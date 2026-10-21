-- UNAPPLIED. Dedicated THIRD restore domain only; no public/client access.
-- This durable row is not protection against a privileged database rollback.
do $$ begin
 if current_database()<>'postgres' or to_regnamespace('alliance_avatar') is not null or to_regnamespace('alliance_journal') is not null or to_regclass('public.alliance_member_owners') is not null then raise exception 'Dedicated control database required';end if;
end $$;
create role alliance_control_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role alliance_control_reader nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role alliance_control_operator nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create schema alliance_control authorization alliance_control_owner;
revoke all on schema alliance_control from public,anon,authenticated,service_role;
set local role alliance_control_owner;
alter default privileges revoke execute on functions from public;
create table alliance_control.policy(
 id boolean primary key default true check(id),
 member_ref text check(member_ref ~ '^[a-z0-9]{20}$'),journal_ref text check(journal_ref ~ '^[a-z0-9]{20}$'),epoch uuid,
 revision integer not null default 0 check(revision between 0 and 2147483646),state text not null default 'closed' check(state in('closed','review','serve')),change_id uuid,
 freeze_id uuid,frozen_at timestamptz,checkpoint_sha256 text check(checkpoint_sha256 ~ '^[0-9a-f]{64}$'),
 floor_sequence integer not null default 0 check(floor_sequence between 0 and 256),floor_sha256 text not null default repeat('0',64) check(floor_sha256 ~ '^[0-9a-f]{64}$'),
 check(member_ref is distinct from journal_ref or member_ref is null),
 check((revision=0 and member_ref is null and journal_ref is null and epoch is null and change_id is null and state='closed') or (revision>0 and member_ref is not null and journal_ref is not null and epoch is not null and change_id is not null)),
 check((freeze_id is null and frozen_at is null and checkpoint_sha256 is null and state='closed' and floor_sequence=0) or (freeze_id is not null and frozen_at is not null and checkpoint_sha256 is not null)),
 check(frozen_at is null or (isfinite(frozen_at) and frozen_at>='1970-01-01 UTC' and date_trunc('milliseconds',frozen_at)=frozen_at)),
 check(floor_sequence<>0 or floor_sha256=repeat('0',64))
);
insert into alliance_control.policy(id) values(true);
alter table alliance_control.policy enable row level security;
alter table alliance_control.policy force row level security;
create policy owner_only on alliance_control.policy to alliance_control_owner using(true) with check(true);
revoke all on alliance_control.policy from public,anon,authenticated,service_role,alliance_control_reader,alliance_control_operator;
create function alliance_control.stamp(t timestamptz) returns text language sql immutable security invoker set search_path='' as $$ select to_char(t at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); $$;
create function alliance_control.value(c alliance_control.policy) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('format',1,'memberProjectRef',c.member_ref,'journalProjectRef',c.journal_ref,'epoch',c.epoch,'revision',c.revision,'state',c.state,'changeId',c.change_id,
 'freezeId',c.freeze_id,'frozenAt',alliance_control.stamp(c.frozen_at),'checkpointSha256',c.checkpoint_sha256,'floor',jsonb_build_object('sequence',c.floor_sequence,'sha256',c.floor_sha256),
 'sha256',encode(sha256(convert_to('GF-ALLIANCE-CONTROL-ROW-V1','UTF8')||decode('00','hex')||convert_to(array_to_string(array[c.member_ref,c.journal_ref,c.epoch::text,c.revision::text,c.state,c.change_id::text,coalesce(c.freeze_id::text,'-'),coalesce(alliance_control.stamp(c.frozen_at),'-'),coalesce(c.checkpoint_sha256,'-'),c.floor_sequence::text,c.floor_sha256],E'\n'),'UTF8')),'hex'));
$$;
create function alliance_control.read_policy(p_member text,p_journal text,p_epoch uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c alliance_control.policy;begin
 select * into strict c from alliance_control.policy where id;
 if c.revision<1 or p_member is null or p_journal is null or p_epoch is null or c.member_ref is distinct from p_member or c.journal_ref is distinct from p_journal or c.epoch is distinct from p_epoch then raise insufficient_privilege using message='control_unavailable';end if;
 return alliance_control.value(c);
end $$;
-- Explicit operator bootstrap only. Readers never establish/reset genesis.
create function alliance_control.bootstrap(p_member text,p_journal text,p_epoch uuid,p_change uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c alliance_control.policy;begin
 if current_setting('synchronous_commit')<>'on' or current_setting('fsync')<>'on' or current_setting('full_page_writes')<>'on' or p_member is null or p_journal is null or p_member !~ '^[a-z0-9]{20}$' or p_journal !~ '^[a-z0-9]{20}$' or p_member=p_journal or p_epoch is null or p_change is null then raise insufficient_privilege using message='control_unavailable';end if;
 select * into strict c from alliance_control.policy where id for update;
 if c.revision<>0 then raise insufficient_privilege using message='control_already_configured';end if;
 update alliance_control.policy set member_ref=p_member,journal_ref=p_journal,epoch=p_epoch,revision=1,change_id=p_change where id returning * into c;
 return alliance_control.value(c);
end $$;
-- Full bounded chain proves a higher floor extends the prior floor. It does not
-- prove source completeness or that the operator froze the other domains.
create function alliance_control.check_chain(p_member text,p_epoch uuid,p_old integer,p_old_hash text,p_new integer,p_new_hash text,p_rows jsonb) returns void
language plpgsql immutable security invoker set search_path='' as $$
declare r jsonb;e jsonb;i integer:=0;prev text:=repeat('0',64);h text;body text;ids uuid[]:='{}';v_id uuid;v_profile uuid;v_object uuid;v_kind text;
begin
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or octet_length(p_rows::text)>262144 then raise insufficient_privilege using message='control_chain_invalid';end if;
 if p_new=p_old and p_new_hash=p_old_hash and p_rows='[]'::jsonb then return;end if;
 if p_new<p_old or jsonb_array_length(p_rows)<>p_new then raise insufficient_privilege using message='control_chain_invalid';end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  i:=i+1;e:=r->'event';
  if jsonb_typeof(r)<>'object' or (select count(*) from jsonb_object_keys(r))<>7 or not(r ?& array['format','projectRef','epoch','sequence','previous','event','sha256']) or r->'format'<>'1'::jsonb or r->'sequence'<>to_jsonb(i) or jsonb_typeof(r->'projectRef')<>'string' or jsonb_typeof(r->'epoch')<>'string' or jsonb_typeof(r->'previous')<>'string' or jsonb_typeof(r->'sha256')<>'string' or r->>'projectRef' is distinct from p_member or r->>'epoch' is distinct from p_epoch::text or r->>'previous' is distinct from prev
    or jsonb_typeof(e)<>'object' or (select count(*) from jsonb_object_keys(e))<>4 or not(e ?& array['id','kind','profileId','objectId']) then raise insufficient_privilege using message='control_chain_invalid';end if;
  if jsonb_typeof(e->'id')<>'string' or e->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(e->'profileId')<>'string' or e->>'profileId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(e->'kind')<>'string' or e->>'kind' not in('profile_remove_requested','image_remove_requested') then raise insufficient_privilege using message='control_chain_invalid';end if;
  v_id:=(e->>'id')::uuid;v_profile:=(e->>'profileId')::uuid;v_kind:=e->>'kind';v_object:=null;
  if v_id=any(ids) then raise insufficient_privilege using message='control_chain_invalid';end if;ids:=array_append(ids,v_id);
  if v_kind='profile_remove_requested' then if e->'objectId'<>'null'::jsonb then raise insufficient_privilege using message='control_chain_invalid';end if;
  else if jsonb_typeof(e->'objectId')<>'string' or e->>'objectId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise insufficient_privilege using message='control_chain_invalid';end if;v_object:=(e->>'objectId')::uuid;end if;
  body:=format('{"format":1,"projectRef":"%s","epoch":"%s","sequence":%s,"previous":"%s","event":{"id":"%s","kind":"%s","profileId":"%s","objectId":%s}}',p_member,p_epoch,i,prev,v_id,v_kind,v_profile,case when v_object is null then 'null' else '"'||v_object::text||'"' end);
  h:=encode(sha256(convert_to('GF-ALLIANCE-DELETION-RECORD-V1','UTF8')||decode('00','hex')||convert_to(body,'UTF8')),'hex');
  if r->>'sha256' is distinct from h or (i=p_old and h<>p_old_hash) then raise insufficient_privilege using message='control_chain_invalid';end if;prev:=h;
 end loop;
 if prev<>p_new_hash then raise insufficient_privilege using message='control_chain_invalid';end if;
end $$;
create function alliance_control.transition(p_member text,p_journal text,p_epoch uuid,p_revision integer,p_sha256 text,p_change uuid,p_policy jsonb,p_chain jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c alliance_control.policy;next_state text;frozen timestamptz;old_binding jsonb;next_seq integer;next_hash text;
begin
 if current_setting('synchronous_commit')<>'on' or current_setting('fsync')<>'on' or current_setting('full_page_writes')<>'on' then raise insufficient_privilege using message='control_unavailable';end if;
 perform alliance_control.read_policy(p_member,p_journal,p_epoch);
 if p_revision is null or p_revision<1 or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' or p_change is null or p_policy is null or jsonb_typeof(p_policy)<>'object' or (select count(*) from jsonb_object_keys(p_policy))<>5 or not(p_policy ?& array['state','freezeId','frozenAt','checkpointSha256','floor']) or p_chain is null or jsonb_typeof(p_chain)<>'array' then raise insufficient_privilege using message='control_invalid';end if;
 select * into strict c from alliance_control.policy where id for update;
 if c.revision<>p_revision or alliance_control.value(c)->>'sha256'<>p_sha256 then return jsonb_build_object('state','conflict','policy',alliance_control.value(c));end if;
 if c.revision=2147483646 or c.change_id=p_change then raise insufficient_privilege using message='control_invalid';end if;
 next_state:=p_policy->>'state';
 old_binding:=jsonb_build_object('freezeId',c.freeze_id,'frozenAt',alliance_control.stamp(c.frozen_at),'checkpointSha256',c.checkpoint_sha256,'floor',jsonb_build_object('sequence',c.floor_sequence,'sha256',c.floor_sha256));
 if next_state='closed' or (c.state='review' and next_state='serve') then
  if p_policy-'state'<>old_binding or p_chain<>'[]'::jsonb or (next_state='closed' and c.state='closed') then raise insufficient_privilege using message='control_invalid';end if;
 elsif c.state='closed' and next_state='review' then
  if jsonb_typeof(p_policy->'freezeId')<>'string' or p_policy->>'freezeId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or p_policy->>'freezeId'=c.freeze_id::text or jsonb_typeof(p_policy->'frozenAt')<>'string' or p_policy->>'frozenAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' or jsonb_typeof(p_policy->'checkpointSha256')<>'string' or p_policy->>'checkpointSha256' !~ '^[0-9a-f]{64}$' then raise insufficient_privilege using message='control_invalid';end if;
  frozen:=(p_policy->>'frozenAt')::timestamptz;
  if alliance_control.stamp(frozen)<>p_policy->>'frozenAt' or frozen<'1970-01-01 UTC' or frozen>clock_timestamp() or (c.frozen_at is not null and frozen<c.frozen_at) then raise insufficient_privilege using message='control_invalid';end if;
  if jsonb_typeof(p_policy->'floor')<>'object' or (select count(*) from jsonb_object_keys(p_policy->'floor'))<>2 or not((p_policy->'floor') ?& array['sequence','sha256']) or jsonb_typeof(p_policy->'floor'->'sequence')<>'number' or p_policy->'floor'->>'sequence' !~ '^(0|[1-9][0-9]{0,2})$' or jsonb_typeof(p_policy->'floor'->'sha256')<>'string' or p_policy->'floor'->>'sha256' !~ '^[0-9a-f]{64}$' then raise insufficient_privilege using message='control_invalid';end if;
  next_seq:=(p_policy->'floor'->>'sequence')::integer;next_hash:=p_policy->'floor'->>'sha256';
  if next_seq>256 or next_seq<c.floor_sequence or (next_seq=c.floor_sequence and next_hash<>c.floor_sha256) or (next_seq=0 and next_hash<>repeat('0',64)) then raise insufficient_privilege using message='control_invalid';end if;
  perform alliance_control.check_chain(p_member,p_epoch,c.floor_sequence,c.floor_sha256,next_seq,next_hash,p_chain);
  c.freeze_id:=(p_policy->>'freezeId')::uuid;c.frozen_at:=frozen;c.checkpoint_sha256:=p_policy->>'checkpointSha256';c.floor_sequence:=next_seq;c.floor_sha256:=next_hash;
 else raise insufficient_privilege using message='control_invalid';end if;
 update alliance_control.policy set revision=c.revision+1,state=next_state,change_id=p_change,freeze_id=c.freeze_id,frozen_at=c.frozen_at,checkpoint_sha256=c.checkpoint_sha256,floor_sequence=c.floor_sequence,floor_sha256=c.floor_sha256 where id returning * into c;
 return jsonb_build_object('state','committed','policy',alliance_control.value(c));
end $$;
revoke all on all functions in schema alliance_control from public,anon,authenticated,service_role,alliance_control_reader,alliance_control_operator;
grant usage on schema alliance_control to alliance_control_reader,alliance_control_operator;
grant execute on function alliance_control.read_policy(text,text,uuid) to alliance_control_reader,alliance_control_operator;
grant execute on function alliance_control.bootstrap(text,text,uuid,uuid),alliance_control.transition(text,text,uuid,integer,text,uuid,jsonb,jsonb) to alliance_control_operator;
reset role;
