// Default-off coordinator over TWO independent protected capabilities. No store
// construction, credentials, filesystem lookup, key installation or retry.
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {isDeepStrictEqual} from 'node:util';
import {accountRecord,reviewAccountHistory} from './account-history.mjs';
import {accountHandoffBytes,reviewAccountHandoff,reviewAccountHandoffSuccessor} from './account-handoff.mjs';
import {deriveAccountResolution,reviewAccountResolutionSuccessor} from './account-resolution.mjs';
import {controlExact as exact,controlHash as hash} from './control-policy.mjs';
const fail=()=>Error('alliance_account_checkpoint_unavailable'),sha=b=>createHash('sha256').update(b).digest('hex');
function receipt(v){if(!exact(v,['generation','sha256'])||!Number.isSafeInteger(v.generation)||v.generation<1||v.generation>2147483646||!hash(v.sha256)||v.sha256==='0'.repeat(64))throw fail();return {generation:v.generation,sha256:v.sha256};}
export function createAccountCheckpoint({enabled=false,reconciliationEnabled=false,scope,verificationKey,minimum,slot,anchor,history,acknowledgements,timeoutMs=8000}={}){
 if(typeof reconciliationEnabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>8000)throw fail();let pin;
 if(enabled===true){
  pin=receipt(minimum);scope=structuredClone(scope);
  // Reuse canonical record validation without introducing a bootstrap path.
  accountHandoffBytes({format:1,scope,generation:1,previousSha256:'0'.repeat(64),verificationKey,minimum:{head:{sequence:0,sha256:'0'.repeat(64)},acknowledged:{sequence:0,sha256:'0'.repeat(64)}},pending:null});
  if(![slot?.read,slot?.compareAndSet,anchor?.read,anchor?.advance,history?.snapshot,history?.append,acknowledgements?.read,acknowledgements?.advance].every(v=>typeof v==='function'))throw fail();
 }
 let closed=false,active=false,faulted=false;const running=new Set();
 async function operation(intent,write,{signal}={},resolve=false){
  if(enabled!==true||closed||faulted)return {state:'unavailable'};if(signal?.aborted)return {state:'cancelled'};if(active)return {state:'busy'};
  if(resolve&&reconciliationEnabled!==true)return {state:'unavailable'};
  if(write)try{
   if(intent===null||typeof intent!=='object'||Array.isArray(intent))throw fail();intent=structuredClone(intent);
   accountHandoffBytes({format:1,scope,generation:1,previousSha256:'0'.repeat(64),verificationKey,minimum:{head:{sequence:0,sha256:'0'.repeat(64)},acknowledged:{sequence:0,sha256:'0'.repeat(64)}},pending:intent});
  }catch{return {state:'invalid'};}active=true;
  const c=new AbortController(),started=performance.now(),abort=()=>c.abort();let onAbort,dirty=false,dispatched=false;
  running.add(c);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
  const check=()=>{if(closed||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
  const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn({signal:c.signal});}),stopped]);
  const same=(a,b)=>isDeepStrictEqual(a,b);
  const verify=(bytes,r)=>reviewAccountHandoff({bytes,expectedSha256:r.sha256,expectedScope:scope,expectedVerificationKey:verificationKey,minimumGeneration:r.generation});
  const load=async()=>{
   const a=receipt(await phase(o=>anchor.read(o)));check();
   if(a.generation<pin.generation||a.generation===pin.generation&&a.sha256!==pin.sha256)throw fail();pin={...a};
   const s=await phase(o=>slot.read(o));check();if(!exact(s,['bytes','receipt'])||!same(receipt(s.receipt),a))throw fail();
   if(!(s.bytes instanceof Uint8Array)||s.bytes.byteLength<1||s.bytes.byteLength>4096)throw fail();
   const bytes=Buffer.from(s.bytes),record=verify(bytes,a);if(record.generation!==a.generation)throw fail();
   const again=receipt(await phase(o=>anchor.read(o)));check();if(!same(a,again))throw fail();return {bytes,record,receipt:a};
  };
  const readHistory=async before=>{
   const v=await phase(o=>history.snapshot(o));check();const hs={memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch};
   if(!exact(v,['scope','enabled','admissionsOpen','head','records'])||!same(v.scope,hs)||typeof v.enabled!=='boolean'||typeof v.admissionsOpen!=='boolean'||v.admissionsOpen&&!v.enabled)throw fail();
   const ack=await phase(o=>acknowledgements.read(o));check();
   reviewAccountHistory({scope:hs,records:v.records,head:v.head,acknowledged:v.head,minimum:before.record.minimum.head});
   reviewAccountHistory({scope:hs,records:v.records,head:v.head,acknowledged:ack,minimum:before.record.minimum.acknowledged});
   return {enabled:v.enabled,admissionsOpen:v.admissionsOpen,records:v.records.map(r=>accountRecord({scope:r.scope,sequence:r.sequence,previous:r.previous,event:r.event})),minimum:{head:{...v.head},acknowledged:{...ack}}};
  };
  const save=async(before,record,records,resolution=false)=>{
   const bytes=accountHandoffBytes(record),next={generation:record.generation,sha256:sha(bytes)};
   (resolution?reviewAccountResolutionSuccessor:reviewAccountHandoffSuccessor)({previousBytes:before.bytes,previousSha256:before.receipt.sha256,nextBytes:bytes,nextSha256:next.sha256,expectedScope:scope,expectedVerificationKey:verificationKey,minimumGeneration:before.receipt.generation,records});
   // Any lost storage reply is uncertain, even if no business mutation started.
   dirty=true;const stored=await phase(o=>slot.compareAndSet({expected:{...before.receipt},bytes:Buffer.from(bytes)},o));check();
   if(!exact(stored,['state','receipt'])||stored.state!=='committed'||!same(receipt(stored.receipt),next))throw fail();
   const advanced=await phase(o=>anchor.advance({expected:{...before.receipt},next:{...next}},o));check();
   if(!exact(advanced,['state','receipt'])||advanced.state!=='committed'||!same(receipt(advanced.receipt),next))throw fail();pin={...next};
   const loaded=await load();check();if(!same(loaded.receipt,next)||!loaded.bytes.equals(bytes))throw fail();return loaded;
  };
  const successor=(b,patch)=>({...b.record,generation:b.record.generation+1,previousSha256:b.receipt.sha256,...patch});
  try{
   let before=await load();const current=await readHistory(before);check();
   if(!same(current.minimum,before.record.minimum))before=await save(before,successor(before,{minimum:current.minimum}),current.records);
   if(resolve){
    const result=deriveAccountResolution({record:before.record,records:current.records,minimum:current.minimum});
    if(result.state!=='resolvable'){const last=await load();check();if(!same(last.receipt,before.receipt))throw fail();return {state:result.state};}
    before=await save(before,successor(before,{format:2,pending:null,resolution:result.resolution}),current.records,true);check();
    return {state:'resolved',outcome:before.record.resolution.outcome,authorization:'not_established',erasure:'not_established'};
   }
   if(!write){const last=await load();check();if(!same(last.receipt,before.receipt))throw fail();return {state:before.record.pending===null?'checkpointed':'pending',minimum:structuredClone(before.record.minimum),authorization:'not_established',erasure:'not_established'};}
   if(before.record.pending!==null)return {state:'pending',outcome:'unresolved'};
   if(!current.enabled)return {state:'paused'};
   if(intent.kind==='history_append'&&intent.event.kind==='account_admitted'&&!current.admissionsOpen)return {state:'admissions_closed'};
   // Intent validation completes before either protected store is changed.
   const staged=successor(before,{pending:structuredClone(intent)});
   before=await save(before,staged,current.records);check();
   const p=before.record.pending;dispatched=true;
   const result=await phase(o=>p.kind==='history_append'?history.append({event:structuredClone(p.event),expected:{...p.expected}},o):acknowledgements.advance({records:structuredClone(current.records),head:{...p.target},expected:{...p.expected}},o));check();
   // A reply is useful evidence, never a reconciliation receipt. Leave the exact
   // pending intent persisted, including after a reported successful mutation.
   const reported=p.kind==='history_append'?result?.state==='recorded':result?.state==='acknowledged';
   return {state:'pending',outcome:reported?'reported_commit':'unknown'};
  }catch{faulted=true;return {state:dirty||dispatched?'unknown':signal?.aborted?'cancelled':'unavailable'};}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();running.delete(c);active=false;}
 }
 return Object.freeze({observe:options=>operation(null,false,options),execute:(intent,options)=>operation(intent,true,options),reconcile:options=>operation(null,false,options,true),close(){closed=true;for(const c of running)c.abort();}});
}
