-- UNAPPLIED extension after control store. Dedicated control domain only.
create role alliance_control_anchor_writer nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
set local role alliance_control_owner;
create table alliance_control.removal_anchor(
 id boolean primary key default true check(id),sequence integer not null check(sequence between 0 and 256),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),check(sequence<>0 or sha256=repeat('0',64))
);
-- Reviewed baseline is a lower bound, never reset a configured policy to genesis.
insert into alliance_control.removal_anchor select true,floor_sequence,floor_sha256 from alliance_control.policy where id;
alter table alliance_control.removal_anchor enable row level security;
alter table alliance_control.removal_anchor force row level security;
create policy owner_only on alliance_control.removal_anchor to alliance_control_owner using(true) with check(true);
revoke all on alliance_control.removal_anchor from public,anon,authenticated,service_role,alliance_control_reader,alliance_control_operator,alliance_control_anchor_writer;
create function alliance_control.anchor_value(c alliance_control.policy,a alliance_control.removal_anchor) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('format',1,'memberProjectRef',c.member_ref,'journalProjectRef',c.journal_ref,'epoch',c.epoch,'sequence',a.sequence,'sha256',a.sha256);
$$;
create function alliance_control.read_anchor(p_member text,p_journal text,p_epoch uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c alliance_control.policy;a alliance_control.removal_anchor;begin
 perform alliance_control.read_policy(p_member,p_journal,p_epoch);select * into strict c from alliance_control.policy where id;select * into strict a from alliance_control.removal_anchor where id;
 if a.sequence<c.floor_sequence or (a.sequence=c.floor_sequence and a.sha256<>c.floor_sha256) then raise insufficient_privilege using message='anchor_unavailable';end if;
 return alliance_control.anchor_value(c,a);
end $$;
create function alliance_control.advance_anchor(p_member text,p_journal text,p_epoch uuid,p_expected integer,p_expected_hash text,p_through integer,p_hash text,p_chain jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c alliance_control.policy;a alliance_control.removal_anchor;begin
 if current_setting('synchronous_commit')<>'on' or current_setting('fsync')<>'on' or current_setting('full_page_writes')<>'on' then raise insufficient_privilege using message='anchor_unavailable';end if;
 perform alliance_control.read_policy(p_member,p_journal,p_epoch);
 -- Same lock order as startup transitions; no network call while locks are held.
 select * into strict c from alliance_control.policy where id for update;select * into strict a from alliance_control.removal_anchor where id for update;
 if p_expected is null or p_expected not between 0 and 256 or p_expected_hash is null or p_expected_hash !~ '^[0-9a-f]{64}$' or p_through is null or p_through not between 0 and 256 or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_chain is null or jsonb_typeof(p_chain)<>'array' or jsonb_array_length(p_chain)<>p_through then raise insufficient_privilege using message='anchor_unavailable';end if;
 if a.sequence<c.floor_sequence or (a.sequence=c.floor_sequence and a.sha256<>c.floor_sha256) then raise insufficient_privilege using message='anchor_unavailable';end if;
 if p_through<a.sequence or (p_through=a.sequence and p_hash<>a.sha256) then raise insufficient_privilege using message='anchor_regression';end if;
 perform alliance_control.check_chain(p_member,p_epoch,a.sequence,a.sha256,p_through,p_hash,p_chain);
 if p_through=a.sequence then return jsonb_build_object('state','anchored','anchor',alliance_control.anchor_value(c,a));end if;
 if p_expected<>a.sequence or p_expected_hash<>a.sha256 then return jsonb_build_object('state','conflict','anchor',alliance_control.anchor_value(c,a));end if;
 update alliance_control.removal_anchor set sequence=p_through,sha256=p_hash where id returning * into a;
 return jsonb_build_object('state','anchored','anchor',alliance_control.anchor_value(c,a));
end $$;
alter function alliance_control.transition(text,text,uuid,integer,text,uuid,jsonb,jsonb) rename to transition_startup_only;
revoke all on function alliance_control.transition_startup_only(text,text,uuid,integer,text,uuid,jsonb,jsonb) from public,anon,authenticated,service_role,alliance_control_reader,alliance_control_operator,alliance_control_anchor_writer;
create function alliance_control.transition(p_member text,p_journal text,p_epoch uuid,p_revision integer,p_sha256 text,p_change uuid,p_policy jsonb,p_chain jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c alliance_control.policy;a alliance_control.removal_anchor;r jsonb;n integer;h text;begin
 perform alliance_control.read_policy(p_member,p_journal,p_epoch);
 select * into strict c from alliance_control.policy where id for update;select * into strict a from alliance_control.removal_anchor where id for update;
 if p_policy->>'state'='review' and c.revision=p_revision and alliance_control.value(c)->>'sha256'=p_sha256 then
  n:=(p_policy->'floor'->>'sequence')::integer;h:=p_policy->'floor'->>'sha256';
  if n is null or n<a.sequence or h is null or (n=a.sequence and h<>a.sha256) then raise insufficient_privilege using message='anchor_regression';end if;
  if n>a.sequence then r:=alliance_control.advance_anchor(p_member,p_journal,p_epoch,a.sequence,a.sha256,n,h,p_chain);if r->>'state'<>'anchored' then raise insufficient_privilege using message='anchor_unavailable';end if;end if;
 end if;
 return alliance_control.transition_startup_only(p_member,p_journal,p_epoch,p_revision,p_sha256,p_change,p_policy,p_chain);
end $$;
revoke all on function alliance_control.anchor_value(alliance_control.policy,alliance_control.removal_anchor),alliance_control.read_anchor(text,text,uuid),alliance_control.advance_anchor(text,text,uuid,integer,text,integer,text,jsonb),alliance_control.transition(text,text,uuid,integer,text,uuid,jsonb,jsonb) from public,anon,authenticated,service_role,alliance_control_reader,alliance_control_operator,alliance_control_anchor_writer;
grant usage on schema alliance_control to alliance_control_anchor_writer;
grant execute on function alliance_control.read_anchor(text,text,uuid) to alliance_control_reader,alliance_control_anchor_writer;
grant execute on function alliance_control.advance_anchor(text,text,uuid,integer,text,integer,text,jsonb) to alliance_control_anchor_writer;
grant execute on function alliance_control.transition(text,text,uuid,integer,text,uuid,jsonb,jsonb) to alliance_control_operator;
reset role;
