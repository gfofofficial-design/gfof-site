import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,chmod,lstat,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {request} from 'node:http';
import {createPersistentAllianceLocalControl} from '../lib/alliance-member-local-control.mjs';

const linux={skip:process.platform==='win32'};
const identity={format:1,instanceArn:'arn:aws:lightsail:us-east-2:759712674603:Instance/e6ee7e8c-38f8-4902-8ef8-69c3a022ebd3',releaseSha256:'a'.repeat(64),processId:'a0814845-b8cb-445a-a60f-111111111111',environment:'production'};
const settled={state:'local_work_settled',access:'closed',providerClosureVerified:false};
async function directory(t){const p=await mkdtemp(join(tmpdir(),'alliance-local-control-'));await chmod(p,0o700);t.after(async()=>{assert.ok(resolve(p).startsWith(resolve(tmpdir())+sep+'alliance-local-control-'));await rm(p,{recursive:true,force:true});});return p;}
function call(socketPath,path='/v1/drain',value={installation:identity},headers={}){
 const body=JSON.stringify(value);
 return new Promise((resolve,reject)=>{const q=request({socketPath,path,method:'POST',headers:{Host:'alliance-control.local','Content-Type':'application/json','Content-Length':Buffer.byteLength(body),...headers}},r=>{let text='';r.setEncoding('utf8');r.on('data',v=>text+=v);r.on('end',()=>resolve({status:r.statusCode,value:JSON.parse(text),text}));});q.on('error',reject);q.end(body);});
}
test('disabled local control reads nothing, opens no socket and calls no host',async()=>{
 let calls=0;const f=()=>{calls++;};const host=createPersistentAllianceLocalControl({applicationHost:{prepare:f,close:f,drain:f}});
 assert.deepEqual(await host.listen(),{state:'disabled'});await host.close();assert.equal(calls,0);
});
test('actual Unix socket uses private ownership/mode and trusted context; drain proves only local closure',linux,async t=>{
 const p=await directory(t),socketPath=join(p,'control.sock');let seen;
 const app={prepare:async(checkpoint,context)=>{seen={checkpoint,context};return {state:'prepared',access:'closed'};},drain:async()=>settled,close:async()=>{}};
 const host=createPersistentAllianceLocalControl({enabled:true,socketPath,installation:identity,applicationHost:app});t.after(()=>host.close());
 await host.listen();assert.equal((await lstat(socketPath)).mode&0o777,0o600);
 const r=await call(socketPath,'/v1/prepare',{installation:identity,checkpoint:{fictional:'checkpoint'}});
 assert.equal(r.status,200);assert.equal(r.value.access,'closed');assert.equal(r.value.providerClosureVerified,false);assert.deepEqual(seen,{checkpoint:{fictional:'checkpoint'},context:{server:identity}});
 const drained=await call(socketPath);assert.deepEqual(drained.value,settled);await host.close();await assert.rejects(call(socketPath));await assert.rejects(host.listen());
});
test('foreign identity, management path and bearer headers never dispatch; unsafe directory refuses',linux,async t=>{
 const p=await directory(t),socketPath=join(p,'control.sock');let calls=0;const f=async()=>{calls++;return settled;};const app={prepare:f,drain:f,close:async()=>{}};
 const host=createPersistentAllianceLocalControl({enabled:true,socketPath,installation:identity,applicationHost:app});t.after(()=>host.close());await host.listen();
 assert.equal((await call(socketPath,'/v1/prepare',{installation:{...identity,releaseSha256:'b'.repeat(64)},checkpoint:{}})).status,503);
 assert.equal((await call(socketPath,'/v1/serve')).status,404);assert.equal((await call(socketPath,'/v1/drain',{installation:identity},{Authorization:'Bearer fictional'})).status,400);assert.equal(calls,0);
 await host.close();await chmod(p,0o755);
 const bad=createPersistentAllianceLocalControl({enabled:true,socketPath,installation:identity,applicationHost:app});await assert.rejects(bad.listen(),e=>e.message==='alliance_local_control_unavailable');
});
test('closure interrupts preparation, discards late readiness and prevents another generation',linux,async t=>{
 const p=await directory(t),socketPath=join(p,'control.sock');let began,finish,closes=0,signal;
 const started=new Promise(r=>{began=r;}),pending=new Promise(r=>{finish=r;});
 const app={prepare:async(_c,_x,o)=>{signal=o.signal;began();return pending;},close:async()=>{closes++;},drain:async()=>settled};
 const host=createPersistentAllianceLocalControl({enabled:true,socketPath,installation:identity,applicationHost:app});t.after(()=>host.close());await host.listen();
 const preparing=call(socketPath,'/v1/prepare',{installation:identity,checkpoint:{}});await started;
 assert.equal((await call(socketPath,'/v1/close')).value.access,'closed');assert.equal(signal.aborted,true);const r=await preparing;assert.equal(r.status,503);assert.doesNotMatch(r.text,/prepared|PRIVATE_CANARY/);
 finish({state:'prepared',access:'closed',private:'PRIVATE_CANARY'});await new Promise(setImmediate);
 assert.equal((await call(socketPath,'/v1/prepare',{installation:identity,checkpoint:{}})).status,503);assert.equal(closes,1);
});
test('occupied target is preserved and remote-provider closure cannot be asserted by this interface',linux,async t=>{
 const p=await directory(t),socketPath=join(p,'control.sock');await writeFile(socketPath,'owned-fixture');let closes=0;
 const app={prepare:async()=>({state:'prepared',access:'closed'}),close:async()=>{closes++;},drain:async()=>({...settled,providerClosureVerified:true})};
 const occupied=createPersistentAllianceLocalControl({enabled:true,socketPath,installation:identity,applicationHost:app});await assert.rejects(occupied.listen());assert.equal(await readFile(socketPath,'utf8'),'owned-fixture');
 const host=createPersistentAllianceLocalControl({enabled:true,socketPath:join(p,'second.sock'),installation:identity,applicationHost:app});t.after(()=>host.close());await host.listen();const r=await call(join(p,'second.sock'));assert.equal(r.status,503);assert.equal(r.value.providerClosureVerified,false);assert.equal(closes,2);
});
