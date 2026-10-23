import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAllianceRecoveryPackage,RECOVERY_COMPONENTS} from './recovery-package.mjs';
import {packageFixture} from './recovery-package.fixture.mjs';
const magic=Buffer.from('age-encryption.org/v1\n'),sha=b=>createHash('sha256').update(b).digest('hex'),unavailable={state:'unavailable',access:'closed'};
// Mock carrier only, explicitly NOT encryption; real age is tested separately.
const carrier={encryptBytes:b=>Buffer.concat([magic,b]),decryptBytes:b=>Buffer.from(b.subarray(magic.length))};
const copy=v=>structuredClone(v);
async function sealed(f,extra={}){const p=f.make({...carrier,...extra});try{const r=await p.seal(f.input);assert.equal(r.state,'sealed');return r;}finally{p.close();}}
test('package path defaults closed and performs no crypto on truthy substitutes',async()=>{
 for(const enabled of [undefined,false,'true',1]){let calls=0;const p=createAllianceRecoveryPackage({enabled,encryptBytes:()=>calls++});assert.deepEqual(await p.seal({}),unavailable);assert.deepEqual(await p.open({}),unavailable);assert.equal(calls,0);p.close();}
});
test('enabled packaging requires exact independent scope, trust pin, native recipient and a capability',()=>{
 const f=packageFixture();for(const change of [{trustSha256:undefined},{minimumGeneration:0},{recipient:'http://example.invalid'},{expectedScope:{...f.scope,controlProjectRef:f.scope.memberProjectRef}},{encryptBytes:undefined,decryptBytes:undefined}])assert.throws(()=>f.make({...carrier,...change}),/alliance_recovery_package_unavailable/);
});
test('sealed package has only opaque descriptor/ciphertext and never grants restore or access',async()=>{
 const f=packageFixture(),r=await sealed(f);assert.deepEqual(Object.keys(r),['state','access','descriptor','ciphertext']);assert.equal(r.access,'closed');assert.deepEqual(r.descriptor,{format:1,packageId:f.input.packageId,bytes:r.ciphertext.length,sha256:sha(r.ciphertext)});assert.equal(Object.isFrozen(r.descriptor),true);
});
test('open verifies bytes for every fixed component and returns closed data without executing it',async()=>{
 const f=packageFixture(),r=await sealed(f),p=f.make(carrier);const opened=await p.open({descriptor:r.descriptor,ciphertext:r.ciphertext});assert.equal(opened.state,'verified_bytes');assert.equal(opened.access,'closed');assert.deepEqual(opened.components,f.input.components);assert.deepEqual(opened.manifest.components.map(c=>c.name),RECOVERY_COMPONENTS);for(const c of opened.components)c.data.fill(0);p.close();
});
test('binary components preserve zero and non-UTF8 bytes through canonical base64 packaging',async()=>{
 const f=packageFixture(),r=await sealed(f),p=f.make(carrier),opened=await p.open({descriptor:r.descriptor,ciphertext:r.ciphertext});assert.equal(opened.state,'verified_bytes');assert.deepEqual(opened.components.find(c=>c.name==='storage').data.subarray(-6),Buffer.from([0,255,128,0,195,40]));for(const c of opened.components)c.data.fill(0);p.close();
});
test('missing, duplicate, reordered, unknown or empty components refuse before encryption',async()=>{
 for(const kind of ['missing','duplicate','reorder','unknown','empty']){const f=packageFixture(),v=copy(f.input);if(kind==='missing')v.components.pop();if(kind==='duplicate')v.components[1]=v.components[0];if(kind==='reorder')v.components.reverse();if(kind==='unknown')v.components[0].name='arbitrary-path';if(kind==='empty')v.components[0].data=Buffer.alloc(0);let calls=0;const p=f.make({encryptBytes:()=>calls++});assert.deepEqual(await p.seal(v),unavailable);assert.equal(calls,0);p.close();}
});
test('per-component and aggregate limits refuse partial or oversized packages',async()=>{
 for(const aggregate of [false,true]){const f=packageFixture(),v=copy(f.input);if(aggregate)for(const c of v.components)c.data=Buffer.alloc(600000);else v.components[0].data=Buffer.alloc(1048577);let calls=0;const p=f.make({encryptBytes:()=>calls++});assert.deepEqual(await p.seal(v),unavailable);assert.equal(calls,0);p.close();}
});
test('wrong generation, trust bytes, scope and public metadata refuse before encryption',async()=>{
 for(const kind of ['generation','trust','scope','commit','date','freeze','extra']){const f=packageFixture(),v=copy(f.input);let calls=0;const options={encryptBytes:()=>calls++};if(kind==='generation')options.minimumGeneration=2;if(kind==='trust')v.trustRecord[0]^=1;if(kind==='scope')options.expectedScope={...f.scope,epoch:f.input.freezeId};if(kind==='commit')v.sourceCommit='main';if(kind==='date')v.capturedAt='today';if(kind==='freeze')v.freezeId='unknown';if(kind==='extra')v.password='not a password';const p=f.make(options);assert.deepEqual(await p.seal(v),unavailable);assert.equal(calls,0);p.close();}
});
test('changed, missing or oversized ciphertext and mixed descriptors refuse before decryption',async()=>{
 const f=packageFixture(),r=await sealed(f);for(const kind of ['tamper','truncate','missing','size','id','extra']){let calls=0;const p=f.make({decryptBytes:()=>calls++}),v={descriptor:{...r.descriptor},ciphertext:Buffer.from(r.ciphertext)};if(kind==='tamper')v.ciphertext[v.ciphertext.length-1]^=1;if(kind==='truncate')v.ciphertext=v.ciphertext.subarray(0,-1);if(kind==='missing')v.ciphertext=null;if(kind==='size')v.descriptor.bytes=8388609;if(kind==='id')v.descriptor.packageId='other';if(kind==='extra')v.descriptor.endpoint='not a secret';assert.deepEqual(await p.open(v),unavailable);assert.equal(calls,0);p.close();}
});
async function changedPlain(change){const f=packageFixture(),r=await sealed(f),raw=JSON.parse(r.ciphertext.subarray(magic.length)),body=change(raw),plain=Buffer.from(typeof body==='string'?body:JSON.stringify(body)+'\n'),cipher=Buffer.concat([magic,plain]),p=f.make(carrier);try{return await p.open({descriptor:{...r.descriptor,bytes:cipher.length,sha256:sha(cipher)},ciphertext:cipher});}finally{p.close();}}
test('plaintext component hash, size, name and canonical base64 are checked independently',async()=>{
 for(const kind of ['hash','size','name','data','base64'])assert.deepEqual(await changedPlain(v=>{const c=v.components[0];if(kind==='hash')c.sha256='f'.repeat(64);if(kind==='size')c.bytes++;if(kind==='name')c.name='wrong';if(kind==='data')c.data=Buffer.from('altered').toString('base64');if(kind==='base64')c.data+='\n';return v;}),unavailable);
});
test('duplicate keys, reordered fields, trailing JSON, malformed UTF8 and hidden fields refuse',async()=>{
 for(const kind of ['duplicate','order','trailing','extra'])assert.deepEqual(await changedPlain(v=>{if(kind==='duplicate')return (JSON.stringify(v)+'\n').replace('"format":1','"format":1,"format":1');if(kind==='order')return JSON.stringify(Object.fromEntries(Object.entries(v).reverse()))+'\n';if(kind==='trailing')return JSON.stringify(v)+'\nnull';v.secret='not a secret';return v;}),unavailable);
 const f=packageFixture(),r=await sealed(f),p=f.make({decryptBytes:()=>Buffer.from([255])});assert.deepEqual(await p.open({descriptor:r.descriptor,ciphertext:r.ciphertext}),unavailable);p.close();
});
test('an internally consistent package cannot replace external trust, recipient or package identity',async()=>{
 for(const kind of ['trust','recipient','id'])assert.deepEqual(await changedPlain(v=>{if(kind==='trust')v.trustSha256='f'.repeat(64);if(kind==='recipient')v.recipient='age1'+'p'.repeat(58);if(kind==='id')v.packageId='44444444-4444-4444-8444-444444444444';return v;}),unavailable);
});
test('wrong decryptor, non-age encryption and private provider errors are sanitized and latch closed',async()=>{
 const f=packageFixture(),r=await sealed(f);for(const extra of [{decryptBytes:()=>{throw Error('PRIVATE endpoint');}},{decryptBytes:()=>null}]){const p=f.make(extra);assert.deepEqual(await p.open({descriptor:r.descriptor,ciphertext:r.ciphertext}),unavailable);assert.deepEqual(await p.open({descriptor:r.descriptor,ciphertext:r.ciphertext}),unavailable);p.close();}const p=f.make({encryptBytes:()=>Buffer.from('not age')});assert.deepEqual(await p.seal(f.input),unavailable);p.close();
});
test('read-only recovery and export-only capabilities cannot invoke their absent counterpart',async()=>{
 const f=packageFixture();const p=f.make({decryptBytes:carrier.decryptBytes});assert.deepEqual(await p.seal(f.input),unavailable);p.close();const q=f.make({encryptBytes:carrier.encryptBytes});assert.deepEqual(await q.open({}),unavailable);q.close();
});
test('one active request has no queue; cancellation clears plaintext and discards late cipher',async()=>{
 const f=packageFixture();let release,seen;const p=f.make({encryptBytes:b=>{seen=b;return new Promise(r=>release=r);}}),c=new AbortController(),pending=p.seal(f.input,{signal:c.signal});while(!release)await new Promise(r=>setImmediate(r));assert.deepEqual(await p.seal(f.input),{state:'busy',access:'closed'});c.abort();assert.deepEqual(await pending,unavailable);assert.ok(seen.every(x=>x===0));const late=Buffer.concat([magic,Buffer.from('late')]);release(late);await new Promise(r=>setImmediate(r));assert.ok(late.every(x=>x===0));p.close();
});
test('close cancels decryption and clears a late plaintext buffer without returning components',async()=>{
 const f=packageFixture(),r=await sealed(f);let release;const p=f.make({decryptBytes:()=>new Promise(resolve=>release=resolve)}),pending=p.open({descriptor:r.descriptor,ciphertext:r.ciphertext});while(!release)await new Promise(r=>setImmediate(r));p.close();assert.deepEqual(await pending,unavailable);const late=Buffer.from('SYNTHETIC late plaintext');release(late);await new Promise(r=>setImmediate(r));assert.ok(late.every(x=>x===0));
});
test('deadline closes a noncooperative provider with no retry or successful result',async()=>{
 const f=packageFixture();let calls=0;const p=f.make({timeoutMs:12,encryptBytes:()=>{calls++;return new Promise(()=>{});}});assert.deepEqual(await p.seal(f.input),unavailable);assert.deepEqual(await p.seal(f.input),unavailable);assert.equal(calls,1);p.close();
});
test('input and caller buffers are copied before provider await and left unchanged',async()=>{
 const f=packageFixture(),original=copy(f.input);let release;const p=f.make({encryptBytes:b=>new Promise(r=>release=()=>r(Buffer.concat([magic,b])))}),pending=p.seal(f.input);while(!release)await new Promise(r=>setImmediate(r));f.input.components[0].data.fill(7);f.input.packageId='wrong';release();const r=await pending;assert.equal(r.descriptor.packageId,original.packageId);const q=f.make(carrier),opened=await q.open({descriptor:r.descriptor,ciphertext:r.ciphertext});assert.deepEqual(opened.components,original.components.map(c=>({...c,data:Buffer.from(c.data)})));assert.equal(r.ciphertext.subarray(0,magic.length).equals(magic),true);for(const c of opened.components)c.data.fill(0);p.close();q.close();
});
