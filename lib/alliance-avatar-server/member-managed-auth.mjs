// Fixed, explicit managed-provider candidate. No connection, grant or discovery.
export const MANAGED_SESSION_GUARD_BODY=`
begin
  if p_actor is null or p_session is null or not exists(
    select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=p_session and s.user_id=p_actor and u.email_confirmed_at is not null
      and u.is_anonymous is false and u.deleted_at is null
      and (u.banned_until is null or u.banned_until<=clock_timestamp())
      and (s.not_after is null or s.not_after>clock_timestamp())
  ) then raise insufficient_privilege using message='avatar_unavailable';end if;
end `;
export function memberDeploymentProfile(v){if(!['strict','supabase-managed'].includes(v))throw Error('avatar_ledger_unavailable');return v;}
const roles="'alliance_avatar_executor','alliance_avatar_owner'";
const gate="(SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='alliance_auth_gate' AND p.proname='require_current_session' AND p.proargtypes='2950 2950'::oidvector)";
// OID overloads do not require the executor to use the private guard schema.
export const MANAGED_MEMBER_ISOLATION=`(
 (SELECT oid=10 AND rolsuper FROM pg_roles WHERE rolname='supabase_admin')
 AND (SELECT pg_get_userbyid(nspowner)='supabase_admin' FROM pg_namespace WHERE nspname='auth')
 AND (SELECT count(*)=2 AND bool_and(NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication AND NOT rolinherit AND (rolname<>'alliance_avatar_owner' OR NOT rolcanlogin)) FROM pg_roles WHERE rolname IN(${roles}))
 AND (SELECT coalesce(jsonb_agg(jsonb_build_array(pg_get_userbyid(m.roleid),pg_get_userbyid(m.member),pg_get_userbyid(m.grantor),m.admin_option,m.inherit_option,m.set_option) ORDER BY pg_get_userbyid(m.roleid)),'[]'::jsonb) FROM pg_auth_members m WHERE m.roleid IN(SELECT oid FROM pg_roles WHERE rolname IN(${roles})) OR m.member IN(SELECT oid FROM pg_roles WHERE rolname IN(${roles})))='[["alliance_avatar_executor","postgres","supabase_admin",true,false,false],["alliance_avatar_owner","postgres","supabase_admin",true,false,false]]'::jsonb
 AND NOT has_schema_privilege('alliance_avatar_owner',(SELECT oid FROM pg_namespace WHERE nspname='auth'),'USAGE,CREATE')
 AND NOT has_schema_privilege('alliance_avatar_executor',(SELECT oid FROM pg_namespace WHERE nspname='auth'),'USAGE,CREATE')
 AND (SELECT pg_get_userbyid(nspowner)='postgres' FROM pg_namespace WHERE nspname='alliance_auth_gate')
 AND (SELECT count(*)=1 FROM pg_proc WHERE pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='alliance_auth_gate'))
 AND EXISTS(SELECT 1 FROM pg_proc WHERE oid=${gate} AND prosecdef AND pg_get_userbyid(proowner)='postgres' AND prorettype='void'::regtype AND array_length(proconfig,1)=1 AND proconfig[1] IN('search_path=','search_path=""') AND prosrc=$session_guard$${MANAGED_SESSION_GUARD_BODY}$session_guard$)
 AND has_schema_privilege('alliance_avatar_owner',(SELECT oid FROM pg_namespace WHERE nspname='alliance_auth_gate'),'USAGE')
 AND NOT has_schema_privilege('alliance_avatar_owner',(SELECT oid FROM pg_namespace WHERE nspname='alliance_auth_gate'),'CREATE')
 AND has_function_privilege('alliance_avatar_owner',${gate},'EXECUTE')
 AND NOT EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname IN('anon','authenticated','service_role','alliance_avatar_executor') AND (has_schema_privilege(r.oid,(SELECT oid FROM pg_namespace WHERE nspname='alliance_auth_gate'),'USAGE,CREATE') OR has_function_privilege(r.oid,${gate},'EXECUTE')))
)`;
