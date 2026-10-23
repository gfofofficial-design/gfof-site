-- Unapplied extension after session/cleanup/recovery candidates. No new role,
-- login or external connection. Trusted coordinator verifies independent proof.
revoke delete on public.alliance_profiles,public.alliance_member_owners from authenticated;
revoke execute on function public.alliance_remove_profile() from authenticated;
grant delete on public.alliance_member_owners to alliance_avatar_owner;
create policy alliance_avatar_owner_remove on public.alliance_member_owners for delete to alliance_avatar_owner using(true);
set local role alliance_avatar_owner;
alter table alliance_avatar.operations drop constraint operations_kind_check;
alter table alliance_avatar.operations add constraint operations_kind_check check(kind in('replace','remove','profile_remove'));
alter table alliance_avatar.operations add column removal_actor uuid,add column removal_manifest jsonb;
alter table alliance_avatar.operations add constraint removal_manifest_bound check(
  (removal_actor is null and removal_manifest is null) or
  (removal_actor is not null and removal_manifest is not null and kind in('remove','profile_remove') and jsonb_typeof(removal_manifest)='object' and octet_length(removal_manifest::text)<=4096));
create function alliance_avatar.require_removal_session(p_actor uuid,p_session uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if p_actor is null or p_session is null or not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=p_session and s.user_id=p_actor and u.email_confirmed_at is not null and u.is_anonymous is false and u.deleted_at is null
      and (u.banned_until is null or u.banned_until<=clock_timestamp()) and (s.not_after is null or s.not_after>clock_timestamp())) then
    raise insufficient_privilege using message='avatar_removal_unavailable';end if;
end $$;
create function alliance_avatar.require_no_removal(p_profile uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from alliance_avatar.operations where profile_id=p_profile and removal_manifest is not null and state='uploading') then
    raise insufficient_privilege using message='avatar_removal_pending';end if;
end $$;
create function alliance_avatar.removal_event_id(p_kind text,p_profile uuid,p_subject uuid) returns uuid
language sql immutable security invoker set search_path='' as $$
  select substr(encode(sha256(convert_to('GF-ALLIANCE-REMOVAL-ID-V1','UTF8')||decode('00','hex')||convert_to(p_kind,'UTF8')||decode('00','hex')||convert_to(p_profile::text,'UTF8')||decode('00','hex')||convert_to(p_subject::text,'UTF8')),'hex'),1,32)::uuid;
$$;
create function alliance_avatar.prepare_removal_session(p_actor uuid,p_session uuid,p_operation uuid,p_version bigint,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare pid uuid;op alliance_avatar.operations;h alliance_avatar.heads;objects jsonb;plan jsonb;counter_actor uuid;today date:=(clock_timestamp() at time zone 'UTC')::date;
begin
  perform alliance_avatar.lock_enabled();perform alliance_avatar.require_removal_session(p_actor,p_session);
  if p_operation is null or p_version is null or p_version<0 or p_kind is null or p_kind not in('image','profile') then raise insufficient_privilege using message='avatar_removal_unavailable';end if;
  select * into op from alliance_avatar.operations where id=p_operation;
  if found then
    if op.removal_actor is distinct from p_actor or op.expected_version<>p_version or op.removal_manifest->>'kind' is distinct from p_kind then raise insufficient_privilege using message='avatar_removal_conflict';end if;
    if op.state='committed' then return jsonb_build_object('state','committed','version',op.result_version);end if;
    if op.state<>'uploading' then raise insufficient_privilege using message='avatar_removal_unavailable';end if;
    return jsonb_build_object('state','prepared','plan',op.removal_manifest);
  end if;
  pid:=alliance_avatar.require_session(p_actor,p_session);perform alliance_avatar.require_no_removal(pid);
  insert into alliance_avatar.heads(profile_id) values(pid) on conflict do nothing;
  select * into strict h from alliance_avatar.heads where profile_id=pid;
  if h.removed_at is not null or h.version<>p_version then raise insufficient_privilege using message='avatar_version_conflict';end if;
  -- Include retained deleted/cleanup history, not only today's live pointer.
  -- This finite pilot refuses larger history rather than silently omitting it.
  select coalesce(jsonb_agg(id order by id),'[]'::jsonb) into objects from
    (select id from alliance_avatar.objects where profile_id=pid order by id limit 5)x;
  if p_kind='image' and jsonb_array_length(objects)>4 then raise insufficient_privilege using message='avatar_removal_history_full';end if;
  if p_kind='profile' then objects:='[]'::jsonb;end if;
  if exists(select 1 from alliance_avatar.daily where actor_id=p_actor and day=today and removals>=20)
    or exists(select 1 from alliance_avatar.daily where actor_id='00000000-0000-0000-0000-000000000000' and day=today and removals>=500)
    then raise insufficient_privilege using message='avatar_limit_reached';end if;
  foreach counter_actor in array array[p_actor,'00000000-0000-0000-0000-000000000000'::uuid] loop
    insert into alliance_avatar.daily(actor_id,day,removals) values(counter_actor,today,1) on conflict(actor_id,day) do update set removals=alliance_avatar.daily.removals+1;
  end loop;
  plan:=jsonb_build_object('format',1,'kind',p_kind,'operationId',p_operation,'profileId',pid,'version',p_version,'objectIds',objects);
  insert into alliance_avatar.operations(id,profile_id,kind,expected_version,state,expires_at,removal_actor,removal_manifest)
    values(p_operation,pid,case when p_kind='image' then 'remove' else 'profile_remove' end,p_version,'uploading','infinity',p_actor,plan);
  return jsonb_build_object('state','prepared','plan',plan);
end $$;
create function alliance_avatar.finish_removal_session(p_actor uuid,p_session uuid,p_operation uuid,p_plan jsonb,p_records jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare op alliance_avatar.operations;h alliance_avatar.heads;n integer;
begin
  perform alliance_avatar.lock_enabled();perform alliance_avatar.require_removal_session(p_actor,p_session);
  select * into strict op from alliance_avatar.operations where id=p_operation;
  if op.removal_actor is distinct from p_actor or op.removal_manifest is distinct from p_plan then raise insufficient_privilege using message='avatar_removal_conflict';end if;
  if op.state='committed' then return jsonb_build_object('state','committed','version',op.result_version);end if;
  n:=case when p_plan->>'kind'='profile' then 1 else jsonb_array_length(p_plan->'objectIds') end;
  -- Receipts are accepted only from the trusted executor/coordinator, which has
  -- independently verified their full journal records. SQL cannot verify that
  -- remote commit merely from these hashes; this is not a cryptographic SQL gate.
  if op.state<>'uploading' or jsonb_typeof(p_records) is distinct from 'object' or jsonb_typeof(p_records->'records') is distinct from 'array'
    or p_records is distinct from jsonb_build_object('records',p_records->'records') or jsonb_array_length(p_records->'records')<>n
    or exists(select 1 from jsonb_array_elements(p_records->'records') r where jsonb_typeof(r)<>'object' or
      r is distinct from jsonb_build_object('id',r->'id','sequence',r->'sequence','sha256',r->'sha256') or
      coalesce(r->>'id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' or coalesce(r->>'sha256','') !~ '^[0-9a-f]{64}$' or
      coalesce(r->>'sequence','') !~ '^[1-9][0-9]{0,2}$' or (r->>'sequence')::integer>256)
    or (select count(distinct r->>'id') from jsonb_array_elements(p_records->'records')r)<>n
    or exists(select 1 from jsonb_array_elements(p_records->'records') with ordinality a(r,i) where (r->>'id')::uuid is distinct from
      alliance_avatar.removal_event_id(p_plan->>'kind',op.profile_id,case when p_plan->>'kind'='profile' then op.profile_id else (p_plan->'objectIds'->>((i-1)::integer))::uuid end))
    then raise insufficient_privilege using message='avatar_removal_unavailable';end if;
  if alliance_avatar.require_session(p_actor,p_session)<>op.profile_id then raise insufficient_privilege using message='avatar_removal_unavailable';end if;
  select * into strict h from alliance_avatar.heads where profile_id=op.profile_id;
  if h.version<>op.expected_version or h.removed_at is not null then raise insufficient_privilege using message='avatar_version_conflict';end if;
  if p_plan->>'kind'='profile' then
    delete from public.alliance_member_owners where id=op.profile_id and user_id=p_actor;
    if not found then raise insufficient_privilege using message='avatar_removal_unavailable';end if;
    select * into strict h from alliance_avatar.heads where profile_id=op.profile_id;
  else
    update alliance_avatar.objects set state='cleanup' where id=h.object_id;
    update alliance_avatar.heads set object_id=null,version=version+1 where profile_id=op.profile_id returning * into h;
    update alliance_avatar.objects set state='deleted',deleted_at=clock_timestamp() where profile_id=op.profile_id and state='reserved';
    update alliance_avatar.operations set state='stale' where profile_id=op.profile_id and kind='replace' and state='reserved';
  end if;
  update alliance_avatar.operations set state='committed',result_version=h.version where id=p_operation;
  return jsonb_build_object('state','committed','version',h.version);
end $$;
-- The existing global control-row lock serializes these checks with prepare.
create or replace function alliance_avatar.reserve_session(p_actor uuid,p_session uuid,p_operation uuid,p_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
begin perform alliance_avatar.lock_enabled();perform alliance_avatar.require_no_removal(alliance_avatar.require_visible_session(p_actor,p_session));return alliance_avatar.reserve(p_actor,p_operation,p_version);end $$;
create or replace function alliance_avatar.claim_upload_session(p_actor uuid,p_session uuid,p_operation uuid,p_descriptor jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin perform alliance_avatar.lock_enabled();perform alliance_avatar.require_no_removal(alliance_avatar.require_visible_session(p_actor,p_session));return alliance_avatar.claim_upload(p_actor,p_operation,p_descriptor);end $$;
create or replace function alliance_avatar.commit_upload_session(p_actor uuid,p_session uuid,p_operation uuid,p_result jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin perform alliance_avatar.lock_enabled();perform alliance_avatar.require_no_removal(alliance_avatar.require_visible_session(p_actor,p_session));return alliance_avatar.commit_upload(p_actor,p_operation,p_result);end $$;
create or replace function alliance_avatar.mine_session(p_actor uuid,p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin perform alliance_avatar.require_no_removal(alliance_avatar.require_session(p_actor,p_session));return alliance_avatar.mine(p_actor);end $$;
revoke all on function alliance_avatar.require_removal_session(uuid,uuid),alliance_avatar.require_no_removal(uuid),alliance_avatar.removal_event_id(text,uuid,uuid),alliance_avatar.prepare_removal_session(uuid,uuid,uuid,bigint,text),alliance_avatar.finish_removal_session(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role,alliance_avatar_executor;
grant execute on function alliance_avatar.prepare_removal_session(uuid,uuid,uuid,bigint,text),alliance_avatar.finish_removal_session(uuid,uuid,uuid,jsonb,jsonb) to alliance_avatar_executor;
revoke execute on function alliance_avatar.remove_image_session(uuid,uuid,uuid,bigint) from alliance_avatar_executor;
reset role;
