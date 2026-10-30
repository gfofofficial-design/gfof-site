-- Disabled, unapplied candidate. Requires the profile candidate first.
-- No Storage bucket, Storage metadata mutation, password or login is created.
create role alliance_avatar_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role alliance_avatar_executor nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create schema alliance_avatar authorization alliance_avatar_owner;
revoke all on schema alliance_avatar from public,anon,authenticated,service_role;
grant usage on schema public to alliance_avatar_owner;
grant select(id,user_id) on public.alliance_member_owners to alliance_avatar_owner;
grant select(id) on public.alliance_profiles to alliance_avatar_owner;
create policy alliance_avatar_owner_binding on public.alliance_member_owners for select to alliance_avatar_owner using(true);
create policy alliance_avatar_owner_profile on public.alliance_profiles for select to alliance_avatar_owner using(true);
set local role alliance_avatar_owner;
alter default privileges revoke execute on functions from public;
create table alliance_avatar.control(id boolean primary key default true check(id), enabled boolean not null default false);
insert into alliance_avatar.control values(true,false);
create table alliance_avatar.heads(
  profile_id uuid primary key, version bigint not null default 0 check(version>=0), object_id uuid,
  removed_at timestamptz
);
create table alliance_avatar.operations(
  id uuid primary key, profile_id uuid not null, kind text not null check(kind in('replace','remove')),
  expected_version bigint not null check(expected_version>=0),
  state text not null check(state in('reserved','uploading','committed','stale','cancelled')),
  object_id uuid, expires_at timestamptz not null, created_at timestamptz not null default clock_timestamp(),
  result_version bigint
);
create table alliance_avatar.objects(
  id uuid primary key, profile_id uuid not null,
  state text not null check(state in('reserved','uploading','active','cleanup','deleted')),
  write_settled boolean not null default false, output_bytes integer check(output_bytes between 1 and 307200),
  descriptor jsonb, receipt jsonb, verified boolean not null default false,
  settled_at timestamptz, deletion_receipt jsonb,
  check(not write_settled or (receipt is not null and settled_at is not null)),
  check(not verified or write_settled),
  check(state<>'active' or (write_settled and verified)),
  check(receipt is null or descriptor is not null),
  check(deletion_receipt is null or (state='deleted' and write_settled)),
  created_at timestamptz not null default clock_timestamp(), deleted_at timestamptz
);
create unique index alliance_avatar_one_active on alliance_avatar.objects(profile_id) where state='active';
create index alliance_avatar_outstanding on alliance_avatar.objects(profile_id) where state<>'deleted';
create index alliance_avatar_cleanup on alliance_avatar.objects(id) where state='cleanup' and write_settled;
create unique index alliance_avatar_provider_receipt on alliance_avatar.objects((receipt->>'providerId')) where receipt is not null;
create table alliance_avatar.daily(
  actor_id uuid not null, day date not null, attempts integer not null default 0 check(attempts between 0 and 200),
  removals integer not null default 0 check(removals between 0 and 500),
  primary key(actor_id,day)
);
-- A global zero UUID counter is separate from the actor counters.
do $$ declare t text; begin
  foreach t in array array['control','heads','operations','objects','daily'] loop
    execute format('alter table alliance_avatar.%I enable row level security',t);
    execute format('alter table alliance_avatar.%I force row level security',t);
    execute format('create policy owner_only on alliance_avatar.%I to alliance_avatar_owner using(true) with check(true)',t);
    execute format('revoke all on alliance_avatar.%I from public,anon,authenticated,service_role,alliance_avatar_executor',t);
  end loop;
end $$;

create function alliance_avatar.live_profile(p_actor uuid) returns uuid
language sql stable security invoker set search_path='' as $$
  select p.id from public.alliance_profiles p join public.alliance_member_owners m on m.id=p.id
  where m.user_id=p_actor and p_actor<>'00000000-0000-0000-0000-000000000000'::uuid;
$$;
create function alliance_avatar.lock_enabled() returns void
language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from alliance_avatar.control where id and enabled for update;
  if not found then raise insufficient_privilege using message='avatar_unavailable';end if;
end $$;

create function alliance_avatar.mine(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare pid uuid; h alliance_avatar.heads;
begin
  if not exists(select 1 from alliance_avatar.control where id and enabled) then raise insufficient_privilege using message='avatar_unavailable';end if;
  pid:=alliance_avatar.live_profile(p_actor);
  if pid is null then raise insufficient_privilege using message='avatar_unavailable';end if;
  select * into h from alliance_avatar.heads where profile_id=pid;
  return jsonb_build_object('version',coalesce(h.version,0),'objectId',h.object_id,
    'pending',coalesce((select jsonb_agg(jsonb_build_object('operationId',x.id,'state',x.state,'expiresAt',x.expires_at))
      from(select op.id,op.state,op.expires_at from alliance_avatar.operations op join alliance_avatar.objects obj on obj.id=op.object_id
        where op.profile_id=pid and (op.state in('reserved','uploading') or (obj.state='cleanup' and not obj.write_settled)) order by op.created_at limit 2)x),'[]'::jsonb));
end $$;

create function alliance_avatar.reserve(p_actor uuid,p_operation uuid,p_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare pid uuid; h alliance_avatar.heads; op alliance_avatar.operations; oid uuid;
  today date:=(clock_timestamp() at time zone 'UTC')::date; counter_actor uuid;
begin
  perform alliance_avatar.lock_enabled();pid:=alliance_avatar.live_profile(p_actor);
  if pid is null or p_operation is null or p_version is null or p_version<0 then raise insufficient_privilege using message='avatar_unavailable';end if;
  select * into op from alliance_avatar.operations where id=p_operation;
  if found then
    if op.profile_id<>pid or op.kind<>'replace' or op.expected_version<>p_version then raise insufficient_privilege using message='avatar_operation_conflict';end if;
    return jsonb_build_object('dispatch',false,'state',op.state,'objectId',op.object_id,'version',op.result_version);
  end if;
  insert into alliance_avatar.heads(profile_id) values(pid) on conflict do nothing;
  select * into strict h from alliance_avatar.heads where profile_id=pid;
  if h.removed_at is not null or h.version<>p_version then raise insufficient_privilege using message='avatar_version_conflict';end if;
  if (select count(*) from alliance_avatar.objects where state<>'deleted')>=100
    or (select count(*) from alliance_avatar.objects where state in('reserved','uploading'))>=2
    or (select count(*) from alliance_avatar.objects where profile_id=pid and state<>'deleted')>=2
    or exists(select 1 from alliance_avatar.objects where profile_id=pid and state in('reserved','uploading'))
    or exists(select 1 from alliance_avatar.daily where actor_id=p_actor and day=today and attempts>=10)
    or exists(select 1 from alliance_avatar.daily where actor_id='00000000-0000-0000-0000-000000000000' and day=today and attempts>=200)
    then raise insufficient_privilege using message='avatar_limit_reached';end if;
  foreach counter_actor in array array[p_actor,'00000000-0000-0000-0000-000000000000'::uuid] loop
    insert into alliance_avatar.daily(actor_id,day,attempts) values(counter_actor,today,1)
    on conflict(actor_id,day) do update set attempts=alliance_avatar.daily.attempts+1;
  end loop;
  oid:=pg_catalog.gen_random_uuid();
  insert into alliance_avatar.objects(id,profile_id,state) values(oid,pid,'reserved');
  insert into alliance_avatar.operations(id,profile_id,kind,expected_version,state,object_id,expires_at)
  values(p_operation,pid,'replace',p_version,'reserved',oid,clock_timestamp()+interval '2 minutes');
  return jsonb_build_object('dispatch',true,'state','reserved','objectId',oid);
end $$;

-- Private canonical input helper; executor cannot call it directly.
create function alliance_avatar.valid_descriptor(p_value jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare field text;
begin
  if jsonb_typeof(p_value) is distinct from 'object' or pg_column_size(p_value)>2048 then raise insufficient_privilege using message='avatar_receipt_invalid';end if;
  if not(p_value ?& array['bytes','sha256','width','height','mime']) or p_value-array['bytes','sha256','width','height','mime']<>'{}'::jsonb
    or p_value->'mime' is distinct from '"image/png"'::jsonb or jsonb_typeof(p_value->'sha256') is distinct from 'string'
    or not coalesce(p_value->>'sha256' ~ '^[0-9a-f]{64}$',false) then raise insufficient_privilege using message='avatar_receipt_invalid';end if;
  foreach field in array array['bytes','width','height'] loop
    if jsonb_typeof(p_value->field) is distinct from 'number' or not coalesce(p_value->>field ~ '^[1-9][0-9]{0,5}$',false) then raise insufficient_privilege using message='avatar_receipt_invalid';end if;
  end loop;
  if (p_value->>'bytes')::integer not between 45 and 307200 or (p_value->>'width')::integer>256 or (p_value->>'height')::integer>256 then raise insufficient_privilege using message='avatar_receipt_invalid';end if;
  return p_value;
end $$;

-- This validates trusted gateway evidence against the pre-dispatch descriptor.
-- It does not contact Storage or make browser-supplied receipts authoritative.
create function alliance_avatar.valid_upload_result(p_object uuid,p_result jsonb,p_publish boolean) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare obj alliance_avatar.objects; r jsonb; proof jsonb; is_verified boolean;
begin
  if jsonb_typeof(p_result) is distinct from 'object' or pg_column_size(p_result)>4096 then raise insufficient_privilege using message='avatar_receipt_invalid';end if;
  if p_result->'state'='"stored"'::jsonb and p_result->'verified'='true'::jsonb then is_verified:=true;
  elsif p_result->'state'='"stored_unverified"'::jsonb and p_result->'verified'='false'::jsonb then is_verified:=false;
  else raise insufficient_privilege using message='avatar_receipt_invalid';end if;
  if p_publish and not is_verified then raise insufficient_privilege using message='avatar_receipt_invalid';end if;
  select * into obj from alliance_avatar.objects where id=p_object;
  if not found or obj.descriptor is null then raise insufficient_privilege using message='avatar_receipt_invalid';end if;
  r:=p_result->'receipt';
  if jsonb_typeof(r) is distinct from 'object' or jsonb_typeof(r->'providerId') is distinct from 'string'
    or not coalesce(r->>'providerId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false) then raise insufficient_privilege using message='avatar_receipt_invalid';end if;
  proof:=obj.descriptor||jsonb_build_object('profileId',obj.profile_id,'objectId',obj.id,'key','v1/'||obj.profile_id||'/'||obj.id||'.png','providerId',r->>'providerId');
  if p_result is distinct from jsonb_build_object('state',case when is_verified then 'stored' else 'stored_unverified' end,'writeSettled',true,'verified',is_verified,'receipt',proof)
    or (obj.receipt is not null and obj.receipt<>proof)
    or exists(select 1 from alliance_avatar.objects where id<>obj.id and receipt->>'providerId'=r->>'providerId') then raise insufficient_privilege using message='avatar_receipt_invalid';end if;
  return proof;
end $$;

create function alliance_avatar.claim_upload(p_actor uuid,p_operation uuid,p_descriptor jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare pid uuid; op alliance_avatar.operations; h alliance_avatar.heads; descriptor_value jsonb;
begin
  perform alliance_avatar.lock_enabled();pid:=alliance_avatar.live_profile(p_actor);
  select * into op from alliance_avatar.operations where id=p_operation and profile_id=pid and kind='replace';
  if not found then raise insufficient_privilege using message='avatar_unavailable';end if;
  descriptor_value:=alliance_avatar.valid_descriptor(p_descriptor);
  if exists(select 1 from alliance_avatar.objects where id=op.object_id and descriptor is not null and descriptor<>descriptor_value) then raise insufficient_privilege using message='avatar_receipt_invalid';end if;
  if op.state<>'reserved' then return jsonb_build_object('dispatch',false,'state',op.state);end if;
  select * into strict h from alliance_avatar.heads where profile_id=pid;
  if op.expires_at<=clock_timestamp() or h.removed_at is not null or h.version<>op.expected_version then
    update alliance_avatar.operations set state='stale' where id=op.id;
    update alliance_avatar.objects set state='deleted',deleted_at=clock_timestamp() where id=op.object_id and state='reserved';
    return jsonb_build_object('dispatch',false,'state','stale');
  end if;
  update alliance_avatar.operations set state='uploading' where id=op.id;
  update alliance_avatar.objects set state='uploading',output_bytes=(descriptor_value->>'bytes')::integer,descriptor=descriptor_value where id=op.object_id;
  return jsonb_build_object('dispatch',true,'objectId',op.object_id,'key','v1/'||pid||'/'||op.object_id||'.png');
end $$;

-- Call ONLY after a trusted Storage gateway proves that the sole upload has
-- settled successfully. An abort, timeout, HEAD or missing object is not proof.
create function alliance_avatar.commit_upload(p_actor uuid,p_operation uuid,p_result jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare pid uuid; op alliance_avatar.operations; h alliance_avatar.heads; proof jsonb;
begin
  perform alliance_avatar.lock_enabled();pid:=alliance_avatar.live_profile(p_actor);
  select * into op from alliance_avatar.operations where id=p_operation and kind='replace';
  if not found or pid is null or op.profile_id<>pid then raise insufficient_privilege using message='avatar_unavailable';end if;
  proof:=alliance_avatar.valid_upload_result(op.object_id,p_result,true);
  if op.state<>'uploading' then return jsonb_build_object('state',op.state,'version',op.result_version);end if;
  update alliance_avatar.objects set write_settled=true,receipt=proof,verified=true,settled_at=clock_timestamp() where id=op.object_id;
  select * into strict h from alliance_avatar.heads where profile_id=pid;
  if h.removed_at is not null or h.version<>op.expected_version or op.expires_at<=clock_timestamp() then
    update alliance_avatar.operations set state='stale' where id=op.id;
    update alliance_avatar.objects set state='cleanup' where id=op.object_id;
    return jsonb_build_object('state','stale');
  end if;
  update alliance_avatar.objects set state='cleanup' where id=h.object_id;
  update alliance_avatar.objects set state='active' where id=op.object_id;
  update alliance_avatar.heads set version=version+1,object_id=op.object_id where profile_id=pid returning * into h;
  update alliance_avatar.operations set state='committed',result_version=h.version where id=op.id;
  return jsonb_build_object('state','committed','version',h.version,'objectId',h.object_id);
end $$;

create function alliance_avatar.cancel_reserved(p_actor uuid,p_operation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare pid uuid; op alliance_avatar.operations;
begin
  perform alliance_avatar.lock_enabled();pid:=alliance_avatar.live_profile(p_actor);
  select * into op from alliance_avatar.operations where id=p_operation and profile_id=pid and kind='replace';
  if not found then raise insufficient_privilege using message='avatar_unavailable';end if;
  if op.state='reserved' then
    update alliance_avatar.objects set state='deleted',deleted_at=clock_timestamp() where id=op.object_id;
    update alliance_avatar.operations set state='cancelled' where id=op.id;
    return jsonb_build_object('state','cancelled');
  end if;
  return jsonb_build_object('state',op.state);
end $$;

create function alliance_avatar.remove_image(p_actor uuid,p_operation uuid,p_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare pid uuid; op alliance_avatar.operations; h alliance_avatar.heads;
  today date:=(clock_timestamp() at time zone 'UTC')::date; counter_actor uuid;
begin
  perform alliance_avatar.lock_enabled();pid:=alliance_avatar.live_profile(p_actor);
  if pid is null or p_operation is null or p_version is null or p_version<0 then raise insufficient_privilege using message='avatar_unavailable';end if;
  select * into op from alliance_avatar.operations where id=p_operation;
  if found then
    if op.profile_id<>pid or op.kind<>'remove' or op.expected_version<>p_version then raise insufficient_privilege using message='avatar_operation_conflict';end if;
    return jsonb_build_object('state',op.state,'version',op.result_version);
  end if;
  insert into alliance_avatar.heads(profile_id) values(pid) on conflict do nothing;
  select * into strict h from alliance_avatar.heads where profile_id=pid;
  if h.removed_at is not null or h.version<>p_version then raise insufficient_privilege using message='avatar_version_conflict';end if;
  if exists(select 1 from alliance_avatar.daily where actor_id=p_actor and day=today and removals>=20)
    or exists(select 1 from alliance_avatar.daily where actor_id='00000000-0000-0000-0000-000000000000' and day=today and removals>=500)
    then raise insufficient_privilege using message='avatar_limit_reached';end if;
  foreach counter_actor in array array[p_actor,'00000000-0000-0000-0000-000000000000'::uuid] loop
    insert into alliance_avatar.daily(actor_id,day,removals) values(counter_actor,today,1)
    on conflict(actor_id,day) do update set removals=alliance_avatar.daily.removals+1;
  end loop;
  update alliance_avatar.objects set state='cleanup' where id=h.object_id;
  update alliance_avatar.heads set object_id=null,version=version+1 where profile_id=pid returning * into h;
  update alliance_avatar.objects set state='deleted',deleted_at=clock_timestamp() where profile_id=pid and state='reserved';
  update alliance_avatar.operations set state='stale' where profile_id=pid and state='reserved';
  insert into alliance_avatar.operations(id,profile_id,kind,expected_version,state,expires_at,result_version)
  values(p_operation,pid,'remove',p_version,'committed',clock_timestamp(),h.version);
  return jsonb_build_object('state','committed','version',h.version);
end $$;

-- A confirmed upload that cannot be published (including account removal) can
-- become cleanup-ready. The trusted gateway must prove the write has settled.
create function alliance_avatar.settle_unpublished(p_operation uuid,p_result jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare op alliance_avatar.operations; proof jsonb;
begin
  perform 1 from alliance_avatar.control where id for update;
  select * into op from alliance_avatar.operations where id=p_operation and kind='replace';
  if not found or op.state not in('uploading','stale') then raise insufficient_privilege using message='avatar_unavailable';end if;
  proof:=alliance_avatar.valid_upload_result(op.object_id,p_result,false);
  if exists(select 1 from alliance_avatar.objects where id=op.object_id and state='deleted' and receipt=proof and deletion_receipt is not null) then return;end if;
  update alliance_avatar.objects set state='cleanup',write_settled=true,receipt=proof,verified=(verified or p_result->'verified'='true'::jsonb),settled_at=coalesce(settled_at,clock_timestamp()) where id=op.object_id and state in('uploading','cleanup');
  if not found then raise insufficient_privilege using message='avatar_unavailable';end if;
  update alliance_avatar.operations set state='stale' where id=op.id;
end $$;

-- Runs even while disabled. Detach access immediately; preserve physical cleanup
-- evidence instead of incorrectly assuming a SQL cascade removes Storage files.
create function alliance_avatar.profile_removed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from alliance_avatar.control where id for update;
  update alliance_avatar.heads set object_id=null,version=version+1,removed_at=clock_timestamp() where profile_id=old.id;
  update alliance_avatar.objects set state='deleted',deleted_at=clock_timestamp() where profile_id=old.id and state='reserved';
  update alliance_avatar.objects set state='cleanup' where profile_id=old.id and state in('active','uploading');
  update alliance_avatar.operations set state='stale' where profile_id=old.id and state in('reserved','uploading');
  return old;
end $$;

-- A cleanup worker may only dispatch deletion for confirmed-settled writes.
-- Uncertain uploads retain their slot until a separately reviewed reconciliation.
create function alliance_avatar.expire_batch(p_limit integer default 20) returns integer
language plpgsql security definer set search_path='' as $$
declare op alliance_avatar.operations; expired integer:=0;
begin
  if p_limit is null or p_limit not between 1 and 20 then raise insufficient_privilege using message='avatar_unavailable';end if;
  perform 1 from alliance_avatar.control where id for update;
  for op in select * from alliance_avatar.operations where kind='replace' and state in('reserved','uploading') and expires_at<=clock_timestamp() order by expires_at,id limit p_limit loop
    if op.state='reserved' then
      update alliance_avatar.objects set state='deleted',deleted_at=clock_timestamp() where id=op.object_id;
    else
      update alliance_avatar.objects set state='cleanup' where id=op.object_id;
    end if;
    update alliance_avatar.operations set state='stale' where id=op.id;
    expired:=expired+1;
  end loop;
  return expired;
end $$;
create function alliance_avatar.cleanup_batch(p_limit integer default 20) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if p_limit is null or p_limit not between 1 and 20 then raise insufficient_privilege using message='avatar_unavailable';end if;
  return coalesce((select jsonb_agg(jsonb_build_object('objectId',x.id,'key','v1/'||x.profile_id||'/'||x.id||'.png','writeSettled',true,'receipt',x.receipt))
    from(select id,profile_id,receipt from alliance_avatar.objects where state='cleanup' and write_settled order by id limit p_limit)x),'[]'::jsonb);
end $$;
-- Trusted caller must verify successful Storage API deletion AND absence after
-- settled writes before acknowledging. This never deletes storage.objects SQL.
create function alliance_avatar.ack_deleted(p_object uuid,p_result jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare obj alliance_avatar.objects;
begin
  perform 1 from alliance_avatar.control where id for update;
  select * into obj from alliance_avatar.objects where id=p_object;
  if not found or obj.receipt is null or not obj.write_settled or jsonb_typeof(p_result) is distinct from 'object'
    or p_result is distinct from jsonb_build_object('state','deleted','writeSettled',true,'receipt',obj.receipt) then raise insufficient_privilege using message='avatar_not_removable';end if;
  if exists(select 1 from alliance_avatar.heads where object_id=p_object) then raise insufficient_privilege using message='avatar_not_removable';end if;
  update alliance_avatar.objects set state='deleted',deleted_at=clock_timestamp(),deletion_receipt=p_result where id=p_object and state='cleanup' and write_settled;
  if not found and not exists(select 1 from alliance_avatar.objects where id=p_object and state='deleted' and deletion_receipt=p_result) then raise insufficient_privilege using message='avatar_not_removable';end if;
end $$;

-- Server-only recovery read; no receipt/descriptor is added to the browser DTO.
create function alliance_avatar.operation_receipt(p_actor uuid,p_operation uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare pid uuid; op alliance_avatar.operations; obj alliance_avatar.objects;
begin
  if not exists(select 1 from alliance_avatar.control where id and enabled) then raise insufficient_privilege using message='avatar_unavailable';end if;
  pid:=alliance_avatar.live_profile(p_actor);
  select * into op from alliance_avatar.operations where id=p_operation and profile_id=pid and kind='replace';
  if not found then raise insufficient_privilege using message='avatar_unavailable';end if;
  select * into strict obj from alliance_avatar.objects where id=op.object_id;
  return jsonb_build_object('state',op.state,'profileId',obj.profile_id,'objectId',obj.id,'key','v1/'||obj.profile_id||'/'||obj.id||'.png','writeSettled',obj.write_settled,'verified',obj.verified,'receipt',obj.receipt,'descriptor',obj.descriptor,'deletionReceipt',obj.deletion_receipt);
end $$;

revoke all on all tables in schema alliance_avatar from public,anon,authenticated,service_role,alliance_avatar_executor;
revoke all on all functions in schema alliance_avatar from public,anon,authenticated,service_role,alliance_avatar_executor;
grant usage on schema alliance_avatar to alliance_avatar_executor;
grant execute on function alliance_avatar.mine(uuid),alliance_avatar.reserve(uuid,uuid,bigint),alliance_avatar.claim_upload(uuid,uuid,jsonb),alliance_avatar.commit_upload(uuid,uuid,jsonb),alliance_avatar.cancel_reserved(uuid,uuid),alliance_avatar.remove_image(uuid,uuid,bigint),alliance_avatar.settle_unpublished(uuid,jsonb),alliance_avatar.expire_batch(integer),alliance_avatar.cleanup_batch(integer),alliance_avatar.ack_deleted(uuid,jsonb),alliance_avatar.operation_receipt(uuid,uuid) to alliance_avatar_executor;
reset role;
create trigger alliance_avatar_profile_removed after delete on public.alliance_profiles for each row execute function alliance_avatar.profile_removed();
