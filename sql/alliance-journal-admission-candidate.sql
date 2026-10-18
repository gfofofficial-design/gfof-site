-- UNAPPLIED extension: install only on an empty, disabled independent journal.
-- Reservations are permanent finite-test capacity, not an adopted retention policy.
do $$ begin
  if current_database()<>'postgres' or to_regnamespace('alliance_avatar') is not null
    or to_regclass('public.alliance_member_owners') is not null
    or exists(select 1 from alliance_journal.entries)
    or not exists(select 1 from alliance_journal.control where not enabled and project_ref is null and epoch is null and sequence=0 and sha256=repeat('0',64)) then
    raise exception 'Empty disabled journal required';end if;
end $$;
set local role alliance_journal_owner;
alter table alliance_journal.control add column admission_enabled boolean not null default false;
create table alliance_journal.admissions(
  slot smallint not null unique check(slot between 1 and 256),
  event_id uuid primary key, kind text not null check(kind in('profile_remove_requested','image_remove_requested')),
  profile_id uuid not null,object_id uuid,
  check((kind='profile_remove_requested' and object_id is null) or (kind='image_remove_requested' and object_id is not null))
);
create unique index admission_profile on alliance_journal.admissions(profile_id) where kind='profile_remove_requested';
create unique index admission_object on alliance_journal.admissions(object_id) where object_id is not null;
alter table alliance_journal.admissions enable row level security;
alter table alliance_journal.admissions force row level security;
create policy owner_only on alliance_journal.admissions to alliance_journal_owner using(true) with check(true);
revoke all on alliance_journal.admissions from public,anon,authenticated,service_role,alliance_journal_executor;
alter table alliance_journal.entries add constraint journal_admitted foreign key(event_id) references alliance_journal.admissions(event_id);

create function alliance_journal.admission_event(p_event jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare v_profile text;v_subject text;v_kind text;h text;v_id uuid;
begin
  if p_event is null or jsonb_typeof(p_event)<>'object' or (select count(*) from jsonb_object_keys(p_event))<>4
    or not(p_event ?& array['id','kind','profileId','objectId']) then raise insufficient_privilege using message='journal_unavailable';end if;
  if jsonb_typeof(p_event->'id')<>'string' or p_event->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(p_event->'profileId')<>'string' or p_event->>'profileId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(p_event->'kind')<>'string' or p_event->>'kind' not in('profile_remove_requested','image_remove_requested') then raise insufficient_privilege using message='journal_unavailable';end if;
  v_profile:=p_event->>'profileId';v_id:=(p_event->>'id')::uuid;
  if p_event->>'kind'='profile_remove_requested' then
    if p_event->'objectId'<>'null'::jsonb then raise insufficient_privilege using message='journal_unavailable';end if;
    v_kind:='profile';v_subject:=v_profile;
  else
    if jsonb_typeof(p_event->'objectId')<>'string' or p_event->>'objectId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise insufficient_privilege using message='journal_unavailable';end if;
    v_kind:='image';v_subject:=p_event->>'objectId';
  end if;
  h:=encode(sha256(convert_to('GF-ALLIANCE-REMOVAL-ID-V1','UTF8')||decode('00','hex')||convert_to(v_kind,'UTF8')||decode('00','hex')||convert_to(v_profile,'UTF8')||decode('00','hex')||convert_to(v_subject,'UTF8')),'hex');
  if v_id<>substr(h,1,32)::uuid then raise insufficient_privilege using message='journal_unavailable';end if;
  return p_event;
end $$;
create function alliance_journal.admission(p_ref text,p_epoch uuid,p_event jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a alliance_journal.admissions;e jsonb;
begin
  perform alliance_journal.tip(p_ref,p_epoch);e:=alliance_journal.admission_event(p_event);
  select * into a from alliance_journal.admissions where event_id=(e->>'id')::uuid;
  if not found then return jsonb_build_object('state','missing');end if;
  if a.kind<>e->>'kind' or a.profile_id<>(e->>'profileId')::uuid or a.object_id is distinct from (e->>'objectId')::uuid then raise insufficient_privilege using message='journal_event_conflict';end if;
  if exists(select 1 from alliance_journal.entries where event_id=a.event_id) then return jsonb_build_object('state','removed');end if;
  return jsonb_build_object('state','admitted','event',e);
end $$;
create function alliance_journal.admit(p_ref text,p_epoch uuid,p_event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c alliance_journal.control;e jsonb;prior jsonb;n integer;parent uuid;
begin
  if current_setting('synchronous_commit')<>'on' or current_setting('fsync')<>'on' or current_setting('full_page_writes')<>'on' then raise insufficient_privilege using message='journal_unavailable';end if;
  perform alliance_journal.tip(p_ref,p_epoch);e:=alliance_journal.admission_event(p_event);
  select * into strict c from alliance_journal.control where id for update;
  if not c.enabled or not c.admission_enabled then return jsonb_build_object('state','paused');end if;
  if e->>'kind'='image_remove_requested' then
    select event_id into parent from alliance_journal.admissions where kind='profile_remove_requested' and profile_id=(e->>'profileId')::uuid;
    if not found then return jsonb_build_object('state','profile_required');end if;
    if exists(select 1 from alliance_journal.entries where event_id=parent) then return jsonb_build_object('state','removed');end if;
  end if;
  prior:=alliance_journal.admission(p_ref,p_epoch,e);
  if prior->>'state'<>'missing' then return prior;end if;
  if e->>'kind'='image_remove_requested' and (select count(*) from alliance_journal.admissions where kind='image_remove_requested' and profile_id=(e->>'profileId')::uuid)>=4 then return jsonb_build_object('state','history_full');end if;
  select count(*) into n from alliance_journal.admissions;
  if n=256 then return jsonb_build_object('state','full');end if;
  insert into alliance_journal.admissions values(n+1,(e->>'id')::uuid,e->>'kind',(e->>'profileId')::uuid,(e->>'objectId')::uuid);
  return jsonb_build_object('state','admitted','event',e);
end $$;

-- Preserve the original hash-chain implementation privately, without allowing
-- the restricted caller to bypass canonical reservation binding.
alter function alliance_journal.append(text,uuid,integer,text,jsonb) rename to append_unreserved;
revoke all on function alliance_journal.append_unreserved(text,uuid,integer,text,jsonb) from public,anon,authenticated,service_role,alliance_journal_executor;
create function alliance_journal.append(p_ref text,p_epoch uuid,p_sequence integer,p_hash text,p_event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c alliance_journal.control;e jsonb;proof jsonb;
begin
  perform alliance_journal.tip(p_ref,p_epoch);e:=alliance_journal.admission_event(p_event);
  select * into strict c from alliance_journal.control where id for update;
  -- Closing admission stops NEW reservations, never later deletion of an
  -- already admitted subject. The existing master switch still pauses appends.
  proof:=alliance_journal.admission(p_ref,p_epoch,e);
  if proof->>'state' not in('admitted','removed') then raise insufficient_privilege using message='journal_admission_required';end if;
  return alliance_journal.append_unreserved(p_ref,p_epoch,p_sequence,p_hash,e);
end $$;
revoke all on function alliance_journal.admission_event(jsonb),alliance_journal.admission(text,uuid,jsonb),alliance_journal.admit(text,uuid,jsonb),alliance_journal.append(text,uuid,integer,text,jsonb) from public,anon,authenticated,service_role,alliance_journal_executor;
grant execute on function alliance_journal.admission(text,uuid,jsonb),alliance_journal.admit(text,uuid,jsonb),alliance_journal.append(text,uuid,integer,text,jsonb) to alliance_journal_executor;
reset role;
