// OFFLINE SQL preparation only. No connection, credential, execution or runtime
// import. Output is an UNAPPLIED candidate, never a Supabase migration record.
import {readFileSync} from 'node:fs';
import {MANAGED_ACCOUNT_ENVIRONMENT_SQL,managedAccountEnvironment} from './account-managed.mjs';
const fail=()=>Error('alliance_account_managed_install_unavailable');
function replaceOnce(text,from,to){if(text.split(from).length!==2)throw fail();return text.replace(from,to);}
export function managedAccountInstallSql(domain){
 if(!['history','ack'].includes(domain))throw fail();
 let common=readFileSync(new URL('../../sql/alliance-account-protocol-candidate.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 common=replaceOnce(common,'-- Not a migration; never install beside member/Auth or both domains together.','-- Not a migration; never install beside Alliance member data or both account domains.\n-- This explicit profile permits the fixed managed Auth/Storage baseline only.');
 let specific=readFileSync(new URL(`../../sql/alliance-account-${domain}-store-candidate.sql`,import.meta.url),'utf8').replace(/\r\n/g,'\n');
 // The nonsuperuser cannot even resolve a private relation before SET ROLE.
 specific='set local role alliance_account_owner;\n'+replaceOnce(specific,'set local role alliance_account_owner;\n','');
 common=replaceOnce(common,"or to_regnamespace('auth') is not null ",'');
 common=replaceOnce(common,'create schema alliance_account authorization alliance_account_owner;',`-- Exact installer-only SET grant; automatic ADMIN-only creator grant remains.\ngrant alliance_account_owner to postgres with inherit false, set true;\ncreate schema alliance_account authorization alliance_account_owner;`);
 common=replaceOnce(common,'revoke all on schema alliance_account from public,anon,authenticated,service_role;\nset local role alliance_account_owner;','set local role alliance_account_owner;\nrevoke all on schema alliance_account from public,anon,authenticated,service_role;');
 return `-- UNAPPLIED explicit supabase-managed account ${domain} installation candidate.
-- Requires separate exact hosted approval. No password, login or mode enabled.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $preflight$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_database()<>'postgres'
 OR (SELECT rolsuper OR NOT rolcreaterole FROM pg_catalog.pg_roles WHERE rolname=current_user)
 OR current_setting('server_version_num')::integer/10000 NOT IN(17,18)
 OR to_regnamespace('alliance_account') IS NOT NULL
 OR to_regclass('auth.users') IS NULL OR to_regclass('auth.identities') IS NULL OR to_regclass('storage.objects') IS NULL OR to_regclass('storage.buckets') IS NULL THEN RAISE EXCEPTION 'Managed account install preflight refused'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users) OR EXISTS(SELECT 1 FROM auth.identities) OR EXISTS(SELECT 1 FROM storage.objects) OR EXISTS(SELECT 1 FROM storage.buckets) THEN RAISE EXCEPTION 'Managed account domain is not empty'; END IF;
END $preflight$;
${common}
${specific}
-- Revokes only the grant made by current postgres, not the bootstrap grant.
REVOKE alliance_account_owner FROM postgres GRANTED BY postgres;
DO $verify$ BEGIN
 IF (${MANAGED_ACCOUNT_ENVIRONMENT_SQL}) IS DISTINCT FROM '${JSON.stringify(managedAccountEnvironment())}'::jsonb
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN('alliance_account_owner','alliance_account_reader','alliance_account_writer','alliance_account_operator') AND (rolcanlogin OR rolsuper OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls))
 OR (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN('alliance_account_owner','alliance_account_reader','alliance_account_writer','alliance_account_operator'))<>4 THEN RAISE EXCEPTION 'Managed account installed permissions refused'; END IF;
END $verify$;
COMMIT;
`;
}
