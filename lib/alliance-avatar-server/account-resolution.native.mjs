// Confirmed disposable TLS account stores only. Checkpoint slot/receipt are
// synthetic in-memory capabilities here, NOT independent production custody.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {accountEvent,accountSubject} from './account-history.mjs';
import {accountHandoffBytes} from './account-handoff.mjs';
import {createAccountCheckpoint} from './account-checkpoint.mjs';
export async function accountResolutionNative({history,ack,historyAdmin,ackAdmin,scope,lossyHistory,lossyAck}){
 if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture')throw Error('Wrong account resolution fixture');
 const before=await history.snapshot(),oldAck=await ack.read(),instances=[],fullScope={...scope,controlProjectRef:'opqrstuvwxyzabcdefgh'},verificationKey='b'.repeat(64),sha=b=>createHash('sha256').update(b).digest('hex');
 assert.equal(before.head.sequence,3);assert.deepEqual(oldAck,before.head);
 const live=before.records[2].event.subject,event=accountEvent({kind:'account_remove_requested',subject:live});
 const subject=n=>accountSubject({memberProjectRef:scope.memberProjectRef,epoch:scope.epoch,authUserId:`99999999-9999-4999-8999-${String(n).padStart(12,'0')}`});
 function capsule(head,acknowledged){
  let bytes=accountHandoffBytes({format:1,scope:fullScope,generation:1,previousSha256:'0'.repeat(64),verificationKey,minimum:{head,acknowledged},pending:null}),r={generation:1,sha256:sha(bytes)};const minimum={...r};
  const slot={read:async()=>({bytes:Buffer.from(bytes),receipt:{generation:JSON.parse(bytes).generation,sha256:sha(bytes)}}),compareAndSet:async q=>{if(q.expected.sha256!==sha(bytes))return {state:'conflict',receipt:{generation:JSON.parse(bytes).generation,sha256:sha(bytes)}};bytes=Buffer.from(q.bytes);return {state:'committed',receipt:{generation:JSON.parse(bytes).generation,sha256:sha(bytes)}};}};
  const anchor={read:async()=>({...r}),advance:async q=>{if(q.expected.sha256!==r.sha256)return {state:'conflict',receipt:{...r}};r={...q.next};return {state:'committed',receipt:{...r}};}};
  return {make:extra=>{const c=createAccountCheckpoint({enabled:true,reconciliationEnabled:true,scope:fullScope,verificationKey,minimum,slot,anchor,history,acknowledgements:ack,...extra});instances.push(c);return c;},get record(){return JSON.parse(bytes);}};
 }
 const restore=()=>{
  historyAdmin(`begin;set local role alliance_account_owner;delete from alliance_account.entries where sequence>${before.head.sequence};update alliance_account.history_control set sequence=${before.head.sequence},sha256='${before.head.sha256}';commit;`);
  ackAdmin(`update alliance_account.ack_control set sequence=${oldAck.sequence},sha256='${oldAck.sha256}';`);
 };
 try{
  const one=capsule(before.head,oldAck),p={id:'c'.repeat(64),kind:'history_append',event,expected:before.head,target:null};
  assert.equal((await one.make({history:lossyHistory}).execute(p)).state,'unknown');
  const removed=await history.snapshot();assert.equal(removed.head.sequence,4);
  assert.equal((await one.make().reconcile()).outcome,'effect_satisfied');assert.equal(one.record.format,2);assert.deepEqual(one.record.resolution.pending,p);
  const replay=await history.append({event,expected:before.head});assert.equal(replay.state,'recorded');assert.deepEqual((await history.snapshot()).head,removed.head);
  console.log('PASS actual lost append COMMIT resolves only its observed canonical effect through v2 evidence in synthetic checkpoint memory; late original append is idempotent with no duplicate record or serving permission');
  const two=capsule(removed.head,oldAck),a={id:'d'.repeat(64),kind:'acknowledgement_advance',event:null,expected:oldAck,target:removed.head};
  assert.equal((await two.make({acknowledgements:lossyAck}).execute(a)).state,'unknown');assert.deepEqual(await ack.read(),removed.head);
  assert.equal((await two.make().reconcile()).outcome,'effect_satisfied');assert.deepEqual(two.record.resolution.guard,removed.head);
  assert.equal((await ack.advance({records:removed.records,head:removed.head,expected:oldAck})).state,'conflict');assert.deepEqual(await ack.read(),removed.head);
  console.log('PASS actual lost acknowledgement COMMIT resolves its exact prefix effect without retry; late original expected-floor request conflicts and cannot lower or repeat the durable acknowledgement');
  const requested=accountEvent({kind:'account_admitted',subject:subject(1)}),third=capsule(removed.head,removed.head),delayed={...history,append:async()=>{throw Error('synthetic_not_dispatched');}},q={id:'e'.repeat(64),kind:'history_append',event:requested,expected:removed.head,target:null};
  assert.equal((await third.make({history:delayed}).execute(q)).state,'unknown');assert.equal((await third.make().reconcile()).state,'pending');
  const changed=await history.append({event:accountEvent({kind:'account_admitted',subject:subject(2)}),expected:removed.head});assert.equal(changed.head.sequence,5);
  assert.equal((await third.make().reconcile()).outcome,'superseded');assert.deepEqual(third.record.resolution.guard,changed.head);
  assert.equal((await history.append({event:requested,expected:removed.head})).state,'conflict');assert.equal((await history.snapshot()).records.some(r=>r.event.id===requested.id),false);
  console.log('PASS unchanged actual history tip keeps an absent append unresolved; a different committed successor displaces its original CAS and late request conflicts without creating the missing account admission');
  const next=await history.append({event:accountEvent({kind:'account_admitted',subject:subject(3)}),expected:changed.head}),snapshot=await history.snapshot(),fourth=capsule(next.head,removed.head),ackIntent={id:'f'.repeat(64),kind:'acknowledgement_advance',event:null,expected:removed.head,target:next.head},delayedAck={...ack,advance:async()=>{throw Error('synthetic_not_dispatched');}};
  assert.equal((await fourth.make({acknowledgements:delayedAck}).execute(ackIntent)).state,'unknown');assert.equal((await fourth.make().reconcile()).state,'pending');
  assert.equal((await ack.advance({records:snapshot.records.slice(0,5),head:changed.head,expected:removed.head})).state,'acknowledged');
  assert.equal((await fourth.make().reconcile()).outcome,'superseded');assert.deepEqual(fourth.record.resolution.guard,changed.head);
  assert.equal((await ack.advance({records:snapshot.records,head:next.head,expected:removed.head})).state,'conflict');assert.deepEqual(await ack.read(),changed.head);
  console.log('PASS actual intermediate acknowledgement supersedes a staged larger advance; late original CAS cannot jump to its target and reconciliation itself performs no business mutation');
 }finally{for(const c of instances)c.close();restore();}
 assert.deepEqual(await history.snapshot(),before);assert.deepEqual(await ack.read(),oldAck);
 console.log('PASS exact synthetic resolution records and acknowledgement changes restored to the surrounding TLS fixture baseline; coordinators closed with no SQL, hosted, real custody, account route or public activation');
}
