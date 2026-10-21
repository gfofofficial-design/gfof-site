-- UNAPPLIED, default-off extension after avatar removal. Empty member store only.
-- Trusted server verifies the remote journal COMMIT; SQL cannot contact it.
do $$ begin
  if exists(select 1 from public.alliance_member_owners) or exists(select 1 from public.alliance_profiles)
    or exists(select 1 from alliance_avatar.objects) or exists(select 1 from alliance_avatar.operations)
    or exists(select 1 from alliance_avatar.control where enabled) then raise exception 'Empty disabled member store required';end if;
end $$;
revoke insert,update on public.alliance_profiles,public.alliance_member_owners from authenticated;
revoke insert(user_id) on public.alliance_member_owners from authenticated;
revoke insert(id,display_name,community,bio,contribution_role,listed),update(display_name,community,bio,contribution_role,listed) on public.alliance_profiles from authenticated;
revoke execute on function public.alliance_save_profile(text,text,text,text,boolean) from authenticated;
grant insert(id,user_id) on public.alliance_member_owners to alliance_avatar_owner;
grant select(id,display_name,community,bio,contribution_role,listed,moderation_state,created_at,updated_at),
  insert(id,display_name,community,bio,contribution_role,listed),update(display_name,community,bio,contribution_role,listed) on public.alliance_profiles to alliance_avatar_owner;
create policy alliance_creation_owner_insert on public.alliance_member_owners for insert to alliance_avatar_owner with check(true);
create policy alliance_creation_profile_insert on public.alliance_profiles for insert to alliance_avatar_owner with check(true);
create policy alliance_creation_profile_update on public.alliance_profiles for update to alliance_avatar_owner using(true) with check(true);
set local role alliance_avatar_owner;
alter table alliance_avatar.control add column creation_enabled boolean not null default false;
create table alliance_avatar.creation_plans(
  slot smallint not null unique check(slot between 1 and 256),
  kind text not null check(kind in('profile','image')),actor_id uuid not null,
  profile_id uuid not null,object_id uuid unique,operation_id uuid unique,
  version bigint not null check(version>=0),activated boolean not null default false,
  check((kind='profile' and object_id is null and operation_id is null and version=0) or (kind='image' and object_id is not null and operation_id is not null))
);
create unique index creation_profile_actor on alliance_avatar.creation_plans(actor_id) where kind='profile';
create unique index creation_profile_identity on alliance_avatar.creation_plans(profile_id) where kind='profile';
alter table alliance_avatar.creation_plans enable row level security;
alter table alliance_avatar.creation_plans force row level security;
create policy owner_only on alliance_avatar.creation_plans to alliance_avatar_owner using(true) with check(true);
revoke all on alliance_avatar.creation_plans from public,anon,authenticated,service_role,alliance_avatar_executor;
create function alliance_avatar.creation_plan(p alliance_avatar.creation_plans) returns jsonb
language sql immutable security invoker set search_path='' as $$ select jsonb_build_object('kind',p.kind,'profileId',p.profile_id,'objectId',p.object_id,'operationId',p.operation_id,'version',p.version) $$;
create function alliance_avatar.creation_live(p_actor uuid,p_session uuid) returns void
language plpgsql security invoker set search_path='' as $$ begin
  if current_setting('synchronous_commit')<>'on' or current_setting('fsync')<>'on' or current_setting('full_page_writes')<>'on'
    or p_actor='00000000-0000-0000-0000-000000000000'::uuid then raise insufficient_privilege using message='creation_unavailable';end if;
  perform alliance_avatar.lock_enabled();perform alliance_avatar.require_removal_session(p_actor,p_session);
  if not exists(select 1 from alliance_avatar.control where id and creation_enabled) then raise insufficient_privilege using message='creation_unavailable';end if;
end $$;
create function alliance_avatar.check_creation_plan(p_actor uuid,p_plan jsonb) returns alliance_avatar.creation_plans
language plpgsql stable security invoker set search_path='' as $$ declare p alliance_avatar.creation_plans;begin
  if jsonb_typeof(p_plan) is distinct from 'object' then raise insufficient_privilege using message='creation_unavailable';end if;
  select * into p from alliance_avatar.creation_plans where actor_id=p_actor and profile_id=(p_plan->>'profileId')::uuid
    and kind=p_plan->>'kind' and object_id is not distinct from (p_plan->>'objectId')::uuid;
  if not found or alliance_avatar.creation_plan(p) is distinct from p_plan then raise insufficient_privilege using message='creation_unavailable';end if;
  perform alliance_avatar.require_no_removal(p.profile_id);
  if exists(select 1 from alliance_avatar.heads where profile_id=p.profile_id and removed_at is not null) then raise insufficient_privilege using message='creation_removed';end if;
  return p;
end $$;
create function alliance_avatar.check_creation_event(p alliance_avatar.creation_plans,p_event jsonb) returns void
language plpgsql immutable security invoker set search_path='' as $$ begin
  if p_event is distinct from jsonb_build_object('id',alliance_avatar.removal_event_id(p.kind,p.profile_id,coalesce(p.object_id,p.profile_id)),
    'kind',case when p.kind='profile' then 'profile_remove_requested' else 'image_remove_requested' end,'profileId',p.profile_id,'objectId',p.object_id)
  then raise insufficient_privilege using message='creation_admission_required';end if;
end $$;
create function alliance_avatar.prepare_profile_session(p_actor uuid,p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ declare p alliance_avatar.creation_plans;n integer;begin
  perform alliance_avatar.creation_live(p_actor,p_session);
  select * into p from alliance_avatar.creation_plans where actor_id=p_actor and kind='profile';
  if not found then
    select count(*) into n from alliance_avatar.creation_plans;if n>=256 then raise insufficient_privilege using message='creation_full';end if;
    insert into alliance_avatar.creation_plans(slot,kind,actor_id,profile_id,version) values(n+1,'profile',p_actor,gen_random_uuid(),0) returning * into p;
  end if;
  perform alliance_avatar.check_creation_plan(p_actor,alliance_avatar.creation_plan(p));return alliance_avatar.creation_plan(p);
end $$;
create function alliance_avatar.prepare_image_session(p_actor uuid,p_session uuid,p_operation uuid,p_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$ declare p alliance_avatar.creation_plans;pid uuid;h alliance_avatar.heads;n integer;begin
  perform alliance_avatar.creation_live(p_actor,p_session);pid:=alliance_avatar.require_visible_session(p_actor,p_session);perform alliance_avatar.require_no_removal(pid);
  if p_operation is null or p_version is null or p_version<0 then raise insufficient_privilege using message='creation_unavailable';end if;
  select * into p from alliance_avatar.creation_plans where operation_id=p_operation;
  if found then
    if p.actor_id<>p_actor or p.profile_id<>pid or p.version<>p_version then raise insufficient_privilege using message='creation_conflict';end if;
    perform alliance_avatar.check_creation_plan(p_actor,alliance_avatar.creation_plan(p));return alliance_avatar.creation_plan(p);
  end if;
  select * into h from alliance_avatar.heads where profile_id=pid;
  if h.removed_at is not null or coalesce(h.version,0)<>p_version then raise insufficient_privilege using message='creation_conflict';end if;
  if not exists(select 1 from alliance_avatar.creation_plans where kind='profile' and profile_id=pid and actor_id=p_actor and activated)
    or (select count(*) from alliance_avatar.creation_plans where kind='image' and profile_id=pid)>=4 then raise insufficient_privilege using message='creation_full';end if;
  select count(*) into n from alliance_avatar.creation_plans;if n>=256 then raise insufficient_privilege using message='creation_full';end if;
  insert into alliance_avatar.creation_plans(slot,kind,actor_id,profile_id,object_id,operation_id,version) values(n+1,'image',p_actor,pid,gen_random_uuid(),p_operation,p_version) returning * into p;
  return alliance_avatar.creation_plan(p);
end $$;
create function alliance_avatar.creation_status_session(p_actor uuid,p_session uuid,p_kind text,p_operation uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$ declare p alliance_avatar.creation_plans;begin
  perform alliance_avatar.require_removal_session(p_actor,p_session);
  if p_kind is null or p_kind not in('profile','image') or p_operation is null or (p_kind='profile')<>(p_operation='00000000-0000-0000-0000-000000000000'::uuid) then raise insufficient_privilege using message='creation_unavailable';end if;
  select * into p from alliance_avatar.creation_plans where actor_id=p_actor and kind=p_kind and (case when p_kind='profile' then operation_id is null else operation_id=p_operation end);
  if not found then return null;end if;
  return alliance_avatar.creation_plan(p);
end $$;
create function alliance_avatar.finish_profile_session(p_actor uuid,p_session uuid,p_plan jsonb,p_input jsonb,p_event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$ declare p alliance_avatar.creation_plans;s public.alliance_profiles;begin
  perform alliance_avatar.creation_live(p_actor,p_session);p:=alliance_avatar.check_creation_plan(p_actor,p_plan);
  if p.kind<>'profile' then raise insufficient_privilege using message='creation_unavailable';end if;
  perform alliance_avatar.check_creation_event(p,p_event);
  if jsonb_typeof(p_input) is distinct from 'object' or not(p_input ?& array['name','community','bio','role','listed']) or p_input-array['name','community','bio','role','listed']<>'{}'::jsonb
    or jsonb_typeof(p_input->'listed') is distinct from 'boolean' or jsonb_typeof(p_input->'name') is distinct from 'string'
    or jsonb_typeof(p_input->'community') is distinct from 'string' or jsonb_typeof(p_input->'bio') is distinct from 'string' or jsonb_typeof(p_input->'role') is distinct from 'string' then raise insufficient_privilege using message='creation_unavailable';end if;
  if p.activated and not exists(select 1 from public.alliance_member_owners where id=p.profile_id and user_id=p_actor) then raise insufficient_privilege using message='creation_removed';end if;
  insert into public.alliance_member_owners(id,user_id) values(p.profile_id,p_actor) on conflict(id) do nothing;
  if not exists(select 1 from public.alliance_member_owners where id=p.profile_id and user_id=p_actor) then raise insufficient_privilege using message='creation_conflict';end if;
  insert into public.alliance_profiles(id,display_name,community,bio,contribution_role,listed)
    values(p.profile_id,p_input->>'name',p_input->>'community',p_input->>'bio',p_input->>'role',(p_input->>'listed')::boolean)
    on conflict(id) do update set display_name=excluded.display_name,community=excluded.community,bio=excluded.bio,contribution_role=excluded.contribution_role,listed=excluded.listed returning * into s;
  update alliance_avatar.creation_plans set activated=true where kind='profile' and actor_id=p_actor;
  return jsonb_build_object('id',s.id,'name',s.display_name,'community',s.community,'bio',s.bio,'role',s.contribution_role,'listed',s.listed,'publication',case when s.moderation_state='held' then 'held' when s.listed then 'listed' else 'private' end,'updatedAt',s.updated_at);
end $$;
create function alliance_avatar.finish_image_session(p_actor uuid,p_session uuid,p_plan jsonb,p_event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$ declare p alliance_avatar.creation_plans;h alliance_avatar.heads;op alliance_avatar.operations;
today date:=(clock_timestamp() at time zone 'UTC')::date;counter_actor uuid;begin
  perform alliance_avatar.creation_live(p_actor,p_session);p:=alliance_avatar.check_creation_plan(p_actor,p_plan);
  if p.kind<>'image' or alliance_avatar.require_visible_session(p_actor,p_session)<>p.profile_id then raise insufficient_privilege using message='creation_unavailable';end if;
  perform alliance_avatar.check_creation_event(p,p_event);
  select * into op from alliance_avatar.operations where id=p.operation_id;
  if found then
    if op.profile_id<>p.profile_id or op.kind<>'replace' or op.expected_version<>p.version or op.object_id<>p.object_id then raise insufficient_privilege using message='creation_conflict';end if;
    return jsonb_build_object('dispatch',false,'state',op.state,'objectId',op.object_id,'version',op.result_version);
  end if;
  if p.activated then raise insufficient_privilege using message='creation_unavailable';end if;
  insert into alliance_avatar.heads(profile_id) values(p.profile_id) on conflict do nothing;select * into strict h from alliance_avatar.heads where profile_id=p.profile_id;
  if h.removed_at is not null or h.version<>p.version then raise insufficient_privilege using message='creation_conflict';end if;
  if (select count(*) from alliance_avatar.objects where state<>'deleted')>=100 or (select count(*) from alliance_avatar.objects where state in('reserved','uploading'))>=2
    or (select count(*) from alliance_avatar.objects where profile_id=p.profile_id and state<>'deleted')>=2
    or exists(select 1 from alliance_avatar.objects where profile_id=p.profile_id and state in('reserved','uploading'))
    or exists(select 1 from alliance_avatar.daily where actor_id=p_actor and day=today and attempts>=10)
    or exists(select 1 from alliance_avatar.daily where actor_id='00000000-0000-0000-0000-000000000000' and day=today and attempts>=200) then raise insufficient_privilege using message='creation_full';end if;
  foreach counter_actor in array array[p_actor,'00000000-0000-0000-0000-000000000000'::uuid] loop
    insert into alliance_avatar.daily(actor_id,day,attempts) values(counter_actor,today,1) on conflict(actor_id,day) do update set attempts=alliance_avatar.daily.attempts+1;
  end loop;
  insert into alliance_avatar.objects(id,profile_id,state) values(p.object_id,p.profile_id,'reserved');
  insert into alliance_avatar.operations(id,profile_id,kind,expected_version,state,object_id,expires_at) values(p.operation_id,p.profile_id,'replace',p.version,'reserved',p.object_id,clock_timestamp()+interval '2 minutes');
  update alliance_avatar.creation_plans set activated=true where operation_id=p.operation_id;
  return jsonb_build_object('dispatch',true,'state','reserved','objectId',p.object_id);
end $$;
revoke all on function alliance_avatar.creation_plan(alliance_avatar.creation_plans),alliance_avatar.creation_live(uuid,uuid),alliance_avatar.check_creation_plan(uuid,jsonb),alliance_avatar.check_creation_event(alliance_avatar.creation_plans,jsonb),alliance_avatar.prepare_profile_session(uuid,uuid),alliance_avatar.prepare_image_session(uuid,uuid,uuid,bigint),alliance_avatar.creation_status_session(uuid,uuid,text,uuid),alliance_avatar.finish_profile_session(uuid,uuid,jsonb,jsonb,jsonb),alliance_avatar.finish_image_session(uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role,alliance_avatar_executor;
grant execute on function alliance_avatar.prepare_profile_session(uuid,uuid),alliance_avatar.prepare_image_session(uuid,uuid,uuid,bigint),alliance_avatar.creation_status_session(uuid,uuid,text,uuid),alliance_avatar.finish_profile_session(uuid,uuid,jsonb,jsonb,jsonb),alliance_avatar.finish_image_session(uuid,uuid,jsonb,jsonb) to alliance_avatar_executor;
revoke execute on function alliance_avatar.reserve_session(uuid,uuid,uuid,bigint),alliance_avatar.reserve(uuid,uuid,bigint) from alliance_avatar_executor;
reset role;
