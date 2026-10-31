import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,mkdir,chmod,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {request as httpsRequest} from 'node:https';
import {request} from 'node:http';
import {createPersistentAllianceProcess} from '../lib/alliance-member-persistent-process.mjs';
import {allianceMemberBackendHostname as hostname} from '../lib/alliance-member-closed-https.mjs';
const identity={format:1,instanceArn:'arn:aws:lightsail:us-east-2:759712674603:Instance/e6ee7e8c-38f8-4902-8ef8-69c3a022ebd3',releaseSha256:'a'.repeat(64),processId:'a0814845-b8cb-445a-a60f-111111111111',environment:'production'};
const origin='https://galacticfederation.co';
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'alliance-process-')),runtime=join(root,'run');await mkdir(runtime,{mode:0o700});await chmod(runtime,0o700);
 execFileSync('openssl',['req','-x509','-newkey','ed25519','-nodes','-days','1','-subj','/CN='+hostname,'-addext','subjectAltName=DNS:'+hostname,'-keyout',join(root,'key'),'-out',join(root,'cert')],{stdio:'ignore',timeout:20000});
 const tls={key:await readFile(join(root,'key')),cert:await readFile(join(root,'cert'))};
 const socketPath=join(runtime,'control.sock');let host;
 return {tls,socketPath,options:{enabled:true,origin,installation:identity,socketPath,port:0,readTlsMaterial:async()=>tls},own:v=>(host=v),async cleanup(){await host?.close();assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep+'alliance-process-'));await rm(root,{recursive:true,force:true});}};
}
function member(port,cert){return new Promise((resolve,reject)=>{const q=httpsRequest({hostname:'127.0.0.1',servername:hostname,port,ca:cert,path:'/api/alliance-members/me',headers:{Host:hostname,Origin:origin,'Sec-Fetch-Site':'same-origin'},agent:false},r=>{let text='';r.on('data',v=>text+=v);r.on('end',()=>resolve({status:r.statusCode,text}));});q.on('error',reject);q.end();});}
function control(socketPath,operation,checkpoint){const body=JSON.stringify({installation:identity,...(checkpoint===undefined?{}:{checkpoint})});return new Promise((resolve,reject)=>{const q=request({socketPath,path:'/v1/'+operation,method:'POST',headers:{Host:'alliance-control.local','Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},r=>{let text='';r.on('data',v=>text+=v);r.on('end',()=>resolve({status:r.statusCode,value:JSON.parse(text)}));});q.on('error',reject);q.end(body);});}
test('default-off composition opens nothing and invokes no private callback',async()=>{let reads=0;const host=createPersistentAllianceProcess({openApplication:()=>{reads++;},readTlsMaterial:()=>{reads++;}});assert.deepEqual(await host.listen(),{state:'disabled'});await host.close();assert.equal(reads,0);});
test('closed bootstrap cannot be promoted through local preparation', {skip:process.platform==='win32'},async()=>{
 const f=await fixture();try{const host=f.own(createPersistentAllianceProcess(f.options)),bound=await host.listen();assert.equal(bound.generationEnabled,false);assert.equal((await member(bound.port,f.tls.cert)).status,404);assert.equal((await control(f.socketPath,'prepare',{})).status,503);assert.equal((await member(bound.port,f.tls.cert)).status,404);assert.equal((await control(f.socketPath,'drain')).value.providerClosureVerified,false);}finally{await f.cleanup();}
});
test('actual local preparation/TLS graph starts private application only on explicit request and drains closed', {skip:process.platform==='win32'},async()=>{
 const f=await fixture();let opens=0,closes=0;try{
  const now=Date.now(),host=f.own(createPersistentAllianceProcess({...f.options,generationEnabled:true,window:{notBeforeUtc:new Date(now-1000).toISOString(),notAfterUtc:new Date(now+120000).toISOString()},openApplication:async()=>{opens++;return {application:{prepare:async()=>({state:'prepared',access:'closed'}),handle:async()=>Response.json({state:'fictional'}),close:async()=>{}},close:async()=>{closes++;}};}}));
  const {port}=await host.listen();assert.equal(opens,0);assert.equal((await member(port,f.tls.cert)).status,503);assert.equal((await control(f.socketPath,'prepare',{fictional:true})).value.state,'prepared');assert.equal(opens,1);assert.equal((await member(port,f.tls.cert)).status,200);assert.equal((await control(f.socketPath,'close')).value.access,'closed');assert.equal((await member(port,f.tls.cert)).status,503);assert.equal((await control(f.socketPath,'drain')).value.state,'local_work_settled');assert.equal(closes,1);
 }finally{await f.cleanup();}
});
