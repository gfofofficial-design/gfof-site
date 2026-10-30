import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {accountEvent,accountRecord,accountSubject} from './account-history.mjs';
import {accountWitnessBytes,createAccountAuthority,createAccountStatusReader} from './account-witness.mjs';
const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:'11111111-1111-4111-8111-111111111111'},hs={memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch};
const pair=generateKeyPairSync('ed25519'),key=Buffer.from(pair.publicKey.export({format:'jwk'}).x,'base64url').toString('hex'),zero={sequence:0,sha256:'0'.repeat(64)};
const tag=accountSubject({memberProjectRef:hs.memberProjectRef,epoch:hs.epoch,authUserId:'22222222-2222-4222-8222-222222222222'}),other='a'.repeat(64);
const one=accountRecord({scope:hs,sequence:1,previous:zero.sha256,event:accountEvent({kind:'account_admitted',subject:tag})});
const two=accountRecord({scope:hs,sequence:2,previous:one.sha256,event:accountEvent({kind:'account_remove_requested',subject:tag})});
const tip=rows=>rows.length?{sequence:rows.length,sha256:rows.at(-1).sha256}:zero;
const minimum={head:zero,acknowledged:zero},request={format:1,scope,bootId:'b'.repeat(64),challenge:'c'.repeat(64),subject:tag};
const snapshot=rows=>({scope:hs,head:tip(rows),enabled:true,admissionsOpen:true,records:structuredClone(rows)});
function fixture({rows=[one],ack=tip(rows),signer,source,ackRead,...options}={}){
 const calls=[],authority=createAccountAuthority({enabled:true,scope,verificationKey:key,minimum,history:{snapshot:async()=>{calls.push('history');return source?source(calls):snapshot(rows);}},acknowledgements:{read:async()=>{calls.push('ack');return ackRead?ackRead(calls):ack;}},signBytes:async b=>{calls.push('sign');return signer?signer(b):sign(null,b,pair.privateKey);},...options});
 return {authority,calls};
}
function reader(f,{rows=[one],readWitness,readHistory,...options}={}){
 const calls=[];let last;
 const value=createAccountStatusReader({enabled:true,scope,verificationKey:key,minimum,readWitness:async(r,o)=>{calls.push('witness');last=r;return readWitness?readWitness(r,o):((await f.authority.issue(r,o)).bytes);},readHistory:async()=>{calls.push('history');return readHistory?readHistory():snapshot(rows);},...options});return {value,calls,get last(){return last;}};
}
test('account witness bytes have a distinct canonical scope/request/point/state domain',()=>{
 const d={...request,head:tip([one]),acknowledged:zero,accountState:'admission_pending',issuedAt:'2026-10-18T00:00:00.000Z'};
 assert.ok(accountWitnessBytes(d).toString().startsWith('GF-ALLIANCE-ACCOUNT-WITNESS-V1\0'));
 assert.deepEqual(accountWitnessBytes(Object.fromEntries(Object.entries(d).reverse())),accountWitnessBytes(d));
 for(const patch of [{extra:true},{accountState:'allow'},{issuedAt:'bad'},{head:zero,acknowledged:tip([one])},{scope:{...scope,controlProjectRef:scope.memberProjectRef}}])assert.throws(()=>accountWitnessBytes({...d,...patch}));
});
test('authority and reader default closed without signing or making any read',async()=>{
 let calls=0;const a=createAccountAuthority({signBytes:()=>calls++}),r=createAccountStatusReader({readWitness:()=>calls++});assert.equal((await a.issue(request)).state,'unavailable');assert.equal((await r.review(tag)).state,'unavailable');assert.equal(calls,0);a.close();r.close();
});
test('configuration requires externally supplied separate head/ack pins and pinned key/scope',()=>{
 for(const options of [{minimum:undefined},{minimum:{head:zero,acknowledged:tip([one])}},{verificationKey:'0'.repeat(64)},{scope:{...scope,controlProjectRef:scope.journalProjectRef}},{timeoutMs:3501}])assert.throws(()=>fixture(options));
});
test('authority reads both domains before and after a verified signature',async()=>{
 const f=fixture(),r=await f.authority.issue(request);assert.equal(r.state,'signed');assert.deepEqual(f.calls,['history','ack','sign','history','ack']);const v=JSON.parse(r.bytes);assert.equal(v.decision.accountState,'admission_acknowledged');assert.equal(v.decision.subject,tag);f.authority.close();
});
test('reader independently verifies full chain and exposes no authentication/erasure permission',async()=>{
 const f=fixture(),r=reader(f),view=await r.value.review(tag);assert.equal(view.state,'verified_account_evidence');assert.deepEqual(view.check(tag),{state:'admission_acknowledged',authorization:'not_established',erasure:'not_established'});assert.equal(view.check(other).state,'invalid');assert.ok(!('allow' in view));view.close();assert.equal(view.state,'unavailable');r.value.close();f.authority.close();
});
test('all account states remain distinct, including pending removal before acknowledgement',async()=>{
 for(const [rows,ack,state] of [[[],zero,'not_admitted'],[[one],zero,'admission_pending'],[[one,two],tip([one]),'removal_pending'],[[one,two],tip([one,two]),'removal_acknowledged']]){
  const f=fixture({rows,ack}),r=reader(f,{rows}),v=await r.value.review(tag);assert.equal(v.check(tag).state,state);r.value.close();f.authority.close();
 }
});
test('removal or ack change during signing discards the response and latches unavailable',async()=>{
 for(const kind of ['history','ack']){
  let changed=false;const f=fixture({source:()=>snapshot(changed&&kind==='history'?[one,two]:[one]),ackRead:()=>changed&&kind==='ack'?tip([one]):zero,signer:b=>{changed=true;return sign(null,b,pair.privateKey);}});
  assert.equal((await f.authority.issue(request)).state,'unavailable');const count=f.calls.length;assert.equal((await f.authority.issue(request)).state,'unavailable');assert.equal(f.calls.length,count);f.authority.close();
 }
});
test('authority remembers unacknowledged head and refuses its rollback even while ack remains genesis',async()=>{
 let rows=[one,two];const f=fixture({source:()=>snapshot(rows),ack:zero});assert.equal((await f.authority.issue(request)).state,'signed');rows=[one];assert.equal((await f.authority.issue({...request,challenge:other})).state,'unavailable');f.authority.close();
});
test('protected pins reject fresh authority construction over rolled-back history or acknowledgement',async()=>{
 for(const options of [{minimum:{head:tip([one,two]),acknowledged:zero}},{minimum:{head:tip([one]),acknowledged:tip([one])},ack:zero}]){const f=fixture(options);assert.equal((await f.authority.issue(request)).state,'unavailable');assert.ok(!f.calls.includes('sign'));f.authority.close();}
});
test('wrong signer, thrown signer and partial signatures never produce evidence',async()=>{
 const wrong=generateKeyPairSync('ed25519');for(const signer of [b=>sign(null,b,wrong.privateKey),()=>Buffer.alloc(63),()=>{throw Error('PRIVATE');}]){const f=fixture({signer});assert.deepEqual(await f.authority.issue(request),{state:'unavailable'});f.authority.close();}
});
test('tampered decision/signature and wrong subject or scope refuse before history fetch',async()=>{
 for(const mutate of [v=>v.decision.accountState='removal_acknowledged',v=>v.signature='f'.repeat(128),v=>v.decision.subject=other,v=>v.decision.scope.epoch='33333333-3333-4333-8333-333333333333']){
  const f=fixture(),r=reader(f,{readWitness:async r=>{const v=JSON.parse((await f.authority.issue(r)).bytes);mutate(v);return Buffer.from(JSON.stringify(v));}});assert.equal((await r.value.review(tag)).state,'unavailable');assert.deepEqual(r.calls,['witness']);r.value.close();f.authority.close();
 }
});
test('recorded response cannot replay for a new challenge or another reader boot',async()=>{
 const f=fixture();let saved;const a=reader(f,{readWitness:async r=>saved??=(await f.authority.issue(r)).bytes});const first=await a.value.review(tag);assert.equal(first.state,'verified_account_evidence');assert.equal((await a.value.review(tag)).state,'unavailable');assert.equal(first.state,'unavailable');
 const b=reader(f,{readWitness:()=>saved});assert.equal((await b.value.review(tag)).state,'unavailable');assert.notEqual(a.last.bootId,b.last.bootId);a.value.close();b.value.close();f.authority.close();
});
test('signed invented account state fails independent full-chain interpretation',async()=>{
 const f=fixture(),r=reader(f,{readWitness:async r=>{const v=JSON.parse((await f.authority.issue(r)).bytes);v.decision.accountState='removal_acknowledged';v.signature=sign(null,accountWitnessBytes(v.decision),pair.privateKey).toString('hex');return Buffer.from(JSON.stringify(v));}});
 assert.equal((await r.value.review(tag)).state,'unavailable');r.value.close();f.authority.close();
});
test('new intent arriving before consumer snapshot refuses the older signed head',async()=>{
 const f=fixture(),r=reader(f,{rows:[one,two]});assert.equal((await r.value.review(tag)).state,'unavailable');r.value.close();f.authority.close();
});
test('signed head or ack rollback/fork refuses at pinned reader before records are trusted',async()=>{
 const f=fixture();for(const minimum of [{head:tip([one,two]),acknowledged:zero},{head:{sequence:1,sha256:'f'.repeat(64)},acknowledged:zero},{head:tip([one]),acknowledged:tip([one])}]){
  const g=fixture({ack:zero}),r=reader(g,{minimum});assert.equal((await r.value.review(tag)).state,'unavailable');r.value.close();g.authority.close();
 }f.authority.close();
});
test('malformed, oversized or invalid UTF8 envelopes refuse without caller-visible detail',async()=>{
 for(const bytes of [Buffer.alloc(8193),Buffer.from([255]),Buffer.from('{}'),Buffer.from('{')]){const f=fixture(),r=reader(f,{readWitness:()=>bytes});assert.deepEqual(await r.value.review(tag),{state:'unavailable'});r.value.close();f.authority.close();}
});
test('view expires on clock age, next review, parent cancellation and reader close',async()=>{
 const f=fixture(),r=reader(f),c=new AbortController(),first=await r.value.review(tag,{signal:c.signal});c.abort();assert.equal(first.state,'unavailable');
 const second=await r.value.review(tag);const now=Date.now;try{Date.now=()=>now()+6000;assert.equal(second.state,'unavailable');}finally{Date.now=now;}
 const third=await r.value.review(tag);r.value.close();assert.equal(third.state,'unavailable');f.authority.close();
});
test('transport mutation cannot change the locally bound request',async()=>{
 const f=fixture(),r=reader(f,{readWitness:async q=>{q.subject=other;return (await f.authority.issue(q)).bytes;}});assert.equal((await r.value.review(tag)).state,'unavailable');r.value.close();f.authority.close();
});
test('deadline/cancellation discards late signer completion with no overlapping retry',async()=>{
 let finish;const f=fixture({timeoutMs:100,signer:b=>new Promise(r=>{finish=()=>r(sign(null,b,pair.privateKey));})});assert.equal((await f.authority.issue(request)).state,'unavailable');finish();assert.equal((await f.authority.issue(request)).state,'unavailable');f.authority.close();
 const c=new AbortController(),g=fixture();c.abort();assert.equal((await g.authority.issue(request,{signal:c.signal})).state,'cancelled');assert.equal(g.calls.length,0);g.authority.close();
});
