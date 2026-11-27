import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {request} from 'node:https';
import {createPersistentAllianceHttpsServer} from '../lib/alliance-member-persistent-https.mjs';
import {allianceMemberBackendHostname as hostname} from '../lib/alliance-member-closed-https.mjs';
import {createPersistentAllianceHost} from '../lib/alliance-member-finite-host.mjs';

let directory,tls,renewed;
const origin='https://galacticfederation.co';
const installation={format:1,instanceArn:'arn:aws:lightsail:us-east-2:759712674603:Instance/e6ee7e8c-38f8-4902-8ef8-69c3a022ebd3',releaseSha256:'a'.repeat(64),processId:'a0814845-b8cb-445a-a60f-111111111111',environment:'production'};
before(async()=>{
 directory=await mkdtemp(join(tmpdir(),'alliance-persistent-https-'));
 const openssl=process.platform==='win32'?'C:/Program Files/Git/usr/bin/openssl.exe':'openssl';
 for(const name of ['fictional','renewed'])execFileSync(openssl,['req','-x509','-newkey','ed25519','-nodes','-days','1','-subj','/CN='+hostname,'-addext','subjectAltName=DNS:'+hostname,'-keyout',join(directory,name+'.key'),'-out',join(directory,name+'.crt')],{stdio:'ignore',timeout:20000});
 tls={key:await readFile(join(directory,'fictional.key')),cert:await readFile(join(directory,'fictional.crt'))};
 renewed={key:await readFile(join(directory,'renewed.key')),cert:await readFile(join(directory,'renewed.crt'))};
});
after(async()=>{if(directory){assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep+'alliance-persistent-https-'));await rm(directory,{recursive:true,force:true});}});
function call(port,{path='/api/alliance-members/me',method='GET',headers={},body}={}){
 return new Promise((resolve,reject)=>{
  const r=request({host:'127.0.0.1',port,servername:hostname,ca:[tls.cert,renewed.cert],path,method,headers:{Host:hostname,...headers},agent:false,timeout:5000},response=>{let text='';const fingerprint=response.socket.getPeerCertificate().fingerprint256;response.setEncoding('utf8');response.on('data',v=>text+=v);response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,text,fingerprint}));});
  r.on('timeout',()=>r.destroy(Error('test_timeout')));r.on('error',reject);r.end(body);
 });
}
const options=applicationHost=>({enabled:true,port:0,origin,installation,applicationHost,readTlsMaterial:async()=>tls});
test('disabled transport opens nothing and reads no private input',async()=>{
 let reads=0;const host=createPersistentAllianceHttpsServer({readTlsMaterial:()=>{reads++;throw Error('PRIVATE_CANARY');}});
 assert.deepEqual(await host.listen(),{state:'disabled'});assert.equal(reads,0);assert.equal(await host.reloadTls(),false);await host.close();
});
test('real TLS transfers bounded cookies, JSON and trusted identity; management and foreign hosts refuse',async()=>{
 const seen=[];let closes=0;
 const host=createPersistentAllianceHttpsServer(options({handle:async(r,c)=>{seen.push({cookie:r.headers.get('cookie'),context:c,body:r.method==='POST'?await r.json():null});return Response.json({state:'fictional'});},close:async()=>{closes++;}}));
 try{
  const {port}=await host.listen();const cookie='session='+ 'x'.repeat(12000);
  const response=await call(port,{headers:{Cookie:cookie}});assert.equal(response.status,200);assert.equal(seen[0].cookie,cookie);assert.deepEqual(seen[0].context,{server:installation});
  assert.equal((await call(port,{method:'POST',path:'/api/alliance-members/feedback/change',headers:{Origin:origin,'Content-Type':'application/json'},body:'{"title":"fictional"}'})).status,200);
  assert.deepEqual(seen[1].body,{title:'fictional'});
  for(const [path,status] of [['/maintenance/prepare',404],['/.env',404]])assert.equal((await call(port,{path})).status,status);
  assert.equal((await call(port,{headers:{Host:'foreign.invalid'}})).status,421);
  assert.equal(seen.length,2);assert.match(response.headers['cache-control'],/no-store/);assert.equal(response.headers['set-cookie'],undefined);assert.equal(response.headers['access-control-allow-origin'],undefined);
 }finally{await host.close();}assert.equal(closes,1);
});
test('transport health makes no member readiness claim and unprepared real host stays closed',async()=>{
 const applicationHost=createPersistentAllianceHost();const host=createPersistentAllianceHttpsServer(options(applicationHost));
 try{const {port}=await host.listen();const health=await call(port,{path:'/healthz'});assert.deepEqual(JSON.parse(health.text),{state:'transport_ready'});assert.equal((await call(port)).status,404);assert.equal((await call(port,{path:'/healthz',headers:{Host:'foreign.invalid'}})).status,503);}finally{await host.close();}
});
test('renewal swaps actual TLS certificate; read failure retains current context and cannot leak',async()=>{
 let current=tls;const host=createPersistentAllianceHttpsServer({...options({handle:async()=>Response.json({state:'fictional'}),close:async()=>{}}),readTlsMaterial:async()=>{if(current===null)throw Error('PRIVATE_CANARY');return current;}});
 const {port}=await host.listen();
 try{const first=(await call(port)).fingerprint;current=renewed;assert.equal(await host.reloadTls(),true);const next=await call(port);assert.notEqual(next.fingerprint,first);current=null;assert.equal(await host.reloadTls(),false);assert.equal((await call(port)).fingerprint,next.fingerprint);}finally{await host.close();}
 assert.equal(await host.reloadTls(),false);await assert.rejects(call(port));await assert.rejects(host.listen(),/persistent_member_https_unavailable/);
});
test('occupied socket or private material failure retires only its own host with sanitized error',async()=>{
 let closes=0;const app=()=>({handle:async()=>Response.json({state:'fictional'}),close:async()=>{closes++;}});
 const first=createPersistentAllianceHttpsServer(options(app()));const {port}=await first.listen();
 const occupied=createPersistentAllianceHttpsServer({...options(app()),port});
 const broken=createPersistentAllianceHttpsServer({...options(app()),readTlsMaterial:async()=>{throw Error('PRIVATE_CANARY');}});
 try{await assert.rejects(occupied.listen(),e=>e.message==='persistent_member_https_unavailable');assert.equal((await call(port)).status,200);await assert.rejects(broken.listen(),e=>e.message==='persistent_member_https_unavailable');assert.equal(closes,2);}finally{await occupied.close();await broken.close();await first.close();}
 assert.equal(closes,3);
});
