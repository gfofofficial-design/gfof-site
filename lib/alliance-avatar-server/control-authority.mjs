// Source-only signer; independent protected pin/custody must be supplied.
// No key/env lookup, operator mutation, persistent-pin write or transport route.
import {createPublicKey,verify} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {startupDecisionBytes} from './startup-gate.mjs';
import {controlPolicy,controlPoint,controlExact as exact,controlRef as ref,controlHash as hash,controlUuid as uuid,controlFailure as fail} from './control-policy.mjs';
export function createAllianceControlAuthority({enabled=false,memberProjectRef,journalProjectRef,epoch,verificationKey,minimum,store,signBytes,timeoutMs=3000}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>3500)throw fail();let key,pin;
 if(enabled===true){
  if(!ref(memberProjectRef)||!ref(journalProjectRef)||memberProjectRef===journalProjectRef||!uuid(epoch)||!hash(verificationKey)||!exact(minimum,['revision','sha256','floor'])||!Number.isSafeInteger(minimum.revision)||minimum.revision<1||minimum.revision>2147483646||!hash(minimum.sha256)||typeof store?.read!=='function'||typeof signBytes!=='function')throw fail();
  pin={revision:minimum.revision,sha256:minimum.sha256,floor:controlPoint(minimum.floor)};key=createPublicKey({format:'jwk',key:{kty:'OKP',crv:'Ed25519',x:Buffer.from(verificationKey,'hex').toString('base64url')}});
 }
 let closed=false,faulted=false,active=false,controller;
 return Object.freeze({
  async issue(input,{signal}={}){
   if(enabled!==true||closed||faulted||signal?.aborted)return {state:'unavailable'};
   if(!exact(input,['format','memberProjectRef','journalProjectRef','epoch','bootId','challenge'])||input.format!==1||input.memberProjectRef!==memberProjectRef||input.journalProjectRef!==journalProjectRef||input.epoch!==epoch||!hash(input.bootId)||!hash(input.challenge))return {state:'invalid'};
   const request={...input};if(active)return {state:'busy'};active=true;
   const c=new AbortController(),abort=()=>c.abort(),started=performance.now();let onAbort;controller=c;signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
   const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
   const check=()=>{if(closed||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
   const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn();}),stopped]);
   const read=async()=>{const v=controlPolicy(await phase(()=>store.read({signal:c.signal})));check();if(v.memberProjectRef!==memberProjectRef||v.journalProjectRef!==journalProjectRef||v.epoch!==epoch||v.revision<pin.revision||v.revision===pin.revision&&v.sha256!==pin.sha256||v.floor.sequence<pin.floor.sequence||v.floor.sequence===pin.floor.sequence&&v.floor.sha256!==pin.floor.sha256)throw fail();pin={revision:v.revision,sha256:v.sha256,floor:controlPoint(v.floor)};return v;};
   try{
    const policy=await read();if(policy.freezeId===null)throw fail();
    const decision={...request,revision:policy.revision,state:policy.state,freezeId:policy.freezeId,frozenAt:policy.frozenAt,checkpointSha256:policy.checkpointSha256,floor:controlPoint(policy.floor),issuedAt:new Date().toISOString()},message=startupDecisionBytes(decision);
    const raw=await phase(()=>signBytes(Buffer.from(message),{signal:c.signal}));check();
    if(!(raw instanceof Uint8Array)||raw.byteLength!==64||!verify(null,message,key,Buffer.from(raw)))throw fail();
    const signature=Buffer.from(raw).toString('hex'),after=await read();if(after.sha256!==policy.sha256)throw fail();check();
    const age=Date.now()-Date.parse(decision.issuedAt);if(age< -1000||age>=30000)throw fail();
    return {state:'signed',bytes:Buffer.from(JSON.stringify({decision,signature}))};
   }catch{faulted=true;return {state:'unavailable'};}
   finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();active=false;controller=undefined;}
  },close(){closed=true;controller?.abort();}
 });
}
