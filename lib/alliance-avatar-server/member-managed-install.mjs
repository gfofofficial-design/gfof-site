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
  'alliance-profile-directory-candidate.sql',
]);
import {MANAGED_SESSION_GUARD_BODY,MANAGED_MEMBER_ISOLATION} from './member-managed-auth.mjs';
export {MANAGED_SESSION_GUARD_BODY} from './member-managed-auth.mjs';
const once=(s,from,to)=>{if(s.split(from).length!==2)throw fail();return s.replace(from,()=>to);};
const read=name=>readFileSync(new URL('../../sql/'+name,import.meta.url),'utf8').replace(/\r\n/g,'\n');
export function managedMemberInstallManifest(){return MEMBER_INSTALL_SOURCES.map(name=>({name,sha256:createHash('sha256').update(read(name)).digest('hex')}));}
// The existing managed administrator may inherit pg_read_all_data, which gives
// implicit schema USAGE without an ACL entry. Verify our temporary grants are
// gone; never grant that built-in role or treat the admin as an isolated client.
export const MANAGED_MEMBER_TEMPORARY_RIGHTS_REMOVED=`(
 EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='alliance_avatar' AND pg_get_userbyid(nspowner)='alliance_avatar_owner')
 AND NOT has_schema_privilege('postgres','alliance_avatar','CREATE')
 AND (NOT has_schema_privilege('postgres','alliance_avatar','USAGE') OR pg_has_role('postgres','pg_read_all_data','USAGE'))
 AND NOT EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='alliance_avatar' AND a.grantee IN(0,(SELECT oid FROM pg_roles WHERE rolname='postgres')) AND a.privilege_type IN('USAGE','CREATE'))
 AND (SELECT count(*)=2 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='alliance_avatar' AND p.proname IN('profile_removed','profile_revision_removed') AND p.proargtypes=''::oidvector)
 AND NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE n.nspname='alliance_avatar' AND p.proname IN('profile_removed','profile_revision_removed') AND a.grantee IN(0,(SELECT oid FROM pg_roles WHERE rolname='postgres')) AND a.privilege_type='EXECUTE')
)`;
// Independent closed-row verification only. The temporary role switch is rolled
// back even on success; no persistent inspection privilege or login is added.
export function managedMemberClosedInspectionSql(){return `BEGIN;
SET LOCAL search_path=pg_catalog;
DO $identity$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_database()<>'postgres'
 OR (${MANAGED_MEMBER_ISOLATION}) IS DISTINCT FROM true
 OR (${MANAGED_MEMBER_TEMPORARY_RIGHTS_REMOVED}) IS DISTINCT FROM true
 OR (SELECT count(*) FROM pg_roles WHERE rolname IN('alliance_avatar_owner','alliance_avatar_executor') AND NOT rolcanlogin)<>2
 OR pg_has_role('postgres','alliance_avatar_owner','SET')
 THEN RAISE EXCEPTION 'Managed member inspection refused';END IF;
END $identity$;
GRANT alliance_avatar_owner TO postgres WITH INHERIT false, SET true;
SET LOCAL ROLE alliance_avatar_owner;
DO $closed$ DECLARE item record; BEGIN
 IF (SELECT count(*) FROM alliance_avatar.control)<>1
 OR NOT EXISTS(SELECT 1 FROM alliance_avatar.control WHERE id AND NOT enabled AND NOT creation_enabled AND NOT cleanup_enabled AND NOT profile_revision_enabled)
 THEN RAISE EXCEPTION 'Managed member is not closed';END IF;
 FOR item IN SELECT * FROM jsonb_to_recordset(alliance_avatar.recovery_inventory()->'tables') AS t("table" text,rows integer,sha256 text) LOOP
  IF item.rows IS DISTINCT FROM (CASE WHEN item."table"='alliance_avatar.control' THEN 1 ELSE 0 END)
  THEN RAISE EXCEPTION 'Managed member is not empty';END IF;
 END LOOP;
END $closed$;
SELECT alliance_avatar.recovery_inventory() AS closed_inventory;
RESET ROLE;
REVOKE alliance_avatar_owner FROM postgres GRANTED BY postgres;
ROLLBACK;
`;}
export function managedMemberInstallSql(){
  const sources=MEMBER_INSTALL_SOURCES.map(read);
  sources[1]=once(sources[1],'create schema alliance_avatar authorization alliance_avatar_owner;',`grant alliance_avatar_owner to postgres with inherit false, set true;
create schema alliance_avatar authorization alliance_avatar_owner;
set local role alliance_avatar_owner;`);
  sources[1]=once(sources[1],'grant usage on schema public to alliance_avatar_owner;',`reset role;
grant usage on schema public to alliance_avatar_owner;`);
  sources[1]=once(sources[1],'reset role;\ncreate trigger alliance_avatar_profile_removed after delete on public.alliance_profiles for each row execute function alliance_avatar.profile_removed();',`grant usage on schema alliance_avatar to postgres;
grant execute on function alliance_avatar.profile_removed() to postgres;
reset role;
create trigger alliance_avatar_profile_removed after delete on public.alliance_profiles for each row execute function alliance_avatar.profile_removed();
set local role alliance_avatar_owner;
revoke execute on function alliance_avatar.profile_removed() from postgres;
revoke usage on schema alliance_avatar from postgres;
reset role;`);
  sources[3]=once(sources[3],'alter table alliance_avatar.control add column cleanup_enabled boolean not null default false;',`set local role alliance_avatar_owner;
alter table alliance_avatar.control add column cleanup_enabled boolean not null default false;`);
  // Existing preflights must run as the private table owner. Public-table ACL
  // changes remain with their actual installer owner, not a superuser shortcut.
  for(const name of ['alliance-creation-admission-candidate.sql','alliance-profile-write-fence-candidate.sql','alliance-profile-revision-candidate.sql']){
    const index=MEMBER_INSTALL_SOURCES.indexOf(name),at=sources[index].indexOf('do $$');
    if(at<0)throw fail();sources[index]=sources[index].slice(0,at)+'set local role alliance_avatar_owner;\n'+sources[index].slice(at);
    if(name==='alliance-creation-admission-candidate.sql'){
      const firstEnd=sources[index].indexOf('end $$;',at),nextRole=sources[index].indexOf('set local role alliance_avatar_owner;',at+40);
      if(firstEnd<at||nextRole<firstEnd)throw fail();
      sources[index]=sources[index].slice(0,firstEnd)+sources[index].slice(firstEnd).replace('end $$;',()=> 'end $$;\nreset role;');
    }
  }
  const revisionIndex=MEMBER_INSTALL_SOURCES.indexOf('alliance-profile-revision-candidate.sql');
  sources[revisionIndex]=once(sources[revisionIndex],'reset role;\ncreate trigger alliance_profile_revision_removed after delete on public.alliance_profiles for each row execute function alliance_avatar.profile_revision_removed();',`grant usage on schema alliance_avatar to postgres;
grant execute on function alliance_avatar.profile_revision_removed() to postgres;
reset role;
create trigger alliance_profile_revision_removed after delete on public.alliance_profiles for each row execute function alliance_avatar.profile_revision_removed();
set local role alliance_avatar_owner;
revoke execute on function alliance_avatar.profile_revision_removed() from postgres;
revoke usage on schema alliance_avatar from postgres;
reset role;`);
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
  const removalStart=sources[6].indexOf('create function alliance_avatar.require_removal_session('),removalEnd=sources[6].indexOf('create function alliance_avatar.require_no_removal(');
  if(removalStart<0||removalEnd<=removalStart)throw fail();
  sources[6]=sources[6].slice(0,removalStart)+`create function alliance_avatar.require_removal_session(p_actor uuid,p_session uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin perform alliance_auth_gate.require_current_session(p_actor,p_session);end $$;
`+sources[6].slice(removalEnd);
  return `-- UNAPPLIED managed member candidate. No passwords, LOGIN, flags or real records.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $preflight$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_database()<>'postgres'
 OR (SELECT rolsuper OR NOT rolcreaterole FROM pg_roles WHERE rolname=current_user)
 OR current_setting('server_version_num')::integer/10000 NOT IN(17,18)
 OR to_regnamespace('alliance_avatar') IS NOT NULL OR to_regnamespace('alliance_auth_gate') IS NOT NULL
 OR to_regclass('public.alliance_profiles') IS NOT NULL OR to_regclass('public.alliance_member_owners') IS NOT NULL
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('alliance_member_eligible','alliance_profile_stamp','alliance_save_profile','alliance_my_profile','alliance_remove_profile'))
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('alliance_avatar_owner','alliance_avatar_executor'))
 OR to_regclass('auth.users') IS NULL OR to_regclass('auth.sessions') IS NULL OR to_regclass('auth.identities') IS NULL
 THEN RAISE EXCEPTION 'Managed member preflight refused';END IF;
END $preflight$;
CREATE TEMP TABLE alliance_install_auth_counts ON COMMIT DROP AS SELECT (SELECT count(*) FROM auth.users) AS users,(SELECT count(*) FROM auth.identities) AS identities;
${sources.join('\n')}
-- Only trusted member routes may expose profile text after journal review.
REVOKE ALL ON public.alliance_profiles,public.alliance_member_owners FROM public,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.alliance_member_eligible(),public.alliance_profile_stamp(),public.alliance_save_profile(text,text,text,text,boolean),public.alliance_my_profile(),public.alliance_remove_profile() FROM public,anon,authenticated,service_role;
SET LOCAL ROLE alliance_avatar_owner;
DO $closed$ BEGIN
 IF EXISTS(SELECT 1 FROM alliance_avatar.control WHERE enabled OR creation_enabled OR cleanup_enabled OR profile_revision_enabled)
 OR EXISTS(SELECT 1 FROM public.alliance_profiles) OR EXISTS(SELECT 1 FROM public.alliance_member_owners)
 THEN RAISE EXCEPTION 'Managed member is not empty and closed';END IF;
END $closed$;
RESET ROLE;
REVOKE alliance_avatar_owner FROM postgres GRANTED BY postgres;
DO $verify$ DECLARE edges jsonb; BEGIN
 IF (SELECT count(*) FROM pg_roles WHERE rolname IN('alliance_avatar_owner','alliance_avatar_executor') AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication)<>2
 OR (${MANAGED_MEMBER_ISOLATION}) IS DISTINCT FROM true
 OR pg_has_role('postgres','alliance_avatar_owner','SET')
 OR (${MANAGED_MEMBER_TEMPORARY_RIGHTS_REMOVED}) IS DISTINCT FROM true
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
