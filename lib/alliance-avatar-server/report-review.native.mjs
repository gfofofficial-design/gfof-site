// Owned fictional PostgreSQL/TLS fixture only; no hosted endpoint or owner input.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {secondCreationFixture} from './creation-second-fixture.mjs';
import {prepareCommunityMemberFixture} from './community-database.fixture.mjs';
import {managedCommunityExtensionSql} from './community-managed-install.mjs';
import {managedFeedbackExtensionSql} from './feedback-managed-install.mjs';
import {managedReportReviewExtensionSql,managedReportReviewRollbackSql,reportReviewBoundarySql} from './report-review-install.mjs';
import {createAllianceReportReviewStore} from './report-review-store.mjs';
import {createAllianceReportReviewService} from './report-review-service.mjs';
import {prepareReportReviewEvidenceUpgrade} from './report-review-upgrade.mjs';
export async function reportReviewNative({secondOptions}){
 const {local,scratch,certificate}=secondOptions;
 const d=await secondCreationFixture({...secondOptions,purpose:'control'}),root=q=>d.admin(q,'fixture_root');
 const stores=[],checks=[];let pool;
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',o='33333333-3333-4333-8333-333333333333';
 const sa='44444444-4444-4444-8444-444444444444',sb='55555555-5555-4555-8555-555555555555',so='66666666-6666-4666-8666-666666666666';
 const id=n=>`${String(n).padStart(8,'0')}-7777-4777-8777-777777777777`;
 const clean=()=>assert.match(root("select to_regnamespace('alliance_report_review') is null and not pg_has_role('postgres','alliance_avatar_owner','SET') as clean;"),/\bt\b/);
 try{
  prepareCommunityMemberFixture(d);d.admin(managedCommunityExtensionSql());d.admin(managedFeedbackExtensionSql());
  const install=managedReportReviewExtensionSql();
  d.admin(managedReportReviewRollbackSql());clean();checks.push('complete_successful_installer_rehearsal_always_rolls_back');
  root('update alliance_feedback.control set enabled=true;');assert.throws(()=>d.admin(install),/Report review requires a closed foundation/);clean();root('update alliance_feedback.control set enabled=false;');
  const marker='RESET ROLE;\nREVOKE alliance_avatar_owner FROM postgres GRANTED BY postgres;\nDO $review_verify$';assert.equal(install.split(marker).length,2);
  assert.throws(()=>d.admin(install.replace(marker,'grant select on alliance_report_review.reviews to alliance_avatar_executor;\n'+marker)),/Report review verification refused/);clean();
  checks.push('atomic_install_rolls_back_on_open_foundation_or_extra_grant');
  d.admin(install);assert.match(d.admin('select not pg_has_role(\'postgres\',\'alliance_avatar_owner\',\'SET\') as clean;'),/\bt\b/);
  assert.match(root(reportReviewBoundarySql()),/\bt\b/);assert.throws(()=>d.admin(install),/Report review preflight refused/);
  checks.push('disabled_install_has_exact_boundary_no_temporary_membership');
  const upgrade=prepareReportReviewEvidenceUpgrade(),baseline=readFileSync(new URL('./report-review-v1.fixture.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');
  const oldSnapshot=[...baseline.matchAll(/create function alliance_report_review\.snapshot\([^]*?\$\$;/g)][0][0].replace('create function','CREATE OR REPLACE FUNCTION');
  const functionIdentity=()=>root("select jsonb_build_array(oid,proowner,proacl::text,proargtypes::text,proconfig) from pg_proc where oid='alliance_report_review.snapshot(uuid,boolean)'::regprocedure;");
  const originalFunctionIdentity=functionIdentity();root(oldSnapshot);
  assert.equal(functionIdentity(),originalFunctionIdentity);assert.match(d.admin(upgrade.verificationSql),/"previousBoundary": true/);
  assert.ok(upgrade.sql.endsWith('COMMIT;'));d.admin(upgrade.sql.slice(0,-7)+'ROLLBACK;');assert.match(d.admin(upgrade.verificationSql),/"previousBoundary": true/);
  d.admin(upgrade.sql);const upgraded=d.admin(upgrade.verificationSql);assert.match(upgraded,/"closed": true/);assert.match(upgraded,/"expectedBoundary": true/);assert.match(upgraded,/"previousBoundary": false/);assert.equal(functionIdentity(),originalFunctionIdentity);
  assert.throws(()=>d.admin(upgrade.sql),/Report review closed upgrade refused/);assert.equal(functionIdentity(),originalFunctionIdentity);
  checks.push('one_function_upgrade_rolls_back_then_commits_with_same_oid_owner_acl_and_replay_refusal');
  assert.match(root("set timezone='America/Chicago';select alliance_report_review.expires_at('2026-10-25T09:00:00Z',null)='2027-01-23T09:00:00Z'::timestamptz and alliance_report_review.expires_at('2026-10-25T09:00:00Z','2026-10-25T09:00:00Z')='2026-11-24T09:00:00Z'::timestamptz as elapsed_days;"),/\bt\b/);
  checks.push('elapsed_day_retention_unchanged_across_Chicago_daylight_saving');
  for(const [actor,session,name]of [[a,sa,'Fictional reporter'],[b,sb,'Fictional target'],[o,so,'Fictional owner']])root(`insert into auth.users values('${actor}',clock_timestamp(),false,null,null);insert into auth.sessions values('${session}','${actor}',null);insert into public.alliance_member_owners(id,user_id) values('${actor}','${actor}');insert into public.alliance_profiles(id,display_name,bio,community,contribution_role,listed) values('${actor}','${name}','Disposable report review acceptance.','Fictional crew','builder',true);`);
  for(let n=1;n<=8;n++)root(`insert into alliance_feedback.reports(id,reporter,target_owner,kind,target) values('${id(n)}','${a}','${b}','challenge','${id(100+n)}');`);
  root('update alliance_feedback.control set reports_created=8,mutations=8;');
  const password='synthetic-report-review-'+randomUUID();root(`alter role alliance_avatar_executor login password '${password}';`);
  const connection={...d.connection,password},open=async()=>{const s=await createAllianceReportReviewStore({enabled:true,deploymentProfile:'supabase-managed',connection,openPool:d.openPool});stores.push(s);return s;};
  const store=await open(),denied=work=>assert.rejects(work,e=>e?.outcome==='not_started'||e?.outcome==='rejected');
  await denied(()=>store.list(o,so));
  root(`update alliance_avatar.control set enabled=true;update alliance_report_review.control set enabled=true,reviewer_actor='${o}';`);
  await denied(()=>store.list(a,sa));await denied(()=>store.read(a,sa,id(1)));await denied(()=>store.review(a,sa,{id:id(1),expected:'unreviewed',disposition:'no_action'}));
  checks.push('default_off_and_second_member_denied_for_list_read_review');
  const page=await store.list(o,so,{limit:2});assert.equal(page.items.length,2);assert.equal(page.next,id(2));assert.equal((await store.list(o,so,{after:page.next,limit:2})).items[0].id,id(3));
  assert.equal(page.items[0].contextState,'unavailable');assert(!JSON.stringify(page).includes(a));assert(!JSON.stringify(page).includes(b));
  checks.push('bounded_paginated_queue_omits_reporter_and_target_owner_ids');
  const first=await store.review(o,so,{id:id(1),expected:'unreviewed',disposition:'no_action'});
  const repeat=await store.review(o,so,{id:id(1),expected:'unreviewed',disposition:'no_action'});assert.deepEqual(repeat,first);
  const changed=await store.review(o,so,{id:id(1),expected:'no_action',disposition:'owner_follow_up'});
  assert.equal(changed.reviewedAt,first.reviewedAt);assert.equal(changed.expiresAt,first.expiresAt);
  await denied(()=>store.review(o,so,{id:id(1),expected:'unreviewed',disposition:'no_action'}));
  assert.equal((await store.read(o,so,id(1))).disposition,'owner_follow_up');
  checks.push('idempotent_review_and_explicit_conflict_never_extend_first_review');
  root(`delete from auth.sessions where id='${so}';`);await denied(()=>store.list(o,so));root(`insert into auth.sessions values('${so}','${o}',null);update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id='${o}';`);await denied(()=>store.list(o,so));root(`update auth.users set banned_until=null where id='${o}';`);
  checks.push('current_session_removal_and_account_ban_refuse_owner_queue');
  pool=d.openPool({user:'alliance_avatar_executor',database:'postgres',password,ssl:{ca:certificate,rejectUnauthorized:true}});
  const c=await pool.connect();try{for(const sql of ['select * from alliance_feedback.reports','select * from alliance_report_review.reviews','select alliance_report_review.expire_closed(1)'])await assert.rejects(c.query(sql),e=>e.code==='42501');}finally{c.release();}
  checks.push('restricted_executor_cannot_read_raw_reports_or_invoke_cleanup');
  root(`update alliance_feedback.reports set created_at=clock_timestamp()-interval '2160 hours' where id='${id(2)}';update alliance_feedback.reports set created_at=clock_timestamp()-interval '2400 hours' where id='${id(1)}';update alliance_report_review.reviews set first_reviewed_at=clock_timestamp()-interval '720 hours' where report_id='${id(1)}';`);
  await denied(()=>store.read(o,so,id(1)));await denied(()=>store.read(o,so,id(2)));await denied(()=>store.review(o,so,{id:id(2),expected:'unreviewed',disposition:'no_action'}));
  assert.equal((await store.list(o,so)).items.some(v=>[id(1),id(2)].includes(v.id)),false);
  checks.push('reviewed_30day_and_unreviewed_90day_expiry_hide_and_refuse_before_cleanup');
  assert.throws(()=>root('select alliance_report_review.expire_closed(2);'),/report_review_unavailable/);
  root('update alliance_avatar.control set enabled=false;update alliance_report_review.control set enabled=false;');
  assert.match(root("select (alliance_report_review.recovery_inventory()->>'expiredReports')::integer=2 and (alliance_report_review.recovery_inventory()->>'closed')::boolean as expiry_requires_reconciliation;"),/\bt\b/);
  const native=(tool,args,input)=>{const opts={input,encoding:'buffer',timeout:10000,maxBuffer:1048576};return local?execFileSync('/usr/lib/postgresql/18/bin/'+tool,args,opts):execFileSync('docker',['exec','-i','-u','postgres',d.archiveTarget.container,tool,...args],opts);};
  const dbArgs=local?['-h',scratch+'/creation-control/socket','-p','55490']:[];
  const archive=native('pg_dump',[...dbArgs,'-U','fixture_root','-d','postgres','--format=custom','--data-only','--no-owner','--no-privileges','--table=alliance_feedback.reports','--table=alliance_report_review.reviews']);
  assert.equal(archive.subarray(0,5).toString(),'PGDMP');
  const restoredSql=native('pg_restore',['--data-only','--no-owner','--no-privileges','--file=-'],archive).toString('utf8');
  assert.throws(()=>root('select alliance_report_review.expire_closed(51);'),/report_review_invalid/);
  assert.match(root("select (alliance_report_review.expire_closed(1)->>'remainingExpired')::boolean as more;"),/\bt\b/);
  assert.match(root("select (alliance_report_review.expire_closed(1)->>'removed')='1' as removed;"),/\bt\b/);
  assert.match(root('select reports_created=8 and mutations=8 from alliance_feedback.control;'),/\bt\b/);
  assert.match(root('select count(*)=0 from alliance_report_review.reviews;'),/\bt\b/);
  checks.push('closed_bounded_cleanup_cascades_review_without_refunding_abuse_counters');
  // Real native dump/readback restores an earlier copy containing expired rows.
  // The closed transaction rolls back after verifying mandatory reconciliation.
  root(`begin;delete from alliance_feedback.reports;${restoredSql}
   do $$begin if (select count(*) from alliance_feedback.reports)<>8 or (select count(*) from alliance_report_review.reviews)<>1 then raise exception 'native report restore incomplete';end if;end $$;
   select alliance_report_review.expire_closed(50);
   do $$begin if exists(select 1 from alliance_feedback.reports where id in('${id(1)}','${id(2)}')) or (select count(*) from alliance_feedback.reports)<>6 or exists(select 1 from alliance_report_review.reviews) then raise exception 'expired report revived';end if;end $$;rollback;`);
  checks.push('native_report_archive_restore_reexpires_old_rows_before_open');
  const inv=await store.inventory();assert.equal(inv.tables.length,2);assert.equal(inv.tables[1].rows,0);
  root(`update alliance_avatar.control set enabled=true;update alliance_report_review.control set enabled=true;`);
  root(`insert into alliance_feedback.ideas(id,owner,title,category,detail) values('${id(72)}','${b}','Fictional accessible labels','accessibility','Add a text summary beside the fictional chart.');
   insert into alliance_feedback.reports(id,reporter,target_owner,kind,target) values('${id(70)}','${a}','${b}','idea','${id(72)}'),('${id(71)}','${a}','${b}','member','${b}');`);
  const metadata=await store.list(o,so,{after:id(60),limit:5});assert.equal(metadata.items.length,2);assert(metadata.items.every(r=>r.contextLoaded===false&&r.targetTitle===null&&r.targetSummary===null));
  assert.equal((await store.read(o,so,id(70))).targetTitle,'Fictional accessible labels');assert.equal((await store.read(o,so,id(71))).targetTitle,'Fictional target');
  checks.push('list_is_metadata_only_selected_read_has_bounded_idea_or_profile_context');
  const evidence=await store.readEvidence(o,so,id(70));assert.deepEqual(evidence.evidenceProfiles,[a,b]);
  const ownerService=createAllianceReportReviewService({enabled:true,reviewerActor:o,store,
   ledger:{async authorizeAccountSession(actor,session){const r=await pool.query({text:'SELECT alliance_avatar.authorize_account_session($1::uuid,$2::uuid) AS result',values:[actor,session]});return r.rows[0].result;}},
   serving:{authorizeReportReview:async()=>true},journal:{review:async()=>({state:'verified_evidence',checkProfile:()=>({state:'not_listed'}),close(){}})}});
  try{const result=await ownerService.read({actorId:o,sessionId:so,expiresAt:Date.now()+60000},id(70));assert.equal(result.state,'ready');assert.equal(result.report.targetTitle,'Fictional accessible labels');assert(!JSON.stringify(result).includes(a));assert(!JSON.stringify(result).includes(b));}finally{ownerService.close();}
  checks.push('real_executor_service_uses_private_profile_evidence_and_strips_it_from_owner_response');
  const ackPool=d.openPool({user:'alliance_avatar_executor',database:'postgres',password,ssl:{ca:certificate,rejectUnauthorized:true}});let lost=false;
  const uncertain=await createAllianceReportReviewStore({enabled:true,deploymentProfile:'supabase-managed',connection,openPool:()=>({async connect(){const c=await ackPool.connect();return {async query(q){const out=await c.query(q);if(q.text==='COMMIT'&&!lost){lost=true;throw Error('Fictional lost commit acknowledgement');}return out;},release:destroy=>c.release(destroy)};},end:()=>ackPool.end(),on:(...args)=>ackPool.on(...args)})});stores.push(uncertain);
  await assert.rejects(uncertain.review(o,so,{id:id(3),expected:'unreviewed',disposition:'no_action'}),e=>e.outcome==='unknown');
  const saved=await store.read(o,so,id(3));assert.equal(saved.disposition,'no_action');await denied(()=>uncertain.list(o,so));
  assert.equal((await store.review(o,so,{id:id(3),expected:'unreviewed',disposition:'no_action'})).reviewedAt,saved.reviewedAt);
  checks.push('lost_commit_acknowledgement_stays_unknown_until_independent_read');
  for(const [drift,restore]of [
   ['grant select on alliance_report_review.reviews to alliance_avatar_executor;','revoke select on alliance_report_review.reviews from alliance_avatar_executor;'],
   ['alter table alliance_report_review.reviews disable row level security;','alter table alliance_report_review.reviews enable row level security;'],
   ['alter function alliance_report_review.read_session(uuid,uuid,uuid) security invoker;','alter function alliance_report_review.read_session(uuid,uuid,uuid) security definer;'],
  ]){const s=await open();root(drift);await denied(()=>s.list(o,so));root(restore);await denied(()=>s.list(o,so));}
  checks.push('inventory_covers_both_new_tables_and_boundary_drift_faults_closed');
  root('update alliance_avatar.control set enabled=false;update alliance_report_review.control set enabled=false;alter role alliance_avatar_executor nologin password null;');
  console.log(JSON.stringify({state:'passed',checks,hostedCalls:0,ownerCredentialRead:false,cleanupSchedule:false,reviewerEnabledOutsideFixture:false}));
 }finally{for(const s of stores)await s.close();if(pool&&!pool.ended)await pool.end();await d.close();}
}
