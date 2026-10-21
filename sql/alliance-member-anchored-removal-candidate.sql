-- UNAPPLIED after member removal extension. No table/role/login added.
set local role alliance_avatar_owner;
create function alliance_avatar.prepare_anchored_removal_session(p_actor uuid,p_session uuid,p_operation uuid,p_version bigint,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb;op alliance_avatar.operations;begin
 r:=alliance_avatar.prepare_removal_session(p_actor,p_session,p_operation,p_version,p_kind);
 -- Even a committed replay must verify the independent anchor before success.
 if r->>'state'='committed' then select * into strict op from alliance_avatar.operations where id=p_operation;
  return jsonb_build_object('state','prepared','plan',op.removal_manifest);end if;
 return r;
end $$;
create function alliance_avatar.finish_anchored_removal_session(p_actor uuid,p_session uuid,p_operation uuid,p_plan jsonb,p_records jsonb,p_anchor jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 -- Remote durability is verified by trusted server coordinator, not these hashes.
 if p_anchor is null or jsonb_typeof(p_anchor)<>'object' or (select count(*) from jsonb_object_keys(p_anchor))<>6 or not(p_anchor ?& array['format','memberProjectRef','journalProjectRef','epoch','sequence','sha256']) or p_anchor->'format'<>'1'::jsonb or jsonb_typeof(p_anchor->'memberProjectRef')<>'string' or p_anchor->>'memberProjectRef' !~ '^[a-z0-9]{20}$' or jsonb_typeof(p_anchor->'journalProjectRef')<>'string' or p_anchor->>'journalProjectRef' !~ '^[a-z0-9]{20}$' or p_anchor->>'journalProjectRef'=p_anchor->>'memberProjectRef' or jsonb_typeof(p_anchor->'epoch')<>'string' or p_anchor->>'epoch' !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' or jsonb_typeof(p_anchor->'sequence')<>'number' or p_anchor->>'sequence' !~ '^(0|[1-9][0-9]{0,2})$' or (p_anchor->>'sequence')::integer>256 or jsonb_typeof(p_anchor->'sha256')<>'string' or p_anchor->>'sha256' !~ '^[0-9a-f]{64}$' then raise insufficient_privilege using message='anchored_removal_unavailable';end if;
 if (p_anchor->>'sequence')::integer=0 and p_anchor->>'sha256'<>repeat('0',64) then raise insufficient_privilege using message='anchored_removal_unavailable';end if;
 if jsonb_typeof(p_records->'records') is distinct from 'array' or exists(select 1 from jsonb_array_elements(p_records->'records')r where coalesce(r->>'sequence','') !~ '^[1-9][0-9]{0,2}$' or (r->>'sequence')::integer>(p_anchor->>'sequence')::integer or ((r->>'sequence')::integer=(p_anchor->>'sequence')::integer and r->>'sha256' is distinct from p_anchor->>'sha256')) then raise insufficient_privilege using message='anchored_removal_unavailable';end if;
 return alliance_avatar.finish_removal_session(p_actor,p_session,p_operation,p_plan,p_records);
end $$;
revoke all on function alliance_avatar.prepare_anchored_removal_session(uuid,uuid,uuid,bigint,text),alliance_avatar.finish_anchored_removal_session(uuid,uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role,alliance_avatar_executor;
revoke execute on function alliance_avatar.prepare_removal_session(uuid,uuid,uuid,bigint,text),alliance_avatar.finish_removal_session(uuid,uuid,uuid,jsonb,jsonb) from alliance_avatar_executor;
grant execute on function alliance_avatar.prepare_anchored_removal_session(uuid,uuid,uuid,bigint,text),alliance_avatar.finish_anchored_removal_session(uuid,uuid,uuid,jsonb,jsonb,jsonb) to alliance_avatar_executor;
reset role;
