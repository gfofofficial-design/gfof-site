// Unapplied one-shot diagnostic candidate. Always aborts its transaction; it is
// never an alternate installer and has no connection or credential lookup.
import {managedMemberInstallSql} from './member-managed-install.mjs';
import {MANAGED_MEMBER_ISOLATION} from './member-managed-auth.mjs';
const fail=()=>Error('alliance_member_diagnostic_unavailable');
const names=['bootstrap','auth_schema_owner','role_attributes','creator_edges',
  'owner_auth_denied','executor_auth_denied','verifier_schema_owner','verifier_count',
  'fixed_verifier','owner_verifier_usage','owner_verifier_create_denied',
  'owner_verifier_execute','api_verifier_denied','public_table_access_closed','public_function_access_closed'];
export function managedMemberDiagnosticSql(){
  const source=managedMemberInstallSql(),at=source.indexOf('DO $verify$');
  if(at<0||source.indexOf('DO $verify$',at+1)!==-1||!source.endsWith('COMMIT;\n'))throw fail();
  // Fixed source clauses, never caller SQL. Refuse a changed source layout.
  const clauses=MANAGED_MEMBER_ISOLATION.trim().slice(1,-1).trim().split(/\n AND /);
  if(clauses.length!==names.length)throw fail();
  const pairs=clauses.map((sql,i)=>`'${names[i]}', ((${sql}) IS NOT DISTINCT FROM true)`).join(',\n');
  return source.slice(0,at)+`DO $diagnostic$ DECLARE report jsonb; BEGIN
 report:=jsonb_build_object('checks',jsonb_build_object(${pairs}),
  'roles_locked',(SELECT count(*)=2 AND bool_and(NOT rolcanlogin) FROM pg_roles WHERE rolname IN('alliance_avatar_owner','alliance_avatar_executor')),
  'temporary_set_removed',NOT pg_has_role('postgres','alliance_avatar_owner','SET'),
  'temporary_schema_access_removed',NOT has_schema_privilege('postgres','alliance_avatar','USAGE,CREATE'),
  'auth_counts_unchanged',(SELECT count(*) FROM auth.users)=(SELECT users FROM alliance_install_auth_counts) AND (SELECT count(*) FROM auth.identities)=(SELECT identities FROM alliance_install_auth_counts),
  'creator_edges',(SELECT coalesce(jsonb_agg(jsonb_build_array(pg_get_userbyid(m.roleid),pg_get_userbyid(m.member),pg_get_userbyid(m.grantor),m.admin_option,m.inherit_option,m.set_option) ORDER BY pg_get_userbyid(m.roleid),pg_get_userbyid(m.member)),'[]'::jsonb) FROM pg_auth_members m WHERE m.roleid IN(SELECT oid FROM pg_roles WHERE rolname IN('alliance_avatar_owner','alliance_avatar_executor')) OR m.member IN(SELECT oid FROM pg_roles WHERE rolname IN('alliance_avatar_owner','alliance_avatar_executor'))));
 -- Intentionally fail even if every predicate passes. No success/COMMIT path.
 RAISE EXCEPTION 'Managed member rollback-only diagnostic' USING DETAIL=report::text;
END $diagnostic$;
ROLLBACK;
`;
}
