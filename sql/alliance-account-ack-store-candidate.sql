-- UNAPPLIED; common protocol first, in a DIFFERENT dedicated ack/control domain.
do $$ begin if to_regclass('alliance_account.history_control') is not null then raise exception 'Separate account acknowledgement domain required';end if;end $$;
set local role alliance_account_owner;
create table alliance_account.ack_control(
 id boolean primary key default true check(id),scope jsonb check(scope is null or alliance_account.scope_ok(scope)),enabled boolean not null default false,
 sequence integer not null default 0 check(sequence between 0 and 256),sha256 text not null default repeat('0',64) check(sha256 ~ '^[0-9a-f]{64}$'),
 check(scope is not null or (not enabled and sequence=0)),check(sequence<>0 or sha256=repeat('0',64))
);
insert into alliance_account.ack_control(id) values(true);
alter table alliance_account.ack_control enable row level security;alter table alliance_account.ack_control force row level security;
create policy owner_only on alliance_account.ack_control to alliance_account_owner using(true) with check(true);
revoke all on alliance_account.ack_control from public,anon,authenticated,service_role,alliance_account_reader,alliance_account_writer,alliance_account_operator;
create function alliance_account.ack_read(s jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c alliance_account.ack_control;begin
 select * into strict c from alliance_account.ack_control where id;
 if s is null or not alliance_account.scope_ok(s) or c.scope is distinct from s then raise insufficient_privilege using message='account_ack_unavailable';end if;
 return jsonb_build_object('sequence',c.sequence,'sha256',c.sha256);
end $$;
create function alliance_account.ack_bootstrap(s jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c alliance_account.ack_control;begin
 if not alliance_account.scope_ok(s) then raise insufficient_privilege using message='account_history_invalid';end if;
 select * into strict c from alliance_account.ack_control where id for update;
 if c.scope is not null then raise insufficient_privilege using message='account_already_configured';end if;update alliance_account.ack_control set scope=s where id;
end $$;
create function alliance_account.ack_mode(s jsonb,on_value boolean) returns void language plpgsql security definer set search_path='' as $$
begin perform alliance_account.ack_read(s);if on_value is null then raise insufficient_privilege using message='account_history_invalid';end if;update alliance_account.ack_control set enabled=on_value where id;end $$;
create function alliance_account.ack_advance(s jsonb,p_n integer,p_h text,rows jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c alliance_account.ack_control;p jsonb;begin
 if current_setting('fsync')<>'on' or current_setting('full_page_writes')<>'on' or current_setting('synchronous_commit')<>'on' then raise insufficient_privilege using message='account_ack_unavailable';end if;
 if p_n is null or p_n not between 0 and 256 or p_h is null or p_h !~ '^[0-9a-f]{64}$' or (p_n=0 and p_h<>repeat('0',64)) then raise insufficient_privilege using message='account_history_invalid';end if;
 select * into strict c from alliance_account.ack_control where id for update;perform alliance_account.ack_read(s);
 if not c.enabled then return jsonb_build_object('state','paused','point',jsonb_build_object('sequence',c.sequence,'sha256',c.sha256));end if;
 if c.sequence<>p_n or c.sha256<>p_h then return jsonb_build_object('state','conflict','point',jsonb_build_object('sequence',c.sequence,'sha256',c.sha256));end if;
 p:=alliance_account.check_chain(s,rows,c.sequence,c.sha256);
 update alliance_account.ack_control set sequence=(p->>'sequence')::integer,sha256=p->>'sha256' where id;
 return jsonb_build_object('state','acknowledged','point',jsonb_build_object('sequence',(p->>'sequence')::integer,'sha256',p->>'sha256'));
end $$;
revoke all on all functions in schema alliance_account from public,anon,authenticated,service_role,alliance_account_reader,alliance_account_writer,alliance_account_operator;
grant usage on schema alliance_account to alliance_account_reader,alliance_account_writer,alliance_account_operator;
grant execute on function alliance_account.ack_read(jsonb) to alliance_account_reader,alliance_account_writer;
grant execute on function alliance_account.ack_advance(jsonb,integer,text,jsonb) to alliance_account_writer;
grant execute on function alliance_account.ack_bootstrap(jsonb),alliance_account.ack_mode(jsonb,boolean) to alliance_account_operator;
reset role;
