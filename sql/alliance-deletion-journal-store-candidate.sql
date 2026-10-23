-- UNAPPLIED candidate for a separately approved independent project/restore domain.
-- Never install beside the member ledger or restore it from a member backup.
do $$ begin
  if current_database()<>'postgres' or to_regnamespace('alliance_avatar') is not null
    or to_regclass('public.alliance_member_owners') is not null then
    raise exception 'Dedicated journal database required';end if;
end $$;
create role alliance_journal_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role alliance_journal_executor nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create schema alliance_journal authorization alliance_journal_owner;
revoke all on schema alliance_journal from public,anon,authenticated,service_role;
set local role alliance_journal_owner;
alter default privileges revoke execute on functions from public;
create table alliance_journal.control(
  id boolean primary key default true check(id), enabled boolean not null default false,
  project_ref text check(project_ref ~ '^[a-z0-9]{20}$'), epoch uuid,
  sequence integer not null default 0 check(sequence between 0 and 256),
  sha256 text not null default repeat('0',64) check(sha256 ~ '^[0-9a-f]{64}$'),
  check((project_ref is null and epoch is null and not enabled and sequence=0) or (project_ref is not null and epoch is not null)),
  check(sequence<>0 or sha256=repeat('0',64))
);
insert into alliance_journal.control(id) values(true);
create table alliance_journal.entries(
  sequence integer primary key check(sequence between 1 and 256),
  event_id uuid not null unique, kind text not null check(kind in('profile_remove_requested','image_remove_requested')),
  profile_id uuid not null, object_id uuid,
  previous text not null check(previous ~ '^[0-9a-f]{64}$'),
  sha256 text not null unique check(sha256 ~ '^[0-9a-f]{64}$'),
  check((kind='profile_remove_requested' and object_id is null) or (kind='image_remove_requested' and object_id is not null))
);
do $$ declare t text; begin foreach t in array array['control','entries'] loop
  execute format('alter table alliance_journal.%I enable row level security',t);
  execute format('alter table alliance_journal.%I force row level security',t);
  execute format('create policy owner_only on alliance_journal.%I to alliance_journal_owner using(true) with check(true)',t);
  execute format('revoke all on alliance_journal.%I from public,anon,authenticated,service_role,alliance_journal_executor',t);
end loop;end $$;
create function alliance_journal.tip_value(c alliance_journal.control) returns jsonb
language sql immutable security invoker set search_path='' as $$
  select jsonb_build_object('projectRef',c.project_ref,'epoch',c.epoch,'sequence',c.sequence,'sha256',c.sha256,'enabled',c.enabled);
$$;
create function alliance_journal.record_value(c alliance_journal.control,e alliance_journal.entries) returns jsonb
language sql immutable security invoker set search_path='' as $$
  select jsonb_build_object('format',1,'projectRef',c.project_ref,'epoch',c.epoch,'sequence',e.sequence,'previous',e.previous,
    'event',jsonb_build_object('id',e.event_id,'kind',e.kind,'profileId',e.profile_id,'objectId',e.object_id),'sha256',e.sha256);
$$;
create function alliance_journal.tip(p_ref text,p_epoch uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c alliance_journal.control;begin
  select * into strict c from alliance_journal.control where id;
  if c.project_ref is distinct from p_ref or c.epoch is distinct from p_epoch or p_ref is null or p_epoch is null then raise insufficient_privilege using message='journal_unavailable';end if;
  return alliance_journal.tip_value(c);
end $$;
create function alliance_journal.lookup(p_ref text,p_epoch uuid,p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c alliance_journal.control;e alliance_journal.entries;begin
  perform alliance_journal.tip(p_ref,p_epoch);select * into strict c from alliance_journal.control where id;
  select * into e from alliance_journal.entries where event_id=p_id;
  if not found then return jsonb_build_object('state','missing');end if;
  return jsonb_build_object('state','recorded','record',alliance_journal.record_value(c,e),'tip',alliance_journal.tip_value(c));
end $$;
create function alliance_journal.append(p_ref text,p_epoch uuid,p_sequence integer,p_hash text,p_event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c alliance_journal.control;e alliance_journal.entries; v_id uuid;v_profile uuid;v_object uuid;v_kind text;body text;digest text;
begin
  if current_setting('synchronous_commit')<>'on' or current_setting('fsync')<>'on' or current_setting('full_page_writes')<>'on' then raise insufficient_privilege using message='journal_unavailable';end if;
  if p_sequence is null or p_sequence not between 0 and 256 or p_hash is null or p_hash !~ '^[0-9a-f]{64}$'
    or p_event is null or jsonb_typeof(p_event)<>'object' or (select count(*) from jsonb_object_keys(p_event))<>4
    or not(p_event ?& array['id','kind','profileId','objectId']) then raise insufficient_privilege using message='journal_unavailable';end if;
  if jsonb_typeof(p_event->'id')<>'string' or p_event->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(p_event->'profileId')<>'string' or p_event->>'profileId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(p_event->'kind')<>'string' or p_event->>'kind' not in('profile_remove_requested','image_remove_requested') then raise insufficient_privilege using message='journal_unavailable';end if;
  v_kind:=p_event->>'kind';v_id:=(p_event->>'id')::uuid;v_profile:=(p_event->>'profileId')::uuid;
  if v_kind='profile_remove_requested' then
    if p_event->'objectId'<>'null'::jsonb then raise insufficient_privilege using message='journal_unavailable';end if;
  else
    if jsonb_typeof(p_event->'objectId')<>'string' or p_event->>'objectId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise insufficient_privilege using message='journal_unavailable';end if;
    v_object:=(p_event->>'objectId')::uuid;
  end if;
  select * into strict c from alliance_journal.control where id for update;
  if p_ref is null or p_epoch is null or c.project_ref is distinct from p_ref or c.epoch is distinct from p_epoch then raise insufficient_privilege using message='journal_unavailable';end if;
  if not c.enabled then return jsonb_build_object('state','paused','tip',alliance_journal.tip_value(c));end if;
  select * into e from alliance_journal.entries x where x.event_id=v_id;
  if found then
    if e.kind<>v_kind or e.profile_id<>v_profile or e.object_id is distinct from v_object then raise insufficient_privilege using message='journal_event_conflict';end if;
    return jsonb_build_object('state','recorded','record',alliance_journal.record_value(c,e),'tip',alliance_journal.tip_value(c));
  end if;
  if c.sequence<>p_sequence or c.sha256<>p_hash then return jsonb_build_object('state','conflict','tip',alliance_journal.tip_value(c));end if;
  if c.sequence=256 then return jsonb_build_object('state','full','tip',alliance_journal.tip_value(c));end if;
  -- Same fixed ASCII field order as deletionRecord(), not jsonb text ordering.
  body:=format('{"format":1,"projectRef":"%s","epoch":"%s","sequence":%s,"previous":"%s","event":{"id":"%s","kind":"%s","profileId":"%s","objectId":%s}}',
    c.project_ref,c.epoch,c.sequence+1,c.sha256,v_id,v_kind,v_profile,case when v_object is null then 'null' else '"'||v_object::text||'"' end);
  digest:=encode(sha256(convert_to('GF-ALLIANCE-DELETION-RECORD-V1','UTF8')||decode('00','hex')||convert_to(body,'UTF8')),'hex');
  insert into alliance_journal.entries values(c.sequence+1,v_id,v_kind,v_profile,v_object,c.sha256,digest) returning * into e;
  update alliance_journal.control set sequence=e.sequence,sha256=digest where id returning * into c;
  return jsonb_build_object('state','recorded','record',alliance_journal.record_value(c,e),'tip',alliance_journal.tip_value(c));
end $$;
create function alliance_journal.records(p_ref text,p_epoch uuid,p_through integer,p_hash text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c alliance_journal.control;h text;out jsonb;begin
  perform alliance_journal.tip(p_ref,p_epoch);select * into strict c from alliance_journal.control where id;
  if p_through is null or p_through not between 0 and 256 or p_through>c.sequence or p_hash is null then raise insufficient_privilege using message='journal_unavailable';end if;
  if p_through=0 then h:=repeat('0',64);else select sha256 into strict h from alliance_journal.entries where sequence=p_through;end if;
  if h<>p_hash then raise insufficient_privilege using message='journal_unavailable';end if;
  select coalesce(jsonb_agg(alliance_journal.record_value(c,e) order by e.sequence),'[]'::jsonb) into out from alliance_journal.entries e where e.sequence<=p_through;
  return out;
end $$;
revoke all on all functions in schema alliance_journal from public,anon,authenticated,service_role,alliance_journal_executor;
grant usage on schema alliance_journal to alliance_journal_executor;
grant execute on function alliance_journal.tip(text,uuid),alliance_journal.lookup(text,uuid,uuid),alliance_journal.append(text,uuid,integer,text,jsonb),alliance_journal.records(text,uuid,integer,text) to alliance_journal_executor;
reset role;
