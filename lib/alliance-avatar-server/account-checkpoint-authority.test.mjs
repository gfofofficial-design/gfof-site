import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {accountEvent,accountRecord} from './account-history.mjs';
import {accountHandoffBytes} from './account-handoff.mjs';
import {createAccountCheckpointAuthority} from './account-checkpoint-authority.mjs';
import {createAccountCheckpoint} from './account-checkpoint.mjs';
import {checkpointFixture,checkpointSqliteAvailable} from './account-checkpoint.fixture.mjs';
const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111'},hs={memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch};
const zero={sequence:0,sha256:'0'.repeat(64)},key='b'.repeat(64),tag='a'.repeat(64),sha=b=>createHash('sha256').update(b).digest('hex');
const event=kind=>accountEvent({kind,subject:tag}),one=accountRecord({scope:hs,sequence:1,previous:zero.sha256,event:event('account_admitted')}),two=accountRecord({scope:hs,sequence:2,previous:one.sha256,event:event('account_remove_requested')});
const tip=r=>({sequence:r.sequence,sha256:r.sha256}),receipt=b=>({generation:JSON.parse(b).generation,sha256:sha(b)}),base=()=>({format:1,scope,generation:1,previousSha256:zero.sha256,verificationKey:key,minimum:{head:tip(one),acknowledged:zero},pending:null});
const intent=()=>({id:'c'.repeat(64),kind:'history_append',event:event('account_remove_requested'),expected:tip(one),target:null});
function fixture(){
 let bytes=accountHandoffBytes(base());const initial=receipt(bytes),calls=[];
 const store={read:async()=>{calls.push('read');return {bytes:Buffer.from(bytes),receipt:receipt(bytes)};},compareAndSet:async q=>{calls.push('cas');if(!same(q.expected,receipt(bytes)))return {state:'conflict',receipt:receipt(bytes)};bytes=Buffer.from(q.bytes);return {state:'committed',receipt:receipt(bytes)};}};
 const make=patch=>createAccountCheckpointAuthority({enabled:true,scope,verificationKey:key,minimum:initial,store,...patch});
 const request=(patch={},records=[one],kind='ordinary')=>{const prior=JSON.parse(bytes),next=accountHandoffBytes({...prior,generation:prior.generation+1,previousSha256:sha(bytes),...patch});return {expected:receipt(bytes),next:receipt(next),bytes:next,records:structuredClone(records),kind};};
 return {store,initial,calls,make,request,get bytes(){return Buffer.from(bytes);},replace:b=>{bytes=Buffer.from(b);}};
}
const same=(a,b)=>a.generation===b.generation&&a.sha256===b.sha256;
test('authority is default-off; invalid bare-digest requests perform no storage I/O',async()=>{
 let n=0;const off=createAccountCheckpointAuthority({store:{read:()=>n++}});assert.deepEqual(await off.read(),{state:'unavailable'});assert.deepEqual(await off.advance({}),{state:'unavailable'});assert.equal(n,0);off.close();
 const f=fixture(),a=f.make();try{assert.deepEqual(await a.advance({expected:f.initial,next:f.initial}),{state:'invalid'});assert.equal(f.calls.length,0);}finally{a.close();}
});
test('authority configuration rejects missing current pin, invalid scope/key and unbounded deadlines',()=>{
 const f=fixture();for(const patch of [{minimum:undefined},{minimum:{generation:0,sha256:key}},{scope:{...scope,controlProjectRef:scope.memberProjectRef}},{verificationKey:zero.sha256},{store:{}},{timeoutMs:4001}])assert.throws(()=>f.make(patch));
});
test('authority validates successor using its own record and reads committed canonical bytes back',async()=>{
 const f=fixture(),a=f.make(),q=f.request({minimum:{head:tip(two),acknowledged:tip(one)}},[one,two]);
 try{assert.deepEqual(await a.advance(q),{state:'committed',receipt:q.next});assert.deepEqual(f.calls,['read','cas','read']);assert.deepEqual(await a.read(),q.next);assert.deepEqual(JSON.parse(f.bytes).minimum,{head:tip(two),acknowledged:tip(one)});}finally{a.close();}
});
test('larger generation cannot lower either retained floor or replace it with a fork',async()=>{
 for(const name of ['head','acknowledged']){const f=fixture();const b=base();b.minimum.acknowledged=tip(one);f.replace(accountHandoffBytes(b));const a=f.make({minimum:receipt(f.bytes)});
  try{const minimum=structuredClone(b.minimum);minimum[name]=zero;if(name==='head')minimum.acknowledged=zero;assert.deepEqual(await a.advance(f.request({minimum})),{state:'invalid'});assert.equal(f.calls.filter(x=>x==='cas').length,0);assert.deepEqual(await a.read(),receipt(f.bytes));}finally{a.close();}
 }
 const f=fixture(),a=f.make(),bad=f.request();bad.bytes=accountHandoffBytes({...JSON.parse(bad.bytes),minimum:{head:{sequence:1,sha256:'e'.repeat(64)},acknowledged:zero}});bad.next=receipt(bad.bytes);
 try{assert.deepEqual(await a.advance(bad),{state:'invalid'});assert.ok(!f.calls.includes('cas'));}finally{a.close();}
});
test('pending intent cannot be cleared or rewritten by an ordinary advancement',async()=>{
 const f=fixture(),a=f.make();try{assert.equal((await a.advance(f.request({pending:intent()}))).state,'committed');for(const pending of [null,{...intent(),id:'e'.repeat(64)}])assert.deepEqual(await a.advance(f.request({pending})),{state:'invalid'});assert.deepEqual(JSON.parse(f.bytes).pending,intent());}finally{a.close();}
});
test('malformed proof, wrong scope/key, oversized chain and mismatched digest refuse before CAS',async()=>{
 const f=fixture(),a=f.make();try{
  for(const patch of [{records:Array(257).fill(one)},{kind:'reset'},{bytes:Buffer.alloc(4097)},{next:{generation:2,sha256:'e'.repeat(64)}}])assert.equal((await a.advance({...f.request(),...patch})).state,'invalid');
  for(const patch of [{scope:{...scope,epoch:'22222222-2222-4222-8222-222222222222'}},{verificationKey:'e'.repeat(64)}])assert.equal((await a.advance(f.request(patch))).state,'invalid');
  assert.equal((await a.advance(f.request({},[{...one,sha256:'e'.repeat(64)}]))).state,'invalid');assert.ok(!f.calls.includes('cas'));
 }finally{a.close();}
});
test('a stale expected receipt conflicts without overwriting the authoritative record',async()=>{
 const f=fixture(),a=f.make(),stale=f.request();try{const q=f.request({pending:intent()});assert.equal((await a.advance(q)).state,'committed');assert.deepEqual(await a.advance(stale),{state:'conflict',receipt:q.next});assert.deepEqual(f.bytes,q.bytes);assert.equal(f.calls.filter(x=>x==='cas').length,1);}finally{a.close();}
});
test('two service instances race through atomic storage with one committed successor',async()=>{
 const f=fixture(),a=f.make(),b=f.make(),q=f.request({pending:intent()});try{const results=await Promise.all([a.advance(q),b.advance(q)]);assert.equal(results.filter(x=>x.state==='committed').length,1);assert.equal(results.filter(x=>x.state==='conflict').length,1);assert.deepEqual(f.bytes,q.bytes);}finally{a.close();b.close();}
});
test('request bytes and proof are copied before asynchronous storage can alter caller inputs',async()=>{
 const f=fixture(),q=f.request({pending:intent()}),expected=Buffer.from(q.bytes),read=f.store.read;f.store.read=async()=>{q.bytes.fill(0);q.records[0].event.subject='e'.repeat(64);q.expected.sha256='e'.repeat(64);return read();};const a=f.make();
 try{assert.equal((await a.advance(q)).state,'committed');assert.deepEqual(f.bytes,expected);}finally{a.close();}
});
test('lost commit response is unknown; fresh service observes stored pending rather than resetting',async()=>{
 const f=fixture(),cas=f.store.compareAndSet;f.store.compareAndSet=async q=>{await cas(q);throw Error('PRIVATE');};const a=f.make(),q=f.request({pending:intent()});
 try{assert.deepEqual(await a.advance(q),{state:'unknown'});assert.deepEqual(await a.read(),{state:'unavailable'});assert.deepEqual(JSON.parse(f.bytes).pending,intent());const fresh=f.make();try{assert.deepEqual(await fresh.read(),q.next);}finally{fresh.close();}}finally{a.close();}
});
test('unverified commit receipt or changed readback never returns committed evidence',async()=>{
 for(const kind of ['receipt','readback','conflict']){const f=fixture(),cas=f.store.compareAndSet;f.store.compareAndSet=async q=>{const r=await cas(q);if(kind==='receipt')return {...r,receipt:f.initial};if(kind==='conflict')return {state:'conflict',receipt:f.initial};f.replace(accountHandoffBytes(base()));return r;};const a=f.make();try{assert.deepEqual(await a.advance(f.request({pending:intent()})),{state:'unknown'});}finally{a.close();}}
});
test('close/timeout prevent a delayed CAS result from releasing evidence and never retry',async()=>{
 for(const kind of ['close','timeout']){const f=fixture();let enter,release;const ready=new Promise(r=>enter=r),cas=f.store.compareAndSet;f.store.compareAndSet=async q=>{enter();await new Promise(r=>release=r);return cas(q);};const a=f.make({timeoutMs:kind==='timeout'?60:4000}),pending=a.advance(f.request({pending:intent()}));await ready;assert.deepEqual(await a.read(),{state:'busy'});if(kind==='close')a.close();assert.deepEqual(await pending,{state:'unknown'});release();await new Promise(r=>setImmediate(r));assert.equal(f.calls.filter(x=>x==='cas').length,1);assert.deepEqual(await a.read(),{state:'unavailable'});a.close();}
});
test('coordinator sends full proof to authority and derives conditional pending resolution without replay',async()=>{
 const f=fixture(),a=f.make();let slotBytes=f.bytes,rows=[one],dispatches=0;
 const slot={read:async()=>({bytes:Buffer.from(slotBytes),receipt:receipt(slotBytes)}),compareAndSet:async q=>{if(!same(q.expected,receipt(slotBytes)))return {state:'conflict',receipt:receipt(slotBytes)};slotBytes=Buffer.from(q.bytes);return {state:'committed',receipt:receipt(slotBytes)};}};
 const c=createAccountCheckpoint({enabled:true,reconciliationEnabled:true,scope,verificationKey:key,minimum:f.initial,slot,anchor:a,history:{snapshot:async()=>({scope:hs,enabled:true,admissionsOpen:true,head:tip(rows.at(-1)),records:structuredClone(rows)}),append:async()=>{dispatches++;rows=[one,two];return {state:'recorded'};}},acknowledgements:{read:async()=>zero,advance:async()=>{throw Error('Unexpected');}}});
 try{assert.equal((await c.execute(intent())).outcome,'reported_commit');assert.equal(JSON.parse(f.bytes).generation,2);assert.equal((await c.reconcile()).state,'resolved');const record=JSON.parse(f.bytes);assert.equal(record.pending,null);assert.equal(record.format,2);assert.equal(record.resolution.outcome,'effect_satisfied');assert.equal(dispatches,1);assert.deepEqual(f.bytes,slotBytes);}finally{c.close();a.close();}
});
test('actual SQLite committed authority record survives close/reopen; ordinary stale restore remains refused',{skip:!checkpointSqliteAvailable},async()=>{
 const f=fixture(),disk=await checkpointFixture(f.bytes,'synthetic_account_checkpoint');let pair=await disk.open(),a=f.make({store:pair.slot});const q=f.request({pending:intent()});
 try{assert.equal((await a.advance(q)).state,'committed');a.close();pair.close();pair=await disk.open();a=f.make({store:pair.slot,minimum:q.next});assert.deepEqual(await a.read(),q.next);pair.replace('slot',accountHandoffBytes(base()),f.initial);assert.deepEqual(await a.read(),{state:'unavailable'});}finally{a.close();pair.close();await disk.cleanup();}
});
