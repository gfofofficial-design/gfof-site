// Read-only removal version guard. Trusted context is supplied by member Auth.
// No row creation, operation, mutation, automatic retry or hosted activation.
import {performance} from 'node:perf_hooks';
import {isDeepStrictEqual} from 'node:util';
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const fail=()=>Error('profile_removal_version_unavailable');
function head(v){if(!exact(v,['version','objectId','pending'])||!Number.isSafeInteger(v.version)||v.version<0||v.version>=Number.MAX_SAFE_INTEGER||v.objectId!==null&&!uuid(v.objectId)||!Array.isArray(v.pending)||v.pending.length)throw fail();return {version:v.version,objectId:v.objectId};}
export function createProfileRemovalVersionView({enabled=false,ledger,journal,serving,timeoutMs=8000}={}){
 if(typeof enabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>8000||enabled&&(!['authorizeSession','mineSession'].every(k=>typeof ledger?.[k]==='function')||typeof journal?.review!=='function'||typeof serving?.authorize!=='function'))throw fail();
 let active=false,closed=false,controller;
 return Object.freeze({async read(input,{signal}={}){
  if(!enabled||closed||active||!exact(input,['actorId','sessionId','expiresAt'])||!uuid(input.actorId)||!uuid(input.sessionId)||!Number.isSafeInteger(input.expiresAt)||input.expiresAt<=Date.now()||signal?.aborted)return {state:'unavailable'};
  const context={...input},c=new AbortController(),abort=()=>c.abort(),start=performance.now();let view,onAbort;
  active=true;controller=c;signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});if(c.signal.aborted)onAbort();});
  const timer=setTimeout(abort,Math.min(timeoutMs,context.expiresAt-Date.now()));
  const check=()=>{if(closed||c.signal.aborted||Date.now()>=context.expiresAt||performance.now()-start>=timeoutMs)throw fail();};
  const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn();}),stopped]);
  const permit=async()=>{if(await phase(()=>serving.authorize({signal:c.signal}))!==true)throw fail();check();};
  const authorize=async()=>{const v=await phase(()=>ledger.authorizeSession(context.actorId,context.sessionId,{signal:c.signal}));check();if(!exact(v,['actorId','sessionId','profileId'])||v.actorId!==context.actorId||v.sessionId!==context.sessionId||!uuid(v.profileId))throw fail();return v.profileId;};
  const review=async profileId=>{view?.close();view=undefined;await permit();view=await phase(async()=>{const v=await journal.review({signal:c.signal});if(closed||c.signal.aborted){v?.close?.();throw fail();}return v;});check();if(view?.state!=='verified_evidence'||typeof view.checkProfile!=='function'||typeof view.close!=='function'||!isDeepStrictEqual(view.checkProfile({profileId}),{state:'not_listed'}))throw fail();};
  try{
   await permit();const profileId=await authorize();await review(profileId);
   const first=head(await phase(()=>ledger.mineSession(context.actorId,context.sessionId,{signal:c.signal})));check();
   await review(profileId);if(await authorize()!==profileId)throw fail();
   const second=head(await phase(()=>ledger.mineSession(context.actorId,context.sessionId,{signal:c.signal})));check();if(!isDeepStrictEqual(first,second))throw fail();
   await permit();if(view?.state!=='verified_evidence'||!isDeepStrictEqual(view.checkProfile({profileId}),{state:'not_listed'}))throw fail();check();
   return {state:'ready',version:second.version};
  }catch{return {state:'unavailable'};}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();try{view?.close?.();}catch{}active=false;controller=undefined;}
 },close(){closed=true;controller?.abort();}});
}
