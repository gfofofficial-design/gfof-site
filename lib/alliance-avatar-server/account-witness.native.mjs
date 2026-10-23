// Confirmed disposable account databases only. Ephemeral test signer in memory;
// no real key, account, credential lookup, route or running fleet configuration.
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createAccountAuthority,createAccountStatusReader} from './account-witness.mjs';
import {accountEvent} from './account-history.mjs';
export async function accountWitnessNative({history,ack,historyAdmin,ackAdmin,scope}){
 if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture')throw Error('Wrong account witness fixture');
 const before=await history.snapshot(),oldAck=await ack.read(),fullScope={...scope,controlProjectRef:'opqrstuvwxyzabcdefgh'},minimum={head:before.head,acknowledged:oldAck};
 assert.equal(before.head.sequence,3);assert.deepEqual(oldAck,before.head);
 const tags=before.records.filter(r=>r.event.kind==='account_admitted').map(r=>r.event.subject),removed=tags[0],live=tags[1];assert.equal(tags.length,2);
 const pair=generateKeyPairSync('ed25519'),key=Buffer.from(pair.publicKey.export({format:'jwk'}).x,'base64url').toString('hex'),instances=[];
 const authority=(extra={})=>{const v=createAccountAuthority({enabled:true,scope:fullScope,verificationKey:key,minimum,history,acknowledgements:ack,signBytes:b=>sign(null,b,pair.privateKey),...extra});instances.push(v);return v;};
 const reader=(a,extra={})=>{const v=createAccountStatusReader({enabled:true,scope:fullScope,verificationKey:key,minimum,readWitness:async(r,o)=>(await a.issue(r,o)).bytes,readHistory:o=>history.snapshot(o),...extra});instances.push(v);return v;};
 const restore=()=>{
  historyAdmin(`begin;set local role alliance_account_owner;delete from alliance_account.entries where sequence>${before.head.sequence};update alliance_account.history_control set sequence=${before.head.sequence},sha256='${before.head.sha256}';commit;`);
  ackAdmin(`update alliance_account.ack_control set sequence=${oldAck.sequence},sha256='${oldAck.sha256}';`);
 };
 try{
  const a=authority(),first=reader(a),second=reader(a);
  assert.equal((await first.review(removed)).check(removed).state,'removal_acknowledged');
  const originalView=await first.review(live);assert.equal(originalView.check(live).state,'admission_acknowledged');assert.equal(originalView.check(live).authorization,'not_established');
  assert.equal((await second.review(live)).check(live).state,'admission_acknowledged');
  console.log('PASS real TLS account stores compose with an ephemeral pinned signer and two independently challenged readers; removed and admitted subjects remain distinct evidence, never authorization');
  let saved;const replay=reader(a,{readWitness:async(r,o)=>saved??=(await a.issue(r,o)).bytes});
  const cachedView=await replay.review(live);assert.equal(cachedView.state,'verified_account_evidence');assert.equal((await replay.review(live)).state,'unavailable');assert.equal(cachedView.state,'unavailable');
  const otherBoot=reader(a,{readWitness:async()=>saved});assert.equal((await otherBoot.review(live)).state,'unavailable');
  console.log('PASS actual signed account response cannot replay for the next challenge or another reader boot; a new review invalidates its earlier view');
  let changed=false;const racing=authority({signBytes:async b=>{
   if(!changed){changed=true;const snap=await history.snapshot();assert.equal((await history.append({event:accountEvent({kind:'account_remove_requested',subject:live}),expected:snap.head})).state,'recorded');}
   return sign(null,b,pair.privateKey);
  }}),racingReader=reader(racing);
  assert.equal((await racingReader.review(live)).state,'unavailable');assert.equal((await racingReader.review(live)).state,'unavailable');
  const current=reader(a);assert.equal((await current.review(live)).check(live).state,'removal_pending');
  const latest=await history.snapshot();assert.equal(latest.head.sequence,4);
  assert.equal((await ack.advance({records:latest.records,head:latest.head,expected:oldAck})).state,'acknowledged');
  assert.equal((await current.review(live)).check(live).state,'removal_acknowledged');
  console.log('PASS committed removal during signing discards the in-flight response and latches that issuer closed; fresh reads deny the pending intent before its separate acknowledgement and retain denial afterward');
  const highMinimum={head:latest.head,acknowledged:latest.head};restore();
  assert.equal((await current.review(live)).state,'unavailable');
  const pinnedAuthority=authority({minimum:highMinimum}),pinnedReader=reader(pinnedAuthority,{minimum:highMinimum});assert.equal((await pinnedReader.review(live)).state,'unavailable');
  const rollbackAuthority=authority(),independentPin=reader(rollbackAuthority,{minimum:highMinimum});assert.equal((await independentPin.review(live)).state,'unavailable');
  console.log('PASS actual coherent history/ack rollback refuses both previously observing readers and fresh externally pinned issuer/consumer instances, without genesis or signature-only fallback');
 }finally{for(const v of instances)v.close();restore();}
 assert.deepEqual(await history.snapshot(),before);assert.deepEqual(await ack.read(),oldAck);
 console.log('PASS exact synthetic witness race records and floor changes are restored to the surrounding fixture baseline; all views close and no key file, hosted signer, account or public feature is created');
}
