import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign,verify} from 'node:crypto';
import {AsyncResource} from 'node:async_hooks';
import {createPersistentGatewaySigningRuntime,PERSISTENT_GATEWAY_SIGNING_SECRET} from '../lib/alliance-avatar-server/netlify-signing-runtime.mjs';
import {createPersistentAllianceHost,createFiniteAlliancePreviewHost} from '../lib/alliance-member-finite-host.mjs';
const origin='https://deploy-preview-166--gfof.netlify.app';
const identity={format:1,instanceArn:'arn:aws:lightsail:us-east-2:123456789012:Instance/11111111-2222-4333-8444-555555555555',releaseSha256:'a'.repeat(64),processId:'22222222-2222-4222-8222-222222222222',environment:'preview'};
function signer(){
 const pair=generateKeyPairSync('ed25519'),spki=pair.publicKey.export({format:'der',type:'spki'});let reads=0;
 const options={enabled:true,expectedInstallation:identity,callerKey:{keyId:createHash('sha256').update(spki).digest('hex'),spki:spki.toString('base64'),notBeforeUtc:new Date(Date.now()-60000).toISOString(),notAfterUtc:new Date(Date.now()+3600000).toISOString()},readSecret:async name=>{assert.equal(name,PERSISTENT_GATEWAY_SIGNING_SECRET);reads++;return pair.privateKey.export({format:'der',type:'pkcs8'}).toString('base64');}};
 return {options,pair,get reads(){return reads;}};
}
test('persistent signing requires its own explicit private reader and actual server identity',async()=>{
 const f=signer();assert.throws(()=>createPersistentGatewaySigningRuntime({...f.options,readSecret:undefined}));
 for(const server of [{...identity,releaseSha256:'b'.repeat(64)},{...identity,instanceArn:identity.instanceArn.replace('123456789012','999999999999')},undefined]){
  const r=createPersistentGatewaySigningRuntime(f.options);try{await assert.rejects(r.run({server,site:{id:'unrelated'}},()=>r.signingKey()));assert.equal(f.reads,0);}finally{r.close();}
 }
});
test('persistent signing preserves caller verification and retires callbacks between exchanges',async()=>{
 const f=signer(),r=createPersistentGatewaySigningRuntime(f.options);let retained;
 try{
  const key=await r.run({server:identity},async()=>{retained=AsyncResource.bind(()=>r.signingKey());return r.signingKey();});
  assert.equal(verify(null,Buffer.from('fictional proof'),f.pair.publicKey,sign(null,Buffer.from('fictional proof'),key)),true);
  await assert.rejects(retained());await r.run({server:identity},async()=>{await assert.rejects(retained());await r.signingKey();});assert.equal(f.reads,2);
 }finally{r.close();}
});
test('persistent host admits one bounded daily generation; preview cannot borrow its identity',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let now=Date.now(),mono=0,closed=0,opened=0;
 const options={enabled:true,origin,expectedInstallation:identity,window:{notBeforeUtc:new Date(now-1000).toISOString(),notAfterUtc:new Date(now+24*3600000).toISOString()},now:()=>now,monotonic:()=>mono,
  openApplication:async()=>{opened++;return {application:{prepare:async()=>({state:'prepared',access:'closed'}),handle:async()=>Response.json({state:'ready'}),close(){}},close(){closed++;}};}};
 assert.throws(()=>createFiniteAlliancePreviewHost(options));
 assert.throws(()=>createPersistentAllianceHost({...options,window:{...options.window,notAfterUtc:new Date(now+27*3600000).toISOString()}}));
 const h=createPersistentAllianceHost(options),context={server:identity},request=()=>new Request(origin+'/api/alliance-members/me');
 try{assert.deepEqual(await h.prepare({},context),{state:'prepared',access:'closed'});now+=12*3600000;mono+=12*3600000;
  assert.equal((await h.handle(request(),context)).status,200);now+=13*3600000;mono+=13*3600000;
  assert.equal((await h.handle(request(),context)).status,503);assert.equal((await h.drain()).state,'local_work_settled');
  assert.deepEqual(await h.prepare({},context),{state:'quarantine',access:'closed'});assert.equal(opened,1);assert.equal(closed,1);
 }finally{await h.close();t.mock.timers.reset();}
});
