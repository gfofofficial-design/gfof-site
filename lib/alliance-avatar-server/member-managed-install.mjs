// Offline candidate builder only. No connection, apply, login or key lookup.
// Hosted use requires a reviewed migration and fresh backup/owner approval.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const fail=()=>Error('alliance_member_managed_install_unavailable');
export const MEMBER_INSTALL_SOURCES=Object.freeze([
  'alliance-profile-candidate.sql','alliance-avatar-ledger-candidate.sql','alliance-avatar-session-candidate.sql',
  'alliance-avatar-cleanup-candidate.sql','alliance-avatar-recovery-candidate.sql','alliance-avatar-restore-review-candidate.sql',
  'alliance-avatar-removal-candidate.sql','alliance-creation-admission-candidate.sql','alliance-profile-write-fence-candidate.sql',
  'alliance-profile-revision-candidate.sql','alliance-member-anchored-removal-candidate.sql',
  'alliance-profile-bound-removal-candidate.sql','alliance-member-recovery-inventory-candidate.sql',
]);
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
const once=(s,from,to)=>{if(s.split(from).length!==2)throw fail();return s.replace(from,to);};
const read=name=>readFileSync(new URL('../../sql/'+name,import.meta.url),'utf8').replace(/\r\n/g,'\n');
export function managedMemberInstallManifest(){return MEMBER_INSTALL_SOURCES.map(name=>({name,sha256:createHash('sha256').update(read(name)).digest('hex')}));}
export function managedMemberInstallSql(){
  const sources=MEMBER_INSTALL_SOURCES.map(read);
  sources[1]=once(sources[1],'create schema alliance_avatar authorization alliance_avatar_owner;',`grant alliance_avatar_owner to postgres with inherit false, set true;
create schema alliance_avatar authorization alliance_avatar_owner;
set local role alliance_avatar_owner;`);
  sources[1]=once(sources[1],'grant usage on schema public to alliance_avatar_owner;',`reset role;
grant usage on schema public to alliance_avatar_owner;`);
  let session=sources[2];
  session=once(session,'grant usage on schema auth to alliance_avatar_owner;\ngrant select(id,user_id,not_after) on auth.sessions to alliance_avatar_owner;\ngrant select(id,email_confirmed_at,is_anonymous,deleted_at,banned_until) on auth.users to alliance_avatar_owner;',`-- Managed Auth grants remain unchanged. One fixed, void verifier only.
create schema alliance_auth_gate authorization postgres;
revoke all on schema alliance_auth_gate from public,anon,authenticated,service_role;
create function alliance_auth_gate.require_current_session(p_actor uuid,p_session uuid) returns void
language plpgsql security definer set search_path='' as $$${MANAGED_SESSION_GUARD_BODY}$$;
revoke all on function alliance_auth_gate.require_current_session(uuid,uuid) from public,anon,authenticated,service_role,alliance_avatar_executor;
grant usage on schema alliance_auth_gate to alliance_avatar_owner;
grant execute on function alliance_auth_gate.require_current_session(uuid,uuid) to alliance_avatar_owner;`);
  const start=session.indexOf('create function alliance_avatar.require_account_session('),end=session.indexOf('-- Account-level authorization');
  if(start<0||end<=start)throw fail();
  session=session.slice(0,start)+`create function alliance_avatar.require_account_session(p_actor uuid,p_session uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin perform alliance_auth_gate.require_current_session(p_actor,p_session);end $$;
`+session.slice(end);sources[2]=session;
  return `-- UNAPPLIED managed member candidate. No passwords, LOGIN, flags or real records.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $preflight$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_database()<>'postgres'
 OR (SELECT rolsuper OR NOT rolcreaterole FROM pg_roles WHERE rolname=current_user)
 OR current_setting('server_version_num')::integer/10000 NOT IN(17,18)
 OR to_regnamespace('alliance_avatar') IS NOT NULL OR to_regnamespace('alliance_auth_gate') IS NOT NULL
 OR to_regclass('public.alliance_profiles') IS NOT NULL OR to_regclass('public.alliance_member_owners') IS NOT NULL
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('alliance_avatar_owner','alliance_avatar_executor'))
 OR to_regclass('auth.users') IS NULL OR to_regclass('auth.sessions') IS NULL OR to_regclass('auth.identities') IS NULL
 THEN RAISE EXCEPTION 'Managed member preflight refused';END IF;
END $preflight$;
CREATE TEMP TABLE alliance_install_auth_counts ON COMMIT DROP AS SELECT (SELECT count(*) FROM auth.users) AS users,(SELECT count(*) FROM auth.identities) AS identities;
${sources.join('\n')}
REVOKE alliance_avatar_owner FROM postgres GRANTED BY postgres;
DO $verify$ DECLARE edges jsonb; BEGIN
 IF EXISTS(SELECT 1 FROM alliance_avatar.control WHERE enabled OR creation_enabled OR cleanup_enabled OR profile_revision_enabled)
 OR EXISTS(SELECT 1 FROM public.alliance_profiles) OR EXISTS(SELECT 1 FROM public.alliance_member_owners)
 OR (SELECT count(*) FROM pg_roles WHERE rolname IN('alliance_avatar_owner','alliance_avatar_executor') AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication)<>2
 OR pg_has_role('postgres','alliance_avatar_owner','SET')
 OR has_schema_privilege('alliance_avatar_owner','auth','USAGE')
 OR has_function_privilege('alliance_avatar_executor','alliance_auth_gate.require_current_session(uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon','alliance_auth_gate.require_current_session(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated','alliance_auth_gate.require_current_session(uuid,uuid)','EXECUTE')
 OR has_function_privilege('service_role','alliance_auth_gate.require_current_session(uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('alliance_avatar_owner','alliance_auth_gate.require_current_session(uuid,uuid)','EXECUTE')
 OR has_schema_privilege('alliance_avatar_owner','alliance_auth_gate','CREATE')
 OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='alliance_auth_gate.require_current_session(uuid,uuid)'::regprocedure AND prosecdef AND pg_get_userbyid(proowner)='postgres' AND prorettype='void'::regtype AND array_length(proconfig,1)=1 AND proconfig[1] IN('search_path=','search_path=""'))
 OR (SELECT prosrc FROM pg_proc WHERE oid='alliance_auth_gate.require_current_session(uuid,uuid)'::regprocedure) IS DISTINCT FROM $guard$${MANAGED_SESSION_GUARD_BODY}$guard$
 OR (SELECT count(*) FROM auth.users)<>(SELECT users FROM alliance_install_auth_counts)
 OR (SELECT count(*) FROM auth.identities)<>(SELECT identities FROM alliance_install_auth_counts)
 THEN RAISE EXCEPTION 'Managed member installed state refused';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_array(pg_get_userbyid(m.roleid),pg_get_userbyid(m.member),pg_get_userbyid(m.grantor),m.admin_option,m.inherit_option,m.set_option) ORDER BY pg_get_userbyid(m.roleid)),'[]'::jsonb) INTO edges FROM pg_auth_members m WHERE m.roleid IN(SELECT oid FROM pg_roles WHERE rolname IN('alliance_avatar_owner','alliance_avatar_executor')) OR m.member IN(SELECT oid FROM pg_roles WHERE rolname IN('alliance_avatar_owner','alliance_avatar_executor'));
 IF edges IS DISTINCT FROM '[["alliance_avatar_executor","postgres","supabase_admin",true,false,false],["alliance_avatar_owner","postgres","supabase_admin",true,false,false]]'::jsonb THEN RAISE EXCEPTION 'Managed member role edges refused';END IF;
END $verify$;
COMMIT;
`;
}
