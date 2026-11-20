import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm,lstat,chmod,symlink,rename} from 'node:fs/promises';
import {X509Certificate} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {request as secureRequest} from 'node:https';
import {request} from 'node:http';
import {allianceMemberBackendHostname as hostname} from '../lib/alliance-member-closed-https.mjs';
const entry=fileURLToPath(new URL('../lib/alliance-member-generation-process-entry.mjs',import.meta.url));
const linux={skip:process.platform==='win32'};
const instanceArn='arn:aws:lightsail:us-east-2:759712674603:Instance/e6ee7e8c-38f8-4902-8ef8-69c3a022ebd3';
function child(args){
 const process=spawn(globalThis.process.execPath,[entry,...args],{stdio:['ignore','pipe','pipe']});
 const messages=[],waiting=new Set();let tail='',stderr='';
 process.stdout.on('data',bytes=>{tail+=bytes.toString();assert.ok(tail.length<8192);let end;while((end=tail.indexOf('\n'))>=0){const row=JSON.parse(tail.slice(0,end));tail=tail.slice(end+1);messages.push(row);for(const w of waiting)if(w.state===row.state){clearTimeout(w.timer);waiting.delete(w);w.resolve(row);}}});
 process.stderr.on('data',bytes=>{stderr+=bytes.toString();});
 const done=new Promise(resolve=>process.once('close',(code,signal)=>resolve({code,signal,stderr,messages})));
 return {process,done,async state(state){const old=messages.find(v=>v.state===state);if(old)return old;return new Promise((resolve,reject)=>{const w={state,resolve};w.timer=setTimeout(()=>{waiting.delete(w);reject(Error('child_status_timeout'));},8000);waiting.add(w);});},async stop(){if(process.exitCode!==null||process.signalCode!==null)return done;process.kill('SIGTERM');const timer=setTimeout(()=>process.kill('SIGKILL'),3000);try{return await done;}finally{clearTimeout(timer);}}};
}
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'alliance-generation-entry-')),runtime=join(root,'run'),rootDirectory=join(root,'tls'),ack=join(root,'ack');await mkdir(runtime,{mode:0o700});await mkdir(rootDirectory,{mode:0o750});await mkdir(ack,{mode:0o750});
 async function generation(name){const folder=join(rootDirectory,'generation-'+name);await mkdir(folder,{mode:0o750});execFileSync('openssl',['req','-x509','-newkey','ed25519','-nodes','-days','1','-subj','/CN='+hostname,'-addext','subjectAltName=DNS:'+hostname,'-keyout',join(folder,'privkey.pem'),'-out',join(folder,'fullchain.pem')],{stdio:'ignore',timeout:20000});for(const n of ['privkey.pem','fullchain.pem'])await chmod(join(folder,n),0o640);return {folder,cert:await readFile(join(folder,'fullchain.pem'))};}
 const initial=await generation('initial'),currentLink=join(root,'tls-current');await symlink(initial.folder,currentLink);
 const config={format:1,origin:'https://galacticfederation.co',instanceArn,releaseSha256:'a'.repeat(64),bind:'127.0.0.1',port:0,socketPath:join(runtime,'control.sock'),tls:{rootDirectory,currentLink,acknowledgementPath:join(ack,'tls-state.json'),ownerUid:process.getuid()}};
 config.window={notBeforeUtc:new Date(Date.now()-60000).toISOString(),notAfterUtc:new Date(Date.now()+3600000).toISOString()};config.privateRuntime={rootDirectory:join(root,'not-delivered'),ownerUid:process.getuid()};
 const path=join(root,'generation.json');await writeFile(path,JSON.stringify(config),{mode:0o600});const children=[];
 return {root,path,config,cert:initial.cert,generation,start(){const c=child(['--generation','--config',path]);children.push(c);return c;},async cleanup(){await Promise.all(children.map(c=>c.stop()));assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep+'alliance-generation-entry-'));await rm(root,{recursive:true,force:true});}};
}
function member(port,cert,path='/healthz'){return new Promise((resolve,reject)=>{const q=secureRequest({hostname:'127.0.0.1',servername:hostname,port,ca:cert,path,headers:{Host:hostname,Origin:'https://galacticfederation.co','Sec-Fetch-Site':'same-origin'},agent:false},r=>{let text='';r.on('data',b=>text+=b);r.on('end',()=>resolve({status:r.statusCode,value:JSON.parse(text)}));});q.on('error',reject);q.end();});}
function prepare(socketPath,installation){const body=JSON.stringify({installation,checkpoint:{}});return new Promise((resolve,reject)=>{const q=request({socketPath,path:'/v1/prepare',method:'POST',headers:{Host:'alliance-control.local','Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},r=>{r.resume();r.on('end',()=>resolve(r.statusCode));});q.on('error',reject);q.end(body);});}


test('generation entry is disabled by default and refuses unknown commands without input',async()=>{
 const disabled=await child([]).done;assert.equal(disabled.code,0);assert.equal(disabled.stderr,'');assert.deepEqual(disabled.messages,[{state:'disabled',memberServing:false}]);
 const refused=await child(['--closed-bootstrap']).done;assert.equal(refused.code,1);assert.equal(refused.stderr,'');assert.deepEqual(refused.messages,[{state:'unavailable',memberServing:false}]);
});
test('real generation child defers private delivery, rejects foreign preparation and closes without provider claims',linux,async()=>{
 const f=await fixture();try{
  // The private directory does not exist. Startup must not inspect it.
  const host=f.start(),ready=await host.state('generation_listening');assert.equal(ready.preparation,'not_started');assert.equal(ready.memberServing,false);
  assert.equal((await member(ready.port,f.cert)).status,200);assert.equal((await member(ready.port,f.cert,'/api/alliance-members/me')).status,503);
  const identity={format:1,instanceArn,releaseSha256:f.config.releaseSha256,environment:'production',processId:ready.processId};
  assert.equal(await prepare(f.config.socketPath,{...identity,processId:'11111111-1111-4111-8111-111111111111'}),503);
  const occupied=f.start(),refused=await occupied.done;assert.equal(refused.code,1);assert.equal(refused.stderr,'');assert.equal((await member(ready.port,f.cert)).status,200);
  const ack=JSON.parse(await readFile(f.config.tls.acknowledgementPath,'utf8'));assert.equal(ack.state,'member_tls_ready');assert.equal(ack.transportOnly,true);assert.equal(Object.hasOwn(ack,'memberServing'),false);
  const replacement=await f.generation('replacement');await symlink(replacement.folder,join(f.root,'tls-next'));await rename(join(f.root,'tls-next'),f.config.tls.currentLink);host.process.kill('SIGHUP');
  const reloaded=await host.state('tls_reloaded');assert.equal(reloaded.authority,'not_certified');assert.equal(Object.hasOwn(reloaded,'memberServing'),false);
  assert.equal((await member(ready.port,replacement.cert)).status,200);
  const next=JSON.parse(await readFile(f.config.tls.acknowledgementPath,'utf8'));assert.equal(next.state,'member_tls_ready');assert.notEqual(next.fingerprint,ack.fingerprint);
  // Matching preparation now reaches absent private delivery, fails closed and
  // cannot use another preparation attempt or expose a private filesystem error.
  assert.equal(await prepare(f.config.socketPath,identity),503);assert.equal(await prepare(f.config.socketPath,identity),503);
  await assert.rejects(lstat(f.config.privateRuntime.rootDirectory),{code:'ENOENT'});
  const end=await host.stop();assert.equal(end.code,0);assert.equal(end.stderr,'');assert.deepEqual(end.messages.at(-1),{state:'stopped',memberServing:false,localClosed:true,providerClosureVerified:false});
  assert.equal(JSON.stringify(end.messages).includes('not-delivered'),false);await assert.rejects(lstat(f.config.socketPath),{code:'ENOENT'});
 }finally{await f.cleanup();}
});
test('generation public configuration refuses writable files and extra private fields with fixed output',linux,async()=>{
 const f=await fixture();try{
  await chmod(f.path,0o666);const writable=await f.start().done;assert.equal(writable.code,1);assert.equal(writable.stderr,'');assert.deepEqual(writable.messages,[{state:'unavailable',memberServing:false}]);
  await chmod(f.path,0o600);await writeFile(f.path,JSON.stringify({...f.config,callerSecret:'FICTIONAL_MUST_NOT_PRINT'}));const extra=await f.start().done;assert.equal(extra.code,1);assert.equal(extra.stderr,'');assert.deepEqual(extra.messages,[{state:'unavailable',memberServing:false}]);
 }finally{await f.cleanup();}
});
