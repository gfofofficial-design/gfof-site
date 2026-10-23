// Public configuration only. The expected digest/generation require independent
// protected custody; a digest read from the same restored archive is not trust.
import {createHash} from 'node:crypto';
import {controlExact as exact,controlHash as hash,controlRef as ref,controlUuid as uuid,controlPoint} from './control-policy.mjs';
import {removalChain} from './removal-anchor.mjs';
const ZERO='0'.repeat(64),fail=()=>Error('alliance_trust_unavailable');
const scopeKeys=['memberProjectRef','journalProjectRef','controlProjectRef','epoch'];
function scope(v){if(!scopeKeys.every(k=>k==='epoch'?uuid(v?.[k]):ref(v?.[k]))||new Set(scopeKeys.slice(0,3).map(k=>v[k])).size!==3)throw fail();return Object.fromEntries(scopeKeys.map(k=>[k,v[k]]));}
function body(v){
 if(!exact(v,['format',...scopeKeys,'generation','previousSha256','controlMinimum','removalMinimum','controlVerificationKey','journalVerificationKey'])||v.format!==1||!Number.isSafeInteger(v.generation)||v.generation<1||v.generation>2147483646||!hash(v.previousSha256)||(v.generation===1)!==(v.previousSha256===ZERO)||!hash(v.controlVerificationKey)||!hash(v.journalVerificationKey)||v.controlVerificationKey===ZERO||v.journalVerificationKey===ZERO||v.controlVerificationKey===v.journalVerificationKey)throw fail();
 const s=scope(v),p=v.controlMinimum;
 if(!exact(p,['revision','sha256','floor'])||!Number.isSafeInteger(p.revision)||p.revision<1||p.revision>2147483646||!hash(p.sha256)||p.sha256===ZERO)throw fail();
 const floor=controlPoint(p.floor),removalMinimum=controlPoint(v.removalMinimum);
 if(floor.sequence>removalMinimum.sequence||floor.sequence===removalMinimum.sequence&&floor.sha256!==removalMinimum.sha256)throw fail();
 return {format:1,...s,generation:v.generation,previousSha256:v.previousSha256,controlMinimum:{revision:p.revision,sha256:p.sha256,floor},removalMinimum,controlVerificationKey:v.controlVerificationKey,journalVerificationKey:v.journalVerificationKey};
}
export function allianceTrustRecordBytes(value){try{return Buffer.from(JSON.stringify(body(value))+'\n');}catch{throw fail();}}
export function allianceTrustRecord({bytes,expectedSha256,expectedScope,minimumGeneration}={}){
 try{
  if(!(bytes instanceof Uint8Array)||bytes.byteLength<1||bytes.byteLength>4096||!hash(expectedSha256)||!Number.isSafeInteger(minimumGeneration)||minimumGeneration<1||minimumGeneration>2147483646)throw fail();
  const copy=Buffer.from(bytes),s=scope(expectedScope);
  if(!exact(expectedScope,scopeKeys)||createHash('sha256').update(copy).digest('hex')!==expectedSha256)throw fail();
  const record=body(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(copy)));
  // Exact canonical bytes also reject duplicate JSON keys, BOMs and hidden fields.
  if(!allianceTrustRecordBytes(record).equals(copy)||record.generation<minimumGeneration||scopeKeys.some(k=>record[k]!==s[k]))throw fail();
  return record;
 }catch{throw fail();}
}
// Review aid, never an installer or automatic trust update. Both digests are
// explicit inputs; the new digest still needs separately authorized custody.
export function reviewAllianceTrustSuccessor({previousBytes,previousSha256,nextBytes,nextSha256,expectedScope,minimumGeneration,records}={}){
 try{
  const before=allianceTrustRecord({bytes:previousBytes,expectedSha256:previousSha256,expectedScope,minimumGeneration}),after=allianceTrustRecord({bytes:nextBytes,expectedSha256:nextSha256,expectedScope,minimumGeneration});
  if(after.generation!==before.generation+1||after.previousSha256!==previousSha256||after.controlMinimum.revision<before.controlMinimum.revision||after.controlMinimum.revision===before.controlMinimum.revision&&after.controlMinimum.sha256!==before.controlMinimum.sha256||after.controlMinimum.floor.sequence<before.controlMinimum.floor.sequence||after.controlVerificationKey===before.journalVerificationKey||after.journalVerificationKey===before.controlVerificationKey)throw fail();
  // One canonical chain must extend every old/new reviewed lower bound.
  for(const floor of [before.controlMinimum.floor,before.removalMinimum,after.controlMinimum.floor])removalChain(records,after.removalMinimum,expectedScope,floor);
  return after;
 }catch{throw fail();}
}
