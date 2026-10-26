// Unapplied fixed-scope SQL proposal only. No connection, credential or apply API.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reportReviewBoundarySql,reportReviewManifest} from './report-review-install.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const PRIOR='d17dad013717f117106f6ff6e17678c7a627f31957d6fda6b968e770ab8b79a9';
const source=url=>readFileSync(new URL(url,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const snapshot=s=>{const rows=[...s.matchAll(/create function alliance_report_review\.snapshot\([^]*?\$\$;/g)];if(rows.length!==1)throw Error('report_review_upgrade_source_refused');return rows[0][0];};
export function prepareReportReviewEvidenceUpgrade(){
 const previous=source('./report-review-v1.fixture.sql'),next=source('../../sql/alliance-report-review-candidate.sql');
 const before=snapshot(previous),after=snapshot(next),current=reportReviewManifest();
 if(sha(previous)!==PRIOR||previous.replace(before,'SNAPSHOT')!==next.replace(after,'SNAPSHOT')||before===after)throw Error('report_review_upgrade_source_refused');
 const body=s=>{const m=/ as \$\$([^]*?)\$\$;/.exec(s);if(!m)throw Error('report_review_upgrade_source_refused');return sha(m[1]);};
 const oldBody=body(before),newBody=body(after),newBoundary=reportReviewBoundarySql();
 if(newBoundary.split(newBody).length!==2)throw Error('report_review_upgrade_source_refused');
 const oldBoundary=newBoundary.replace(newBody,oldBody);
 const closed=`current_user='postgres' AND session_user='postgres' AND current_database()='postgres'
 AND current_setting('server_version_num')::integer/10000 IN(17,18)
 AND NOT pg_has_role('postgres','alliance_avatar_owner','SET')
 AND (SELECT count(*)=2 AND bool_and(NOT rolcanlogin AND rolpassword IS NULL) FROM pg_authid WHERE rolname IN('alliance_avatar_owner','alliance_avatar_executor'))
 AND NOT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename IN('alliance_avatar_owner','alliance_avatar_executor'))
 AND (SELECT count(*)=1 AND bool_and(id AND NOT enabled AND NOT creation_enabled AND NOT cleanup_enabled AND NOT profile_revision_enabled) FROM alliance_avatar.control)
 AND (SELECT count(*)=1 AND bool_and(id AND NOT enabled AND mutations=0 AND invitations=0 AND contributions=0) FROM alliance_community.control)
 AND (SELECT count(*)=1 AND bool_and(id AND NOT enabled AND mutations=0 AND ideas_created=0 AND support_adds=0 AND reports_created=0) FROM alliance_feedback.control)
 AND (SELECT count(*)=1 AND bool_and(id AND NOT enabled AND reviewer_actor IS NULL) FROM alliance_report_review.control)
 AND NOT EXISTS(SELECT 1 FROM alliance_feedback.reports) AND NOT EXISTS(SELECT 1 FROM alliance_report_review.reviews)
 AND NOT EXISTS(SELECT 1 FROM public.alliance_profiles) AND NOT EXISTS(SELECT 1 FROM public.alliance_member_owners)`;
 const settings="SET LOCAL search_path=pg_catalog;SET LOCAL statement_timeout='3000ms';SET LOCAL lock_timeout='500ms';SET LOCAL idle_in_transaction_session_timeout='5000ms';\n";
 const guard=boundary=>`DO $upgrade_guard$ BEGIN IF (${closed}) IS DISTINCT FROM true OR (SELECT report_review_boundary FROM (${boundary}) b) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Report review closed upgrade refused';END IF;END $upgrade_guard$;\n`;
 const verificationSql='BEGIN READ ONLY;\n'+settings+`SELECT jsonb_build_object('closed',(${closed}),'previousBoundary',(SELECT report_review_boundary FROM (${oldBoundary}) a),'expectedBoundary',(SELECT report_review_boundary FROM (${newBoundary}) b)) AS report_review_upgrade;\nROLLBACK;\n`;
 const sql='BEGIN;\n'+settings+"SET LOCAL synchronous_commit='on';\n"+guard(oldBoundary)+
 'GRANT alliance_avatar_owner TO postgres WITH INHERIT false,SET true;SET LOCAL ROLE alliance_avatar_owner;\n'+after.replace('create function','CREATE OR REPLACE FUNCTION')+
 '\nRESET ROLE;REVOKE alliance_avatar_owner FROM postgres GRANTED BY postgres;\n'+guard(newBoundary)+'COMMIT;';
 return {format:1,ownerApproved:false,projectId:'sfsluqpsaevhpqbdlbit',previousSourceSha256:PRIOR,expectedSourceSha256:current.sourceSha256,previousSnapshotBodySha256:oldBody,expectedSnapshotBodySha256:newBody,sql,sqlSha256:sha(sql),verificationSql,verificationSha256:sha(verificationSql),scope:{functionReplacements:1,newFunctions:0,newRoles:0,newGrants:0,temporaryOwnerGrants:1,loginsOpened:0,reviewerBound:false,dataWrites:0,otherProjectsChanged:false,activation:false}};
}
