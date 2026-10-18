-- UNAPPLIED READ-ONLY extension on the separate journal after admission.
set local role alliance_journal_owner;
create function alliance_journal.recovery_inventory(p_ref text,p_epoch uuid) returns jsonb
language plpgsql stable security definer set search_path=''
set timezone='UTC' set datestyle='ISO, YMD' as $$
declare name text;n integer;digest text;rows jsonb:='[]'::jsonb;c alliance_journal.control;
begin
  perform alliance_journal.tip(p_ref,p_epoch);
  select * into strict c from alliance_journal.control where id;
  foreach name in array array['control','admissions','entries'] loop
    execute format($query$
      select count(*)::integer,encode(sha256(convert_to(coalesce(string_agg(h,'' order by h collate "C"),''),'UTF8')),'hex')
      from(select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') h from(select * from alliance_journal.%I limit 257)t)s
    $query$,name) into n,digest;
    if n>256 then raise insufficient_privilege using message='recovery_inventory_too_large';end if;
    rows:=rows||jsonb_build_array(jsonb_build_object('table','alliance_journal.'||name,'rows',n,'sha256',digest));
  end loop;
  return jsonb_build_object('format',2,'domain','journal','closed',not c.enabled and not c.admission_enabled,
    'projectRef',c.project_ref,'epoch',c.epoch,'sequence',c.sequence,'sha256',c.sha256,'tables',rows);
end $$;
revoke all on function alliance_journal.recovery_inventory(text,uuid) from public,anon,authenticated,service_role,alliance_journal_executor;
grant execute on function alliance_journal.recovery_inventory(text,uuid) to alliance_journal_executor;
reset role;
