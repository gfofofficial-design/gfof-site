// Pure conditional-effect reconciliation. No retry, mutation, physical erasure,
// authentication or attribution of which caller committed an observed effect.
// Safe only with the reviewed monotonic/CAS/idempotent account-store-v1 contract.
import {isDeepStrictEqual} from 'node:util';
import {reviewAccountHistory} from './account-history.mjs';
import {accountHandoffBytes,reviewAccountHandoff} from './account-handoff.mjs';
import {createHash} from 'node:crypto';
const fail=()=>Error('alliance_account_resolution_unavailable'),sha=b=>createHash('sha256').update(b).digest('hex'),zero={sequence:0,sha256:'0'.repeat(64)};
const pointAt=(rows,n)=>n===0?zero:{sequence:n,sha256:rows[n-1]?.sha256};
function checked(record,records,minimum){
 const s={memberProjectRef:record.scope.memberProjectRef,journalProjectRef:record.scope.journalProjectRef,epoch:record.scope.epoch};
 reviewAccountHistory({scope:s,records,head:minimum.head,acknowledged:minimum.head,minimum:record.minimum.head});
 reviewAccountHistory({scope:s,records,head:minimum.head,acknowledged:minimum.acknowledged,minimum:record.minimum.acknowledged});
}
// Structural derivation only: the coordinator must first authenticate record and
// current stores against independently retained scope/key/digest/generation.
export function deriveAccountResolution({record,records,minimum}={}){
 try{
  accountHandoffBytes(record);accountHandoffBytes({...record,minimum});checked(record,records,minimum);const p=record.pending;if(p===null)return {state:'no_pending'};
  if(p.expected.sequence>record.minimum.head.sequence||!isDeepStrictEqual(pointAt(records,p.expected.sequence),p.expected))throw fail();
  let outcome,guard;
  if(p.kind==='history_append'){
   const found=records.find(r=>r.event.id===p.event.id);
   if(found){
    if(found.sequence<=p.expected.sequence||!isDeepStrictEqual(found.event,p.event))throw fail();
    outcome='effect_satisfied';guard=pointAt(records,found.sequence);
   }else if(minimum.head.sequence>p.expected.sequence){outcome='superseded';guard=pointAt(records,p.expected.sequence+1);}
   else return {state:'pending'};
  }else{
   if(p.target.sequence>record.minimum.head.sequence||!isDeepStrictEqual(pointAt(records,p.target.sequence),p.target)||p.expected.sequence>record.minimum.acknowledged.sequence)throw fail();
   if(minimum.acknowledged.sequence>=p.target.sequence){outcome='effect_satisfied';guard={...p.target};}
   else if(minimum.acknowledged.sequence>p.expected.sequence){outcome='superseded';guard={...minimum.acknowledged};}
   else return {state:'pending'};
  }
  return {state:'resolvable',resolution:{pending:structuredClone(p),checkpointSha256:sha(accountHandoffBytes(record)),outcome,head:{...minimum.head},acknowledged:{...minimum.acknowledged},guard}};
 }catch{throw fail();}
}
// Different entry point from an ordinary successor. No supplied outcome flag or
// receipt can bypass deriving the narrow condition from complete current history.
export function reviewAccountResolutionSuccessor({previousBytes,previousSha256,nextBytes,nextSha256,expectedScope,expectedVerificationKey,minimumGeneration,records}={}){
 try{
  const shared={expectedScope,expectedVerificationKey,minimumGeneration},before=reviewAccountHandoff({...shared,bytes:previousBytes,expectedSha256:previousSha256}),after=reviewAccountHandoff({...shared,bytes:nextBytes,expectedSha256:nextSha256});
  if(after.format!==2||after.generation!==before.generation+1||after.previousSha256!==previousSha256||before.pending===null||after.pending!==null)throw fail();
  const result=deriveAccountResolution({record:before,records,minimum:after.minimum});
  if(result.state!=='resolvable'||!isDeepStrictEqual(result.resolution,after.resolution))throw fail();return after;
 }catch{throw fail();}
}
