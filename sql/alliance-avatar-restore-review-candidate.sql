-- Unapplied READ-ONLY ledger inventory. Requires cleanup/recovery candidates.
-- No role, table, flag, pruning, reconciliation or permission to reopen service.
set local role alliance_avatar_owner;
create function alliance_avatar.restore_inventory() returns jsonb
language plpgsql stable security definer set search_path=''
set timezone='UTC' set datestyle='ISO, YMD' as $$
declare name text; n integer; digest text; rows jsonb:='[]'::jsonb; closed boolean;
begin
  select not enabled and not cleanup_enabled into strict closed from alliance_avatar.control where id;
  -- Fixed names only; no caller SQL. LIMIT bounds each inventory to 1001 rows.
  -- Hash complete rows, including tombstones, receipts and spent counters.
  foreach name in array array['control','heads','operations','objects','daily','cleanup_attempts'] loop
    execute format($query$
      select count(*)::integer,encode(sha256(convert_to(
        coalesce(string_agg(h,'' order by h collate "C"),''),'UTF8')),'hex')
      from (select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') h
        from (select * from alliance_avatar.%I limit 1001) t) s
    $query$,name) into n,digest;
    if n>1000 then raise insufficient_privilege using message='avatar_inventory_too_large';end if;
    rows:=rows||jsonb_build_array(jsonb_build_object('table',name,'rows',n,'sha256',digest));
  end loop;
  return jsonb_build_object('format',1,'closed',closed,'tables',rows);
end $$;
revoke all on function alliance_avatar.restore_inventory() from public,anon,authenticated,service_role,alliance_avatar_executor;
grant execute on function alliance_avatar.restore_inventory() to alliance_avatar_executor;
reset role;
