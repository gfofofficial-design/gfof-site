import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {RECOVERY_TABLES,recoveryInventory,createAllianceRecoveryPair} from './recovery-pair.mjs';
import {chain,event,projectRef as memberProjectRef,epoch,other,zero} from './deletion-journal.fixture.mjs';
const journalProjectRef='uvwxyzabcdefghijklmn',freezeId=other,history=()=>chain([event()]);
const inventory=domain=>({format:2,domain,closed:true,tables:RECOVERY_TABLES[domain].map((table,i)=>({table,rows:table.endsWith('.control')?1:domain==='journal'&&table.endsWith('.entries')?1:2,sha256:String(i).repeat(64)})),...(domain==='journal'?{projectRef:memberProjectRef,epoch,sequence:1,sha256:history()[0].sha256}:{})});
const input=()=>({freezeId,frozenAt:'2026-01-01T00:00:00.000Z',checkpoint:{format:2,memberProjectRef,journalProjectRef,epoch,freezeId,capturedAt:'2026-01-01T00:01:00.000Z',member:inventory('member'),journal:inventory('journal')}});
const q=reason=>({state:'quarantine',access:'closed',reason}),minimum=()=>({sequence:1,sha256:history()[0].sha256});
function fixture({member=()=>inventory('member'),journal=()=>inventory('journal'),records=history,...options}={}){
  const calls=[];const review=createAllianceRecoveryPair({enabled:true,memberProjectRef,journalProjectRef,epoch,minimum:minimum(),ledger:{recoveryInventory:o=>{calls.push({name:'member',options:o});return member(o);}},journal:{recoveryInventory:o=>{calls.push({name:'journal',options:o});return journal(o);},records:(through,o)=>{calls.push({name:'records',through,options:o});return records(through,o);}},...options});return {review,calls};
}
test('paired review defaults closed and has no inventory, backup or credential side effect',async()=>{for(const enabled of [undefined,false,'true']){const f=fixture({enabled});assert.deepEqual(await f.review.inspect(input()),q('unavailable'));assert.deepEqual(f.calls,[]);}});
test('configuration requires different pinned scopes, an independent floor and bounded dependencies/deadline',()=>{for(const options of [{journalProjectRef:memberProjectRef},{epoch:'bad'},{minimum:undefined},{minimum:{sequence:0,sha256:'a'.repeat(64)}},{ledger:{}},{timeoutMs:0},{timeoutMs:25001}])assert.throws(()=>fixture(options));assert.throws(()=>createAllianceRecoveryPair({enabled:true,memberProjectRef,journalProjectRef,epoch,minimum:minimum(),ledger:{recoveryInventory(){}},journal:{}}));});
test('two complete stable snapshots and a floor-extending chain match without granting access',async()=>{
  const f=fixture();assert.deepEqual(await f.review.inspect(input()),{state:'matches_checkpoint',access:'closed'});assert.deepEqual(f.calls.map(x=>x.name),['member','journal','records','member','journal']);assert.deepEqual(f.calls[2].through,minimum());assert.ok(f.calls.every(x=>x.options.signal.aborted));
});
test('old six-table inventory, missing preparations/admissions, wrong order and extra row content refuse',()=>{
  for(const domain of ['member','journal'])for(const change of [v=>v.format=1,v=>v.tables.pop(),v=>v.tables.reverse(),v=>v.tables.find(t=>t.table.endsWith('.control')).rows=0,v=>v.tables[0].private='PRIVATE',v=>v.tables[1].sha256='bad',v=>v.tables[1].rows=1001,v=>v.secret='PRIVATE']){const v=inventory(domain);change(v);assert.throws(()=>recoveryInventory(v,domain));}
  const member=inventory('member');member.tables.at(-1).rows=257;assert.throws(()=>recoveryInventory(member,'member'));
});
test('journal inventory binds scope, exact chain count and reservation coverage',()=>{for(const change of [v=>v.projectRef='bad',v=>v.epoch='bad',v=>v.sequence=257,v=>v.tables[2].rows=0,v=>v.tables[1].rows=0]){const v=inventory('journal');change(v);assert.throws(()=>recoveryInventory(v,'journal'));}});
test('missing, stale, unscoped or private evidence refuses before any store read',async()=>{
  for(const [change,reason] of [[v=>v.extra='PRIVATE','invalid_evidence'],[v=>v.checkpoint.freezeId=epoch,'freeze_mismatch'],[v=>v.checkpoint.journalProjectRef=memberProjectRef,'scope_mismatch'],[v=>v.checkpoint.epoch=other,'scope_mismatch'],[v=>v.checkpoint.capturedAt='2099-01-01T00:01:00.000Z','invalid_evidence'],[v=>v.frozenAt='2026-01-01T00:02:00.000Z','checkpoint_predates_freeze'],[v=>v.checkpoint.member.closed=false,'feature_open']]){const value=input();change(value);const f=fixture();assert.deepEqual(await f.review.inspect(value),q(reason));assert.deepEqual(f.calls,[]);}
});
test('older checkpoint floor and wrong same-sequence hash refuse before store reads',async()=>{
  const older=input();older.checkpoint.journal.sequence=0;older.checkpoint.journal.sha256=zero;older.checkpoint.journal.tables[2].rows=0;const f=fixture();assert.deepEqual(await f.review.inspect(older),q('floor_regression'));assert.equal(f.calls.length,0);
  const fork=input();fork.checkpoint.journal.sha256='a'.repeat(64);const g=fixture();assert.deepEqual(await g.review.inspect(fork),q('floor_fork'));assert.equal(g.calls.length,0);
});
test('same-count changes in every member/journal table are not hidden by aggregate counts',async()=>{
  for(const domain of ['member','journal'])for(let i=0;i<RECOVERY_TABLES[domain].length;i++){const changed=inventory(domain);changed.tables[i].sha256='f'.repeat(64);const f=fixture({[domain]:()=>changed});assert.deepEqual(await f.review.inspect(input()),q(domain+'_mismatch'));}
});
test('live old journal and incompatible complete chain stay quarantined',async()=>{
  const old=inventory('journal');old.sequence=0;old.sha256=zero;old.tables[2].rows=0;const f=fixture({journal:()=>old});assert.deepEqual(await f.review.inspect(input()),q('floor_regression'));
  const fork=chain([event({profileId:other})]),j={...inventory('journal'),sha256:fork[0].sha256};const g=fixture({journal:()=>j,records:()=>fork});assert.deepEqual(await g.review.inspect(input()),q('floor_fork'));
});
test('partial, malformed, reordered, duplicate or changed deletion history never qualifies',async()=>{
  for(const records of [()=>[],()=>[{...history()[0],sha256:'f'.repeat(64)}],()=>[{...history()[0],previous:'a'.repeat(64)}],()=>[{...history()[0],event:{...event(),extra:'PRIVATE'}}],()=>[{...history()[0],projectRef:journalProjectRef}]]){const f=fixture({records});assert.deepEqual(await f.review.inspect(input()),q('unavailable'));assert.equal(f.calls.length,3);}
});
test('a known earlier floor must occur in the verified full current chain',async()=>{
  const two=chain([event(),event({id:epoch,profileId:other})]),j=inventory('journal');j.sequence=2;j.sha256=two[1].sha256;j.tables[2].rows=2;
  const value=input();value.checkpoint.journal=j;const f=fixture({journal:()=>j,records:()=>two});assert.deepEqual(await f.review.inspect(value),{state:'matches_checkpoint',access:'closed'});
});
test('changing either snapshot across reads refuses rather than selecting a favorable copy',async()=>{
  for(const domain of ['member','journal']){let n=0;const f=fixture({[domain]:()=>{const v=inventory(domain);if(++n===2)v.tables.at(-1).sha256='f'.repeat(64);return v;}});assert.deepEqual(await f.review.inspect(input()),q('snapshot_changed'));assert.equal(f.calls.length,5);}
});
test('any creation/cleanup/admission/master opening remains closed to recovery even with matching digests',async()=>{for(const domain of ['member','journal']){const f=fixture({[domain]:()=>({...inventory(domain),closed:false})});assert.deepEqual(await f.review.inspect(input()),q('feature_open'));}});
test('evidence and returned inventories are copied before asynchronous reads',async()=>{
  let release;const wait=new Promise(r=>release=r),value=input(),f=fixture({member:async()=>{await wait;return inventory('member');}});const pending=f.review.inspect(value);value.checkpoint.member.tables[0].sha256='f'.repeat(64);release();assert.deepEqual(await pending,{state:'matches_checkpoint',access:'closed'});
  const original=inventory('member'),copy=recoveryInventory(original,'member');original.tables[0].sha256='a'.repeat(64);assert.notEqual(copy.tables[0].sha256,original.tables[0].sha256);
});
test('late/cancelled reads cannot trigger more phases, retry or reopen',async()=>{
  let release;const wait=new Promise(r=>release=r),f=fixture({member:()=>wait,timeoutMs:15});assert.deepEqual(await f.review.inspect(input()),q('unavailable'));release(inventory('member'));await new Promise(r=>setImmediate(r));assert.equal(f.calls.length,1);
  const c=new AbortController();c.abort();const g=fixture();assert.deepEqual(await g.review.inspect(input(),{signal:c.signal}),q('cancelled'));assert.equal(g.calls.length,0);
});
test('one active inspection and explicit close bound pending work without leaking raw errors',async()=>{
  const f=fixture({member:()=>new Promise(()=>{})}),pending=f.review.inspect(input());assert.deepEqual(await f.review.inspect(input()),q('busy'));f.review.close();assert.deepEqual(await pending,q('unavailable'));assert.deepEqual(await f.review.inspect(input()),q('unavailable'));
  const g=fixture({journal:()=>{throw Error('PRIVATE endpoint');}});assert.deepEqual(await g.review.inspect(input()),q('unavailable'));assert.equal(g.calls.length,2);
});
test('event-loop delay cannot extend the inspection deadline or launch later reads',async()=>{
  const f=fixture({member:()=>{const start=performance.now();while(performance.now()-start<15){}return inventory('member');},timeoutMs:5});
  assert.deepEqual(await f.review.inspect(input()),q('unavailable'));assert.equal(f.calls.length,1);
});
