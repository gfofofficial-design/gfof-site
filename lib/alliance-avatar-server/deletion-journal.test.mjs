import test from 'node:test';
import assert from 'node:assert/strict';
import {createAvatarDeletionJournal,deletionRecord,deletionWitnessBytes} from './deletion-journal.mjs';
import {journalFixture,event,chain,projectRef,epoch,profileId,objectId,other,zero} from './deletion-journal.fixture.mjs';
const wait=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
const unavailable={state:'unavailable'};
test('default-closed and truthy-only journal readers contact neither dependency',async()=>{
  for(const enabled of [undefined,false,'true']){const f=journalFixture({options:{enabled}});assert.deepEqual(await f.client.review(),unavailable);assert.equal(f.calls.length,0);}
});
test('enabled mode needs pinned scope, epoch, public key, floor and finite bounds',()=>{
  assert.throws(()=>createAvatarDeletionJournal({enabled:true}));
  for(const options of [{projectRef:'bad'},{epoch:'bad'},{verificationKey:'PRIVATE KEY'},{minimum:{sequence:0,sha256:'a'.repeat(64)}},{minimum:{sequence:257,sha256:zero}},{timeoutMs:0},{timeoutMs:8001}])assert.throws(()=>journalFixture({options}));
});
test('record format excludes free text, raw receipts, unblocking and invalid scope',()=>{
  const value={projectRef,epoch,sequence:1,previous:zero,event:event()};
  for(const v of [{...value,sequence:0},{...value,previous:'bad'},{...value,event:event({kind:'allow'})},{...value,event:event({receipt:'PRIVATE'})},{...value,event:event({objectId})},{...value,event:event({kind:'image_remove_requested'})},{...value,event:event({profileId:'bad'})}])assert.throws(()=>deletionRecord(v));
});
test('fixed witness encoding is domain separated and never signs arbitrary JSON',()=>{
  const a={format:1,projectRef,epoch,sequence:0,sha256:zero,challenge:'a'.repeat(64),issuedAt:'2026-01-01T00:00:00.000Z'};
  assert.equal(deletionWitnessBytes(a).toString(),'GF-ALLIANCE-DELETION-WITNESS-V1\0'+JSON.stringify(a));
  assert.throws(()=>deletionWitnessBytes({...a,key:'PRIVATE'}));assert.throws(()=>deletionWitnessBytes({...a,sha256:'b'.repeat(64)}));
});
test('fixed record digest agrees with an independently calculated Python SHA-256 vector',()=>{
  assert.equal(chain([event()])[0].sha256,'16be7915a18c5625b3e3fcafc59e722d4cf201845f734b61e11efd52403983c3');
});
test('real Ed25519 verification accepts a fresh complete chain and produces a deny-only view',async()=>{
  const f=journalFixture();const view=await f.client.review();assert.equal(view.state,'verified_evidence');assert.deepEqual(view.check({profileId,objectId}),{state:'blocked',scope:'profile'});assert.deepEqual(view.check({profileId:other,objectId}),{state:'not_listed'});
  assert.deepEqual(f.calls.map(x=>x.phase),['witness','records']);assert.equal(f.calls[0].args.challenge.length,64);assert.equal(f.calls[1].args.through,1);assert.equal(f.calls[1].args.maxBytes,262144);
  assert.equal(view.allows,undefined);assert.equal(view.access,undefined);assert.equal(JSON.stringify(view).includes(profileId),false);view.close();assert.deepEqual(view.check({profileId,objectId}),unavailable);f.client.close();
});
test('image intent denies the immutable object even if an older database changes its profile',async()=>{
  const f=journalFixture({events:[event({kind:'image_remove_requested',objectId})]});const view=await f.client.review();assert.deepEqual(view.check({profileId:other,objectId}),{state:'blocked',scope:'image'});assert.deepEqual(view.check({profileId,objectId:other}),{state:'not_listed'});f.client.close();
});
test('genesis can be verified but absence is not access permission or erasure',async()=>{
  const f=journalFixture({events:[]});const view=await f.client.review();assert.equal(view.state,'verified_evidence');assert.deepEqual(view.check({profileId,objectId}),{state:'not_listed'});f.client.close();
});
test('wrong key, invalid signature and extra witness fields stop before record reads',async()=>{
  for(const witness of [({anchor,signAnchor,encode})=>encode({...signAnchor(anchor),signature:'0'.repeat(128)}),({anchor,signAnchor,encode})=>encode({...signAnchor(anchor),secret:'PRIVATE'})]){const f=journalFixture({witness});assert.deepEqual(await f.client.review(),unavailable);assert.equal(f.calls.length,1);}
  const otherKey=journalFixture().verificationKey,f=journalFixture({options:{verificationKey:otherKey}});assert.deepEqual(await f.client.review(),unavailable);assert.equal(f.calls.length,1);
});
test('replayed signed witness fails a newly generated challenge without record fetch',async()=>{
  let saved;const f=journalFixture({witness:({anchor,signAnchor,encode})=>{saved??=encode(signAnchor(anchor));return saved;}});
  const old=await f.client.review();assert.equal(old.state,'verified_evidence');assert.deepEqual(await f.client.review(),unavailable);assert.equal(old.state,'unavailable');assert.deepEqual(f.calls.map(x=>x.phase),['witness','records','witness']);assert.notEqual(f.calls[0].args.challenge,f.calls[2].args.challenge);
});
test('signed wrong scope/epoch and stale/future/ambiguous dates remain unavailable',async()=>{
  for(const change of [{projectRef:'bbbbbbbbbbbbbbbbbbbb'},{epoch:other},{issuedAt:'2026-01-01T00:00:00.000Z'},{issuedAt:'2099-01-01T00:00:00.000Z'}]){const f=journalFixture({witness:({anchor,signAnchor,encode})=>encode(signAnchor({...anchor,...change}))});assert.deepEqual(await f.client.review(),unavailable);assert.equal(f.calls.length,1);}
  const f=journalFixture({witness:({anchor,encode})=>encode({anchor:{...anchor,issuedAt:'2026-01-01'},signature:'a'.repeat(128)})});assert.deepEqual(await f.client.review(),unavailable);
});
test('a signed rollback or same-height fork faults this reader rather than reopening it',async()=>{
  for(const minimum of [{sequence:2,sha256:'a'.repeat(64)},{sequence:1,sha256:'b'.repeat(64)}]){const f=journalFixture({minimum});assert.deepEqual(await f.client.review(),unavailable);assert.deepEqual(await f.client.review(),unavailable);assert.equal(f.calls.length,1);}
});
test('truncated, reordered, duplicated, tampered or extra-field records fail complete-chain verification',async()=>{
  const events=[event(),event({id:other,kind:'image_remove_requested',objectId})];
  for(const change of [h=>h.slice(0,1),h=>h.toReversed(),h=>[h[0],h[0]],h=>[h[0],{...h[1],previous:zero}],h=>[h[0],{...h[1],event:event({id:other,profileId:other})}],h=>[{...h[0],receipt:'PRIVATE'},h[1]]]){
    const f=journalFixture({events,readRecords:({history,encode})=>encode(change(history))});assert.deepEqual(await f.client.review(),unavailable);assert.equal(f.calls.length,2);
  }
});
test('duplicate intent IDs are refused even when every hash and the signed tip agree',async()=>{
  const f=journalFixture({events:[event(),event()]});assert.deepEqual(await f.client.review(),unavailable);
});
test('a higher signed chain must extend the independently pinned minimum',async()=>{
  const f=journalFixture({events:[event(),event({id:other,kind:'image_remove_requested',objectId})],minimum:{sequence:1,sha256:'f'.repeat(64)}});assert.deepEqual(await f.client.review(),unavailable);assert.equal(f.calls.length,2);
});
test('a complete extension of the trusted minimum preserves all earlier denials',async()=>{
  const first=chain([event()])[0],f=journalFixture({events:[event(),event({id:other,kind:'image_remove_requested',objectId})],minimum:{sequence:1,sha256:first.sha256}});
  const view=await f.client.review();assert.equal(view.state,'verified_evidence');assert.deepEqual(view.check({profileId,objectId}),{state:'blocked',scope:'profile'});assert.deepEqual(view.check({profileId:other,objectId}),{state:'blocked',scope:'image'});f.client.close();
});
test('a newly witnessed tip stays pinned even if the archive read fails',async()=>{
  let n=0;const f=journalFixture({witness:({anchor,signAnchor,encode})=>encode(signAnchor(n++===0?anchor:{...anchor,sequence:0,sha256:zero})),readRecords:()=>{throw Error('PRIVATE');}});
  assert.deepEqual(await f.client.review(),unavailable);assert.deepEqual(await f.client.review(),unavailable);assert.deepEqual(await f.client.review(),unavailable);assert.deepEqual(f.calls.map(x=>x.phase),['witness','records','witness']);
});
test('the complete maximum chain is accepted without allowing a 257th event or trimming history',async()=>{
  const events=Array.from({length:256},(_,i)=>event({id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`}));const f=journalFixture({events});const view=await f.client.review();assert.equal(view.state,'verified_evidence');assert.deepEqual(view.check({profileId,objectId}),{state:'blocked',scope:'profile'});f.client.close();assert.throws(()=>chain([...events,event({id:other})]));
});
test('invalid UTF-8, non-byte and oversized dependency responses cannot yield evidence',async()=>{
  for(const result of [Buffer.alloc(2049),Buffer.from([0xff]),'PRIVATE']){const f=journalFixture({witness:()=>result});assert.deepEqual(await f.client.review(),unavailable);assert.equal(f.calls.length,1);}
  for(const raw of [Buffer.alloc(262145),Buffer.from([0xff]),[]]){const f=journalFixture({readRecords:()=>raw});assert.deepEqual(await f.client.review(),unavailable);assert.equal(f.calls.length,2);}
});
test('private DTOs, malformed IDs and attempted actor overrides are not accepted by a view',async()=>{
  const f=journalFixture(),view=await f.client.review();for(const input of [{profileId,objectId,actor:'PRIVATE'},{profileId:'bad',objectId},{profileId,objectId:null},{}])assert.deepEqual(view.check(input),{state:'invalid'});f.client.close();
});
test('the trusted minimum is copied before later caller mutation',async()=>{
  const minimum={sequence:1,sha256:chain([event()])[0].sha256},f=journalFixture({minimum});minimum.sha256=zero;assert.equal((await f.client.review()).state,'verified_evidence');f.client.close();
});
test('pre-cancellation sends no witness or record request',async()=>{const f=journalFixture();assert.deepEqual(await f.client.review({signal:AbortSignal.abort()}),{state:'cancelled'});assert.equal(f.calls.length,0);});
test('cancellation during witness delivery cannot issue a later record read',async()=>{
  const c=new AbortController(),f=journalFixture({witness:({anchor,signAnchor,encode})=>{c.abort();return encode(signAnchor(anchor));}});assert.deepEqual(await f.client.review({signal:c.signal}),unavailable);assert.equal(f.calls.length,1);
});
test('expired evidence never revives after the wall clock is moved back',async t=>{
  const time=Date.now();t.mock.timers.enable({apis:['Date'],now:time});
  try{const f=journalFixture(),view=await f.client.review();assert.equal(view.state,'verified_evidence');t.mock.timers.tick(31000);assert.equal(view.state,'unavailable');t.mock.timers.setTime(time);assert.deepEqual(view.check({profileId,objectId}),unavailable);assert.equal(view.state,'unavailable');f.client.close();}finally{t.mock.timers.reset();}
});
test('stalled/late witness cannot start a record read after the deadline',async()=>{
  const gate=wait(),f=journalFixture({witness:({anchor,signAnchor,encode})=>{gate.result=encode(signAnchor(anchor));return gate.promise;},options:{timeoutMs:15}});assert.deepEqual(await f.client.review(),unavailable);gate.resolve(gate.result);await new Promise(r=>setImmediate(r));assert.equal(f.calls.length,1);
});
test('stalled/late records cannot restore a usable evidence view',async()=>{
  const gate=wait(),f=journalFixture({readRecords:()=>gate.promise,options:{timeoutMs:15}});assert.deepEqual(await f.client.review(),unavailable);gate.resolve(f.encode(f.history));await new Promise(r=>setImmediate(r));assert.equal(f.calls.length,2);
});
test('one in-flight review refuses queues; close invalidates work and all future evidence',async()=>{
  const f=journalFixture({witness:()=>new Promise(()=>{})});const pending=f.client.review();assert.deepEqual(await f.client.review(),{state:'busy'});f.client.close();assert.deepEqual(await pending,unavailable);assert.deepEqual(await f.client.review(),unavailable);assert.equal(f.calls.length,1);
});
