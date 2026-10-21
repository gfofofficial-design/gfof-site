-- UNAPPLIED; install common account protocol first, in the dedicated history domain.
do $$ begin if to_regclass('alliance_account.ack_control') is not null then raise exception 'Separate account history domain required';end if;end $$;
set local role alliance_account_owner;
create table alliance_account.history_control(
 id boolean primary key default true check(id),scope jsonb check(scope is null or alliance_account.scope_ok(scope)),
 enabled boolean not null default false,admissions_open boolean not null default false,
 sequence integer not null default 0 check(sequence between 0 and 256),sha256 text not null default repeat('0',64) check(sha256 ~ '^[0-9a-f]{64}$'),
 check(not admissions_open or enabled),check(scope is not null or (not enabled and not admissions_open and sequence=0)),check(sequence<>0 or sha256=repeat('0',64))
);
insert into alliance_account.history_control(id) values(true);
create table alliance_account.entries(sequence integer primary key check(sequence between 1 and 256),event_id text not null unique check(event_id ~ '^[0-9a-f]{64}$'),record jsonb not null check(jsonb_typeof(record)='object'));
do $$ declare t text;begin foreach t in array array['history_control','entries'] loop
 execute format('alter table alliance_account.%I enable row level security',t);execute format('alter table alliance_account.%I force row level security',t);
 execute format('create policy owner_only on alliance_account.%I to alliance_account_owner using(true) with check(true)',t);
 execute format('revoke all on alliance_account.%I from public,anon,authenticated,service_role,alliance_account_reader,alliance_account_writer,alliance_account_operator',t);
end loop;end $$;
create function alliance_account.snapshot(s jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare c alliance_account.history_control;rows jsonb;p jsonb;begin
 select * into strict c from alliance_account.history_control where id;
 if s is null or not alliance_account.scope_ok(s) or c.scope is distinct from s then raise insufficient_privilege using message='account_history_unavailable';end if;
 select coalesce(jsonb_agg(record order by sequence),'[]'::jsonb) into rows from alliance_account.entries;
 p:=alliance_account.check_chain(s,rows,0,repeat('0',64));
 if (p->>'sequence')::integer<>c.sequence or p->>'sha256'<>c.sha256 or exists(select 1 from alliance_account.entries where event_id is distinct from record->'event'->>'id' or sequence is distinct from (record->>'sequence')::integer) then raise insufficient_privilege using message='account_history_invalid';end if;
 return jsonb_build_object('scope',s,'enabled',c.enabled,'admissionsOpen',c.admissions_open,'head',jsonb_build_object('sequence',c.sequence,'sha256',c.sha256),'records',rows);
end $$;
create function alliance_account.history_bootstrap(s jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c alliance_account.history_control;begin
 if not alliance_account.scope_ok(s) then raise insufficient_privilege using message='account_history_invalid';end if;
 select * into strict c from alliance_account.history_control where id for update;
 if c.scope is not null then raise insufficient_privilege using message='account_already_configured';end if;
 update alliance_account.history_control set scope=s where id;
end $$;
create function alliance_account.history_mode(s jsonb,on_value boolean,admissions boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform alliance_account.snapshot(s);
 if on_value is null or admissions is null or (admissions and not on_value) then raise insufficient_privilege using message='account_history_invalid';end if;
 update alliance_account.history_control set enabled=on_value,admissions_open=admissions where id;
end $$;
create function alliance_account.append(s jsonb,p_n integer,p_h text,e jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c alliance_account.history_control;snap jsonb;found_record jsonb;next_record jsonb;rows jsonb;meta jsonb;head jsonb;begin
 if current_setting('fsync')<>'on' or current_setting('full_page_writes')<>'on' or current_setting('synchronous_commit')<>'on' then raise insufficient_privilege using message='account_history_unavailable';end if;
 perform alliance_account.event_value(e);
 if p_n is null or p_n not between 0 and 256 or p_h is null or p_h !~ '^[0-9a-f]{64}$' or (p_n=0 and p_h<>repeat('0',64)) then raise insufficient_privilege using message='account_history_invalid';end if;
 select * into strict c from alliance_account.history_control where id for update;snap:=alliance_account.snapshot(s);head:=snap->'head';rows:=snap->'records';
 if not c.enabled then return jsonb_build_object('state','paused','head',head);end if;
 if e->>'kind'='account_admitted' and exists(select 1 from jsonb_array_elements(rows) r where r->'event'->>'subject'=e->>'subject' and r->'event'->>'kind'='account_remove_requested') then return jsonb_build_object('state','removed','head',head);end if;
 select record into found_record from alliance_account.entries where event_id=e->>'id';
 if found then return jsonb_build_object('state','recorded','record',found_record,'head',head);end if;
 if c.sequence<>p_n or c.sha256<>p_h then return jsonb_build_object('state','conflict','head',head);end if;
 if e->>'kind'='account_admitted' and not c.admissions_open then return jsonb_build_object('state','admissions_closed','head',head);end if;
 meta:=alliance_account.check_chain(s,rows,0,repeat('0',64));
 if e->>'kind'='account_admitted' and (meta->>'accounts')::integer>=128 then return jsonb_build_object('state','full','head',head);end if;
 if e->>'kind'='account_remove_requested' and not exists(select 1 from jsonb_array_elements(rows) r where r->'event'->>'subject'=e->>'subject' and r->'event'->>'kind'='account_admitted') then return jsonb_build_object('state','not_admitted','head',head);end if;
 if c.sequence>=256 then return jsonb_build_object('state','full','head',head);end if;
 next_record:=alliance_account.record_value(s,c.sequence+1,c.sha256,e);perform alliance_account.check_chain(s,rows||jsonb_build_array(next_record),0,repeat('0',64));
 insert into alliance_account.entries values(c.sequence+1,e->>'id',next_record);
 update alliance_account.history_control set sequence=c.sequence+1,sha256=next_record->>'sha256' where id;
 return jsonb_build_object('state','recorded','record',next_record,'head',jsonb_build_object('sequence',c.sequence+1,'sha256',next_record->>'sha256'));
end $$;
revoke all on all functions in schema alliance_account from public,anon,authenticated,service_role,alliance_account_reader,alliance_account_writer,alliance_account_operator;
grant usage on schema alliance_account to alliance_account_reader,alliance_account_writer,alliance_account_operator;
grant execute on function alliance_account.snapshot(jsonb) to alliance_account_reader,alliance_account_writer;
grant execute on function alliance_account.append(jsonb,integer,text,jsonb) to alliance_account_writer;
grant execute on function alliance_account.history_bootstrap(jsonb),alliance_account.history_mode(jsonb,boolean,boolean) to alliance_account_operator;
reset role;
