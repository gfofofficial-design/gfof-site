-- UNAPPLIED READ-ONLY extension after creation/cleanup. No write or reopen path.
set local role alliance_avatar_owner;
create function alliance_avatar.recovery_inventory() returns jsonb
language plpgsql stable security definer set search_path=''
set timezone='UTC' set datestyle='ISO, YMD' as $$
declare qualified text;parts text[];n integer;digest text;rows jsonb:='[]'::jsonb;closed boolean;
begin
  select not enabled and not cleanup_enabled and not creation_enabled into strict closed from alliance_avatar.control where id;
  foreach qualified in array array['public.alliance_member_owners','public.alliance_profiles','alliance_avatar.control','alliance_avatar.heads','alliance_avatar.operations','alliance_avatar.objects','alliance_avatar.daily','alliance_avatar.cleanup_attempts','alliance_avatar.creation_plans'] loop
    parts:=string_to_array(qualified,'.');
    execute format($query$
      select count(*)::integer,encode(sha256(convert_to(coalesce(string_agg(h,'' order by h collate "C"),''),'UTF8')),'hex')
      from(select encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') h from(select * from %I.%I limit 1001)t)s
    $query$,parts[1],parts[2]) into n,digest;
    if n>1000 or (qualified='alliance_avatar.creation_plans' and n>256) then raise insufficient_privilege using message='recovery_inventory_too_large';end if;
    rows:=rows||jsonb_build_array(jsonb_build_object('table',qualified,'rows',n,'sha256',digest));
  end loop;
  return jsonb_build_object('format',2,'domain','member','closed',closed,'tables',rows);
end $$;
revoke all on function alliance_avatar.recovery_inventory() from public,anon,authenticated,service_role,alliance_avatar_executor;
grant execute on function alliance_avatar.recovery_inventory() to alliance_avatar_executor;
reset role;
