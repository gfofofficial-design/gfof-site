// Server-only, default-off adapter. No handler, key generation, filesystem,
// environment enumeration, deployment, credential fallback or private export.
import {AsyncLocalStorage} from 'node:async_hooks';
import {createPrivateKey} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {isDeepStrictEqual as same} from 'node:util';
import {createGatewaySigningKeyProvider} from './gateway-signing-key.mjs';
const fail=()=>Error('alliance_netlify_signing_unavailable');
export const NETLIFY_GATEWAY_SIGNING_SECRET='FEDERATION_ACCOUNT_GATEWAY_ED25519_PKCS8';
// Serverless Functions' documented process.env interface; one fixed key only.
const secret=name=>process.env[name];
// trustedContext must be the actual second Netlify Function handler argument.
// These checks bind wiring; trusted application code can still fabricate it.
export function createNetlifyGatewaySigningRuntime({enabled=false,expectedInstallation,callerKey,readSecret=secret,timeoutMs=6000,keyTimeoutMs=1500}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>6000||!Number.isInteger(keyTimeoutMs)||keyTimeoutMs<1||keyTimeoutMs>1500||keyTimeoutMs>timeoutMs)throw fail();
 const local=new AsyncLocalStorage();let active,closed=false,provider,expected;
 const check=scope=>{if(enabled!==true||closed||!scope||scope!==active||!scope.alive||scope.controller.signal.aborted||performance.now()-scope.started>=timeoutMs)throw fail();};
 function runtime(){
  const s=local.getStore();check(s);
  // Read only the three documented deployment fields; never request data,
  // cookies, URLs, headers, user identity or build-environment substitutes.
  const site=s.context.site,deploy=s.context.deploy;
  const value={siteId:site?.id,deployId:deploy?.id,context:deploy?.context};check(s);return value;
 }
 async function loadKey(){
  const s=local.getStore();check(s);let bytes;
  try{
   const value=await readSecret(NETLIFY_GATEWAY_SIGNING_SECRET);check(s);
   // This store contract accepts only canonical 48-byte Ed25519 PKCS8 DER.
   // No trimming, PEM/passphrase support, key-name override or second lookup.
   if(typeof value!=='string'||!(/^[A-Za-z0-9+/]{64}$/).test(value))throw fail();
   bytes=Buffer.from(value,'base64');if(bytes.length!==48||bytes.toString('base64')!==value)throw fail();
   const key=createPrivateKey({key:bytes,format:'der',type:'pkcs8'});
   if(key.asymmetricKeyType!=='ed25519')throw fail();check(s);return key;
  }finally{bytes?.fill(0);}
 }
 if(enabled===true)try{
  if(typeof readSecret!=='function')throw fail();
  expected=structuredClone(expectedInstallation);
  provider=createGatewaySigningKeyProvider({enabled:true,expectedInstallation,callerKey,runtime,loadKey,timeoutMs:keyTimeoutMs});
 }catch{throw fail();}
 async function signingKey({signal}={}){
  try{const s=local.getStore();check(s);const key=await provider({signal:signal?AbortSignal.any([s.controller.signal,signal]):s.controller.signal});check(s);return key;}
  catch{throw fail();}
 }
 return Object.freeze({
  signingKey,
  async run(trustedContext,operation,{signal}={}){
   if(enabled!==true||closed||active||signal?.aborted||typeof operation!=='function')throw fail();
   const s={context:trustedContext,started:performance.now(),controller:new AbortController(),alive:true};active=s;
   const abort=()=>s.controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
   let onAbort;const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());s.controller.signal.addEventListener('abort',onAbort,{once:true});});
   const timer=setTimeout(abort,timeoutMs);
   try{return await local.run(s,()=>Promise.race([Promise.resolve().then(()=>{check(s);if(!same(runtime(),expected))throw fail();return operation({signal:s.controller.signal});}),stopped]));}
   catch{throw fail();}
   finally{clearTimeout(timer);s.alive=false;s.controller.signal.removeEventListener('abort',onAbort);s.controller.abort();signal?.removeEventListener('abort',abort);if(active===s)active=undefined;}
  },
  close(){closed=true;provider?.close();if(active){active.alive=false;active.controller.abort();}}
 });
}
