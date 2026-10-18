// Restart evidence only. No disk, cloud, credentials, mutation dispatch or trust
// installation. The latest digest/generation must survive OUTSIDE restored data.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {accountEvent,accountRecord,reviewAccountHistory} from './account-history.mjs';
import {controlExact as exact,controlHash as hash,controlRef as ref,controlUuid as uuid} from './control-policy.mjs';
const ZERO='0'.repeat(64),MAX_GENERATION=2147483646,fail=()=>Error('alliance_account_handoff_unavailable');
const keys=['memberProjectRef','journalProjectRef','controlProjectRef','epoch'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function scope(v){
 if(!exact(v,keys)||!keys.every(k=>k==='epoch'?uuid(v[k]):ref(v[k]))||new Set(keys.slice(0,3).map(k=>v[k])).size!==3)throw fail();
 return Object.fromEntries(keys.map(k=>[k,v[k]]));
}
function point(v){
 if(!exact(v,['sequence','sha256'])||!Number.isSafeInteger(v.sequence)||v.sequence<0||v.sequence>256||!hash(v.sha256)||(v.sequence===0)!==(v.sha256===ZERO))throw fail();
 return {sequence:v.sequence,sha256:v.sha256};
}
function pins(v){
 if(!exact(v,['head','acknowledged']))throw fail();const head=point(v.head),acknowledged=point(v.acknowledged);
 if(acknowledged.sequence>head.sequence||acknowledged.sequence===head.sequence&&acknowledged.sha256!==head.sha256)throw fail();return {head,acknowledged};
}
function pending(v){
 if(v===null)return null;
 if(!exact(v,['id','kind','event','expected','target'])||!hash(v.id)||v.id===ZERO)throw fail();
 const expected=point(v.expected);let event=null,target=null;
 if(v.kind==='history_append'){
  if(!exact(v.event,['id','kind','subject'])||v.target!==null)throw fail();event=accountEvent({kind:v.event.kind,subject:v.event.subject});if(!isDeepStrictEqual(event,v.event))throw fail();
 }else if(v.kind==='acknowledgement_advance'){
  if(v.event!==null)throw fail();target=point(v.target);if(target.sequence<expected.sequence||target.sequence===expected.sequence&&target.sha256!==expected.sha256)throw fail();
 }else throw fail();
 return {id:v.id,kind:v.kind,event,expected,target};
}
function body(v){
 if(!exact(v,['format','scope','generation','previousSha256','verificationKey','minimum','pending'])||v.format!==1||!Number.isSafeInteger(v.generation)||v.generation<1||v.generation>MAX_GENERATION||!hash(v.previousSha256)||(v.generation===1)!==(v.previousSha256===ZERO)||!hash(v.verificationKey)||v.verificationKey===ZERO)throw fail();
 return {format:1,scope:scope(v.scope),generation:v.generation,previousSha256:v.previousSha256,verificationKey:v.verificationKey,minimum:pins(v.minimum),pending:pending(v.pending)};
}
export function accountHandoffBytes(value){try{return Buffer.from(JSON.stringify(body(value))+'\n');}catch{throw fail();}}
export function reviewAccountHandoff({bytes,expectedSha256,expectedScope,expectedVerificationKey,minimumGeneration}={}){
 try{
  if(!(bytes instanceof Uint8Array)||bytes.byteLength<1||bytes.byteLength>4096||!hash(expectedSha256)||!hash(expectedVerificationKey)||expectedVerificationKey===ZERO||!Number.isSafeInteger(minimumGeneration)||minimumGeneration<1||minimumGeneration>MAX_GENERATION)throw fail();
  const copy=Buffer.from(bytes),s=scope(expectedScope);
  if(sha(copy)!==expectedSha256)throw fail();const record=body(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(copy)));
  if(!accountHandoffBytes(record).equals(copy)||record.generation<minimumGeneration||!isDeepStrictEqual(record.scope,s)||record.verificationKey!==expectedVerificationKey)throw fail();
  // Fresh copies only; callers cannot mutate the parsed record through inputs.
  return record;
 }catch{throw fail();}
}
// Review a proposed successor, not a CAS/installer or receipt of persistence.
// Pending work is sticky, even after its event appears committed. Reconciliation
// and a protected-store transaction remain separate, deliberately absent gates.
export function reviewAccountHandoffSuccessor({previousBytes,previousSha256,nextBytes,nextSha256,expectedScope,expectedVerificationKey,minimumGeneration,records}={}){
 try{
  const shared={expectedScope,expectedVerificationKey,minimumGeneration},before=reviewAccountHandoff({...shared,bytes:previousBytes,expectedSha256:previousSha256}),after=reviewAccountHandoff({...shared,bytes:nextBytes,expectedSha256:nextSha256});
  if(after.generation!==before.generation+1||after.previousSha256!==previousSha256||before.pending!==null&&!isDeepStrictEqual(before.pending,after.pending))throw fail();
  const s={memberProjectRef:after.scope.memberProjectRef,journalProjectRef:after.scope.journalProjectRef,epoch:after.scope.epoch};
  // Check both head AND acknowledgement against one complete canonical chain;
  // an unacknowledged removal must survive restart as well as acknowledged work.
  reviewAccountHistory({scope:s,records,head:after.minimum.head,acknowledged:after.minimum.head,minimum:before.minimum.head});
  reviewAccountHistory({scope:s,records,head:after.minimum.head,acknowledged:after.minimum.acknowledged,minimum:before.minimum.acknowledged});
  if(before.pending===null&&after.pending!==null){
   // A pending intent must be recorded in its own generation BEFORE dispatch,
   // not combined with a guessed successful result or a changed read floor.
   if(!isDeepStrictEqual(before.minimum,after.minimum))throw fail();const p=after.pending;
   if(p.kind==='history_append'){
    if(!isDeepStrictEqual(p.expected,before.minimum.head))throw fail();
    if(records.some(r=>r.event.id===p.event.id))throw fail();
    // Validate admission/removal ordering and reserved lifetime capacity too.
    // Actual append remains conditional on the server's current expected tip.
    if(p.expected.sequence===256)throw fail();
    const candidate=accountRecord({scope:s,sequence:p.expected.sequence+1,previous:p.expected.sha256,event:p.event});
    reviewAccountHistory({scope:s,records:[...records,candidate],head:{sequence:candidate.sequence,sha256:candidate.sha256},acknowledged:before.minimum.acknowledged,minimum:before.minimum.acknowledged});
   }else if(!isDeepStrictEqual(p.expected,before.minimum.acknowledged)||!isDeepStrictEqual(p.target,before.minimum.head))throw fail();
  }
  return after;
 }catch{throw fail();}
}
