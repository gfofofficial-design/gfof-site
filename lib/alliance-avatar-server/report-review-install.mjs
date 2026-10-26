// Source-only, atomic disabled extension; no connection or credential lookup.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {FEEDBACK_BOUNDARY_SQL} from './feedback-boundary.mjs';
const source=()=>readFileSync(new URL('../../sql/alliance-report-review-candidate.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const hash=v=>createHash('sha256').update(v).digest('hex');
const quote=v=>"'"+v.replaceAll("'","''")+"'";
const entry=new Set(['queue_session','read_session','review_session','recovery_inventory']);
export function reportReviewManifest(){
 const sql=source(),functions=[...sql.matchAll(/create function alliance_report_review\.(\w+)\(([^)]*)\) returns (\w+)\nlanguage (\w+)( immutable)? security (invoker|definer) set search_path=''((?: set \w+='[^']*')*) as \$\$([\s\S]*?)\$\$;/g)].map(m=>({
  name:m[1],arguments:m[2].split(',').filter(Boolean).map(v=>v.trim().split(' ').slice(1).join(' ')).join(', '),result:m[3],language:m[4],volatility:m[5]?'i':'v',definer:m[6]==='definer',settings:1+(m[7].match(/ set /g)||[]).length,bodySha256:hash(m[8]),
 }));
 if(functions.length!==8||new Set(functions.map(f=>f.name)).size!==8)throw Error('report_review_source_changed');
 return {sourceSha256:hash(sql),functions};
}
export function reportReviewBoundarySql(){
 const {functions}=reportReviewManifest();
 const checks=functions.map(f=>`EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
 WHERE n.nspname='alliance_report_review' AND p.proname=${quote(f.name)} AND oidvectortypes(p.proargtypes)=${quote(f.arguments.replaceAll('timestamptz','timestamp with time zone'))}
 AND p.prorettype=${quote(f.result.replaceAll('timestamptz','timestamp with time zone'))}::regtype AND pg_get_userbyid(p.proowner)='alliance_avatar_owner'
 AND p.prosecdef=${f.definer} AND l.lanname=${quote(f.language)} AND p.provolatile=${quote(f.volatility)}
 AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=${quote(f.bodySha256)} AND cardinality(p.proconfig)=${f.settings}
 AND NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) x WHERE lower(x) NOT IN('search_path=','search_path=""','timezone=utc','datestyle=iso, ymd'))
 AND has_function_privilege('alliance_avatar_executor',p.oid,'EXECUTE')=${entry.has(f.name)}
 AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantor<>p.proowner OR a.privilege_type<>'EXECUTE' OR a.is_grantable
 OR NOT(a.grantee=p.proowner${entry.has(f.name)?" OR a.grantee=(SELECT oid FROM pg_roles WHERE rolname='alliance_avatar_executor')":''})))`).join('\n AND ');
 return `SELECT ((SELECT feedback_boundary FROM (${FEEDBACK_BOUNDARY_SQL}) prior)
 AND EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='alliance_report_review' AND pg_get_userbyid(nspowner)='alliance_avatar_owner')
 AND has_schema_privilege('alliance_avatar_executor','alliance_report_review','USAGE') AND NOT has_schema_privilege('alliance_avatar_executor','alliance_report_review','CREATE')
 AND NOT EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname IN('anon','authenticated','service_role') AND has_schema_privilege(r.oid,'alliance_report_review','USAGE,CREATE'))
 AND (SELECT count(*)=2 AND bool_and(c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity AND pg_get_userbyid(c.relowner)='alliance_avatar_owner' AND c.relname IN('control','reviews')) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='alliance_report_review' AND c.relkind NOT IN('i','I'))
 AND (SELECT jsonb_agg(jsonb_build_array(c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull) ORDER BY c.relname,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='alliance_report_review' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped)
 ='[["control","id","boolean",true],["control","enabled","boolean",true],["control","reviewer_actor","uuid",false],["reviews","report_id","uuid",true],["reviews","first_reviewed_at","timestamp with time zone",true],["reviews","disposition","text",true]]'::jsonb
 AND (SELECT count(*)=2 AND bool_and(p.polname='owner_only' AND p.polpermissive AND p.polcmd='*' AND p.polroles=ARRAY[(SELECT oid FROM pg_roles WHERE rolname='alliance_avatar_owner')] AND pg_get_expr(p.polqual,p.polrelid)='true' AND pg_get_expr(p.polwithcheck,p.polrelid)='true') FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='alliance_report_review')
 AND NOT EXISTS(SELECT 1 FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='alliance_report_review' AND c.relkind='r' AND r.rolname IN('anon','authenticated','service_role','alliance_avatar_executor') AND (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
 AND (SELECT count(*)=1 AND bool_and(k.confdeltype='c' AND k.convalidated AND k.confrelid='alliance_feedback.reports'::regclass) FROM pg_constraint k JOIN pg_namespace n ON n.oid=k.connamespace WHERE n.nspname='alliance_report_review' AND k.contype='f')
 AND (SELECT count(*)=8 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='alliance_report_review')
 AND ${checks}) AS report_review_boundary`;
}
const closed=`DO $review_closed$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM alliance_avatar.control WHERE id AND NOT enabled AND NOT creation_enabled AND NOT cleanup_enabled AND NOT profile_revision_enabled)
 OR NOT EXISTS(SELECT 1 FROM alliance_community.control WHERE id AND NOT enabled)
 OR NOT EXISTS(SELECT 1 FROM alliance_feedback.control WHERE id AND NOT enabled)
 THEN RAISE EXCEPTION 'Report review requires a closed foundation';END IF;
END $review_closed$;`;
export function managedReportReviewExtensionSql(){return `BEGIN;
SET LOCAL search_path=pg_catalog;
DO $review_preflight$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_database()<>'postgres'
 OR current_setting('server_version_num')::integer/10000 NOT IN(17,18)
 OR (SELECT feedback_boundary FROM (${FEEDBACK_BOUNDARY_SQL}) prior) IS DISTINCT FROM true
 OR to_regnamespace('alliance_report_review') IS NOT NULL OR pg_has_role('postgres','alliance_avatar_owner','SET')
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('alliance_avatar_owner','alliance_avatar_executor') AND rolcanlogin)
 THEN RAISE EXCEPTION 'Report review preflight refused';END IF;
END $review_preflight$;
GRANT alliance_avatar_owner TO postgres WITH INHERIT false, SET true;
SET LOCAL ROLE alliance_avatar_owner;
${closed}
RESET ROLE;
CREATE SCHEMA alliance_report_review AUTHORIZATION alliance_avatar_owner;
${source()}
SET LOCAL ROLE alliance_avatar_owner;
DO $review_empty$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM alliance_report_review.control WHERE id AND NOT enabled AND reviewer_actor IS NULL)
 OR EXISTS(SELECT 1 FROM alliance_report_review.reviews) THEN RAISE EXCEPTION 'Report review is not empty and disabled';END IF;
END $review_empty$;
RESET ROLE;
REVOKE alliance_avatar_owner FROM postgres GRANTED BY postgres;
DO $review_verify$ BEGIN
 IF (SELECT report_review_boundary FROM (${reportReviewBoundarySql()}) verified) IS DISTINCT FROM true
 OR pg_has_role('postgres','alliance_avatar_owner','SET')
 THEN RAISE EXCEPTION 'Report review verification refused';END IF;
END $review_verify$;
COMMIT;`;
}
export function managedReportReviewRollbackSql(){
 const sql=managedReportReviewExtensionSql();if(!sql.endsWith('\nCOMMIT;'))throw Error('report_review_source_changed');
 return sql.slice(0,-'COMMIT;'.length)+'ROLLBACK;';
}
