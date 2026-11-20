import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,chmod,rm,symlink} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {generateKeyPairSync,createHash} from 'node:crypto';
import {rootCertificates} from 'node:tls';
import {createRequire} from 'node:module';
import {createPersistentAlliancePrivateBundle} from '../lib/alliance-member-private-bundle.mjs';
import {PERSISTENT_GATEWAY_SIGNING_SECRET} from '../lib/alliance-avatar-server/netlify-signing-runtime.mjs';
const linux={skip:process.platform==='win32'};
const installation={format:1,instanceArn:'arn:aws:lightsail:us-east-2:123456789012:Instance/11111111-2222-4333-8444-555555555555',releaseSha256:'a'.repeat(64),processId:'22222222-2222-4222-8222-222222222222',environment:'production'};
const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111'};
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'alliance-private-runtime-')),directory=join(root,'private');await mkdir(directory,{mode:0o750});await chmod(directory,0o750);
 const pair=generateKeyPairSync('ed25519'),spki=pair.publicKey.export({format:'der',type:'spki'});
 const payload={format:1,purpose:'alliance-member-private-runtime',installation:{instanceArn:installation.instanceArn,releaseSha256:installation.releaseSha256,environment:installation.environment},
  configuration:{origin:'https://galacticfederation.co',key:'sb_publishable_fictional_private_bundle_only',scope:{...scope},minimum:{sequence:0,sha256:'0'.repeat(64)},minimumRevision:1,
   reviewerActor:'22222222-2222-4222-8222-222222222222',gateway:{apiId:'abcdefghij',region:'us-east-2',stage:'preview'},resource:{accountId:'123456789012',region:'us-east-2',functionName:'alliance-member-authority-fictional',version:'1'},
   callerKey:{keyId:createHash('sha256').update(spki).digest('hex'),spki:spki.toString('base64'),notBeforeUtc:new Date(Date.now()-60000).toISOString(),notAfterUtc:new Date(Date.now()+3600000).toISOString()},
   controlVerificationKey:'a'.repeat(64),journalVerificationKey:'b'.repeat(64)},
  connections:Object.fromEntries([['member',scope.memberProjectRef],['journal',scope.journalProjectRef],['anchor',scope.controlProjectRef]].map(([n,ref])=>[n,{host:`db.${ref}.supabase.co`,password:'FICTIONAL_PRIVATE_PASSWORD_NOT_LOGGED',ca:rootCertificates[0]}])),
  callerSecret:pair.privateKey.export({format:'der',type:'pkcs8'}).toString('base64')};
 const file=join(directory,'runtime.json');await writeFile(file,JSON.stringify(payload),{mode:0o640});await chmod(file,0o640);
 const pools=[];let network=0,queries=0;
 const options={enabled:true,rootDirectory:directory,ownerUid:process.getuid(),installation,openPool(config){const p={config,ends:0,on(){},async end(){p.ends++;},async connect(){queries++;throw Error('no live SQL');}};pools.push(p);return p;},fetcher(){network++;throw Error('no Auth request');},transport(){network++;throw Error('no authority request');}};
 return {root,directory,file,payload,pools,options,get counts(){return {network,queries};},async cleanup(){assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep+'alliance-private-runtime-'));await rm(root,{recursive:true,force:true});}};
}
test('private opener defaults off without inspecting private paths or dependencies',async()=>{
 const f=createPersistentAlliancePrivateBundle({get rootDirectory(){throw Error('must not inspect');},get createBundle(){throw Error('must not inspect');}});
 const b=await f.openApplication();assert.equal((await b.application.handle(null,{})).status,404);await b.close();await f.close();
});
test('owned private file opens the real closed six-pool bundle only on explicit call and retires once',linux,async()=>{
 const f=await fixture();const opener=createPersistentAlliancePrivateBundle(f.options);
 try{
  assert.equal(f.pools.length,0);const b=await opener.openApplication();assert.equal(f.pools.length,6);
  assert.deepEqual(f.counts,{network:0,queries:0});assert.equal((await b.application.handle(new Request('https://galacticfederation.co/api/alliance-members/me'),{server:installation})).status,503);
  await Promise.all([b.application.close(),b.close(),opener.close()]);assert.ok(f.pools.every(p=>p.ends===1));
  await assert.rejects(opener.openApplication(),/^Error: alliance_private_bundle_unavailable$/);
 }finally{await opener.close();await f.cleanup();}
});
test('production default constructs and closes six real pg pools without provider work',linux,async()=>{
 const f=await fixture(),{openPool,...options}=f.options;
 const {Pool}=createRequire(new URL('../lib/alliance-avatar-server/package.json',import.meta.url))('pg');
 const originalConnect=Pool.prototype.connect,originalEnd=Pool.prototype.end;let connects=0,ends=0;
 Pool.prototype.connect=function(){connects++;throw Error('no provider connection permitted');};
 Pool.prototype.end=function(...args){ends++;return originalEnd.apply(this,args);};
 const opener=createPersistentAlliancePrivateBundle(options);
 try{
  const b=await opener.openApplication();
  assert.equal((await b.application.handle(new Request('https://galacticfederation.co/api/alliance-members/me'),{server:installation})).status,503);
  await b.close();await opener.close();assert.equal(ends,6);assert.equal(connects,0);assert.deepEqual(f.counts,{network:0,queries:0});
 }finally{await opener.close();Pool.prototype.connect=originalConnect;Pool.prototype.end=originalEnd;await f.cleanup();}
});
test('writable/symlinked private files, deployment drift and extra fields refuse before pools with fixed errors',linux,async()=>{
 for(const change of [async f=>chmod(f.file,0o660),async f=>{await writeFile(join(f.directory,'other.json'),await readFile(f.file));await rm(f.file);await symlink(join(f.directory,'other.json'),f.file);},async f=>{f.payload.installation.releaseSha256='c'.repeat(64);await writeFile(f.file,JSON.stringify(f.payload));},async f=>{f.payload.extra='FICTIONAL_DO_NOT_LOG';await writeFile(f.file,JSON.stringify(f.payload));}]){
  const f=await fixture();let opener;try{await change(f);opener=createPersistentAlliancePrivateBundle(f.options);await assert.rejects(opener.openApplication(),/^Error: alliance_private_bundle_unavailable$/);assert.equal(f.pools.length,0);assert.deepEqual(f.counts,{network:0,queries:0});}finally{await opener?.close();await f.cleanup();}
 }
});
test('cancellation retires a late bundle and disables retained secret callbacks',linux,async()=>{
 const f=await fixture(),controller=new AbortController();let ready,release,readSecret,ends=0;
 const started=new Promise(r=>{ready=r;}),gate=new Promise(r=>{release=r;});
 const opener=createPersistentAlliancePrivateBundle({...f.options,async createBundle(options){readSecret=options.readCallerSecret;ready();await gate;return {application:{prepare(){},handle(){},close(){}},async close(){ends++;}};}});
 try{
  const pending=opener.openApplication({signal:controller.signal});await started;controller.abort();
  await assert.rejects(readSecret(PERSISTENT_GATEWAY_SIGNING_SECRET),/^Error: alliance_private_bundle_unavailable$/);
  release();await assert.rejects(pending,/alliance_private_bundle_unavailable/);assert.equal(ends,1);await opener.close();assert.equal(ends,1);
 }finally{release?.();await opener.close();await f.cleanup();}
});
