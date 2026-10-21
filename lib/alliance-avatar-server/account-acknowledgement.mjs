// Default-closed account-history acknowledgement bridge, not an Auth/serving
// gate. A durable SQL ack is not physical erasure or independently signed trust.
import {reviewAccountHistory} from './account-history.mjs';
import {controlExact as exact,controlPoint as point} from './control-policy.mjs';
import {performance} from 'node:perf_hooks';
import {isDeepStrictEqual} from 'node:util';
const fail=()=>Error('alliance_account_ack_unavailable');
export function createAccountAcknowledgement({enabled=false,scope,minimum,history,acknowledgements,timeoutMs=8000}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>8000)throw fail();let floor;
 if(enabled===true){
  floor=point(minimum);reviewAccountHistory({scope,records:[],head:{sequence:0,sha256:'0'.repeat(64)},acknowledged:{sequence:0,sha256:'0'.repeat(64)},minimum:{sequence:0,sha256:'0'.repeat(64)}});scope={...scope};
  if(typeof history?.snapshot!=='function'||typeof acknowledgements?.read!=='function'||typeof acknowledgements?.advance!=='function')throw fail();
 }
 let active=false,closed=false,faulted=false,uncertain=false;const running=new Set();
 async function operation(write,{signal}={}){
  if(enabled!==true||closed||faulted||write&&uncertain)return {state:'unavailable'};
  if(signal?.aborted)return {state:'cancelled'};if(active)return {state:'busy'};active=true;
  const c=new AbortController(),abort=()=>c.abort(),started=performance.now();let onAbort,dispatched=false;
  running.add(c);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
  const check=()=>{if(closed||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
  const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn({signal:c.signal});}),stopped]);
  const read=async()=>{
   const snap=await phase(options=>history.snapshot(options));check();
   if(!exact(snap,['scope','enabled','admissionsOpen','head','records'])||!isDeepStrictEqual(snap.scope,scope)||typeof snap.enabled!=='boolean'||typeof snap.admissionsOpen!=='boolean'||snap.admissionsOpen&&!snap.enabled)throw fail();
   const ack=point(await phase(options=>acknowledgements.read(options)));check();
   const evidence=reviewAccountHistory({scope,records:snap.records,head:snap.head,acknowledged:ack,minimum:floor});
   // Pin the read-back floor before any later transport operation can fail.
   floor={...ack};return {snap,ack,evidence};
  };
  try{
   const before=await read();
   if(!write)return before.evidence;
   dispatched=true;const result=await phase(options=>acknowledgements.advance({records:before.snap.records,head:before.snap.head,expected:before.ack},options));check();
   if(!exact(result,['state','point'])||!['acknowledged','paused','conflict'].includes(result.state))throw fail();const p=point(result.point);
   if(result.state!=='acknowledged')return {state:result.state};
   if(p.sequence!==before.snap.head.sequence||p.sha256!==before.snap.head.sha256)throw fail();
   // Even a committed reply is not enough: read the independent floor and the
   // current history again. An intent arriving meanwhile remains pending/deny.
   floor={...p};const after=await read();check();return after.evidence;
  }catch(e){
   if(dispatched){uncertain=true;return {state:'unknown'};}
   // Bad or unavailable current evidence must never trigger mutation or fallback
   // to an older floor. New construction requires the externally retained pin.
   faulted=true;return {state:signal?.aborted?'cancelled':'unavailable'};
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();running.delete(c);active=false;}
 }
 return Object.freeze({review:options=>operation(false,options),acknowledge:options=>operation(true,options),close(){closed=true;for(const c of running)c.abort();}});
}
