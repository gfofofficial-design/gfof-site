// Source-only trusted service. Callers receive read/advance, NEVER raw store CAS.
// Store must independently provide authenticated current reads and durable atomic
// compare-and-set. No provider, bootstrap/reset, credential, transport or retry.
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {isDeepStrictEqual as same} from 'node:util';
import {accountHandoffBytes,reviewAccountHandoff,reviewAccountHandoffSuccessor} from './account-handoff.mjs';
import {reviewAccountResolutionSuccessor} from './account-resolution.mjs';
import {controlExact as exact,controlHash as hash} from './control-policy.mjs';
const fail=()=>Error('alliance_account_checkpoint_authority_unavailable'),zero='0'.repeat(64),sha=b=>createHash('sha256').update(b).digest('hex');
function receipt(v){
 if(!exact(v,['generation','sha256'])||!Number.isSafeInteger(v.generation)||v.generation<1||v.generation>2147483646||!hash(v.sha256)||v.sha256===zero)throw fail();
 return {generation:v.generation,sha256:v.sha256};
}
export function createAccountCheckpointAuthority({enabled=false,scope,verificationKey,minimum,store,timeoutMs=4000}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>4000)throw fail();let pin,observed;
 if(enabled===true){
  pin=receipt(minimum);scope=structuredClone(scope);
  accountHandoffBytes({format:1,scope,generation:1,previousSha256:zero,verificationKey,minimum:{head:{sequence:0,sha256:zero},acknowledged:{sequence:0,sha256:zero}},pending:null});
  if(typeof store?.read!=='function'||typeof store?.compareAndSet!=='function')throw fail();
 }
 let closed=false,active=false,faulted=false,controller;
 async function operation(input,{signal}={},write=false){
  if(enabled!==true||closed||faulted)return {state:'unavailable'};
  if(signal?.aborted)return {state:'cancelled'};if(active)return {state:'busy'};
  let request;
  if(write)try{
   if(!exact(input,['expected','next','bytes','records','kind'])||!['ordinary','resolution'].includes(input.kind)||!(input.bytes instanceof Uint8Array)||input.bytes.byteLength<1||input.bytes.byteLength>4096||!Array.isArray(input.records)||input.records.length>256||Buffer.byteLength(JSON.stringify(input.records))>262144)throw fail();
   request={expected:receipt(input.expected),next:receipt(input.next),bytes:Buffer.from(input.bytes),records:structuredClone(input.records),kind:input.kind};
   if(request.next.generation!==request.expected.generation+1||sha(request.bytes)!==request.next.sha256)throw fail();
   const record=reviewAccountHandoff({bytes:request.bytes,expectedSha256:request.next.sha256,expectedScope:scope,expectedVerificationKey:verificationKey,minimumGeneration:request.next.generation});
   if(record.generation!==request.next.generation)throw fail();
  }catch{return {state:'invalid'};}
  active=true;let dirty=false,onAbort;
  const c=new AbortController(),abort=()=>c.abort(),started=performance.now();controller=c;
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
  const check=()=>{if(closed||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
  const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn({signal:c.signal});}),stopped]);
  const read=async()=>{
   const value=await phase(o=>store.read(o));check();
   if(!exact(value,['bytes','receipt'])||!(value.bytes instanceof Uint8Array)||value.bytes.byteLength<1||value.bytes.byteLength>4096)throw fail();
   const r=receipt(value.receipt),bytes=Buffer.from(value.bytes);
   const record=reviewAccountHandoff({bytes,expectedSha256:r.sha256,expectedScope:scope,expectedVerificationKey:verificationKey,minimumGeneration:pin.generation});
   if(record.generation!==r.generation||r.generation<pin.generation||r.generation===pin.generation&&r.sha256!==pin.sha256)throw fail();
   if(observed)for(const name of ['head','acknowledged']){
    const before=observed.minimum[name],after=record.minimum[name];
    if(after.sequence<before.sequence||after.sequence===before.sequence&&after.sha256!==before.sha256)throw fail();
   }
   pin={...r};observed=record;return {bytes,record,receipt:r};
  };
  try{
   const before=await read();check();
   if(!write)return {...before.receipt};
   if(!same(request.expected,before.receipt))return {state:'conflict',receipt:{...before.receipt}};
   try{
    (request.kind==='resolution'?reviewAccountResolutionSuccessor:reviewAccountHandoffSuccessor)({previousBytes:before.bytes,previousSha256:before.receipt.sha256,nextBytes:request.bytes,nextSha256:request.next.sha256,expectedScope:scope,expectedVerificationKey:verificationKey,minimumGeneration:before.receipt.generation,records:request.records});
   }catch{return {state:'invalid'};}
   dirty=true;const result=await phase(o=>store.compareAndSet({expected:{...before.receipt},bytes:Buffer.from(request.bytes)},o));check();
   if(!exact(result,['state','receipt'])||!['committed','conflict'].includes(result.state))throw fail();
   const returned=receipt(result.receipt);
   if(result.state==='conflict'){
    // Verify current storage independently, never trust a conflict's claimed pin.
    const after=await read();check();if(!same(returned,after.receipt))throw fail();
    return {state:'conflict',receipt:{...after.receipt}};
   }
   if(!same(returned,request.next))throw fail();
   const after=await read();check();if(!same(after.receipt,request.next)||!after.bytes.equals(request.bytes))throw fail();
   return {state:'committed',receipt:{...after.receipt}};
  }catch{faulted=true;return {state:dirty?'unknown':signal?.aborted?'cancelled':'unavailable'};}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();active=false;controller=undefined;}
 }
 return Object.freeze({read:options=>operation(null,options),advance:(input,options)=>operation(input,options,true),close(){closed=true;controller?.abort();}});
}
