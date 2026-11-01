import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createAllianceLocalControlClient} from '../lib/alliance-member-local-control-client.mjs';
import {createPersistentAllianceLocalControl} from '../lib/alliance-member-local-control.mjs';
import {createPersistentAllianceHost} from '../lib/alliance-member-finite-host.mjs';
import {feedbackRecoveryFixture} from '../lib/alliance-avatar-server/feedback-recovery.fixture.mjs';
const linux={skip:process.platform==='win32'};
const identity={format:1,instanceArn:'arn:aws:lightsail:us-east-2:759712674603:Instance/e6ee7e8c-38f8-4902-8ef8-69c3a022ebd3',releaseSha256:'a'.repeat(64),processId:'a0814845-b8cb-445a-a60f-111111111111',environment:'production'};
const retired={...identity,processId:'b0814845-b8cb-445a-a60f-111111111111'};
const expected={instanceArn:identity.instanceArn,releaseSha256:identity.releaseSha256,environment:identity.environment};
const settled={state:'local_work_settled',access:'closed',providerClosureVerified:false};
async function fixture(t,app,other={}){
 const directory=await mkdtemp(join(tmpdir(),'alliance-control-client-'));await chmod(directory,0o700);const socketPath=join(directory,'s');
 t.after(async()=>{assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep+'alliance-control-client-'));await rm(directory,{recursive:true,force:true});});
 const host=createPersistentAllianceLocalControl({enabled:true,socketPath,installation:identity,applicationHost:app});t.after(()=>host.close());await host.listen();
 const options={enabled:true,socketPath,ownerUid:process.getuid(),expected,...other};const client=createAllianceLocalControlClient(options);t.after(()=>client.close());
 return {client,host,options,directory};
}
function checkpoint(){const f=feedbackRecoveryFixture();f.gate.close();return {...f.checkpoint,format:5,reportReview:{format:1,closed:true,expiredReports:0,tables:[{table:'alliance_report_review.control',rows:1,sha256:'a'.repeat(64)},{table:'alliance_report_review.reviews',rows:0,sha256:'0'.repeat(64)}]}};}
test('disabled client touches no path or host',async()=>{
 const client=createAllianceLocalControlClient({get socketPath(){throw Error('PRIVATE');}});assert.deepEqual(await client.status(),{state:'disabled'});client.close();
});
test('actual private socket discovers the trusted process and prepares only a fresh generation',linux,async t=>{
 let prepared=0;const app={prepare:async(cp,c)=>{assert.deepEqual(c,{server:identity});assert.equal(cp.format,5);prepared++;return {state:'prepared',access:'closed'};},close:async()=>{},drain:async()=>settled};
 const f=await fixture(t,app);assert.deepEqual(await f.client.status(),{state:'local_control_available',installation:identity,preparationAttempted:false,applicationCloseRequested:false,providerClosureVerified:false});assert.equal(prepared,0);
 assert.deepEqual(await f.client.prepare(checkpoint(),{retiredInstallation:retired}),{installation:identity,state:'prepared',access:'closed',providerClosureVerified:false});assert.equal(prepared,1);
 assert.equal((await f.client.status()).preparationAttempted,true);
 await assert.rejects(f.client.prepare(checkpoint(),{retiredInstallation:retired}),/alliance_local_controller_unavailable/);assert.equal(prepared,1);
});
test('same process, wrong release and unsafe path refuse before preparation',linux,async t=>{
 let prepared=0;const app={prepare:async()=>{prepared++;},close:async()=>{},drain:async()=>settled};
 const f=await fixture(t,app);await assert.rejects(f.client.prepare(checkpoint(),{retiredInstallation:identity}));assert.equal(prepared,0);
 const other=createAllianceLocalControlClient({...f.options,expected:{...expected,releaseSha256:'b'.repeat(64)}});t.after(()=>other.close());await assert.rejects(other.status());
 const unsafe=createAllianceLocalControlClient(f.options);t.after(()=>unsafe.close());await chmod(f.directory,0o755);await assert.rejects(unsafe.status());assert.equal(prepared,0);
});
test('actual host closure waits for late work, while status stays metadata-only during preparation',linux,async t=>{
 let release,started;const began=new Promise(r=>{started=r;});let retiredLate=false;
 const now=Date.now(),application=createPersistentAllianceHost({enabled:true,origin:'https://galacticfederation.co',expectedInstallation:identity,
  window:{notBeforeUtc:new Date(now-1000).toISOString(),notAfterUtc:new Date(now+3600000).toISOString()},
  openApplication:async()=>{started();return new Promise(r=>{release=()=>r({application:{prepare:async()=>({state:'prepared',access:'closed'}),handle:async()=>new Response(),close(){}},close(){retiredLate=true;}});});}});
 let sawClose;const closeStarted=new Promise(r=>{sawClose=r;});
 t.after(()=>application.close());const f=await fixture(t,{...application,close:()=>{sawClose();return application.close();}});const preparing=f.client.prepare(checkpoint(),{retiredInstallation:retired});const rejection=assert.rejects(preparing);
 await began;const control=createAllianceLocalControlClient(f.options);t.after(()=>control.close());assert.equal((await control.status()).preparationAttempted,true);
 let drained=false;const closing=control.closeAndDrain().then(v=>{drained=true;return v;});await closeStarted;assert.equal(drained,false);
 release();assert.deepEqual(await closing,{installation:identity,...settled});await rejection;assert.equal(retiredLate,true);
 assert.equal((await control.status()).applicationCloseRequested,true);
});
