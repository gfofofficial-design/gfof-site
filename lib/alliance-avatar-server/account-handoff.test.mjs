import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {mkdtemp,open,readFile,realpath,rename,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,dirname,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {accountEvent,accountRecord} from './account-history.mjs';
import {accountHandoffBytes,reviewAccountHandoff,reviewAccountHandoffSuccessor} from './account-handoff.mjs';
import {createAccountAuthority,createAccountStatusReader} from './account-witness.mjs';
const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111'},hs={memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch};
const zero={sequence:0,sha256:'0'.repeat(64)},tag='a'.repeat(64),key='b'.repeat(64),digest=b=>createHash('sha256').update(b).digest('hex');
const admission=accountEvent({kind:'account_admitted',subject:tag}),removal=accountEvent({kind:'account_remove_requested',subject:tag});
const one=accountRecord({scope:hs,sequence:1,previous:zero.sha256,event:admission}),two=accountRecord({scope:hs,sequence:2,previous:one.sha256,event:removal}),tip=r=>({sequence:r.sequence,sha256:r.sha256});
const base=()=>({format:1,scope:structuredClone(scope),generation:1,previousSha256:zero.sha256,verificationKey:key,minimum:{head:tip(one),acknowledged:zero},pending:null});
const config={expectedScope:scope,expectedVerificationKey:key,minimumGeneration:1};
const review=(bytes,patch={})=>reviewAccountHandoff({...config,bytes,expectedSha256:digest(bytes),...patch});
const successor=(before,after,records=[one,two],patch={})=>{const previousBytes=accountHandoffBytes(before),nextBytes=accountHandoffBytes(after);return reviewAccountHandoffSuccessor({...config,previousBytes,previousSha256:digest(previousBytes),nextBytes,nextSha256:digest(nextBytes),records,...patch});};
const next=(b,patch={})=>({...structuredClone(b),generation:b.generation+1,previousSha256:digest(accountHandoffBytes(b)),...patch});
const intent=()=>({id:'c'.repeat(64),kind:'history_append',event:removal,expected:tip(one),target:null});

test('restart handoff has bounded canonical bytes, separate head/ack pins and no account secrets',()=>{
 const b=base(),bytes=accountHandoffBytes(b);assert.deepEqual(review(bytes),b);assert.deepEqual(accountHandoffBytes(Object.fromEntries(Object.entries(b).reverse())),bytes);
 assert.ok(bytes.length<4096);assert.ok(!bytes.includes('authUserId'));assert.deepEqual(Object.keys(review(bytes)),['format','scope','generation','previousSha256','verificationKey','minimum','pending']);
});
test('restart never accepts missing independently retained digest, scope, key or generation',()=>{
 const bytes=accountHandoffBytes(base());for(const patch of [{expectedSha256:undefined},{expectedSha256:'f'.repeat(64)},{expectedScope:undefined},{expectedScope:{...scope,controlProjectRef:'z'.repeat(20)}},{expectedVerificationKey:undefined},{expectedVerificationKey:'f'.repeat(64)},{minimumGeneration:undefined},{minimumGeneration:2}])assert.throws(()=>review(bytes,patch),/alliance_account_handoff_unavailable/);
});
test('restart rejects malformed bytes, duplicate keys, extra fields, BOM, whitespace and truncation',()=>{
 const bytes=accountHandoffBytes(base());for(const b of [Buffer.alloc(4097),bytes.subarray(0,-2),Buffer.from('\ufeff'+bytes),Buffer.from(' '+bytes),Buffer.from(bytes.toString().replace('"format":1','"format":1,"format":1')),Buffer.from(bytes.toString().replace('"format":1','"format":1,"extra":true')),Buffer.from([255])])assert.throws(()=>review(b));
});
test('record schema rejects same-domain scope, impossible points, invalid keys and generation boundaries',()=>{
 for(const patch of [{scope:{...scope,controlProjectRef:scope.memberProjectRef}},{verificationKey:zero.sha256},{generation:0},{generation:2147483647},{previousSha256:key},{minimum:{head:zero,acknowledged:tip(one)}},{minimum:{head:{sequence:257,sha256:key},acknowledged:zero}},{minimum:{head:{sequence:1,sha256:zero.sha256},acknowledged:zero}},{pending:{...intent(),extra:true}}])assert.throws(()=>accountHandoffBytes({...base(),...patch}));
});
test('successor validates a complete chain and preserves both independent observed minima',()=>{
 const b=base(),a=next(b,{minimum:{head:tip(two),acknowledged:tip(one)}});assert.deepEqual(successor(b,a),a);
 for(const records of [[],[one],[two],[one,{...two,sha256:key}],[one,{...two,scope:{...hs,epoch:scope.epoch.replace('1111','2222')}}]])assert.throws(()=>successor(b,a,records));
});
test('successor rejects skipped generation, wrong predecessor, changed scope and unreviewed key rotation',()=>{
 const b=base();for(const patch of [{generation:3},{previousSha256:key},{scope:{...scope,epoch:'22222222-2222-4222-8222-222222222222'}},{verificationKey:'d'.repeat(64)}])assert.throws(()=>successor(b,next(b,patch),[one]));
});
test('unacknowledged head rollback and same-height forks are refused even with a valid successor hash',()=>{
 const b={...base(),minimum:{head:tip(two),acknowledged:zero}};assert.throws(()=>successor(b,next(b,{minimum:{head:tip(one),acknowledged:zero}}),[one]));
 const fork=accountRecord({scope:hs,sequence:1,previous:zero.sha256,event:accountEvent({kind:'account_admitted',subject:'e'.repeat(64)})});assert.throws(()=>successor(base(),next(base(),{minimum:{head:tip(fork),acknowledged:zero}}),[fork]));
});
test('acknowledgement rollback refuses even when the observed head is unchanged',()=>{
 const b={...base(),minimum:{head:tip(two),acknowledged:tip(one)}};assert.throws(()=>successor(b,next(b,{minimum:{head:tip(two),acknowledged:zero}})));assert.deepEqual(successor(b,next(b,{minimum:{head:tip(two),acknowledged:tip(two)}})).minimum.acknowledged,tip(two));
});
test('history intent is staged separately at the exact observed tip before any possible dispatch',()=>{
 const b=base(),a=next(b,{pending:intent()});assert.deepEqual(successor(b,a,[one]).pending,intent());
 for(const patch of [{pending:{...intent(),expected:zero}},{minimum:{head:tip(two),acknowledged:zero},pending:intent()},{pending:{...intent(),event:admission}},{pending:{...intent(),event:{...removal,id:key}}}])assert.throws(()=>successor(b,next(b,patch),patch.minimum?[one,two]:[one]));
});
test('staged history intent validates legal account event ordering before dispatch',()=>{
 const b=base(),unknownRemoval=accountEvent({kind:'account_remove_requested',subject:'e'.repeat(64)});assert.throws(()=>successor(b,next(b,{pending:{...intent(),event:unknownRemoval}}),[one]));
 const removed={...b,minimum:{head:tip(two),acknowledged:zero}};assert.throws(()=>successor(removed,next(removed,{pending:{...intent(),expected:tip(two),event:admission}})));
});
test('staging a new admission cannot exceed the reserved lifetime account capacity',()=>{
 const records=[];for(let i=0;i<128;i++)records.push(accountRecord({scope:hs,sequence:i+1,previous:i?records.at(-1).sha256:zero.sha256,event:accountEvent({kind:'account_admitted',subject:createHash('sha256').update(String(i)).digest('hex')})}));
 const b={...base(),minimum:{head:tip(records.at(-1)),acknowledged:zero}},event=accountEvent({kind:'account_admitted',subject:tag});assert.throws(()=>successor(b,next(b,{pending:{...intent(),expected:b.minimum.head,event}}),records));
 // Admission closure/capacity must not prevent a later removal of an admitted account.
 const remove=accountEvent({kind:'account_remove_requested',subject:records[0].event.subject});assert.deepEqual(successor(b,next(b,{pending:{...intent(),expected:b.minimum.head,event:remove}}),records).pending.event,remove);
});
test('acknowledgement intent pins the exact expected acknowledgement and target head',()=>{
 const b=base(),p={id:key,kind:'acknowledgement_advance',event:null,expected:zero,target:tip(one)};assert.deepEqual(successor(b,next(b,{pending:p}),[one]).pending,p);
 for(const patch of [{expected:tip(one)},{target:zero},{event:admission},{kind:'arbitrary_call'}])assert.throws(()=>successor(b,next(b,{pending:{...p,...patch}}),[one]));
});
test('unknown operation survives newer observations and cannot be cleared, replaced or guessed complete',()=>{
 const b=next(base(),{pending:intent()}),a=next(b,{minimum:{head:tip(two),acknowledged:tip(two)}});assert.deepEqual(successor(b,a).pending,intent());
 for(const pending of [null,{...intent(),id:'d'.repeat(64)},{...intent(),expected:tip(two)},{...intent(),event:admission}])assert.throws(()=>successor(b,next(b,{pending}),[one]));
});
test('parsed records and caller configuration have no mutable aliases',()=>{
 const original=base(),bytes=accountHandoffBytes(original),r=review(bytes);r.minimum.head.sequence=0;r.scope.memberProjectRef='x'.repeat(20);assert.deepEqual(review(bytes),original);assert.deepEqual(config.expectedScope,scope);
});
test('a fresh reader uses restarted head pins to refuse an old but correctly signed history',async()=>{
 const pair=generateKeyPairSync('ed25519'),verificationKey=Buffer.from(pair.publicKey.export({format:'jwk'}).x,'base64url').toString('hex');
 const b={...base(),verificationKey,minimum:{head:tip(two),acknowledged:zero}},bytes=accountHandoffBytes(b),r=review(bytes,{expectedVerificationKey:verificationKey});
 const snapshot={scope:hs,enabled:true,admissionsOpen:true,head:tip(one),records:[one]};let signed=0;
 const authority=createAccountAuthority({enabled:true,scope,verificationKey,minimum:{head:zero,acknowledged:zero},history:{snapshot:async()=>snapshot},acknowledgements:{read:async()=>zero},signBytes:b=>{signed++;return sign(null,b,pair.privateKey);}});
 const reader=createAccountStatusReader({enabled:true,scope:r.scope,verificationKey:r.verificationKey,minimum:r.minimum,readWitness:async(req,o)=>(await authority.issue(req,o)).bytes,readHistory:async()=>snapshot});
 try{assert.equal((await reader.review(tag)).state,'unavailable');assert.equal(signed,1);}finally{reader.close();authority.close();}
});
test('fresh process reads flushed synthetic checkpoint; interrupted, missing and rolled-back copies fail against outside receipt',async()=>{
 const tempRoot=await realpath(tmpdir()),directory=await mkdtemp(join(tempRoot,'alliance-account-handoff-')),path=join(directory,'checkpoint.json'),staging=join(directory,'checkpoint.partial');
 const b=base(),a=next(b,{pending:intent()}),bytes=accountHandoffBytes(a),anchor={...config,expectedSha256:digest(bytes),minimumGeneration:2};
 // Fixture persistence only, not a production store: no ACL, directory flush,
 // cross-machine custody, compare-and-set or platform durability claim.
 const child=`import {readFileSync} from 'node:fs';import {reviewAccountHandoff} from ${JSON.stringify(new URL('./account-handoff.mjs',import.meta.url).href)};try{const x=JSON.parse(readFileSync(0,'utf8'));const r=reviewAccountHandoff({...x.anchor,bytes:readFileSync(x.path)});process.stdout.write(r.pending===null?'clear':'pending');}catch{process.stdout.write('refused');}`;
 const fresh=()=>{const result=spawnSync(process.execPath,['--input-type=module','-e',child],{input:JSON.stringify({path,anchor}),encoding:'utf8',timeout:10000,maxBuffer:4096});assert.equal(result.status,0,result.stderr);return result.stdout;};
 try{
  const f=await open(staging,'wx',0o600);try{await f.writeFile(bytes);await f.sync();}finally{await f.close();}await rename(staging,path);assert.deepEqual(await readFile(path),bytes);assert.equal(fresh(),'pending');
  await writeFile(staging,bytes.subarray(0,80));assert.equal(fresh(),'pending'); // Interrupted replacement cannot establish a new trusted receipt.
  await writeFile(path,bytes.subarray(0,80));assert.equal(fresh(),'refused');await rm(path);assert.equal(fresh(),'refused');
  await writeFile(path,accountHandoffBytes(b));assert.equal(fresh(),'refused');await writeFile(path,bytes);assert.equal(fresh(),'pending');
 }finally{assert.equal(dirname(directory),tempRoot);assert.match(basename(directory),/^alliance-account-handoff-[a-zA-Z0-9]+$/);assert.equal(await realpath(directory),directory);await rm(directory,{recursive:true,force:true});}
});
