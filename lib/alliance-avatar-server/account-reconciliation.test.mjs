import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {accountEvent,accountRecord} from './account-history.mjs';
import {accountHandoffBytes} from './account-handoff.mjs';
import {createAccountCheckpoint} from './account-checkpoint.mjs';
import {checkpointFixture,checkpointSqliteAvailable} from './account-checkpoint.fixture.mjs';
const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111'},hs={memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch};
const zero={sequence:0,sha256:'0'.repeat(64)},tag='a'.repeat(64),verificationKey='b'.repeat(64),sha=b=>createHash('sha256').update(b).digest('hex'),point=r=>({sequence:r.sequence,sha256:r.sha256}),clone=v=>structuredClone(v);
const event=accountEvent({kind:'account_remove_requested',subject:tag}),one=accountRecord({scope:hs,sequence:1,previous:zero.sha256,event:accountEvent({kind:'account_admitted',subject:tag})}),two=accountRecord({scope:hs,sequence:2,previous:one.sha256,event}),other=accountRecord({scope:hs,sequence:2,previous:one.sha256,event:accountEvent({kind:'account_admitted',subject:'e'.repeat(64)})}),three=accountRecord({scope:hs,sequence:3,previous:other.sha256,event:accountEvent({kind:'account_remove_requested',subject:'e'.repeat(64)})});
const p=()=>({id:'c'.repeat(64),kind:'history_append',event,expected:point(one),target:null});
function fixture({rows=[one,two],ack=zero,pending=p(),initialHead=one,initialAck=zero}={}){
 const record={format:1,scope,generation:2,previousSha256:'d'.repeat(64),verificationKey,minimum:{head:point(initialHead),acknowledged:initialAck},pending};let bytes=accountHandoffBytes(record),r={generation:2,sha256:sha(bytes)};const initial={...r},calls=[];
 const slot={read:async()=>({bytes:Buffer.from(bytes),receipt:{generation:JSON.parse(bytes).generation,sha256:sha(bytes)}}),compareAndSet:async q=>{calls.push('slot');if(q.expected.sha256!==sha(bytes))return {state:'conflict',receipt:{generation:JSON.parse(bytes).generation,sha256:sha(bytes)}};bytes=Buffer.from(q.bytes);return {state:'committed',receipt:{generation:JSON.parse(bytes).generation,sha256:sha(bytes)}};}};
 const anchor={read:async()=>({...r}),advance:async q=>{calls.push('anchor');if(q.expected.sha256!==r.sha256)return {state:'conflict',receipt:{...r}};r={...q.next};return {state:'committed',receipt:{...r}};}};
 const history={snapshot:async()=>{calls.push('history.read');return {scope:hs,enabled:true,admissionsOpen:true,head:point(rows.at(-1)),records:clone(rows)};},append:async q=>{calls.push('history.write');const match=rows.find(x=>x.event.id===q.event.id);if(match)return {state:'recorded',record:match,head:point(rows.at(-1))};if(q.expected.sha256!==rows.at(-1).sha256)return {state:'conflict',head:point(rows.at(-1))};throw Error('Unexpected synthetic append');}};
 const acknowledgements={read:async()=>{calls.push('ack.read');return {...ack};},advance:async q=>{calls.push('ack.write');if(q.expected.sha256!==ack.sha256)return {state:'conflict',point:{...ack}};ack={...q.head};return {state:'acknowledged',point:{...ack}};}};
 const make=patch=>createAccountCheckpoint({enabled:true,reconciliationEnabled:true,scope,verificationKey,minimum:initial,slot,anchor,history,acknowledgements,...patch});
 return {make,slot,anchor,history,acknowledgements,calls,initial,get bytes(){return Buffer.from(bytes);},get receipt(){return {...r};},get ack(){return {...ack};},setRows:v=>{rows=clone(v);}};
}
test('reconciliation is separately disabled by default and makes no I/O',async()=>{
 const f=fixture(),c=f.make({reconciliationEnabled:false});try{assert.deepEqual(await c.reconcile(),{state:'unavailable'});assert.deepEqual(f.calls,[]);}finally{c.close();}assert.throws(()=>f.make({reconciliationEnabled:'true'}));
});
test('effect reconciliation persists v2 receipt before returning, with zero business writes',async()=>{
 const f=fixture(),c=f.make();try{assert.deepEqual(await c.reconcile(),{state:'resolved',outcome:'effect_satisfied',authorization:'not_established',erasure:'not_established'});const stored=JSON.parse(f.bytes);assert.equal(stored.format,2);assert.equal(stored.pending,null);assert.deepEqual(stored.resolution.pending,p());assert.equal(f.receipt.sha256,sha(f.bytes));assert.equal(stored.generation,4);assert.ok(!f.calls.includes('history.write'));assert.ok(!f.calls.includes('ack.write'));assert.deepEqual(await c.reconcile(),{state:'no_pending'});}finally{c.close();}
});
test('absence at an unchanged tip remains pending without a write or retry',async()=>{
 const f=fixture({rows:[one]}),c=f.make();try{assert.deepEqual(await c.reconcile(),{state:'pending'});assert.equal(JSON.parse(f.bytes).pending.id,p().id);assert.ok(!f.calls.includes('slot'));assert.ok(!f.calls.includes('history.write'));}finally{c.close();}
});
test('superseded append records the displaced CAS guard; a late original cannot append',async()=>{
 const f=fixture({rows:[one,other]}),c=f.make();try{assert.equal((await c.reconcile()).outcome,'superseded');const before=f.bytes;assert.deepEqual(JSON.parse(before).resolution.guard,point(other));assert.equal((await f.history.append({event,expected:point(one)})).state,'conflict');assert.deepEqual(f.bytes,before);}finally{c.close();}
});
test('an intermediate ack advance safely supersedes the original larger target',async()=>{
 const pending={id:verificationKey,kind:'acknowledgement_advance',event:null,expected:zero,target:point(three)},f=fixture({rows:[one,other,three],ack:point(one),initialHead:three,pending}),c=f.make();try{assert.equal((await c.reconcile()).outcome,'superseded');assert.deepEqual(JSON.parse(f.bytes).resolution.guard,point(one));assert.equal((await f.acknowledgements.advance({records:[one,other,three],head:point(three),expected:zero})).state,'conflict');assert.deepEqual(f.ack,point(one));}finally{c.close();}
});
test('lost resolution slot reply never returns resolved; fresh instance refuses mismatched stores',async()=>{
 const f=fixture({initialHead:two}),put=f.slot.compareAndSet;f.slot.compareAndSet=async q=>{await put(q);throw Error('lost_slot_commit');};const c=f.make();try{assert.equal((await c.reconcile()).state,'unknown');const fresh=f.make();try{assert.equal((await fresh.reconcile()).state,'unavailable');assert.ok(!f.calls.includes('history.write'));}finally{fresh.close();}}finally{c.close();}
});
test('lost resolution anchor reply can be independently read after restart without business replay',async()=>{
 const f=fixture({initialHead:two}),advance=f.anchor.advance;f.anchor.advance=async q=>{await advance(q);throw Error('lost_anchor_commit');};const c=f.make();try{assert.equal((await c.reconcile()).state,'unknown');const fresh=f.make();try{assert.deepEqual(await fresh.reconcile(),{state:'no_pending'});assert.equal(JSON.parse(f.bytes).format,2);assert.ok(!f.calls.includes('history.write'));assert.ok(!f.calls.includes('ack.write'));}finally{fresh.close();}}finally{c.close();}
});
test('resolution CAS conflict never clears or replaces the pending operation',async()=>{
 const f=fixture({initialHead:two});f.slot.compareAndSet=async()=>({state:'conflict',receipt:f.receipt});const c=f.make();try{assert.equal((await c.reconcile()).state,'unknown');assert.deepEqual(JSON.parse(f.bytes).pending,p());assert.ok(!f.calls.includes('history.write'));}finally{c.close();}
});
test('a late resolution write after close cannot advance the outside receipt or return success',async()=>{
 const f=fixture({initialHead:two}),put=f.slot.compareAndSet;let entered,release;const ready=new Promise(r=>entered=r);f.slot.compareAndSet=async q=>{entered();await new Promise(r=>release=r);return put(q);};const c=f.make(),result=c.reconcile();await ready;c.close();assert.deepEqual(await result,{state:'unknown'});release();await new Promise(r=>setImmediate(r));assert.equal(f.calls.filter(x=>x==='anchor').length,0);assert.ok(!f.calls.includes('history.write'));
});
test('a fresh v2 observation preserves the last resolution while a later acknowledgement is staged and resolved',async()=>{
 const f=fixture(),c=f.make();try{assert.equal((await c.reconcile()).state,'resolved');const resolved=JSON.parse(f.bytes).resolution;const pending={id:'f'.repeat(64),kind:'acknowledgement_advance',event:null,expected:zero,target:point(two)};assert.equal((await c.execute(pending)).outcome,'reported_commit');assert.deepEqual(JSON.parse(f.bytes).resolution,resolved);assert.equal((await c.reconcile()).outcome,'effect_satisfied');assert.deepEqual(JSON.parse(f.bytes).resolution.pending,pending);assert.deepEqual(JSON.parse(f.bytes).resolution.guard,point(two));assert.equal(f.calls.filter(x=>x==='ack.write').length,1);}finally{c.close();}
});
test('real SQLite resolution persists its canonical receipt after close/reopen without any business dispatch',{skip:!checkpointSqliteAvailable},async()=>{
 const f=fixture(),disk=await checkpointFixture(f.bytes,'synthetic_account_checkpoint');let pair=await disk.open(),c=f.make({slot:pair.slot,anchor:pair.anchor});try{assert.equal((await c.reconcile()).outcome,'effect_satisfied');const stored=await pair.slot.read();assert.equal(JSON.parse(stored.bytes).format,2);assert.deepEqual(JSON.parse(stored.bytes).resolution.pending,p());c.close();pair.close();pair=await disk.open();const fresh=f.make({slot:pair.slot,anchor:pair.anchor});try{assert.deepEqual(await fresh.reconcile(),{state:'no_pending'});assert.deepEqual((await pair.slot.read()).receipt,await pair.anchor.read());assert.ok(!f.calls.includes('history.write'));assert.ok(!f.calls.includes('ack.write'));}finally{fresh.close();}}finally{c.close();pair.close();await disk.cleanup();}
});
test('real split resolution commit stays closed after reopen; no automatic anchor repair',{skip:!checkpointSqliteAvailable},async()=>{
 const f=fixture({initialHead:two}),disk=await checkpointFixture(f.bytes,'synthetic_account_checkpoint');let pair=await disk.open();const put=pair.slot.compareAndSet,pairSlot={...pair.slot,compareAndSet:async q=>{await put(q);throw Error('lost');}},c=f.make({slot:pairSlot,anchor:pair.anchor});try{assert.equal((await c.reconcile()).state,'unknown');c.close();pair.close();pair=await disk.open();const fresh=f.make({slot:pair.slot,anchor:pair.anchor});try{assert.equal((await fresh.reconcile()).state,'unavailable');assert.equal((await pair.anchor.read()).generation,2);assert.equal((await pair.slot.read()).receipt.generation,3);assert.ok(!f.calls.includes('history.write'));}finally{fresh.close();}}finally{c.close();pair.close();await disk.cleanup();}
});
