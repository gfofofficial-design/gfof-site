import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {request} from 'node:https';
import {createClosedAllianceHttpsServer,allianceMemberBackendHostname as hostname} from '../lib/alliance-member-closed-https.mjs';

let directory,tls,renewed;
before(async()=>{
 directory=await mkdtemp(join(tmpdir(),'alliance-closed-https-'));
 const openssl=process.platform==='win32'?'C:/Program Files/Git/usr/bin/openssl.exe':'openssl';
 for(const name of ['fictional','renewed'])execFileSync(openssl,['req','-x509','-newkey','ed25519','-nodes','-days','1','-subj','/CN='+hostname,'-addext','subjectAltName=DNS:'+hostname,'-keyout',join(directory,name+'.key'),'-out',join(directory,name+'.crt')],{stdio:'ignore',timeout:20000});
 tls={key:await readFile(join(directory,'fictional.key')),cert:await readFile(join(directory,'fictional.crt'))};
 renewed={key:await readFile(join(directory,'renewed.key')),cert:await readFile(join(directory,'renewed.crt'))};
});
after(async()=>{if(directory){assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep+'alliance-closed-https-'));await rm(directory,{recursive:true,force:true});}});
function call(port,{path='/healthz',method='GET',headers={},body}={}){
 return new Promise((resolve,reject)=>{
  const r=request({host:'127.0.0.1',port,servername:hostname,ca:[tls.cert,renewed.cert],path,method,headers:{Host:hostname,...headers},agent:false,timeout:5000},response=>{let text='';const fingerprint=response.socket.getPeerCertificate().fingerprint256;response.setEncoding('utf8');response.on('data',v=>text+=v);response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,text,fingerprint}));});
  r.on('timeout',()=>r.destroy(Error('test_timeout')));r.on('error',reject);r.end(body);
 });
}
test('default-off does not read keys or open a listener',async()=>{
 let reads=0;const host=createClosedAllianceHttpsServer({readTlsMaterial:()=>{reads++;throw Error();}});
 assert.deepEqual(await host.listen(),{state:'disabled'});assert.equal(reads,0);assert.equal(await host.reloadTls(),false);await host.close();
});
test('actual verified TLS serves only closed health and refuses member/control paths and wrong host',async()=>{
 const host=createClosedAllianceHttpsServer({enabled:true,port:0,readTlsMaterial:async()=>tls});
 try{
  const {port}=await host.listen();
  const health=await call(port);assert.equal(health.status,200);assert.deepEqual(JSON.parse(health.text),{state:'closed',memberServing:false});assert.match(health.headers['cache-control'],/no-store/);assert.equal(health.headers['access-control-allow-origin'],undefined);
  for(const path of ['/api/alliance-members/me','/api/alliance-members/report-review/reports','/maintenance/prepare','/.env','/healthz?open=true'])assert.equal((await call(port,{path})).status,503);
  assert.equal((await call(port,{headers:{Host:'attacker.invalid','X-Forwarded-Host':hostname}})).status,421);
  assert.equal((await call(port,{method:'HEAD'})).text,'');
  assert.equal((await call(port,{headers:{'Content-Length':'1'},body:'x'})).status,400);
  await assert.rejects(host.listen(),/closed_member_https_unavailable/);
 }finally{await host.close();}
});
test('TLS reload stays closed; failed key read is sanitized and leaves existing listener working',async()=>{
 let fail=false,next=tls;const host=createClosedAllianceHttpsServer({enabled:true,port:0,readTlsMaterial:async()=>{if(fail)throw Error('PRIVATE_VALUE_CANARY');return next;}});
 const {port}=await host.listen();
 try{const before=(await call(port)).fingerprint;next=renewed;assert.equal(await host.reloadTls(),true);const after=await call(port);assert.notEqual(after.fingerprint,before);fail=true;assert.equal(await host.reloadTls(),false);const kept=await call(port);assert.equal(kept.status,200);assert.equal(kept.fingerprint,after.fingerprint);}finally{await host.close();}
 assert.equal(await host.reloadTls(),false);await assert.rejects(call(port));
});
test('private reader failure never reaches logs or caller and cannot reopen',async()=>{
 const host=createClosedAllianceHttpsServer({enabled:true,port:0,readTlsMaterial:async()=>{throw Error('PRIVATE_VALUE_CANARY');}});
 await assert.rejects(host.listen(),e=>e.message==='closed_member_https_unavailable');
 await assert.rejects(host.listen(),/closed_member_https_unavailable/);await host.close();
});
test('occupied port refuses without disturbing the existing closed server',async()=>{
 const first=createClosedAllianceHttpsServer({enabled:true,port:0,readTlsMaterial:async()=>tls});
 const {port}=await first.listen();const second=createClosedAllianceHttpsServer({enabled:true,port,readTlsMaterial:async()=>tls});
 try{await assert.rejects(second.listen(),e=>e.message==='closed_member_https_unavailable');assert.equal((await call(port)).status,200);}finally{await second.close();await first.close();}
});
