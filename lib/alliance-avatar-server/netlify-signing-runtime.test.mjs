import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign,verify} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {AsyncResource} from 'node:async_hooks';
import {createNetlifyGatewaySigningRuntime as factory,NETLIFY_GATEWAY_SIGNING_SECRET as secretName} from './netlify-signing-runtime.mjs';
const error=/^Error: alliance_netlify_signing_unavailable$/;
const installation=()=>({siteId:'11111111-1111-4111-8111-111111111111',deployId:'1234567890abcdef12345678',context:'deploy-preview'});
const context=()=>({site:{id:installation().siteId},deploy:{id:installation().deployId,context:'deploy-preview'}});
function fixture(patch={}){
 const pair=generateKeyPairSync('ed25519'),spki=pair.publicKey.export({format:'der',type:'spki'}),value=pair.privateKey.export({format:'der',type:'pkcs8'}).toString('base64');
 const descriptor={keyId:createHash('sha256').update(spki).digest('hex'),spki:spki.toString('base64'),notBeforeUtc:new Date(Date.now()-60000).toISOString(),notAfterUtc:new Date(Date.now()+3600000).toISOString()};
 let reads=0;const names=[];
 const runtime=factory({enabled:true,expectedInstallation:installation(),callerKey:descriptor,readSecret:async name=>{reads++;names.push(name);return value;},...patch});
 return {runtime,pair,value,descriptor,names,get reads(){return reads;}};
}
test('adapter import and default-off methods do not read Netlify or inherited environment',()=>{
 const code=`let reads=0;Object.defineProperty(globalThis,'Netlify',{get(){reads++;throw Error('forbidden global lookup');}});const m=await import(${JSON.stringify(new URL('./netlify-signing-runtime.mjs',import.meta.url).href)});const original=process.env;process.env=new Proxy({},{get(){reads++;throw Error('forbidden environment lookup');},ownKeys(){throw Error('forbidden enumeration');}});try{for(const enabled of [false,undefined,'true']){const p=m.createNetlifyGatewaySigningRuntime({enabled});try{await p.signingKey();throw Error('unexpected key');}catch(e){if(e.message!=='alliance_netlify_signing_unavailable')throw e;}try{await p.run({},()=>{});throw Error('unexpected admission');}catch(e){if(e.message!=='alliance_netlify_signing_unavailable')throw e;}p.close();}if(reads!==0)throw Error('lookup occurred');}finally{process.env=original;}`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code],{env:{TZ:'UTC'},encoding:'utf8',timeout:15000});assert.equal(child.status,0,child.stderr);assert.equal(child.stdout,'');
});
test('matching documented context reads one fixed secret and produces a matching signing key without private export',async t=>{
 const f=fixture();try{
  t.mock.method(Object.getPrototypeOf(f.pair.privateKey),'export',()=>{throw Error('Private key export forbidden');});
  const ctx=context();Object.defineProperty(ctx,'headers',{get(){throw Error('request-like field read');}});Object.defineProperty(ctx,'user',{get(){throw Error('user field read');}});
  const key=await f.runtime.run(ctx,()=>f.runtime.signingKey());const bytes=Buffer.from('synthetic server adapter signing proof');
  assert.equal(verify(null,bytes,f.pair.publicKey,sign(null,bytes,key)),true);assert.equal(f.reads,1);assert.deepEqual(f.names,[secretName]);
  await f.runtime.run(context(),()=>f.runtime.signingKey());assert.equal(f.reads,2);
  await assert.rejects(f.runtime.signingKey(),error);assert.equal(f.reads,2);
 }finally{f.runtime.close();}
});
test('wrong site/deploy/context, request-shaped inputs and context getter failure deny before secret lookup',async()=>{
 for(const ctx of [{site:{id:'22222222-2222-4222-8222-222222222222'},deploy:context().deploy},{site:context().site,deploy:{...context().deploy,id:'abcdef1234567890abcdef12'}},{site:context().site,deploy:{...context().deploy,context:'production'}},{headers:{'x-nf-site-id':installation().siteId},siteId:installation().siteId},new Proxy({},{get(){throw Error('PRIVATE context diagnostic');}})]){
  const f=fixture();try{await assert.rejects(f.runtime.run(ctx,()=>f.runtime.signingKey()),error);assert.equal(f.reads,0);}finally{f.runtime.close();}
 }
});
test('private store reads only the one explicit server environment key with no global or alternate lookup',()=>{
 const code=`import {generateKeyPairSync,createHash,verify,sign} from 'node:crypto';import {strict as a} from 'node:assert';const pair=generateKeyPairSync('ed25519'),der=pair.publicKey.export({format:'der',type:'spki'}),value=pair.privateKey.export({format:'der',type:'pkcs8'}).toString('base64');let reads=0;Object.defineProperty(globalThis,'Netlify',{get(){throw Error('forbidden alternate global');}});const {createNetlifyGatewaySigningRuntime:factory}=await import(${JSON.stringify(new URL('./netlify-signing-runtime.mjs',import.meta.url).href)});const original=process.env;process.env=new Proxy({},{get(_,name){a.equal(name,'FEDERATION_ACCOUNT_GATEWAY_ED25519_PKCS8');reads++;return value;},ownKeys(){throw Error('forbidden enumeration');}});let p;try{p=factory({enabled:true,expectedInstallation:${JSON.stringify(installation())},callerKey:{keyId:createHash('sha256').update(der).digest('hex'),spki:der.toString('base64'),notBeforeUtc:new Date(Date.now()-60000).toISOString(),notAfterUtc:new Date(Date.now()+3600000).toISOString()}});const k=await p.run(${JSON.stringify(context())},()=>p.signingKey());a.equal(verify(null,Buffer.from('proof'),pair.publicKey,sign(null,Buffer.from('proof'),k)),true);a.equal(reads,1);}finally{p?.close();process.env=original;}`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code],{env:{TZ:'UTC'},encoding:'utf8',timeout:15000});assert.equal(child.status,0,child.stderr);assert.equal(child.stdout,'');
});
test('missing, malformed, whitespace/PEM/raw/public/foreign values and store errors are sanitized with no retry',async()=>{
 for(const value of [undefined,null,'',Buffer.from('not a key'),'not a key',' '.repeat(64),'A'.repeat(64),'-----BEGIN PRIVATE KEY-----']){
  let reads=0;const f=fixture({readSecret:()=>{reads++;return value;}});try{await assert.rejects(f.runtime.run(context(),()=>f.runtime.signingKey()),error);await assert.rejects(f.runtime.run(context(),()=>f.runtime.signingKey()),error);assert.equal(reads,1);}finally{f.runtime.close();}
 }
 const foreign=generateKeyPairSync('ed25519').privateKey.export({format:'der',type:'pkcs8'}).toString('base64');
 for(const readSecret of [()=>foreign,()=>{throw Error('PRIVATE store diagnostics');}]){const f=fixture({readSecret});try{await assert.rejects(f.runtime.run(context(),()=>f.runtime.signingKey()),error);}finally{f.runtime.close();}}
});
test('context changing during store lookup withholds the key and faults the provider',async()=>{
 const ctx=context();let reads=0,value;const f=fixture({readSecret:()=>{reads++;ctx.deploy.id='abcdef1234567890abcdef12';return value;}});value=f.value;
 try{await assert.rejects(f.runtime.run(ctx,()=>f.runtime.signingKey()),error);await assert.rejects(f.runtime.run(context(),()=>f.runtime.signingKey()),error);assert.equal(reads,1);}finally{f.runtime.close();}
});
test('a retained callback cannot read outside its invocation or borrow the next invocation',async()=>{
 const f=fixture();let retained;try{
  await f.runtime.run(context(),()=>{retained=AsyncResource.bind(()=>f.runtime.signingKey());});await assert.rejects(retained(),error);assert.equal(f.reads,0);
  await f.runtime.run(context(),async()=>{await assert.rejects(retained(),error);await f.runtime.signingKey();});assert.equal(f.reads,1);
 }finally{f.runtime.close();}
});
test('expiry, pre-cancel, busy, close, deadline and late store results never release a key',async()=>{
 const expired=fixture({callerKey:(()=>{const pair=generateKeyPairSync('ed25519'),spki=pair.publicKey.export({format:'der',type:'spki'});return {keyId:createHash('sha256').update(spki).digest('hex'),spki:spki.toString('base64'),notBeforeUtc:new Date(Date.now()-3600000).toISOString(),notAfterUtc:new Date(Date.now()-1).toISOString()};})()});
 try{await assert.rejects(expired.runtime.run(context(),()=>expired.runtime.signingKey()),error);assert.equal(expired.reads,0);}finally{expired.runtime.close();}
 let enter,release,reads=0;const ready=new Promise(r=>enter=r),f=fixture({keyTimeoutMs:25,readSecret:()=>{reads++;enter();return new Promise(r=>release=r);}});
 try{const c=new AbortController();c.abort();await assert.rejects(f.runtime.run(context(),()=>f.runtime.signingKey(),{signal:c.signal}),error);assert.equal(reads,0);const pending=f.runtime.run(context(),()=>f.runtime.signingKey());await ready;await assert.rejects(f.runtime.run(context(),()=>{}),error);await assert.rejects(pending,error);release(f.value);await new Promise(r=>setImmediate(r));await assert.rejects(f.runtime.run(context(),()=>f.runtime.signingKey()),error);assert.equal(reads,1);}finally{release?.(f.value);f.runtime.close();}
 const g=fixture();let started;const began=new Promise(r=>started=r);const p=g.runtime.run(context(),()=>{started();return new Promise(()=>{});});await began;g.runtime.close();await assert.rejects(p,error);assert.equal(g.reads,0);
});
test('whole-invocation timeout retires callbacks while a later invocation remains usable',async()=>{
 const f=fixture({timeoutMs:200,keyTimeoutMs:100});let old;
 try{await assert.rejects(f.runtime.run(context(),()=>{old=AsyncResource.bind(()=>f.runtime.signingKey());return new Promise(()=>{});}),error);await f.runtime.run(context(),async()=>{await assert.rejects(old(),error);await f.runtime.signingKey();});assert.equal(f.reads,1);}finally{f.runtime.close();}
});
