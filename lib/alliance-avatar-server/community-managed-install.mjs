// Offline atomic upgrade/inspection candidate. Never connects or applies SQL.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MANAGED_MEMBER_ISOLATION} from './member-managed-auth.mjs';
import {MANAGED_MEMBER_TEMPORARY_RIGHTS_REMOVED} from './member-managed-install.mjs';
import {COMMUNITY_BOUNDARY_SQL,COMMUNITY_SOURCE_SHA256} from './community-boundary.mjs';
const fail=()=>Error('community_managed_source_changed');
const base=`current_user='postgres' AND session_user='postgres' AND current_database()='postgres'
 AND current_setting('server_version_num')::integer/10000 IN(17,18)
 AND (${MANAGED_MEMBER_ISOLATION}) IS TRUE AND (${MANAGED_MEMBER_TEMPORARY_RIGHTS_REMOVED}) IS TRUE
 AND (SELECT count(*)=2 AND bool_and(NOT rolcanlogin) FROM pg_roles WHERE rolname IN('alliance_avatar_owner','alliance_avatar_executor'))
 AND NOT pg_has_role('postgres','alliance_avatar_owner','SET')`;
const closed=`DO $community_closed$ DECLARE t record; BEGIN
 IF (SELECT count(*) FROM alliance_avatar.control)<>1
 OR NOT EXISTS(SELECT 1 FROM alliance_avatar.control WHERE id AND NOT enabled AND NOT creation_enabled AND NOT cleanup_enabled AND NOT profile_revision_enabled)
 OR EXISTS(SELECT 1 FROM public.alliance_profiles) OR EXISTS(SELECT 1 FROM public.alliance_member_owners)
 THEN RAISE EXCEPTION 'Community requires an empty closed member foundation';END IF;
 FOR t IN SELECT * FROM jsonb_to_recordset(alliance_avatar.recovery_inventory()->'tables') AS x("table" text,rows bigint,sha256 text) LOOP
  IF t.rows IS DISTINCT FROM (CASE WHEN t."table"='alliance_avatar.control' THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'Community requires an empty closed member foundation';END IF;
 END LOOP;
END $community_closed$;`;
const communityClosed=`DO $community_empty$ DECLARE t record; BEGIN
 IF NOT EXISTS(SELECT 1 FROM alliance_community.control WHERE id AND NOT enabled AND mutations=0 AND invitations=0 AND contributions=0)
 THEN RAISE EXCEPTION 'Community is not empty and closed';END IF;
 FOR t IN SELECT * FROM jsonb_to_recordset(alliance_community.recovery_inventory()->'tables') AS x("table" text,rows bigint,sha256 text) LOOP
  IF t.rows IS DISTINCT FROM (CASE WHEN t."table"='alliance_community.control' THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'Community is not empty and closed';END IF;
 END LOOP;
END $community_empty$;`;
export function managedCommunityExtensionSql(){
 const source=readFileSync(new URL('../../sql/alliance-community-candidate.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 if(createHash('sha256').update(source).digest('hex')!==COMMUNITY_SOURCE_SHA256)throw fail();
 return `BEGIN;
SET LOCAL search_path=pg_catalog;
DO $community_preflight$ BEGIN
 IF (${base}) IS DISTINCT FROM true OR to_regnamespace('alliance_community') IS NOT NULL
 OR has_column_privilege('alliance_avatar_owner','public.alliance_profiles','id','REFERENCES')
 THEN RAISE EXCEPTION 'Managed community preflight refused';END IF;
END $community_preflight$;
CREATE TEMP TABLE alliance_community_auth_counts ON COMMIT DROP AS SELECT (SELECT count(*) FROM auth.users) AS users,(SELECT count(*) FROM auth.identities) AS identities;
GRANT alliance_avatar_owner TO postgres WITH INHERIT false, SET true;
SET LOCAL ROLE alliance_avatar_owner;
${closed}
RESET ROLE;
GRANT REFERENCES(id) ON public.alliance_profiles TO alliance_avatar_owner;
CREATE SCHEMA alliance_community AUTHORIZATION alliance_avatar_owner;
${source}
SET LOCAL ROLE alliance_avatar_owner;
${communityClosed}
RESET ROLE;
REVOKE alliance_avatar_owner FROM postgres GRANTED BY postgres;
DO $community_verify$ DECLARE matched boolean; BEGIN
 SELECT community_boundary INTO matched FROM (${COMMUNITY_BOUNDARY_SQL}) verified;
 IF matched IS DISTINCT FROM true OR (${base}) IS DISTINCT FROM true
 OR NOT has_column_privilege('alliance_avatar_owner','public.alliance_profiles','id','REFERENCES')
 OR has_table_privilege('alliance_avatar_owner','public.alliance_profiles','REFERENCES')
 OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.alliance_profiles'::regclass AND a.attnum>0 AND NOT a.attisdropped AND a.attname<>'id' AND has_column_privilege('alliance_avatar_owner',a.attrelid,a.attname,'REFERENCES'))
 OR (SELECT count(*) FROM auth.users)<>(SELECT users FROM alliance_community_auth_counts)
 OR (SELECT count(*) FROM auth.identities)<>(SELECT identities FROM alliance_community_auth_counts)
 THEN RAISE EXCEPTION 'Managed community verification refused';END IF;
END $community_verify$;
COMMIT;
`;
}
export function managedCommunityClosedInspectionSql(){return `BEGIN;
SET LOCAL search_path=pg_catalog;
DO $community_identity$ DECLARE matched boolean; BEGIN
 SELECT community_boundary INTO matched FROM (${COMMUNITY_BOUNDARY_SQL}) verified;
 IF (${base}) IS DISTINCT FROM true OR matched IS DISTINCT FROM true THEN RAISE EXCEPTION 'Managed community inspection refused';END IF;
END $community_identity$;
GRANT alliance_avatar_owner TO postgres WITH INHERIT false, SET true;
SET LOCAL ROLE alliance_avatar_owner;
${closed}
${communityClosed}
SELECT alliance_community.recovery_inventory() AS closed_community_inventory;
RESET ROLE;
REVOKE alliance_avatar_owner FROM postgres GRANTED BY postgres;
ROLLBACK;
`;}
