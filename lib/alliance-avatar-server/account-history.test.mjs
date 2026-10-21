import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {accountSubject,accountEvent,accountRecord,reviewAccountHistory} from './account-history.mjs';

const ZERO='0'.repeat(64),genesis={sequence:0,sha256:ZERO};
const scope={memberProjectRef:'a'.repeat(20),journalProjectRef:'b'.repeat(20),epoch:'ffffffff-ffff-4fff-8fff-ffffffffffff'};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const subject=n=>accountSubject({memberProjectRef:scope.memberProjectRef,epoch:scope.epoch,authUserId:id(n)});
function append(rows,kind,tag=subject(1),s=scope){
  return [...rows,accountRecord({scope:s,sequence:rows.length+1,previous:rows.at(-1)?.sha256??ZERO,event:accountEvent({kind,subject:tag})})];
}
const tip=rows=>rows.length?{sequence:rows.length,sha256:rows.at(-1).sha256}:{...genesis};
const review=(rows,ack=tip(rows),minimum=genesis)=>reviewAccountHistory({scope,records:rows,head:tip(rows),acknowledged:ack,minimum});
const rejects=fn=>assert.throws(fn,{message:'alliance_account_history_unavailable'});
const admitted=append([],'account_admitted');
const removed=append(admitted,'account_remove_requested');

test('canonical subject uses a fixed, separately scoped preimage without retaining the Auth ID',()=>{
  const expected=createHash('sha256').update('GF-ALLIANCE-ACCOUNT-SUBJECT-V1\0'+JSON.stringify({memberProjectRef:scope.memberProjectRef,epoch:scope.epoch,authUserId:id(1)})).digest('hex');
  assert.equal(subject(1),expected);assert.match(subject(1),/^[0-9a-f]{64}$/);
  assert.notEqual(subject(1),accountSubject({memberProjectRef:'c'.repeat(20),epoch:scope.epoch,authUserId:id(1)}));
  assert.notEqual(subject(1),accountSubject({memberProjectRef:scope.memberProjectRef,epoch:id(2),authUserId:id(1)}));
  assert.notEqual(subject(1),subject(2));assert.ok(!JSON.stringify(removed).includes(id(1)));
});
test('strict subject shape rejects email, profile, unknown fields and malformed identity',()=>{
  const value={memberProjectRef:scope.memberProjectRef,epoch:scope.epoch,authUserId:id(1)};
  for(const patch of [{authUserId:'owner@example.invalid'},{authUserId:id(1).toUpperCase().replace('4000','ABCD')},{memberProjectRef:'bad'},{profileId:id(2)}])rejects(()=>accountSubject({...value,...patch}));
  rejects(()=>accountSubject({...value,email:'owner@example.invalid'}));
});
test('event IDs are stable by subject/kind and separated from content history',()=>{
  assert.deepEqual(accountEvent({subject:subject(1),kind:'account_admitted'}),admitted[0].event);
  assert.notEqual(admitted[0].event.id,removed[1].event.id);
  rejects(()=>accountEvent({kind:'profile_remove_requested',subject:subject(1)}));
  rejects(()=>accountEvent({kind:'account_admitted',subject:subject(1),id:ZERO}));
});
test('canonical record ignores field insertion order but rejects extra keys and forged event IDs',()=>{
  const row=admitted[0];
  assert.deepEqual(accountRecord({event:{subject:row.event.subject,kind:row.event.kind,id:row.event.id},previous:ZERO,sequence:1,scope:{epoch:scope.epoch,journalProjectRef:scope.journalProjectRef,memberProjectRef:scope.memberProjectRef}}),row);
  rejects(()=>accountRecord({scope,sequence:1,previous:ZERO,event:{...row.event,id:ZERO}}));
  rejects(()=>accountRecord({scope,sequence:1,previous:ZERO,event:row.event,format:1}));
});
test('no profile is needed to admit or record an account removal',()=>{
  assert.equal(review(admitted).check(subject(1)).state,'admission_acknowledged');
  assert.equal(review(removed).check(subject(1)).state,'removal_acknowledged');
});
test('unacknowledged admission stays pending and supplies no permission',()=>{
  assert.deepEqual(review(admitted,genesis).check(subject(1)),{state:'admission_pending',authorization:'not_established',erasure:'not_established'});
});
test('durable removal intent denies before independent acknowledgement; acknowledgement is not erasure',()=>{
  assert.equal(review(removed,tip(admitted)).check(subject(1)).state,'removal_pending');
  assert.deepEqual(review(removed).check(subject(1)),{state:'removal_acknowledged',authorization:'not_established',erasure:'not_established'});
});
test('an unknown or separately consented new Auth identity never inherits old admission',()=>{
  assert.equal(review(removed).check(subject(2)).state,'not_admitted');
  const rows=append(removed,'account_admitted',subject(2));
  assert.equal(review(rows).check(subject(1)).state,'removal_acknowledged');
  assert.equal(review(rows).check(subject(2)).state,'admission_acknowledged');
});
test('removal without admission, duplicate admissions/removals and re-admission refuse',()=>{
  rejects(()=>review(append([],'account_remove_requested')));
  rejects(()=>review(append(admitted,'account_admitted')));
  rejects(()=>review(append(removed,'account_remove_requested')));
  rejects(()=>review(append(removed,'account_admitted')));
});
test('older member copy is blocked by current independent account history',()=>{
  const restoredIdentity=accountSubject({memberProjectRef:scope.memberProjectRef,epoch:scope.epoch,authUserId:id(1)});
  assert.equal(review(removed,tip(removed),tip(removed)).check(restoredIdentity).state,'removal_acknowledged');
});
test('restored history below protected minimum or acknowledged floor refuses',()=>{
  rejects(()=>review(admitted,tip(admitted),tip(removed)));
  rejects(()=>reviewAccountHistory({scope,records:admitted,head:tip(admitted),acknowledged:tip(removed),minimum:genesis}));
});
test('same-length fork refuses the independently protected prefix',()=>{
  const other=append([],'account_admitted',subject(2));
  rejects(()=>review(other,tip(other),tip(admitted)));
});
test('forked acknowledged point and missing prefix refuse even when head is consistent',()=>{
  rejects(()=>review(removed,{sequence:1,sha256:'f'.repeat(64)}));
  rejects(()=>review([removed[1]]));
});
test('cross-member, cross-journal and cross-epoch histories refuse',()=>{
  for(const patch of [{memberProjectRef:'c'.repeat(20)},{journalProjectRef:'c'.repeat(20)},{epoch:id(2)}]){
    const rows=append([],'account_admitted',subject(1),{...scope,...patch});rejects(()=>review(rows));
  }
});
test('tampered, truncated, reordered and surplus records refuse',()=>{
  const changed=structuredClone(removed);changed[0].event.subject=subject(2);rejects(()=>review(changed));
  rejects(()=>reviewAccountHistory({scope,records:admitted,head:tip(removed),acknowledged:tip(removed),minimum:genesis}));
  rejects(()=>review([...removed].reverse()));rejects(()=>review([...removed,removed[1]]));
});
test('bounded admissions reserve every later removal, even when all admissions arrive first',()=>{
  let rows=[];for(let n=1;n<=128;n++)rows=append(rows,'account_admitted',subject(n));
  assert.deepEqual(review(rows).capacity,{accounts:128,remainingAdmissions:0,reservedRemovals:128});
  rejects(()=>review(append(rows,'account_admitted',subject(129))));
  for(let n=1;n<=128;n++)rows=append(rows,'account_remove_requested',subject(n));
  const evidence=review(rows);assert.equal(rows.length,256);assert.equal(evidence.capacity.reservedRemovals,0);
  for(let n=1;n<=128;n++)assert.equal(evidence.check(subject(n)).state,'removal_acknowledged');
  rejects(()=>append(rows,'account_admitted',subject(129)));
});
test('genesis is empty only, points are mandatory and ordering is checked',()=>{
  assert.equal(review([]).check(subject(1)).state,'not_admitted');
  const v={scope,records:[],head:genesis,acknowledged:genesis,minimum:genesis};
  for(const key of ['head','acknowledged','minimum']){const copy={...v};delete copy[key];rejects(()=>reviewAccountHistory(copy));}
  for(const patch of [{head:{sequence:0,sha256:'f'.repeat(64)}},{minimum:{sequence:-1,sha256:ZERO}},{acknowledged:{sequence:257,sha256:ZERO}},{head:{sequence:0.5,sha256:ZERO}}])rejects(()=>reviewAccountHistory({...v,...patch}));
});
test('inputs cannot mutate an issued evidence view or its exposed points',()=>{
  const rows=structuredClone(removed),ack=tip(rows),evidence=review(rows,ack);
  rows.length=0;ack.sequence=0;
  assert.equal(evidence.check(subject(1)).state,'removal_acknowledged');
  assert.throws(()=>{evidence.acknowledged.sequence=0;},TypeError);
  assert.throws(()=>{evidence.capacity.reservedRemovals=123;},TypeError);
  rejects(()=>evidence.check(id(1)));
});
test('plain self-consistent input only verifies structure, never authenticity or current availability',()=>{
  const evidence=review(admitted);
  assert.equal(evidence.state,'verified_structure');
  assert.equal(evidence.check(subject(1)).authorization,'not_established');
  assert.ok(!('allow' in evidence));assert.ok(!('erase' in evidence));assert.ok(!('write' in evidence));
});
