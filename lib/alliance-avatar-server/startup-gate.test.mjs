import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createAllianceStartupGate,startupCheckpointSha256,startupDecisionBytes} from './startup-gate.mjs';
import {startupFixture} from './startup-gate.fixture.mjs';
import {createAllianceProfileView} from './profile-view.mjs';
import {journalFixture,other} from './deletion-journal.fixture.mjs';
const quarantine={state:'quarantine',access:'closed'},prepared={state:'prepared',access:'closed'};
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};},tick=()=>new Promise(r=>setImmediate(r));
test('startup defaults closed; no comparison, authority read or implicit preparation',async()=>{
  for(const enabled of [undefined,false,'true']){const f=startupFixture({options:{enabled}});assert.equal(await f.gate.authorize(),false);assert.deepEqual(await f.gate.prepare(f.checkpoint),quarantine);assert.deepEqual(f.calls,[]);}
  assert.equal(await createAllianceStartupGate().authorize(),false);
});
test('startup requires pinned distinct scopes, public key, independent revision/floor and fixed dependencies',()=>{
  for(const options of [{journalProjectRef:'abcdefghijklmnopqrst'},{verificationKey:'bad'},{minimumRevision:0},{minimum:undefined},{minimum:{sequence:0,sha256:'a'.repeat(64)}},{readDecision:null},{ledger:{}},{journal:{}},{timeoutMs:25001},{decisionTimeoutMs:3501},{decisionTimeoutMs:0}])assert.throws(()=>startupFixture({options}));
});
test('signed review surrounds actual paired comparison but keeps access closed until separate higher-revision serve',async()=>{
  const f=startupFixture();assert.equal(await f.gate.authorize(),false);assert.deepEqual(await f.gate.prepare(f.checkpoint),prepared);
  assert.deepEqual(f.calls,['decision','member','journal','records','member','journal','decision']);assert.equal(f.requests.every(x=>x.signal.aborted),true);
  f.serve();assert.equal(await f.gate.authorize(),true);assert.equal(await f.gate.authorize(),true);assert.equal(f.requests.length,4);
  assert.equal(new Set(f.requests.map(x=>x.request.challenge)).size,4);assert.equal(new Set(f.requests.map(x=>x.request.bootId)).size,1);
  assert.deepEqual(await f.gate.prepare(f.checkpoint),quarantine);f.gate.close();assert.equal(await f.gate.authorize(),false);
});
test('a comparison match never automatically opens without an explicit signed serve transition',async()=>{
  const f=startupFixture();assert.deepEqual(await f.gate.prepare(f.checkpoint),prepared);assert.equal(await f.gate.authorize(),false);f.serve();assert.equal(await f.gate.authorize(),false);
});
test('restart cannot inherit preparation or replay another boot decision',async()=>{
  let saved;const f=startupFixture({read:({decision,signDecision})=>saved=signDecision(decision)});assert.deepEqual(await f.gate.prepare(f.checkpoint),prepared);f.gate.close();
  const restarted=f.make({readDecision:()=>saved});assert.equal(await restarted.authorize(),false);assert.deepEqual(await restarted.prepare(f.checkpoint),quarantine);
  const fresh=f.make();assert.deepEqual(await fresh.prepare(f.checkpoint),prepared);assert.notEqual(f.requests.at(-1).request.bootId,f.requests[0].request.bootId);fresh.close();
});
test('replaying the first signed decision cannot pass the final fresh-challenge check',async()=>{
  let saved;const f=startupFixture({read:({decision,signDecision})=>saved||=(signDecision(decision))});assert.deepEqual(await f.gate.prepare(f.checkpoint),quarantine);assert.equal(f.calls.length,7);assert.equal(await f.gate.authorize(),false);
});
test('signed wrong scope, boot, challenge, time, freeze, digest, floor or revision refuses',async()=>{
  for(const change of [d=>({...d,memberProjectRef:'zzzzzzzzzzzzzzzzzzzz'}),d=>({...d,epoch:other}),d=>({...d,bootId:'f'.repeat(64)}),d=>({...d,challenge:'f'.repeat(64)}),d=>({...d,issuedAt:'2020-01-01T00:00:00.000Z'}),d=>({...d,issuedAt:'2099-01-01T00:00:00.000Z'}),d=>({...d,freezeId:d.epoch}),d=>({...d,checkpointSha256:'f'.repeat(64)}),d=>({...d,floor:{sequence:0,sha256:'0'.repeat(64)}}),d=>({...d,floor:{sequence:1,sha256:'a'.repeat(64)}})]){
    const f=startupFixture({change});assert.deepEqual(await f.gate.prepare(f.checkpoint),quarantine);assert.deepEqual(f.calls,['decision']);
  }
  const f=startupFixture({options:{minimumRevision:2}});assert.deepEqual(await f.gate.prepare(f.checkpoint),quarantine);assert.deepEqual(f.calls,['decision']);
});
test('signed binding faults independently refuse with an otherwise acceptable revision',async()=>{
  for(const change of [d=>({...d,checkpointSha256:'f'.repeat(64)}),d=>({...d,freezeId:d.epoch}),d=>({...d,frozenAt:'2026-01-01T00:02:00.000Z'}),d=>({...d,floor:{sequence:2,sha256:'a'.repeat(64)}}),d=>({...d,state:'serve'})]){const f=startupFixture({change});assert.deepEqual(await f.gate.prepare(f.checkpoint),quarantine);assert.equal(await f.gate.authorize(),false);}
});
test('malformed, forged, oversized and invalid UTF8 authority envelopes never disclose raw errors',async()=>{
  for(const read of [()=>Buffer.from([255]),()=>Buffer.alloc(8193),()=>({state:'serve'}),()=>Buffer.from('PRIVATE endpoint'),({decision})=>Buffer.from(JSON.stringify({decision,signature:'f'.repeat(128)})),({decision,signDecision})=>Buffer.from(JSON.stringify({...JSON.parse(signDecision(decision)),extra:'PRIVATE'}))]){
    const f=startupFixture({read});assert.deepEqual(await f.gate.prepare(f.checkpoint),quarantine);assert.equal(f.calls.length,1);assert.equal(await f.gate.authorize(),false);
  }
});
test('malformed canonical policy and old or incomplete checkpoints cannot be signed or prepared',async()=>{
  const f=startupFixture();for(const change of [p=>p.format=1,p=>p.member.tables.pop(),p=>p.extra='PRIVATE',p=>p.journal.tables.reverse()]){const p=structuredClone(f.checkpoint);change(p);assert.throws(()=>startupCheckpointSha256(p));}
  const d={...f.requests[0]};assert.throws(()=>startupDecisionBytes(d));
  assert.deepEqual(await f.gate.prepare({...f.checkpoint,extra:'PRIVATE'}),quarantine);assert.equal(f.calls.length,0);
});
test('same complete checkpoint digest is independent of caller object key order',()=>{
  const f=startupFixture(),reverse=v=>Object.fromEntries(Object.entries(v).reverse());const cp=reverse(f.checkpoint);cp.member=reverse(cp.member);cp.member.tables=cp.member.tables.map(reverse);
  assert.equal(startupCheckpointSha256(cp),startupCheckpointSha256(f.checkpoint));
});
test('policy change while recovery is inspected cannot prepare or automatically retry',async()=>{
  const f=startupFixture({change:(d,n)=>n===2?{...d,revision:d.revision+1}:d});assert.deepEqual(await f.gate.prepare(f.checkpoint),quarantine);assert.deepEqual(await f.gate.prepare(f.checkpoint),quarantine);assert.equal(f.calls.length,7);
});
test('missing or changed member data refuses through the real five-read inspector',async()=>{
  const f=startupFixture({ledger:{recoveryInventory:()=>{const v=structuredClone(f.checkpoint.member);v.tables[0].sha256='f'.repeat(64);return v;}}});assert.deepEqual(await f.gate.prepare(f.checkpoint),quarantine);assert.equal(f.requests.length,1);
});
test('explicit closure after serving latches this boot closed even if control reopens',async()=>{
  const f=startupFixture();await f.gate.prepare(f.checkpoint);f.serve();assert.equal(await f.gate.authorize(),true);f.control.state='closed';f.control.revision++;assert.equal(await f.gate.authorize(),false);f.serve();assert.equal(await f.gate.authorize(),false);assert.equal(f.requests.length,4);
});
test('same-revision serving, changing checkpoint/freeze/floor and regressed revision refuse',async()=>{
  for(const change of [c=>c.revision--,c=>c.checkpointSha256='f'.repeat(64),c=>c.freezeId='11111111-1111-4111-8111-111111111111',c=>c.frozenAt='2026-01-01T00:00:01.000Z',c=>c.floor={sequence:2,sha256:'a'.repeat(64)}]){
    const f=startupFixture();await f.gate.prepare(f.checkpoint);f.serve();change(f.control);assert.equal(await f.gate.authorize(),false);assert.equal(await f.gate.authorize(),false);
  }
  const f=startupFixture();await f.gate.prepare(f.checkpoint);f.serve();f.control.revision=4;assert.equal(await f.gate.authorize(),true);f.control.revision=3;assert.equal(await f.gate.authorize(),false);
});
test('input checkpoint is copied before asynchronous authority work',async()=>{
  const wait=deferred(),f=startupFixture({read:async({decision,signDecision})=>{await wait.promise;return signDecision(decision);}}),cp=structuredClone(f.checkpoint);
  const pending=f.gate.prepare(cp);cp.member.tables[0].sha256='a'.repeat(64);wait.resolve();assert.deepEqual(await pending,prepared);
});
test('stalled authority deadline, abort and close cannot start late inventory work',async()=>{
  const wait=deferred(),f=startupFixture({read:()=>wait.promise,options:{decisionTimeoutMs:10}});assert.deepEqual(await f.gate.prepare(f.checkpoint),quarantine);wait.resolve(Buffer.alloc(0));await tick();assert.deepEqual(f.calls,['decision']);assert.equal(f.requests[0].signal.aborted,true);
  const g=startupFixture({read:()=>new Promise(()=>{})}),pending=g.gate.prepare(g.checkpoint);g.gate.close();assert.deepEqual(await pending,quarantine);assert.equal(await g.gate.authorize(),false);
  const h=startupFixture();assert.deepEqual(await h.gate.prepare(h.checkpoint,{signal:AbortSignal.abort()}),quarantine);assert.deepEqual(h.calls,[]);
});
test('one active operation refuses queues and a late serving result cannot survive cancellation',async()=>{
  const wait=deferred();let stalled=false;
  const f=startupFixture({read:({decision,signDecision})=>stalled?wait.promise:signDecision(decision)});await f.gate.prepare(f.checkpoint);f.serve();stalled=true;
  const c=new AbortController(),pending=f.gate.authorize({signal:c.signal});assert.equal(await f.gate.authorize(),false);await tick();c.abort();assert.equal(await pending,false);wait.resolve(f.signDecision({...f.requests.at(-1).request,...f.control,issuedAt:new Date().toISOString()}));await tick();assert.equal(await f.gate.authorize(),false);
});
test('event-loop blocking cannot extend a decision deadline into a successful startup',async()=>{
  const f=startupFixture({read:({decision,signDecision})=>{const t=performance.now();while(performance.now()-t<15){}return signDecision(decision);},options:{decisionTimeoutMs:5}});assert.deepEqual(await f.gate.prepare(f.checkpoint),quarantine);assert.deepEqual(f.calls,['decision']);
});
test('actual profile guard composes startup permission, then discards loaded text on signed closure',async()=>{
  const f=startupFixture(),signed=journalFixture({minimum:{...f.control.floor}}),row={id:other,name:'Fixture Reader',community:'',bio:'Synthetic only.',role:'builder',listed:true,publication:'listed',updatedAt:'2026-10-17T16:00:00Z'};
  const view=createAllianceProfileView({enabled:true,serving:f.gate,journal:signed.client});let loads=0;
  assert.deepEqual(await view.read({kind:'self'},{load:()=>{loads++;return row;}}),{state:'unavailable'});assert.equal(loads,0);
  await f.gate.prepare(f.checkpoint);f.serve();assert.equal((await view.read({kind:'self'},{load:()=>row})).state,'ready');
  assert.deepEqual(await view.read({kind:'self'},{load:()=>{f.control.state='closed';f.control.revision++;return row;}}),{state:'unavailable'});
  view.close();signed.client.close();f.gate.close();
});
