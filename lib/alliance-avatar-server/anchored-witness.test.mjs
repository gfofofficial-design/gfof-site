import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createAnchoredJournalWitness} from './anchored-witness.mjs';
import {createAnchoredControlAuthority} from './control-authority.mjs';
import {controlPolicySha256} from './control-policy.mjs';
import {journalFixture,projectRef,epoch,other,zero} from './deletion-journal.fixture.mjs';
const journalProjectRef='uvwxyzabcdefghijklmn',scope={memberProjectRef:projectRef,journalProjectRef,epoch};
const point=(sequence,sha256)=>({format:1,...scope,sequence,sha256});
const request={challenge:'a'.repeat(64)};
function fixture({anchor,read,signer,options={}}={}){
 const j=journalFixture(),calls=[],a=anchor||point(1,j.history[0].sha256);
 const witness=createAnchoredJournalWitness({enabled:true,projectRef,journalProjectRef,epoch,minimum:{sequence:0,sha256:zero},verificationKey:j.verificationKey,signBytes:signer||j.signBytes,anchorStore:{read:async o=>{calls.push('anchor');return read?read(o,calls.length):structuredClone(a);}},store:{tip:async()=>{calls.push('tip');return {projectRef,epoch,sequence:j.history.length,sha256:j.history.at(-1)?.sha256||zero,enabled:true};},records:async()=>{calls.push('records');return structuredClone(j.history);}},...options});return {witness,j,calls,a};
}
test('anchored witness defaults off and invalid challenges cause no reads',async()=>{
 for(const enabled of [undefined,false,'true']){const f=fixture({options:{enabled}});assert.deepEqual(await f.witness.issue(request),{state:'unavailable'});assert.deepEqual(f.calls,[]);}
 const f=fixture();assert.deepEqual(await f.witness.issue({...request,extra:true}),{state:'invalid'});assert.deepEqual(f.calls,[]);assert.throws(()=>fixture({options:{anchorStore:{}}}));
});
test('fresh cryptographic witness reads live independent floor around full signed history',async()=>{
 const f=fixture(),r=await f.witness.issue(request);assert.equal(r.state,'signed');assert.equal(JSON.parse(r.bytes).anchor.sha256,f.a.sha256);assert.deepEqual(f.calls,['anchor','tip','records','tip','anchor']);f.witness.close();
});
test('new process with genesis configuration refuses a journal restored below durable anchor',async()=>{
 const f=fixture();f.j.history.length=0;assert.deepEqual(await f.witness.issue(request),{state:'unavailable'});assert.deepEqual(f.calls,['anchor','tip']);
});
test('forked independent floor and scope or availability errors cannot sign a witness',async()=>{
 for(const anchor of [point(1,'f'.repeat(64)),{...point(0,zero),epoch:other}]){const f=fixture({anchor});assert.deepEqual(await f.witness.issue(request),{state:'unavailable'});}
 const f=fixture({read:()=>{throw Error('PRIVATE');}});assert.deepEqual(await f.witness.issue(request),{state:'unavailable'});assert.deepEqual(f.calls,['anchor']);
});
test('anchor movement during signing discards an otherwise valid journal signature',async()=>{
 const f=fixture({read:(o,n)=>n===1?f.a:point(2,'f'.repeat(64))});assert.deepEqual(await f.witness.issue(request),{state:'unavailable'});assert.deepEqual(await f.witness.issue(request),{state:'unavailable'});
});
test('late anchor cannot start a journal query after cancellation',async()=>{
 let release;const f=fixture({read:()=>new Promise(r=>release=r)}),c=new AbortController(),pending=f.witness.issue(request,{signal:c.signal});await new Promise(r=>setImmediate(r));c.abort();assert.deepEqual(await pending,{state:'unavailable'});release(f.a);await new Promise(r=>setImmediate(r));assert.deepEqual(f.calls,['anchor']);
});
function authority(state,anchorSequence=1){
 const pair=generateKeyPairSync('ed25519'),verificationKey=Buffer.from(pair.publicKey.export({format:'jwk'}).x,'base64url').toString('hex');
 const raw={format:1,...scope,revision:2,state,changeId:other,freezeId:other,frozenAt:'2026-01-01T00:00:00.000Z',checkpointSha256:'e'.repeat(64),floor:{sequence:0,sha256:zero}};const policy={...raw,sha256:controlPolicySha256(raw)};let signs=0;
 const a=createAnchoredControlAuthority({enabled:true,...scope,verificationKey,minimum:{revision:2,sha256:policy.sha256,floor:raw.floor},store:{read:async()=>policy},anchorStore:{read:async()=>point(anchorSequence,anchorSequence?'f'.repeat(64):zero)},signBytes:bytes=>{signs++;return sign(null,bytes,pair.privateKey);}});
 return {a,get signs(){return signs;},request:{format:1,...scope,bootId:'a'.repeat(64),challenge:'b'.repeat(64)}};
}
test('fresh startup review cannot use a policy older than the live removal floor',async()=>{const f=authority('review');assert.deepEqual(await f.a.issue(f.request),{state:'unavailable'});assert.equal(f.signs,0);});
test('existing serving baseline can remain stable while independent live floor advances',async()=>{const f=authority('serve');assert.equal((await f.a.issue(f.request)).state,'signed');assert.equal(f.signs,1);});
test('matching reviewed floor remains eligible for fresh signed recovery review',async()=>{const f=authority('review',0);assert.equal((await f.a.issue(f.request)).state,'signed');});
