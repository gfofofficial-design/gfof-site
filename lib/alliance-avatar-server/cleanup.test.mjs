import test from 'node:test';
import assert from 'node:assert/strict';
import {createAvatarCleanup} from './cleanup.mjs';
const claimId='11111111-1111-4111-8111-111111111111',objectId='22222222-2222-4222-8222-222222222222',profileId='33333333-3333-4333-8333-333333333333';
const receipt=()=>({profileId,objectId,key:`v1/${profileId}/${objectId}.png`,providerId:claimId,sha256:'a'.repeat(64),bytes:100,width:1,height:1,mime:'image/png'});
const claim=()=>({granted:true,claimId,objectId,receipt:receipt(),expiresAt:new Date(Date.now()+120000).toISOString()});
const dispatch=()=>({dispatch:true,claimId,objectId,receipt:receipt()});
const proof=()=>({state:'deleted',writeSettled:true,receipt:receipt()});
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(overrides={},options={}){
  const calls=[];
  const defaults={claimCleanup:claim,beginCleanup:dispatch,authorizeCleanup:()=>true,unknownCleanup:()=>null,finishCleanup:()=>null,remove:async(value,{authorize})=>await authorize(value)?proof():{state:'not_started'}};
  const methods=Object.fromEntries(Object.entries(defaults).map(([name,fn])=>[name,(...args)=>{calls.push({name,args});return (overrides[name]||fn)(...args);} ]));
  return {calls,cleanup:createAvatarCleanup({enabled:true,ledger:methods,storage:methods,...options})};
}
const names=f=>f.calls.map(x=>x.name);
test('disabled and non-boolean configuration cannot claim or delete anything',async()=>{
  for(const enabled of [undefined,false,'true']){const f=fixture({}, {enabled});assert.deepEqual(await f.cleanup.run(claimId),{state:'unavailable'});assert.equal(f.calls.length,0);}
});
test('configuration, UUID and early cancellation refuse before SQL',async()=>{
  assert.throws(()=>createAvatarCleanup({enabled:true}));for(const timeoutMs of [0,59,25001,NaN])assert.throws(()=>createAvatarCleanup({timeoutMs}));
  const f=fixture();assert.deepEqual(await f.cleanup.run('bad'),{state:'invalid'});assert.deepEqual(await f.cleanup.run(claimId,{signal:AbortSignal.abort()}),{state:'cancelled'});assert.equal(f.calls.length,0);
});
test('one committed claim and dispatch precede current policy, deletion and exact receipt recording',async()=>{
  const f=fixture();assert.deepEqual(await f.cleanup.run(claimId),{state:'deleted'});assert.deepEqual(names(f),['claimCleanup','beginCleanup','remove','authorizeCleanup','finishCleanup']);assert.deepEqual(f.calls.at(-1).args.slice(0,2),[claimId,proof()]);
});
test('empty/busy or replayed claims never authorize another deletion',async()=>{
  for(const state of ['empty','busy','claimed','expired','dispatched','unknown','deleted']){const f=fixture({claimCleanup:()=>({granted:false,state})});assert.deepEqual(await f.cleanup.run(claimId),{state});assert.deepEqual(names(f),['claimCleanup']);}
});
test('uncertain or malformed claims stop before dispatch',async()=>{
  for(const claimCleanup of [()=>{throw Error('PRIVATE SQL');},()=>({...claim(),claimId:objectId}),()=>({...claim(),objectId:'bad'}),()=>null]){const f=fixture({claimCleanup});assert.deepEqual(await f.cleanup.run(claimId),{state:'unknown'});assert.deepEqual(names(f),['claimCleanup']);}
});
test('dispatch must commit before Storage is called; replay never dispatches',async()=>{
  const gate=deferred(),f=fixture({beginCleanup:()=>gate.promise}),pending=f.cleanup.run(claimId);await tick();assert.deepEqual(names(f),['claimCleanup','beginCleanup']);gate.resolve({dispatch:false,state:'dispatched'});assert.deepEqual(await pending,{state:'dispatched'});assert.equal(f.calls.length,2);
});
test('uncertain dispatch and mismatched immutable evidence cannot reach Storage',async()=>{
  for(const beginCleanup of [()=>{throw Error('PRIVATE');},()=>({...dispatch(),objectId:claimId}),()=>({...dispatch(),receipt:{...receipt(),providerId:objectId}})]){const f=fixture({beginCleanup});assert.deepEqual(await f.cleanup.run(claimId),{state:'unknown'});assert.equal(f.calls.length,2);}
});
test('cancellation after claim leaves only an expirable undispatched grant',async()=>{
  const c=new AbortController(),f=fixture({claimCleanup:()=>{c.abort();return claim();}});assert.deepEqual(await f.cleanup.run(claimId,{signal:c.signal}),{state:'cancelled'});assert.deepEqual(names(f),['claimCleanup']);
});
test('cancellation after dispatch records uncertainty without deletion or retry',async()=>{
  const c=new AbortController(),f=fixture({beginCleanup:()=>{c.abort();return dispatch();}});assert.deepEqual(await f.cleanup.run(claimId,{signal:c.signal}),{state:'unknown'});assert.deepEqual(names(f),['claimCleanup','beginCleanup','unknownCleanup']);
});
test('a current policy denial or exception never releases quota',async()=>{
  for(const authorizeCleanup of [()=>false,()=>{throw Error('PRIVATE');}]){const f=fixture({authorizeCleanup});assert.deepEqual(await f.cleanup.run(claimId),{state:'unknown'});assert.equal(names(f).includes('finishCleanup'),false);assert.equal(names(f).at(-1),'unknownCleanup');}
});
test('policy cannot authorize a substituted receipt',async()=>{
  const f=fixture({remove:async(_r,{authorize})=>{assert.equal(await authorize({...receipt(),providerId:objectId}),false);return {state:'not_started'};}});assert.deepEqual(await f.cleanup.run(claimId),{state:'unknown'});assert.equal(names(f).includes('authorizeCleanup'),false);
});
test('missing, unconfirmed, wrong or extra-field deletion results remain unknown',async()=>{
  for(const remove of [()=>({state:'unknown'}),()=>({state:'not_started'}),()=>({...proof(),writeSettled:false}),()=>({...proof(),receipt:{...receipt(),sha256:'b'.repeat(64)}}),()=>({...proof(),private:'SECRET'})]){const f=fixture({remove});assert.deepEqual(await f.cleanup.run(claimId),{state:'unknown'});assert.equal(names(f).includes('finishCleanup'),false);assert.equal(names(f).at(-1),'unknownCleanup');}
});
test('known matching deletion after cancellation is recorded with a separate live signal',async()=>{
  const c=new AbortController(),f=fixture({remove:()=>{c.abort();return proof();},finishCleanup:(_id,p,{signal})=>{assert.equal(signal.aborted,false);assert.deepEqual(p,proof());}});assert.deepEqual(await f.cleanup.run(claimId,{signal:c.signal}),{state:'deleted'});assert.equal(names(f).includes('unknownCleanup'),false);
});
test('lost finish acknowledgement remains unknown without another DELETE or acknowledgement retry',async()=>{
  const f=fixture({finishCleanup:()=>{throw Error('PRIVATE');}});assert.deepEqual(await f.cleanup.run(claimId),{state:'unknown'});assert.equal(names(f).filter(n=>n==='remove').length,1);assert.equal(names(f).at(-1),'finishCleanup');
});
test('unknown-mark failure stays bounded and private',async()=>{
  const f=fixture({remove:()=>({state:'unknown'}),unknownCleanup:()=>{throw Error('PRIVATE');}});assert.deepEqual(await f.cleanup.run(claimId),{state:'unknown'});assert.equal(names(f).at(-1),'unknownCleanup');
});
test('late non-cooperative claim/dispatch cannot initiate Storage work',async()=>{
  for(const name of ['claimCleanup','beginCleanup']){const gate=deferred(),f=fixture({[name]:()=>gate.promise},{timeoutMs:90});assert.deepEqual(await f.cleanup.run(claimId),{state:'unknown'});const n=f.calls.length;gate.resolve(name==='claimCleanup'?claim():dispatch());await tick();assert.equal(f.calls.length,n);assert.equal(names(f).includes('remove'),false);}
});
test('late Storage completion cannot record success or retry',async()=>{
  const gate=deferred(),f=fixture({remove:()=>gate.promise},{timeoutMs:90});assert.deepEqual(await f.cleanup.run(claimId),{state:'unknown'});const n=f.calls.length;gate.resolve(proof());await tick();assert.equal(f.calls.length,n);assert.equal(names(f).includes('finishCleanup'),false);
});
test('late policy read cannot authorize after its Storage stage has ended',async()=>{
  const gate=deferred();let allowed;const f=fixture({authorizeCleanup:()=>gate.promise,remove:async(r,{authorize})=>{allowed=await authorize(r);return {state:'unknown'};}},{timeoutMs:90});assert.deepEqual(await f.cleanup.run(claimId),{state:'unknown'});gate.resolve(true);await tick();assert.notEqual(allowed,true);assert.equal(names(f).includes('finishCleanup'),false);
});
test('known receipt recording is awaited and finitely bounded',async()=>{
  const gate=deferred(),f=fixture({finishCleanup:()=>gate.promise},{timeoutMs:90});assert.deepEqual(await f.cleanup.run(claimId),{state:'unknown'});gate.resolve();await tick();assert.equal(names(f).at(-1),'finishCleanup');
});
test('only one local invocation can run; close cancels and refuses new work',async()=>{
  const gate=deferred(),f=fixture({claimCleanup:()=>gate.promise});const pending=f.cleanup.run(claimId);assert.deepEqual(await f.cleanup.run(objectId),{state:'busy'});f.cleanup.close();gate.resolve(claim());assert.deepEqual(await pending,{state:'cancelled'});assert.deepEqual(await f.cleanup.run(objectId),{state:'unavailable'});
});
test('claim and dispatch evidence are snapshotted before the next asynchronous boundary',async()=>{
  const value=claim(),gate=deferred(),f=fixture({claimCleanup:()=>value,beginCleanup:()=>gate.promise});const pending=f.cleanup.run(claimId);await tick();value.receipt.sha256='b'.repeat(64);gate.resolve(dispatch());assert.deepEqual(await pending,{state:'deleted'});
});
