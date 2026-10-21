-- UNAPPLIED common protocol for either dedicated account-history OR ack domain.
-- Not a migration; never install beside member/Auth or both domains together.
do $$ begin
 if current_database()<>'postgres' or to_regnamespace('auth') is not null or to_regnamespace('alliance_avatar') is not null or to_regnamespace('alliance_journal') is not null or to_regnamespace('alliance_control') is not null then raise exception 'Dedicated account domain required';end if;
end $$;
create role alliance_account_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role alliance_account_reader nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role alliance_account_writer nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role alliance_account_operator nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create schema alliance_account authorization alliance_account_owner;
revoke all on schema alliance_account from public,anon,authenticated,service_role;
set local role alliance_account_owner;
alter default privileges revoke execute on functions from public;
create function alliance_account.scope_ok(s jsonb) returns boolean language sql immutable security invoker set search_path='' as $$
 select coalesce(jsonb_typeof(s)='object' and (select count(*) from jsonb_object_keys(s))=3 and s ?& array['memberProjectRef','journalProjectRef','epoch']
 and jsonb_typeof(s->'memberProjectRef')='string' and s->>'memberProjectRef' ~ '^[a-z0-9]{20}$'
 and jsonb_typeof(s->'journalProjectRef')='string' and s->>'journalProjectRef' ~ '^[a-z0-9]{20}$' and s->>'memberProjectRef'<>s->>'journalProjectRef'
 and jsonb_typeof(s->'epoch')='string' and s->>'epoch' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false);
$$;
create function alliance_account.event_value(e jsonb) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare h text;body text;begin
 if e is null or jsonb_typeof(e)<>'object' or (select count(*) from jsonb_object_keys(e))<>3 or not(e ?& array['id','kind','subject']) or jsonb_typeof(e->'kind')<>'string' or e->>'kind' not in('account_admitted','account_remove_requested') or jsonb_typeof(e->'subject')<>'string' or e->>'subject' !~ '^[0-9a-f]{64}$' or jsonb_typeof(e->'id')<>'string' then raise insufficient_privilege using message='account_history_invalid';end if;
 body:=format('{"kind":"%s","subject":"%s"}',e->>'kind',e->>'subject');
 h:=encode(sha256(convert_to('GF-ALLIANCE-ACCOUNT-EVENT-V1','UTF8')||decode('00','hex')||convert_to(body,'UTF8')),'hex');
 if e->>'id' is distinct from h then raise insufficient_privilege using message='account_history_invalid';end if;return e;
end $$;
create function alliance_account.record_value(s jsonb,n integer,prev text,e jsonb) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare body text;h text;begin
 if not alliance_account.scope_ok(s) or n is null or n not between 1 and 256 or prev is null or prev !~ '^[0-9a-f]{64}$' or (n=1 and prev<>repeat('0',64)) then raise insufficient_privilege using message='account_history_invalid';end if;
 perform alliance_account.event_value(e);
 body:=format('{"format":1,"scope":{"memberProjectRef":"%s","journalProjectRef":"%s","epoch":"%s"},"sequence":%s,"previous":"%s","event":{"id":"%s","kind":"%s","subject":"%s"}}',s->>'memberProjectRef',s->>'journalProjectRef',s->>'epoch',n,prev,e->>'id',e->>'kind',e->>'subject');
 h:=encode(sha256(convert_to('GF-ALLIANCE-ACCOUNT-RECORD-V1','UTF8')||decode('00','hex')||convert_to(body,'UTF8')),'hex');
 return jsonb_build_object('format',1,'scope',s,'sequence',n,'previous',prev,'event',e,'sha256',h);
end $$;
create function alliance_account.check_chain(s jsonb,rows jsonb,floor_n integer,floor_h text) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare r jsonb;e jsonb;canonical jsonb;n integer:=0;prev text:=repeat('0',64);admitted text[]:='{}';removed text[]:='{}';tag text;begin
 if not alliance_account.scope_ok(s) or floor_n is null or floor_n not between 0 and 256 or floor_h is null or floor_h !~ '^[0-9a-f]{64}$' or (floor_n=0 and floor_h<>prev) or rows is null or jsonb_typeof(rows)<>'array' or octet_length(rows::text)>262144 or jsonb_array_length(rows)>256 or jsonb_array_length(rows)<floor_n then raise insufficient_privilege using message='account_history_invalid';end if;
 for r in select value from jsonb_array_elements(rows) loop
  n:=n+1;e:=alliance_account.event_value(r->'event');canonical:=alliance_account.record_value(s,n,prev,e);
  if r is distinct from canonical then raise insufficient_privilege using message='account_history_invalid';end if;
  tag:=e->>'subject';
  if e->>'kind'='account_admitted' then
   if tag=any(admitted) or cardinality(admitted)>=128 then raise insufficient_privilege using message='account_history_invalid';end if;admitted:=array_append(admitted,tag);
  else
   if not(tag=any(admitted)) or tag=any(removed) then raise insufficient_privilege using message='account_history_invalid';end if;removed:=array_append(removed,tag);
  end if;
  prev:=r->>'sha256';if n=floor_n and prev<>floor_h then raise insufficient_privilege using message='account_history_invalid';end if;
 end loop;
 return jsonb_build_object('sequence',n,'sha256',prev,'accounts',cardinality(admitted),'reservedRemovals',cardinality(admitted)-cardinality(removed));
end $$;
revoke all on all functions in schema alliance_account from public,anon,authenticated,service_role,alliance_account_reader,alliance_account_writer,alliance_account_operator;
reset role;
