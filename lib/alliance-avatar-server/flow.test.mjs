import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAvatarFlow} from './flow.mjs';
const actorId='11111111-1111-4111-8111-111111111111',operationId='22222222-2222-4222-8222-222222222222';
const objectId='33333333-3333-4333-8333-333333333333',profileId='44444444-4444-4444-8444-444444444444';
const providerId='55555555-5555-4555-8555-555555555555',key=`v1/${profileId}/${objectId}.png`;
const png=()=>Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWMQjG34DwADXwHuQa7szAAAAABJRU5ErkJggg==','base64');
const input=()=>({actorId,operationId,version:0,bytes:png(),mime:'image/png'});
const descriptor=()=>({bytes:png().length,sha256:createHash('sha256').update(png()).digest('hex'),width:1,height:1,mime:'image/png'});
const proof=()=>({state:'stored',writeSettled:true,verified:true,receipt:{profileId,objectId,key,providerId,...descriptor()}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
const rejected=outcome=>()=>{throw Object.assign(Error('SECRET PRIVATE DIAGNOSTIC'),{outcome});};
function fixture(overrides={},options={}){
  const calls=[];
  const defaults={reserve:()=>({dispatch:true,state:'reserved',objectId}),process:()=>({bytes:png(),mime:'image/png',width:1,height:1}),
    claimUpload:()=>({dispatch:true,objectId,key}),upload:proof,commitUpload:()=>({state:'committed',version:1,objectId}),
    cancelReserved:()=>({state:'cancelled'}),settleUnpublished:()=>null,operationReceipt:()=>({state:'uploading',receipt:proof().receipt})};
  const methods=Object.fromEntries(Object.entries(defaults).map(([name,fn])=>[name,(...args)=>{calls.push({name,args});return (overrides[name]||fn)(...args);} ]));
  return {calls,flow:createAvatarFlow({enabled:true,ledger:methods,processor:methods,storage:methods,...options})};
}
const names=f=>f.calls.map(c=>c.name);

test('default closed and non-boolean activation perform no dependency work',async()=>{
  for(const enabled of [undefined,false,'true',1]){const f=fixture({}, {enabled});assert.deepEqual(await f.flow.replace(input()),{state:'unavailable'});assert.deepEqual(await f.flow.status(actorId,operationId),{state:'unavailable'});assert.equal(f.calls.length,0);}
});
test('finite limits and enabled dependencies are mandatory',()=>{
  for(const timeoutMs of [0,59,30001,NaN,1.5])assert.throws(()=>createAvatarFlow({timeoutMs}));
  assert.throws(()=>createAvatarFlow({enabled:true}));
});
test('invalid inputs and pre-cancellation stop before a reservation',async()=>{
  const f=fixture();for(const data of [{...input(),actorId:'bad'},{...input(),version:-1},{...input(),bytes:new Uint8Array(3)},{...input(),mime:'text/html'}])assert.deepEqual(await f.flow.replace(data),{state:'invalid'});
  assert.deepEqual(await f.flow.replace(input(),{signal:AbortSignal.abort()}),{state:'cancelled'});assert.equal(f.calls.length,0);
});
test('committed dispatch boundaries precede one decode, one claim, one upload and publication',async()=>{
  const gate=deferred(),f=fixture({reserve:()=>gate.promise});const pending=f.flow.replace(input());await tick();assert.deepEqual(names(f),['reserve']);
  gate.resolve({dispatch:true,state:'reserved',objectId});assert.deepEqual(await pending,{state:'committed',version:1});
  assert.deepEqual(names(f),['reserve','process','claimUpload','upload','commitUpload']);
  assert.deepEqual(f.calls[2].args.slice(0,3),[actorId,operationId,descriptor()]);
  assert.equal(f.calls[3].args[0].profileId,profileId);assert.notEqual(profileId,actorId);
});
test('input bytes are snapshotted before reservation yields',async()=>{
  const gate=deferred(),f=fixture({reserve:()=>gate.promise}),data=input();const pending=f.flow.replace(data);data.bytes.fill(0);gate.resolve({dispatch:true,state:'reserved',objectId});await pending;
  assert.deepEqual(f.calls.find(c=>c.name==='process').args[0],new Uint8Array(png()));
});
test('reservation replay never dispatches image work or exposes private fields',async()=>{
  for(const state of ['reserved','uploading','stale','cancelled','committed']){const f=fixture({reserve:()=>({dispatch:false,state,version:4,objectId,key,secret:'private'})});
    assert.deepEqual(await f.flow.replace(input()),state==='committed'?{state,version:4}:{state});assert.deepEqual(names(f),['reserve']);}
});
test('uncertain or rejected reservation never decodes or retries',async()=>{
  for(const outcome of ['unknown','rejected','not_started']){const f=fixture({reserve:rejected(outcome)});assert.deepEqual(await f.flow.replace(input()),{state:outcome==='rejected'?'rejected':'unknown'});assert.deepEqual(names(f),['reserve']);}
});
test('malformed reservation cannot grant dispatch',async()=>{
  for(const value of [{dispatch:true,state:'uploading',objectId},{dispatch:true,state:'reserved',objectId:'bad'},null]){const f=fixture({reserve:()=>value});assert.deepEqual(await f.flow.replace(input()),{state:'unknown'});assert.deepEqual(names(f),['reserve']);}
});
test('decoder rejection releases only the confirmed undispatched reservation',async()=>{
  const f=fixture({process:rejected('unknown')});assert.deepEqual(await f.flow.replace(input()),{state:'cancelled'});assert.deepEqual(names(f),['reserve','process','cancelReserved']);
});
test('invalid derivative is never claimed or uploaded',async()=>{
  const f=fixture({process:()=>({bytes:png(),width:2,height:1,mime:'image/png'})});assert.deepEqual(await f.flow.replace(input()),{state:'cancelled'});assert.equal(names(f).includes('claimUpload'),false);
});
test('cancellation after reservation or decode cannot start a claim',async()=>{
  for(const boundary of ['reserve','process']){const controller=new AbortController();const original=boundary==='reserve'?{dispatch:true,state:'reserved',objectId}:{bytes:png(),width:1,height:1,mime:'image/png'};
    const f=fixture({[boundary]:()=>{controller.abort();return original;}});assert.deepEqual(await f.flow.replace(input(),{signal:controller.signal}),{state:'cancelled'});assert.equal(names(f).includes('claimUpload'),false);}
});
test('claim must finish before upload and duplicate claim dispatch is refused',async()=>{
  const gate=deferred(),f=fixture({claimUpload:()=>gate.promise});const pending=f.flow.replace(input());await tick();assert.deepEqual(names(f),['reserve','process','claimUpload']);
  gate.resolve({dispatch:false,state:'uploading'});assert.deepEqual(await pending,{state:'uploading'});assert.equal(names(f).includes('upload'),false);
});
test('uncertain claim never refunds a potentially dispatched writer',async()=>{
  const f=fixture({claimUpload:rejected('unknown')});assert.deepEqual(await f.flow.replace(input()),{state:'unknown'});assert.deepEqual(names(f),['reserve','process','claimUpload']);
});
test('mismatched claim object/path and cancellation after claim stop provider writes',async()=>{
  for(const claim of [{dispatch:true,objectId:providerId,key},{dispatch:true,objectId,key:`v1/${profileId}/${providerId}.png`},{dispatch:true,objectId,key:'https://example.invalid/file'}]){const f=fixture({claimUpload:()=>claim});assert.deepEqual(await f.flow.replace(input()),{state:'unknown'});assert.equal(names(f).includes('upload'),false);}
  const c=new AbortController(),f=fixture({claimUpload:()=>{c.abort();return {dispatch:true,objectId,key};}});assert.deepEqual(await f.flow.replace(input(),{signal:c.signal}),{state:'unknown'});assert.equal(names(f).includes('upload'),false);
});
test('unknown or not-started upload is never a settlement, refund or second dispatch',async()=>{
  for(const state of ['unknown','not_started','unavailable']){const f=fixture({upload:()=>({state})});assert.deepEqual(await f.flow.replace(input()),{state:'unknown'});assert.deepEqual(names(f),['reserve','process','claimUpload','upload']);}
});
test('mismatched, malformed or unsettled provider proof never publishes',async()=>{
  for(const change of [p=>({...p,writeSettled:false}),p=>({...p,verified:false}),p=>({...p,receipt:{...p.receipt,sha256:'a'.repeat(64)}}),p=>({...p,receipt:{...p.receipt,private:'bad'}}),p=>({...p,receipt:{...p.receipt,objectId:providerId}})]){const f=fixture({upload:()=>change(proof())});assert.deepEqual(await f.flow.replace(input()),{state:'unknown'});assert.equal(f.calls.length,4);}
});
test('settled unverified evidence is recorded without publishing',async()=>{
  const f=fixture({upload:()=>({...proof(),state:'stored_unverified',verified:false})});assert.deepEqual(await f.flow.replace(input()),{state:'cleanup_pending'});assert.deepEqual(names(f),['reserve','process','claimUpload','upload','settleUnpublished']);
});
test('known acknowledgement after cancellation gets a separate live receipt-recording signal',async()=>{
  const c=new AbortController(),f=fixture({upload:(_input,{signal})=>{assert.equal(signal.aborted,false);c.abort();assert.equal(signal.aborted,true);return proof();},settleUnpublished:(_operation,p,{signal})=>{assert.equal(signal.aborted,false);assert.deepEqual(p,proof());}});
  assert.deepEqual(await f.flow.replace(input(),{signal:c.signal}),{state:'cleanup_pending'});assert.equal(names(f).includes('commitUpload'),false);
});
test('stale publication or confirmed denial records evidence without republishing',async()=>{
  for(const commitUpload of [()=>({state:'stale'}),rejected('rejected')]){const f=fixture({commitUpload});assert.deepEqual(await f.flow.replace(input()),{state:'cleanup_pending'});assert.equal(names(f).filter(n=>n==='commitUpload').length,1);assert.equal(names(f).at(-1),'settleUnpublished');}
});
test('unknown commit is not retried or silently converted into cleanup',async()=>{
  const f=fixture({commitUpload:rejected('unknown')});assert.deepEqual(await f.flow.replace(input()),{state:'unknown'});assert.equal(names(f).at(-1),'commitUpload');
});
test('late non-cooperative commit remains unknown without a background settlement',async()=>{
  const gate=deferred(),f=fixture({commitUpload:()=>gate.promise},{timeoutMs:90});assert.deepEqual(await f.flow.replace(input()),{state:'unknown'});const count=f.calls.length;gate.resolve({state:'committed',version:1});await tick();assert.equal(f.calls.length,count);assert.equal(names(f).at(-1),'commitUpload');
});
test('confirmed commit is truthful even if cancellation arrived during its acknowledgement',async()=>{
  const c=new AbortController(),f=fixture({commitUpload:()=>{c.abort();return {state:'committed',version:1};}});assert.deepEqual(await f.flow.replace(input(),{signal:c.signal}),{state:'committed',version:1});assert.equal(names(f).includes('settleUnpublished'),false);
});
test('malformed commit is unknown and unexpected dependency diagnostics stay private',async()=>{
  const f=fixture({commitUpload:()=>({state:'committed',version:0,private:'secret'})});assert.deepEqual(await f.flow.replace(input()),{state:'unknown'});
  const g=fixture({upload:()=>({get state(){throw Error('SECRET URL');}})});assert.deepEqual(await g.flow.replace(input()),{state:'unknown'});
});
test('provider evidence is snapshotted before database publication yields',async()=>{
  const gate=deferred(),p=proof(),f=fixture({upload:()=>p,commitUpload:()=>gate.promise});const pending=f.flow.replace(input());await tick();p.receipt.sha256='a'.repeat(64);gate.resolve({state:'committed',version:1});await pending;assert.deepEqual(f.calls.at(-1).args[2],proof());
});
test('uncertain cancellation or receipt settlement stays unknown',async()=>{
  for(const overrides of [{process:rejected('unknown'),cancelReserved:rejected('unknown')},{upload:()=>({...proof(),state:'stored_unverified',verified:false}),settleUnpublished:rejected('unknown')}]){const f=fixture(overrides);assert.deepEqual(await f.flow.replace(input()),{state:'unknown'});}
});
test('same-operation and capacity overlap refuse without extra reservation',async()=>{
  const gate=deferred(),f=fixture({reserve:()=>gate.promise});const a=f.flow.replace(input()),b=f.flow.replace({...input(),operationId:providerId});
  assert.deepEqual(await f.flow.replace(input()),{state:'busy'});assert.deepEqual(await f.flow.replace({...input(),operationId:objectId}),{state:'busy'});await tick();assert.equal(f.calls.length,2);
  gate.resolve({dispatch:false,state:'reserved'});await Promise.all([a,b]);
});
test('late non-cooperative reservation/claim/upload never starts follow-up work',async()=>{
  for(const name of ['reserve','claimUpload','upload']){const gate=deferred(),f=fixture({[name]:()=>gate.promise},{timeoutMs:90});const pending=f.flow.replace(input());assert.deepEqual(await pending,{state:'unknown'});const count=f.calls.length;
    gate.resolve(name==='reserve'?{dispatch:true,state:'reserved',objectId}:name==='claimUpload'?{dispatch:true,objectId,key}:proof());await tick();assert.equal(f.calls.length,count);}
});
test('non-cooperative decoder times out then cancels only its undispatched reservation',async()=>{
  const gate=deferred(),f=fixture({process:()=>gate.promise},{timeoutMs:90});assert.deepEqual(await f.flow.replace(input()),{state:'cancelled'});gate.resolve({bytes:png(),width:1,height:1,mime:'image/png'});await tick();assert.deepEqual(names(f),['reserve','process','cancelReserved']);
});
test('receipt recording is awaited and independently bounded',async()=>{
  const gate=deferred(),f=fixture({upload:()=>({...proof(),state:'stored_unverified',verified:false}),settleUnpublished:()=>gate.promise},{timeoutMs:90});assert.deepEqual(await f.flow.replace(input()),{state:'unknown'});const count=f.calls.length;gate.resolve();await tick();assert.equal(f.calls.length,count);
});
test('status read never exposes private receipts or retries provider work',async()=>{
  const f=fixture();assert.deepEqual(await f.flow.status(actorId,operationId),{state:'uploading'});assert.deepEqual(names(f),['operationReceipt']);assert.deepEqual(await f.flow.status('bad',operationId),{state:'invalid'});
});
test('close cancels active work, preserves known evidence and refuses new work',async()=>{
  const gate=deferred(),f=fixture({upload:()=>gate.promise});const pending=f.flow.replace(input());await tick();f.flow.close();gate.resolve(proof());assert.deepEqual(await pending,{state:'cleanup_pending'});assert.deepEqual(await f.flow.replace(input()),{state:'unavailable'});assert.deepEqual(await f.flow.status(actorId,operationId),{state:'unavailable'});
});
