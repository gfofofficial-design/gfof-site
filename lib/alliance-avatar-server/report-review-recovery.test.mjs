import test from 'node:test';
import assert from 'node:assert/strict';
import {feedbackRecoveryFixture} from './feedback-recovery.fixture.mjs';
import {feedbackCheckpoint} from './feedback-recovery.mjs';
import {reportReviewCheckpoint,reportReviewCheckpointSha256,createAllianceReportReviewRecoveryReview} from './report-review-recovery.mjs';
import {createAllianceFeedbackStartupGate,createAllianceReportReviewStartupGate} from './startup-gate.mjs';
import {createAllianceFeedbackRecoveryPackage,createAllianceReportReviewRecoveryPackage,REPORT_REVIEW_RECOVERY_COMPONENTS} from './recovery-package.mjs';
import {packageFixture} from './recovery-package.fixture.mjs';
const clone=structuredClone;
function fixture({readReview}={}){
 const f=feedbackRecoveryFixture();f.gate.close();
 const cp={...f.checkpoint,format:5,reportReview:{format:1,closed:true,expiredReports:0,tables:[{table:'alliance_report_review.control',rows:1,sha256:'c'.repeat(64)},{table:'alliance_report_review.reviews',rows:2,sha256:'d'.repeat(64)}]}};
 f.control.checkpointSha256=reportReviewCheckpointSha256(cp);
 const deps={...f.deps,reportReview:{inventory(o){f.calls.push('report-review');return readReview?readReview(o):clone(cp.reportReview);}}};
 return {...f,checkpoint:cp,deps,gate:createAllianceReportReviewStartupGate(deps)};
}
const input=f=>({freezeId:f.checkpoint.freezeId,frozenAt:f.control.frozenAt,checkpoint:clone(f.checkpoint)});
test('checkpoint5 requires both review tables, closed state and zero expired reports',()=>{
 const f=fixture();try{
  assert.equal(reportReviewCheckpoint(f.checkpoint).format,5);assert.throws(()=>feedbackCheckpoint(f.checkpoint));
  for(const mutate of [v=>delete v.reportReview,v=>v.reportReview.tables.pop(),v=>v.reportReview.tables.reverse(),v=>v.reportReview.closed=false,v=>v.reportReview.expiredReports=1]){const cp=clone(f.checkpoint);mutate(cp);assert.throws(()=>reportReviewCheckpoint(cp));}
 }finally{f.gate.close();}
});
test('full prior recovery evidence is surrounded by both review inventories',async()=>{
 const f=fixture(),r=createAllianceReportReviewRecoveryReview(f.deps);try{
  assert.deepEqual(await r.inspect(input(f)),{state:'matches_checkpoint',access:'closed'});
  assert.deepEqual(f.calls,['report-review','feedback','community','member','journal','records','member','journal','community','feedback','report-review']);
 }finally{r.close();f.gate.close();}
});
test('expired reports require closed reconciliation and cannot gain serving from an old checkpoint',async()=>{
 const f=fixture({readReview:()=>({...clone(f.checkpoint.reportReview),expiredReports:1})}),r=createAllianceReportReviewRecoveryReview(f.deps);try{
  assert.equal((await r.inspect(input(f))).reason,'expiry_reconciliation_required');assert.deepEqual(f.calls,['report-review']);
  assert.equal((await f.gate.prepare(f.checkpoint)).state,'quarantine');assert.equal(await f.gate.authorizeReportReview(),false);
 }finally{r.close();f.gate.close();}
});
test('scope, minimum and freeze failures precede any review inventory read',async()=>{
 for(const mutate of [v=>v.freezeId='99999999-9999-4999-8999-999999999999',v=>v.checkpoint.memberProjectRef='zzzzzzzzzzzzzzzzzzzz',v=>v.frozenAt='2026-02-30T00:00:00.000Z',v=>v.checkpoint.journal.sequence=0]){
  const f=fixture(),r=createAllianceReportReviewRecoveryReview(f.deps),v=input(f);mutate(v);try{assert.equal((await r.inspect(v)).state,'quarantine');assert.deepEqual(f.calls,[]);}finally{r.close();f.gate.close();}
 }
});
test('same-count review changes and moving snapshots quarantine',async()=>{
 const f=fixture(),r=createAllianceReportReviewRecoveryReview(f.deps);try{
  const v=input(f);v.checkpoint.reportReview.tables[1].sha256='e'.repeat(64);assert.equal((await r.inspect(v)).reason,'report_review_mismatch');
 }finally{r.close();f.gate.close();}
 let reads=0;const g=fixture({readReview:()=>{const v=clone(g.checkpoint.reportReview);if(reads++)v.tables[1].sha256='e'.repeat(64);return v;}}),s=createAllianceReportReviewRecoveryReview(g.deps);try{assert.equal((await s.inspect(input(g))).reason,'snapshot_changed');}finally{s.close();g.gate.close();}
});
test('cancelled late review inventory cannot advance recovery or reopen the inspector',async()=>{
 let resume;const f=fixture({readReview:()=>new Promise(resolve=>{resume=resolve;})}),r=createAllianceReportReviewRecoveryReview(f.deps),c=new AbortController();
 try{const pending=r.inspect(input(f),{signal:c.signal});while(!resume)await new Promise(resolve=>setImmediate(resolve));c.abort();assert.equal((await pending).state,'quarantine');resume(clone(f.checkpoint.reportReview));await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.calls,['report-review']);assert.equal((await r.inspect(input(f))).reason,'unavailable');}finally{resume?.(clone(f.checkpoint.reportReview));r.close();f.gate.close();}
});
test('only review-aware signed startup can authorize private review',async()=>{
 const f=fixture();try{
  const old=createAllianceFeedbackStartupGate(f.deps);try{assert.equal((await old.prepare(f.checkpoint)).state,'quarantine');assert.equal(typeof old.authorizeReportReview,'undefined');}finally{old.close();}
  assert.equal(typeof f.gate.authorizeFeedback,'undefined');assert.equal(await f.gate.authorizeReportReview(),false);
  assert.deepEqual(await f.gate.prepare(f.checkpoint),{state:'prepared',access:'closed'});f.serve();assert.equal(await f.gate.authorizeReportReview(),true);
  f.control.state='closed';f.control.revision++;assert.equal(await f.gate.authorizeReportReview(),false);f.serve();assert.equal(await f.gate.authorizeReportReview(),false);
 }finally{f.gate.close();}
});
const magic=Buffer.from('age-encryption.org/v1\n'),carrier={encryptBytes:b=>Buffer.concat([magic,b]),decryptBytes:b=>Buffer.from(b.subarray(magic.length))};
function packaging(){const f=fixture(),p=packageFixture();f.gate.close();return {options:p.options,input:{...p.input,freezeId:f.checkpoint.freezeId,checkpoint:f.checkpoint,checkpointSha256:reportReviewCheckpointSha256(f.checkpoint),components:REPORT_REVIEW_RECOVERY_COMPONENTS.map(name=>({name,data:Buffer.from('SYNTHETIC '+name)}))}};}
test('package4 carries eleven components and checkpoint5; the old reader refuses omission',async()=>{
 const f=packaging(),p=createAllianceReportReviewRecoveryPackage({...f.options,...carrier}),old=createAllianceFeedbackRecoveryPackage({...f.options,...carrier});try{
  const sealed=await p.seal(f.input);assert.equal(sealed.state,'sealed');const opened=await p.open({descriptor:sealed.descriptor,ciphertext:sealed.ciphertext});
  assert.equal(opened.state,'verified_bytes');assert.equal(opened.manifest.format,4);assert.equal(opened.components.length,11);assert.equal(opened.manifest.checkpoint.format,5);assert.deepEqual(opened.components,f.input.components);
  assert.deepEqual(await old.open({descriptor:sealed.descriptor,ciphertext:sealed.ciphertext}),{state:'unavailable',access:'closed'});for(const part of opened.components)part.data.fill(0);
 }finally{p.close();old.close();}
});
test('missing review dump or expiry metadata is refused before encryption',async()=>{
 for(const alter of [v=>v.components.splice(3,1),v=>delete v.checkpoint.reportReview,v=>v.checkpoint.reportReview.expiredReports=1]){
  const f=packaging();alter(f.input);let calls=0;const p=createAllianceReportReviewRecoveryPackage({...f.options,encryptBytes:()=>{calls++;return Buffer.alloc(0);}});try{assert.deepEqual(await p.seal(f.input),{state:'unavailable',access:'closed'});assert.equal(calls,0);}finally{p.close();}
 }
});
