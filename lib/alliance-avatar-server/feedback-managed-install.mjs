// Offline atomic candidate only; no connection, credential lookup or submission.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MANAGED_MEMBER_ISOLATION} from './member-managed-auth.mjs';
import {MANAGED_MEMBER_TEMPORARY_RIGHTS_REMOVED} from './member-managed-install.mjs';
import {COMMUNITY_BOUNDARY_SQL} from './community-boundary.mjs';
import {FEEDBACK_BOUNDARY_SQL,FEEDBACK_SOURCE_SHA256} from './feedback-boundary.mjs';
const base=`current_user='postgres' AND session_user='postgres' AND current_database()='postgres'
 AND current_setting('server_version_num')::integer/10000 IN(17,18)
 AND (${MANAGED_MEMBER_ISOLATION}) IS TRUE AND (${MANAGED_MEMBER_TEMPORARY_RIGHTS_REMOVED}) IS TRUE
 AND (SELECT count(*)=2 AND bool_and(NOT rolcanlogin) FROM pg_roles WHERE rolname IN('alliance_avatar_owner','alliance_avatar_executor'))
 AND NOT pg_has_role('postgres','alliance_avatar_owner','SET')`;
const closed=`DO $feedback_closed$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM alliance_avatar.control WHERE id AND NOT enabled AND NOT creation_enabled AND NOT cleanup_enabled AND NOT profile_revision_enabled)
 OR NOT EXISTS(SELECT 1 FROM alliance_community.control WHERE id AND NOT enabled)
 THEN RAISE EXCEPTION 'Feedback requires a closed foundation';END IF;
END $feedback_closed$;`;
const empty=`DO $feedback_empty$ DECLARE t record;BEGIN
 IF NOT EXISTS(SELECT 1 FROM alliance_feedback.control WHERE id AND NOT enabled AND mutations=0 AND ideas_created=0 AND support_adds=0 AND reports_created=0)
 THEN RAISE EXCEPTION 'Feedback is not empty and closed';END IF;
 FOR t IN SELECT * FROM jsonb_to_recordset(alliance_feedback.recovery_inventory()->'tables') AS x("table" text,rows bigint,sha256 text) LOOP
 IF t.rows IS DISTINCT FROM (CASE WHEN t."table"='alliance_feedback.control' THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'Feedback is not empty and closed';END IF;
 END LOOP;
END $feedback_empty$;`;
export function managedFeedbackExtensionSql(){
 const source=readFileSync(new URL('../../sql/alliance-feedback-candidate.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 if(createHash('sha256').update(source).digest('hex')!==FEEDBACK_SOURCE_SHA256)throw Error('feedback_source_changed');
 return `BEGIN;
SET LOCAL search_path=pg_catalog;
DO $feedback_preflight$ DECLARE matched boolean;BEGIN
 SELECT community_boundary INTO matched FROM (${COMMUNITY_BOUNDARY_SQL}) prior;
 IF (${base}) IS DISTINCT FROM true OR matched IS DISTINCT FROM true OR to_regnamespace('alliance_feedback') IS NOT NULL
 OR NOT has_column_privilege('alliance_avatar_owner','public.alliance_profiles','id','REFERENCES')
 THEN RAISE EXCEPTION 'Managed feedback preflight refused';END IF;
END $feedback_preflight$;
CREATE TEMP TABLE alliance_feedback_auth_counts ON COMMIT DROP AS SELECT (SELECT count(*) FROM auth.users) AS users,(SELECT count(*) FROM auth.identities) AS identities;
GRANT alliance_avatar_owner TO postgres WITH INHERIT false, SET true;
SET LOCAL ROLE alliance_avatar_owner;
${closed}
RESET ROLE;
CREATE SCHEMA alliance_feedback AUTHORIZATION alliance_avatar_owner;
${source}
SET LOCAL ROLE alliance_avatar_owner;
${empty}
RESET ROLE;
REVOKE alliance_avatar_owner FROM postgres GRANTED BY postgres;
DO $feedback_verify$ DECLARE matched boolean;BEGIN
 SELECT feedback_boundary INTO matched FROM (${FEEDBACK_BOUNDARY_SQL}) verified;
 IF matched IS DISTINCT FROM true OR (${base}) IS DISTINCT FROM true
 OR (SELECT count(*) FROM auth.users)<>(SELECT users FROM alliance_feedback_auth_counts)
 OR (SELECT count(*) FROM auth.identities)<>(SELECT identities FROM alliance_feedback_auth_counts)
 THEN RAISE EXCEPTION 'Managed feedback verification refused';END IF;
END $feedback_verify$;
COMMIT;
`;
}
export function managedFeedbackClosedInspectionSql(){return `BEGIN;
SET LOCAL search_path=pg_catalog;
DO $feedback_identity$ DECLARE matched boolean;BEGIN
 SELECT feedback_boundary INTO matched FROM (${FEEDBACK_BOUNDARY_SQL}) verified;
 IF (${base}) IS DISTINCT FROM true OR matched IS DISTINCT FROM true THEN RAISE EXCEPTION 'Managed feedback inspection refused';END IF;
END $feedback_identity$;
GRANT alliance_avatar_owner TO postgres WITH INHERIT false, SET true;
SET LOCAL ROLE alliance_avatar_owner;
${closed}
${empty}
SELECT alliance_feedback.recovery_inventory() AS closed_feedback_inventory;
RESET ROLE;
REVOKE alliance_avatar_owner FROM postgres GRANTED BY postgres;
ROLLBACK;
`;}
