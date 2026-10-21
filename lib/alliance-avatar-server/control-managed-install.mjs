// OFFLINE, UNAPPLIED preparation only. No runtime import, connection or apply.
import {readFileSync} from 'node:fs';
import {MANAGED_CONTROL_ENVIRONMENT_SQL,managedControlEnvironment} from './control-managed.mjs';
const fail=()=>Error('alliance_control_managed_install_unavailable');
function replaceOnce(text,from,to){if(text.split(from).length!==2)throw fail();return text.replace(from,to);}
export function managedControlInstallSql(){
 let base=readFileSync(new URL('../../sql/alliance-control-store-candidate.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 const anchor=readFileSync(new URL('../../sql/alliance-control-removal-anchor-candidate.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 base=replaceOnce(base,'create schema alliance_control authorization alliance_control_owner;',`-- Installer-only SET; automatic bootstrap ADMIN-only edges remain.\ngrant alliance_control_owner to postgres with inherit false, set true;\ncreate schema alliance_control authorization alliance_control_owner;`);
 base=replaceOnce(base,'revoke all on schema alliance_control from public,anon,authenticated,service_role;\nset local role alliance_control_owner;','set local role alliance_control_owner;\nrevoke all on schema alliance_control from public,anon,authenticated,service_role;');
 return `-- UNAPPLIED explicit supabase-managed control AND anchor candidate.
-- Separate exact hosted approval required. No passwords, LOGIN, bootstrap or mode.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $preflight$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_database()<>'postgres'
 OR (SELECT rolsuper OR NOT rolcreaterole FROM pg_catalog.pg_roles WHERE rolname=current_user)
 OR current_setting('server_version_num')::integer/10000 NOT IN(17,18)
 OR to_regnamespace('alliance_control') IS NOT NULL OR to_regnamespace('alliance_account') IS NOT NULL
 OR to_regnamespace('alliance_avatar') IS NOT NULL OR to_regnamespace('alliance_journal') IS NOT NULL
 OR to_regclass('auth.users') IS NULL OR to_regclass('auth.identities') IS NULL OR to_regclass('storage.objects') IS NULL OR to_regclass('storage.buckets') IS NULL THEN RAISE EXCEPTION 'Managed control install preflight refused'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users) OR EXISTS(SELECT 1 FROM auth.identities) OR EXISTS(SELECT 1 FROM storage.objects) OR EXISTS(SELECT 1 FROM storage.buckets) THEN RAISE EXCEPTION 'Managed control domain is not empty'; END IF;
END $preflight$;
${base}
${anchor}
REVOKE alliance_control_owner FROM postgres GRANTED BY postgres;
DO $verify$ BEGIN
 IF (${MANAGED_CONTROL_ENVIRONMENT_SQL}) IS DISTINCT FROM '${JSON.stringify(managedControlEnvironment())}'::jsonb
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN('alliance_control_owner','alliance_control_reader','alliance_control_operator','alliance_control_anchor_writer') AND rolcanlogin)
 THEN RAISE EXCEPTION 'Managed control installed permissions refused'; END IF;
END $verify$;
COMMIT;
`;
}
