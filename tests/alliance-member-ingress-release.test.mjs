import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createPersistentAllianceHost} from '../lib/alliance-member-finite-host.mjs';
import {createPersistentAllianceLocalControl} from '../lib/alliance-member-local-control.mjs';
import {createAllianceLocalControlClient} from '../lib/alliance-member-local-control-client.mjs';
import {ingressCheckpoint,ingressPolicy} from './alliance-member-ingress.fixture.mjs';
const linux={skip:process.platform==='win32'},origin='https://galacticfederation.co';
const installation={format:1,instanceArn:'arn:aws:lightsail:us-east-2:123456789012:Instance/11111111-2222-4333-8444-555555555555',releaseSha256:'a'.repeat(64),processId:'22222222-2222-4222-8222-222222222222',environment:'production'};
const context={server:installation},released={state:'local_ingress_released',access:'not_assessed',providerAuthorityVerified:false};
function fixture(t){
 let calls=0,closes=0;const now=Date.now(),cp=ingressCheckpoint(),policy=ingressPolicy(cp);
 const host=createPersistentAllianceHost({enabled:true,origin,expectedInstallation:installation,window:{notBeforeUtc:new Date(now-1000).toISOString(),notAfterUtc:new Date(now+3600000).toISOString()},openApplication:async()=>({application:{prepare:async()=>({state:'prepared',access:'closed'}),handle:async()=>{calls++;return Response.json({state:'ready'});},close(){}},close:async()=>{closes++;}})});
 t.after(()=>host.close());return {host,cp,policy,get calls(){return calls;},get closes(){return closes;},request:()=>new Request(origin+'/api/alliance-members/me',{headers:{Origin:origin,'Sec-Fetch-Site':'same-origin'}})};
}
test('prepared persistent REVIEW remains locally blocked until explicit bound release; traffic cannot retire the application during the handoff',async t=>{
 const f=fixture(t);assert.equal((await f.host.handle(f.request(),context)).status,503);await f.host.prepare(f.cp,context);
 for(let i=0;i<4;i++)assert.equal((await f.host.handle(f.request(),context)).status,503);
 assert.equal(f.calls,0);assert.equal(f.closes,0);assert.deepEqual(await f.host.release(f.policy,context),released);
 assert.equal((await f.host.handle(f.request(),context)).status,200);assert.equal(f.calls,1);
 await f.host.close();assert.equal((await f.host.handle(f.request(),context)).status,503);
 assert.deepEqual(await f.host.release(f.policy,context),{state:'quarantine',access:'closed'});
});
test('wrong checkpoint, REVIEW policy or foreign process cannot release ingress and never dispatches a member request',async t=>{
 for(const mode of ['checkpoint','review','foreign']){
  const f=fixture(t);await f.host.prepare(f.cp,context);
  const policy=mode==='checkpoint'?ingressPolicy(f.cp,{checkpointSha256:'b'.repeat(64)}):mode==='review'?ingressPolicy(f.cp,{state:'review'}):f.policy;
  const from=mode==='foreign'?{server:{...installation,processId:'33333333-3333-4333-8333-333333333333'}}:context;
  assert.deepEqual(await f.host.release(policy,from),{state:'quarantine',access:'closed'});
  assert.equal((await f.host.handle(f.request(),context)).status,503);assert.equal(f.calls,0);assert.equal(f.closes,1);
 }
});
test('actual private Unix client releases only the pinned prepared process; a foreign installation causes no release',linux,async t=>{
 const f=fixture(t),directory=await mkdtemp(join(tmpdir(),'alliance-ingress-release-'));await chmod(directory,0o700);
 t.after(async()=>{assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep+'alliance-ingress-release-'));await rm(directory,{recursive:true,force:true});});
 const socketPath=join(directory,'s'),control=createPersistentAllianceLocalControl({enabled:true,socketPath,installation,applicationHost:f.host});t.after(()=>control.close());await control.listen();
 const options={enabled:true,socketPath,ownerUid:process.getuid(),expected:{instanceArn:installation.instanceArn,releaseSha256:installation.releaseSha256,environment:installation.environment}};
 const client=createAllianceLocalControlClient(options);t.after(()=>client.close());
 await client.prepare(f.cp,{retiredInstallation:{...installation,processId:'44444444-4444-4444-8444-444444444444'},installation});assert.equal((await f.host.handle(f.request(),context)).status,503);
 const foreign=createAllianceLocalControlClient(options);t.after(()=>foreign.close());await assert.rejects(foreign.release(f.policy,{installation:{...installation,processId:'55555555-5555-4555-8555-555555555555'}}));
 assert.equal((await f.host.handle(f.request(),context)).status,503);assert.equal(f.closes,0);
 assert.deepEqual(await client.release(f.policy,{installation}),{installation,...released});assert.equal((await f.host.handle(f.request(),context)).status,200);
 await client.closeAndDrain({installation});assert.equal((await f.host.handle(f.request(),context)).status,503);
});
