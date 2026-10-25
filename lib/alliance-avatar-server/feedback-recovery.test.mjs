import test from 'node:test';
import assert from 'node:assert/strict';
import {feedbackCheckpoint,feedbackCheckpointSha256,createAllianceFeedbackRecoveryReview} from './feedback-recovery.mjs';
import {communityCheckpoint} from './community-recovery.mjs';
import {createAllianceStartupGate,createAllianceCommunityStartupGate} from './startup-gate.mjs';
import {feedbackRecoveryFixture} from './feedback-recovery.fixture.mjs';
const clone=structuredClone,input=f=>({freezeId:f.checkpoint.freezeId,frozenAt:f.control.frozenAt,checkpoint:clone(f.checkpoint)});
test('format 4 names every feedback table, is canonical and is rejected by old checkpoint readers',()=>{
 const f=feedbackRecoveryFixture();try{
  const cp=clone(f.checkpoint),reverse=v=>Object.fromEntries(Object.entries(v).reverse());
  cp.feedback=reverse(cp.feedback);cp.feedback.tables=cp.feedback.tables.map(reverse);
  assert.equal(feedbackCheckpointSha256(reverse(cp)),feedbackCheckpointSha256(f.checkpoint));assert.throws(()=>communityCheckpoint(cp));
  for(const mutate of [v=>delete v.feedback,v=>v.feedback.tables.pop(),v=>v.feedback.tables.reverse(),v=>v.feedback.tables[0].rows=0,v=>v.feedback.extra='PRIVATE',v=>v.feedback.closed=false,v=>v.format=3]){const bad=clone(cp);mutate(bad);assert.throws(()=>feedbackCheckpoint(bad));}
 }finally{f.gate.close();}
});
test('closed review surrounds complete community/member/journal evidence with both feedback inventories',async()=>{
 const f=feedbackRecoveryFixture(),r=createAllianceFeedbackRecoveryReview(f.deps);try{
  assert.deepEqual(await r.inspect(input(f)),{state:'matches_checkpoint',access:'closed'});
  assert.deepEqual(f.calls,['feedback','community','member','journal','records','member','journal','community','feedback']);
 }finally{r.close();f.gate.close();}
});
test('scope, freeze, minimum and missing coverage fail before a database read',async()=>{
 for(const mutate of [v=>delete v.checkpoint.feedback,v=>v.checkpoint.memberProjectRef='zzzzzzzzzzzzzzzzzzzz',v=>v.freezeId='99999999-9999-4999-8999-999999999999',v=>v.checkpoint.journal.sequence=0]){
  const f=feedbackRecoveryFixture(),r=createAllianceFeedbackRecoveryReview(f.deps),v=input(f);mutate(v);try{assert.equal((await r.inspect(v)).state,'quarantine');assert.deepEqual(f.calls,[]);}finally{r.close();f.gate.close();}
 }
});
test('each same-count feedback alteration fails and a moving snapshot cannot be accepted',async()=>{
 for(let i=0;i<4;i++){
  const f=feedbackRecoveryFixture(),r=createAllianceFeedbackRecoveryReview(f.deps),v=input(f);v.checkpoint.feedback.tables[i].sha256='f'.repeat(64);
  try{assert.equal((await r.inspect(v)).reason,'feedback_mismatch');}finally{r.close();f.gate.close();}
 }
 let reads=0;const f=feedbackRecoveryFixture({readFeedback:()=>{const v=clone(f.checkpoint.feedback);if(++reads===2)v.tables[1].sha256='f'.repeat(64);return v;}}),r=createAllianceFeedbackRecoveryReview(f.deps);
 try{assert.equal((await r.inspect(input(f))).reason,'snapshot_changed');}finally{r.close();f.gate.close();}
});
test('cancelled late inventory is withheld and the review cannot reopen',async()=>{
 let resume;const f=feedbackRecoveryFixture({readFeedback:()=>new Promise(r=>resume=r)}),r=createAllianceFeedbackRecoveryReview(f.deps),c=new AbortController();
 try{const pending=r.inspect(input(f),{signal:c.signal});while(!resume)await new Promise(r=>setImmediate(r));c.abort();assert.equal((await pending).state,'quarantine');resume(clone(f.checkpoint.feedback));await new Promise(r=>setImmediate(r));assert.deepEqual(f.calls,['feedback']);assert.equal((await r.inspect(input(f))).reason,'unavailable');}finally{resume?.();r.close();f.gate.close();}
});
test('only the explicitly feedback-aware signed gate can prepare and authorize the new tables',async()=>{
 const f=feedbackRecoveryFixture();try{
  assert.equal(typeof f.gate.authorize,'undefined');assert.equal(typeof f.gate.authorizeCommunity,'undefined');assert.equal(await f.gate.authorizeFeedback(),false);
  for(const make of [createAllianceStartupGate,createAllianceCommunityStartupGate]){const old=make(f.deps);try{assert.equal((await old.prepare(f.checkpoint)).state,'quarantine');assert.equal(f.calls.length,0);}finally{old.close();}}
  assert.deepEqual(await f.gate.prepare(f.checkpoint),{state:'prepared',access:'closed'});f.serve();assert.equal(await f.gate.authorizeFeedback(),true);
  f.control.state='closed';f.control.revision++;assert.equal(await f.gate.authorizeFeedback(),false);f.serve();assert.equal(await f.gate.authorizeFeedback(),false);
 }finally{f.gate.close();}
});

// Deliberately synthetic carrier; real age and real SQL archives run in CI.
import {packageFixture} from './recovery-package.fixture.mjs';
import {createAllianceFeedbackRecoveryPackage,createAllianceCommunityRecoveryPackage,FEEDBACK_RECOVERY_COMPONENTS} from './recovery-package.mjs';
const magic=Buffer.from('age-encryption.org/v1\n'),carrier={encryptBytes:b=>Buffer.concat([magic,b]),decryptBytes:b=>Buffer.from(b.subarray(magic.length))};
function packaging(){const f=feedbackRecoveryFixture(),p=packageFixture();f.gate.close();return {options:p.options,input:{...p.input,freezeId:f.checkpoint.freezeId,checkpoint:f.checkpoint,checkpointSha256:feedbackCheckpointSha256(f.checkpoint),components:FEEDBACK_RECOVERY_COMPONENTS.map(name=>({name,data:Buffer.from('SYNTHETIC '+name)}))}};}
test('feedback package3 binds checkpoint4 and ten components; legacy readers cannot omit feedback',async()=>{
 const f=packaging(),p=createAllianceFeedbackRecoveryPackage({...f.options,...carrier}),old=createAllianceCommunityRecoveryPackage({...f.options,...carrier});
 try{const v=await p.seal(f.input);assert.equal(v.state,'sealed');const opened=await p.open({descriptor:v.descriptor,ciphertext:v.ciphertext});assert.equal(opened.state,'verified_bytes');assert.equal(opened.manifest.format,3);assert.deepEqual(opened.manifest.checkpoint,feedbackCheckpoint(f.input.checkpoint));assert.deepEqual(opened.components,f.input.components);for(const part of opened.components)part.data.fill(0);assert.deepEqual(await old.open({descriptor:v.descriptor,ciphertext:v.ciphertext}),{state:'unavailable',access:'closed'});}finally{p.close();old.close();}
});
test('missing feedback dump or altered checkpoint refuses before encryption',async()=>{
 for(const alter of [v=>v.components.splice(2,1),v=>delete v.checkpoint.feedback,v=>v.checkpoint.feedback.tables[1].sha256='f'.repeat(64)]){
  const f=packaging();alter(f.input);let calls=0;const p=createAllianceFeedbackRecoveryPackage({...f.options,encryptBytes:()=>calls++});
  try{assert.deepEqual(await p.seal(f.input),{state:'unavailable',access:'closed'});assert.equal(calls,0);}finally{p.close();}
 }
});
