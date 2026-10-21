// Source-only key policy/provider. No key generation, export, environment read,
// filesystem copy, cache, hosted configuration or automatic renewal.
import {createHash,createPublicKey} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {isDeepStrictEqual as same} from 'node:util';
import {controlExact as exact} from './control-policy.mjs';
const fail=()=>Error('alliance_gateway_signing_unavailable'),sha=b=>createHash('sha256').update(b).digest('hex');
const reviewedKeys=new WeakSet();
const utc=v=>typeof v==='string'&&v.length===24&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v&&Date.parse(v)>=0;
function parseCallerKey(v){
 if(!exact(v,['keyId','spki','notBeforeUtc','notAfterUtc'])||typeof v.spki!=='string'||v.spki.length>128||!(/^[A-Za-z0-9+/]+={0,2}$/).test(v.spki)||!utc(v.notBeforeUtc)||!utc(v.notAfterUtc))throw fail();
 const bytes=Buffer.from(v.spki,'base64'),notBefore=Date.parse(v.notBeforeUtc),notAfter=Date.parse(v.notAfterUtc);
 if(bytes.toString('base64')!==v.spki||sha(bytes)!==v.keyId||notAfter<=notBefore||notAfter-notBefore>30*86400000)throw fail();
 const key=createPublicKey({key:bytes,format:'der',type:'spki'});if(key.asymmetricKeyType!=='ed25519'||!key.export({format:'der',type:'spki'}).equals(bytes))throw fail();
 const reviewed=Object.freeze({key,keyId:v.keyId,notBefore,notAfter});reviewedKeys.add(reviewed);return reviewed;
}
export function reviewGatewayCallerKey(v){try{return parseCallerKey(v);}catch{throw fail();}}
export function assertGatewayKeyCurrent(k,marginMs=0){const now=Date.now();if(!reviewedKeys.has(k)||!Number.isInteger(marginMs)||marginMs<0||marginMs>60000||!Number.isFinite(now)||now<k.notBefore||now+marginMs>=k.notAfter)throw fail();}
function installation(v){
 if(!exact(v,['siteId','deployId','context'])||typeof v.siteId!=='string'||!(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/).test(v.siteId)||typeof v.deployId!=='string'||!(/^[a-f0-9]{24}$/).test(v.deployId)||!['deploy-preview','production'].includes(v.context))throw fail();return {...v};
}
// runtime() must be a trusted Netlify-context adapter. Never derive the expected
// installation from the same incoming request, browser body or runtime callback.
export function createGatewaySigningKeyProvider({enabled=false,expectedInstallation,callerKey,runtime,loadKey,timeoutMs=1500}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>1500)throw fail();let expected,k;
 if(enabled===true){expected=installation(expectedInstallation);k=reviewGatewayCallerKey(callerKey);if(typeof runtime!=='function'||typeof loadKey!=='function')throw fail();}
 let closed=false,faulted=false,active=false,controller;
 async function provider({signal}={}){
  if(enabled!==true||closed||faulted||active||signal?.aborted)throw fail();active=true;
  const c=new AbortController(),abort=()=>c.abort(),started=performance.now();let onAbort;controller=c;signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
  const check=()=>{if(closed||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();assertGatewayKeyCurrent(k,37000);};
  const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn({signal:c.signal});}),stopped]);
  const checkRuntime=async()=>{const actual=installation(await phase(runtime));check();if(!same(actual,expected))throw fail();};
  try{
   await checkRuntime();const key=await phase(loadKey);check();
   if(key?.type!=='private'||key.asymmetricKeyType!=='ed25519'||sha(createPublicKey(key).export({format:'der',type:'spki'}))!==k.keyId)throw fail();
   await checkRuntime();check();return key;
  }catch{faulted=true;throw fail();}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();active=false;controller=undefined;}
 }
 return Object.freeze(Object.assign(provider,{close(){closed=true;controller?.abort();}}));
}
