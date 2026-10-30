-- UNAPPLIED private directory path; no browser/Data API grant or mode change.
set local role alliance_avatar_owner;
create function alliance_avatar.directory_session(p_actor uuid,p_session uuid,p_after uuid,p_limit integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare rows jsonb;items jsonb;next_id text;
begin
  perform alliance_avatar.lock_enabled();perform alliance_avatar.require_account_session(p_actor,p_session);
  if p_limit is null or p_limit<1 or p_limit>20 then raise insufficient_privilege using message='profile_directory_unavailable';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'community',p.community,'bio',p.bio,'role',p.contribution_role) order by p.id),'[]'::jsonb)
    into rows from (select id,display_name,community,bio,contribution_role from public.alliance_profiles where listed and moderation_state='visible' and (p_after is null or id>p_after) order by id limit p_limit+1) p;
  if jsonb_array_length(rows)>p_limit then items:=rows-p_limit;next_id:=items->(p_limit-1)->>'id';else items:=rows;next_id:=null;end if;
  return jsonb_build_object('items',items,'next',next_id);
end $$;
revoke all on function alliance_avatar.directory_session(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function alliance_avatar.directory_session(uuid,uuid,uuid,integer) to alliance_avatar_executor;
reset role;
