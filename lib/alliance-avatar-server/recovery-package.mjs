// Source-only bounded byte packaging. Crypto is an injected age capability.
// No key/env/file/DB/provider lookup, SQL execution, restore or serving authority.
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {allianceTrustRecord} from './trust-record.mjs';
import {controlExact as exact,controlHash as hash,controlRef as ref,controlUuid as uuid} from './control-policy.mjs';
export const RECOVERY_COMPONENTS=Object.freeze(['member-data','journal-data','control-data','schema-security','auth','storage','signing-recovery','deployment']);
const ONE=1048576,TOTAL=4*ONE,PLAIN=6*ONE,CIPHER=8*ONE,MAGIC=Buffer.from('age-encryption.org/v1\n');
const fail=()=>Error('alliance_recovery_package_unavailable'),digest=b=>createHash('sha256').update(b).digest('hex');
const recipient=v=>typeof v==='string'&&/^age1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(v);
const date=v=>typeof v==='string'&&v.length===24&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v&&Date.parse(v)>=0;
function bytes(v,max){if(!(v instanceof Uint8Array)||v.byteLength<1||v.byteLength>max)throw fail();return Buffer.from(v);}
function b64(v,max){if(typeof v!=='string'||v.length>Math.ceil(max/3)*4||!v.length)throw fail();const b=Buffer.from(v,'base64');if(b.length<1||b.length>max||b.toString('base64')!==v)throw fail();return b;}
function descriptor(v){if(!exact(v,['format','packageId','bytes','sha256'])||v.format!==1||!uuid(v.packageId)||!Number.isSafeInteger(v.bytes)||v.bytes<MAGIC.length||v.bytes>CIPHER||!hash(v.sha256))throw fail();return {...v};}
function components(values,encoded=false){
 if(!Array.isArray(values)||values.length!==RECOVERY_COMPONENTS.length)throw fail();let total=0;const out=[];
 try{for(let i=0;i<values.length;i++){
  const v=values[i];if(!exact(v,encoded?['name','bytes','sha256','data']:['name','data'])||v.name!==RECOVERY_COMPONENTS[i])throw fail();
  const data=encoded?b64(v.data,ONE):bytes(v.data,ONE);out.push({name:v.name,data});total+=data.length;
  if(total>TOTAL||encoded&&(!Number.isSafeInteger(v.bytes)||v.bytes!==data.length||!hash(v.sha256)||v.sha256!==digest(data)))throw fail();
 }return out;}catch{for(const v of out)v.data.fill(0);throw fail();}
}
export function createAllianceRecoveryPackage({enabled=false,expectedScope,trustSha256,minimumGeneration,recipient:expectedRecipient,encryptBytes,decryptBytes,timeoutMs=15000}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw fail();let scope;
 if(enabled===true){
  if(!exact(expectedScope,['memberProjectRef','journalProjectRef','controlProjectRef','epoch'])||!['memberProjectRef','journalProjectRef','controlProjectRef'].every(k=>ref(expectedScope[k]))||new Set([expectedScope.memberProjectRef,expectedScope.journalProjectRef,expectedScope.controlProjectRef]).size!==3||!uuid(expectedScope.epoch)||!hash(trustSha256)||!Number.isSafeInteger(minimumGeneration)||minimumGeneration<1||minimumGeneration>2147483646||!recipient(expectedRecipient)||typeof encryptBytes!=='function'&&typeof decryptBytes!=='function')throw fail();
  scope={...expectedScope};
 }
 let active=false,closed=false,faulted=false,controller;
 const unavailable=()=>({state:'unavailable',access:'closed'});
 const trust=raw=>allianceTrustRecord({bytes:raw,expectedSha256:trustSha256,expectedScope:scope,minimumGeneration});
 function validate(v){
  if(!exact(v,['format','packageId','capturedAt','sourceCommit','freezeId','checkpointSha256','recipient','trustSha256','trustRecord','components'])||v.format!==1||!uuid(v.packageId)||!date(v.capturedAt)||typeof v.sourceCommit!=='string'||!/^[0-9a-f]{40}$/.test(v.sourceCommit)||!uuid(v.freezeId)||!hash(v.checkpointSha256)||v.recipient!==expectedRecipient||v.trustSha256!==trustSha256)throw fail();
  const rawTrust=b64(v.trustRecord,4096);try{trust(rawTrust);}finally{rawTrust.fill(0);}
  return components(v.components,true);
 }
 async function run(signal,work){
  if(enabled!==true||closed||faulted||signal?.aborted)return unavailable();if(active)return {state:'busy',access:'closed'};active=true;
  const c=new AbortController(),abort=()=>c.abort(),started=performance.now();let onAbort;controller=c;signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
  const check=()=>{if(closed||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
  const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn();}).then(v=>{try{check();return v;}catch{if(v instanceof Uint8Array)v.fill(0);throw fail();}}),stopped]);let result;
  try{result=await work({check,phase,signal:c.signal});check();return result;}catch{if(result?.state==='verified_bytes')for(const p of result.components)p.data.fill(0);faulted=true;return unavailable();}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();controller=undefined;active=false;}
 }
 return Object.freeze({
  async seal(input,{signal}={}){
   return run(signal,async context=>{
    if(typeof encryptBytes!=='function'||!exact(input,['packageId','capturedAt','sourceCommit','freezeId','checkpointSha256','trustRecord','components']))throw fail();
    let rawTrust,parts=[],plain;
    try{
     rawTrust=bytes(input.trustRecord,4096);trust(rawTrust);parts=components(input.components);
     const v={format:1,packageId:input.packageId,capturedAt:input.capturedAt,sourceCommit:input.sourceCommit,freezeId:input.freezeId,checkpointSha256:input.checkpointSha256,recipient:expectedRecipient,trustSha256,trustRecord:rawTrust.toString('base64'),components:parts.map(p=>({name:p.name,bytes:p.data.length,sha256:digest(p.data),data:p.data.toString('base64')}))};
     // Validate public metadata before invoking the encryption capability.
     const verified=validate(v);for(const p of verified)p.data.fill(0);
     plain=Buffer.from(JSON.stringify(v)+'\n');if(plain.length>PLAIN)throw fail();context.check();
     const raw=await context.phase(()=>encryptBytes(plain,{recipient:expectedRecipient,signal:context.signal}));context.check();let cipher;try{cipher=bytes(raw,CIPHER);}finally{if(raw instanceof Uint8Array)raw.fill(0);}
     if(!cipher.subarray(0,MAGIC.length).equals(MAGIC)){cipher.fill(0);throw fail();}
     return {state:'sealed',access:'closed',descriptor:Object.freeze({format:1,packageId:v.packageId,bytes:cipher.length,sha256:digest(cipher)}),ciphertext:cipher};
    }finally{rawTrust?.fill(0);plain?.fill(0);for(const p of parts)p.data.fill(0);}
   });
  },
  async open(input,{signal}={}){
   return run(signal,async context=>{
    if(typeof decryptBytes!=='function'||!exact(input,['descriptor','ciphertext']))throw fail();
    const pin=descriptor(input.descriptor);let cipher,plain,parts=[];let released=false;
    try{
     cipher=bytes(input.ciphertext,CIPHER);if(cipher.length!==pin.bytes||digest(cipher)!==pin.sha256||!cipher.subarray(0,MAGIC.length).equals(MAGIC))throw fail();context.check();
     const raw=await context.phase(()=>decryptBytes(cipher,{recipient:expectedRecipient,signal:context.signal}));context.check();try{plain=bytes(raw,PLAIN);}finally{if(raw instanceof Uint8Array)raw.fill(0);}
     const v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain));parts=validate(v);
     if(v.packageId!==pin.packageId||!Buffer.from(JSON.stringify(v)+'\n').equals(plain))throw fail();
     // Rebuild exact canonical field/order rather than trusting JSON insertion order.
     const canonical={format:1,packageId:v.packageId,capturedAt:v.capturedAt,sourceCommit:v.sourceCommit,freezeId:v.freezeId,checkpointSha256:v.checkpointSha256,recipient:v.recipient,trustSha256:v.trustSha256,trustRecord:v.trustRecord,components:parts.map(p=>({name:p.name,bytes:p.data.length,sha256:digest(p.data),data:p.data.toString('base64')}))};
     if(!Buffer.from(JSON.stringify(canonical)+'\n').equals(plain))throw fail();context.check();
     const manifest={format:1,packageId:v.packageId,capturedAt:v.capturedAt,sourceCommit:v.sourceCommit,freezeId:v.freezeId,checkpointSha256:v.checkpointSha256,recipient:v.recipient,trustSha256:v.trustSha256,components:parts.map(p=>({name:p.name,bytes:p.data.length,sha256:digest(p.data)}))};
     released=true;return {state:'verified_bytes',access:'closed',manifest,components:parts};
    }finally{cipher?.fill(0);plain?.fill(0);if(!released)for(const p of parts)p.data.fill(0);}
   });
  },close(){closed=true;controller?.abort();}
 });
}
