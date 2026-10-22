import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {communityCheckpoint,communityCheckpointSha256,createAllianceCommunityRecoveryReview} from './community-recovery.mjs';
import {createAllianceStartupGate,startupCheckpointSha256} from './startup-gate.mjs';
import {communityRecoveryFixture} from './community-recovery.fixture.mjs';
import {packageFixture} from './recovery-package.fixture.mjs';
import {createAllianceCommunityRecoveryPackage,COMMUNITY_RECOVERY_COMPONENTS} from './recovery-package.mjs';
const clone=structuredClone,closed={state:'quarantine',access:'closed'},unavailable={state:'unavailable',access:'closed'},magic=Buffer.from('age-encryption.org/v1\n');
// Unit carrier is deliberately not encryption. Actual age remains a native test.
const carrier={encryptBytes:p=>Buffer.concat([magic,p]),decryptBytes:c=>Buffer.from(c.subarray(magic.length))};
const review=f=>createAllianceCommunityRecoveryReview(f.deps),input=f=>({freezeId:f.checkpoint.freezeId,frozenAt:f.control.frozenAt,checkpoint:clone(f.checkpoint)});
function packaging(){const f=communityRecoveryFixture(),p=packageFixture(),cp=clone(f.checkpoint);f.gate.close();return {f,p,input:{...p.input,freezeId:cp.freezeId,checkpointSha256:communityCheckpointSha256(cp),checkpoint:cp,components:COMMUNITY_RECOVERY_COMPONENTS.map(name=>({name,data:Buffer.from('SYNTHETIC '+name)}))},make:extra=>createAllianceCommunityRecoveryPackage({...p.options,...extra})};}

test('community checkpoint has a separate domain and canonical order; old evidence cannot silently omit tables',()=>{
 const f=communityRecoveryFixture();try{
  const cp=clone(f.checkpoint),reverse=v=>Object.fromEntries(Object.entries(v).reverse());
  cp.community=reverse(cp.community);cp.community.tables=cp.community.tables.map(reverse);cp.member.tables=cp.member.tables.map(reverse);
  assert.equal(communityCheckpointSha256(cp),communityCheckpointSha256(reverse(f.checkpoint)));
  assert.throws(()=>startupCheckpointSha256(cp));const {community,...legacy}=cp;legacy.format=2;assert.throws(()=>communityCheckpoint(legacy));
  for(const change of [v=>v.community.tables.pop(),v=>v.community.tables.reverse(),v=>v.community.tables[0].rows=0,v=>v.community.extra='PRIVATE',v=>v.community.closed=false]){const c=clone(cp);change(c);assert.throws(()=>communityCheckpoint(c));}
 }finally{f.gate.close();}
});
test('combined closed review surrounds the unchanged member/journal full-prefix review with community inventories',async()=>{
 const f=communityRecoveryFixture(),r=review(f);try{assert.deepEqual(await r.inspect(input(f)),{state:'matches_checkpoint',access:'closed'});assert.deepEqual(f.calls,['community','member','journal','records','member','journal','community']);}finally{r.close();f.gate.close();}
});
test('scope/freeze mismatch and old checkpoints refuse before any lookup; all five same-count changes are detected',async()=>{
 for(const change of [v=>v.checkpoint.journalProjectRef='zzzzzzzzzzzzzzzzzzzz',v=>v.freezeId='99999999-9999-4999-8999-999999999999',v=>{delete v.checkpoint.community;v.checkpoint.format=2;}]){
  const f=communityRecoveryFixture(),r=review(f),v=input(f);change(v);try{assert.equal((await r.inspect(v)).state,'quarantine');assert.equal(f.calls.length,0);}finally{r.close();f.gate.close();}
 }
 for(let i=0;i<5;i++){const f=communityRecoveryFixture(),r=review(f),v=input(f);v.checkpoint.community.tables[i].sha256='f'.repeat(64);try{assert.equal((await r.inspect(v)).reason,'community_mismatch');}finally{r.close();f.gate.close();}}
});
test('changing community snapshot and cancelled late inventory never produces preparation or retries',async()=>{
 let n=0,source;const f=communityRecoveryFixture({readCommunity:()=>{const c=clone(source);if(++n===2)c.tables[1].sha256='f'.repeat(64);return c;}});source=f.checkpoint.community;
 const r=review(f);try{assert.equal((await r.inspect(input(f))).reason,'snapshot_changed');}finally{r.close();f.gate.close();}
 let release;const g=communityRecoveryFixture({readCommunity:()=>new Promise(r=>release=r)}),s=review(g),c=new AbortController();
 try{const pending=s.inspect(input(g),{signal:c.signal});while(!release)await new Promise(r=>setImmediate(r));c.abort();assert.equal((await pending).state,'quarantine');release(clone(g.checkpoint.community));await new Promise(r=>setImmediate(r));assert.deepEqual(g.calls,['community']);assert.equal((await s.inspect(input(g))).reason,'unavailable');}finally{s.close();g.gate.close();}
});
test('dedicated signed startup prepares all three inventories and exposes only community-aware current authority',async()=>{
 const f=communityRecoveryFixture();try{
  assert.equal(typeof f.gate.authorize,'undefined');assert.equal(await f.gate.authorizeCommunity(),false);
  assert.deepEqual(await f.gate.prepare(f.checkpoint),{state:'prepared',access:'closed'});assert.deepEqual(f.calls,['decision','community','member','journal','records','member','journal','community','decision']);
  f.serve();assert.equal(await f.gate.authorizeCommunity(),true);f.control.state='closed';f.control.revision++;assert.equal(await f.gate.authorizeCommunity(),false);f.serve();assert.equal(await f.gate.authorizeCommunity(),false);
 }finally{f.gate.close();}
});
test('profile-only gate and signed profile-only digest cannot authorize community storage',async()=>{
 const f=communityRecoveryFixture(),old=createAllianceStartupGate(f.deps);try{assert.deepEqual(await old.prepare(f.checkpoint),closed);assert.equal(f.calls.length,0);assert.equal(typeof old.authorizeCommunity,'undefined');}finally{old.close();f.gate.close();}
 const g=communityRecoveryFixture();const {community,...legacy}=g.checkpoint;legacy.format=2;g.control.checkpointSha256=startupCheckpointSha256(legacy);
 try{assert.deepEqual(await g.gate.prepare(g.checkpoint),closed);assert.deepEqual(g.calls,['decision']);}finally{g.gate.close();}
});
test('community-aware gate keeps changed stored data and a failed snapshot permanently closed',async()=>{
 const f=communityRecoveryFixture({readCommunity:()=>{const c=clone(f.checkpoint.community);c.tables[1].sha256='f'.repeat(64);return c;}});
 try{assert.deepEqual(await f.gate.prepare(f.checkpoint),closed);assert.equal(await f.gate.authorizeCommunity(),false);assert.deepEqual(await f.gate.prepare(f.checkpoint),closed);}finally{f.gate.close();}
});
test('community package requires nine ordered components and exact combined checkpoint binding before encryption',async()=>{
 for(const kind of ['missing','legacy','digest','freeze','scope']){
  const f=packaging(),v=clone(f.input);if(kind==='missing')v.components.splice(1,1);if(kind==='legacy')delete v.checkpoint;if(kind==='digest')v.checkpointSha256='e'.repeat(64);if(kind==='freeze')v.checkpoint.freezeId='99999999-9999-4999-8999-999999999999';if(kind==='scope')v.checkpoint.journalProjectRef='zzzzzzzzzzzzzzzzzzzz';let calls=0;const p=f.make({encryptBytes:()=>calls++});
  try{assert.deepEqual(await p.seal(v),unavailable);assert.equal(calls,0);}finally{p.close();}
 }
});
test('verified community package carries explicit format2/checkpoint and refuses both legacy readers and legacy archives',async()=>{
 const f=packaging(),p=f.make(carrier),old=f.p.make(carrier);try{
  const sealed=await p.seal(f.input);assert.equal(sealed.state,'sealed');const opened=await p.open({descriptor:sealed.descriptor,ciphertext:sealed.ciphertext});assert.equal(opened.state,'verified_bytes');assert.equal(opened.manifest.format,2);assert.deepEqual(opened.manifest.checkpoint,communityCheckpoint(f.input.checkpoint));assert.deepEqual(opened.components,f.input.components);for(const c of opened.components)c.data.fill(0);
  assert.deepEqual(await old.open({descriptor:sealed.descriptor,ciphertext:sealed.ciphertext}),unavailable);
  const legacy=f.p.make(carrier),current=f.make(carrier);try{const v=await legacy.seal(f.p.input);assert.deepEqual(await current.open({descriptor:v.descriptor,ciphertext:v.ciphertext}),unavailable);}finally{legacy.close();current.close();}
 }finally{p.close();old.close();}
});
test('a valid ciphertext carrier cannot hide missing community coverage or a changed inner checkpoint hash',async()=>{
 for(const kind of ['component','checkpoint']){const f=packaging(),p=f.make(carrier);try{
  const sealed=await p.seal(f.input),v=JSON.parse(sealed.ciphertext.subarray(magic.length));if(kind==='component')v.components.splice(1,1);else v.checkpoint.community.tables[2].sha256='f'.repeat(64);
  const cipher=Buffer.concat([magic,Buffer.from(JSON.stringify(v)+'\n')]),descriptor={...sealed.descriptor,bytes:cipher.length,sha256:createHash('sha256').update(cipher).digest('hex')};assert.deepEqual(await p.open({descriptor,ciphertext:cipher}),unavailable);
 }finally{p.close();}}
});
