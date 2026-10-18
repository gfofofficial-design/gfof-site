// Disabled, server-only composition. actorId MUST come from verified server Auth,
// never a browser field. This module provides no Auth, route, environment access,
// storage cleanup worker or automatic retry.
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {validateAvatarInput,validatedDerivative} from '../alliance-avatar-runtime/limits.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STATES=new Set(['reserved','uploading','committed','cancelled','stale']);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const result=state=>Object.freeze({state});
const unknown=()=>result('unknown');
function publicResult(value){
  if(!value||!STATES.has(value.state))return unknown();
  if(value.state==='committed')return Number.isSafeInteger(value.version)&&value.version>0?
    Object.freeze({state:'committed',version:value.version}):unknown();
  return result(value.state);
}
function failure(error){return result(error?.outcome==='rejected'?'rejected':'unknown');}

// Abort is forwarded immediately, but a cooperative storage gateway can still
// return its known acknowledgement. Only the finite stage timer wins the race;
// results arriving after it are ignored and cannot dispatch a follow-up step.
async function bounded(work,signal,milliseconds){
  if(milliseconds<=0)throw Error('avatar_flow_deadline');
  const controller=new AbortController(),abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  let timer;
  try{return await Promise.race([
    Promise.resolve().then(()=>work(controller.signal)),
    new Promise((_,reject)=>{timer=setTimeout(()=>{abort();reject(Error('avatar_flow_deadline'));},milliseconds);})
  ]);}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);abort();}
}

export function createAvatarFlow({enabled=false,ledger,processor,storage,timeoutMs=30000}={}){
  if(!Number.isInteger(timeoutMs)||timeoutMs<60||timeoutMs>30000)throw Error('avatar_flow_unavailable');
  if(enabled===true&&(!['reserve','claimUpload','commitUpload','cancelReserved','settleUnpublished','operationReceipt'].every(k=>typeof ledger?.[k]==='function')||
    typeof processor?.process!=='function'||typeof storage?.upload!=='function'))throw Error('avatar_flow_unavailable');
  const active=new Map();let closed=false;
  const settlementMs=Math.min(4500,Math.floor(timeoutMs/6));
  async function replace({actorId,operationId,version,bytes,mime}={}, {signal}={}){
    if(enabled!==true||closed)return result('unavailable');
    if(!UUID.test(actorId)||!UUID.test(operationId)||!Number.isSafeInteger(version)||version<0)return result('invalid');
    let original;
    try{validateAvatarInput(bytes,mime);original=new Uint8Array(bytes);}catch{return result('invalid');}
    if(signal?.aborted)return result('cancelled');
    const id=actorId+'/'+operationId;if(active.has(id)||active.size>=2)return result('busy');
    const controller=new AbortController(),abort=()=>controller.abort();
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();active.set(id,controller);
    const started=performance.now(),workUntil=started+timeoutMs-settlementMs;
    const live=()=>!controller.signal.aborted&&performance.now()<workUntil;
    const step=(work,cap)=>bounded(work,controller.signal,Math.min(cap,workUntil-performance.now()));
    // A known provider receipt may need recording after client disconnect. This
    // separate bounded phase never retries publication and is awaited, not queued.
    const record=async proof=>{
      try{await bounded(s=>ledger.settleUnpublished(operationId,proof,{signal:s}),undefined,
        Math.min(settlementMs,started+timeoutMs-performance.now()));return result('cleanup_pending');}
      catch{return unknown();}
    };
    const cancelReservation=async()=>{
      try{return publicResult(await bounded(s=>ledger.cancelReserved(actorId,operationId,{signal:s}),undefined,
        Math.min(settlementMs,started+timeoutMs-performance.now())));}catch{return unknown();}
    };
    try{
      let reservation;
      // Admission-backed reserve is three committed calls across two domains.
      // It still shares this flow's finite total deadline, with no retry.
      try{reservation=await step(s=>ledger.reserve(actorId,operationId,version,{signal:s}),14250);}catch(e){return failure(e);}
      if(reservation?.dispatch===false)return publicResult(reservation);
      if(reservation?.dispatch!==true||reservation.state!=='reserved'||!UUID.test(reservation.objectId))return unknown();
      if(!live())return await cancelReservation();
      let derivative;
      try{
        const decoded=await step(s=>processor.process(original,mime,{signal:s}),8250);
        if(decoded?.mime!=='image/png')throw Error('avatar_invalid');
        derivative=validatedDerivative({...decoded,ok:true});
      }catch{return await cancelReservation();}
      if(!live())return await cancelReservation();
      const descriptor={bytes:derivative.bytes.length,sha256:hash(derivative.bytes),width:derivative.width,height:derivative.height,mime:'image/png'};
      let claim;
      try{claim=await step(s=>ledger.claimUpload(actorId,operationId,descriptor,{signal:s}),4750);}catch(e){return failure(e);}
      if(claim?.dispatch===false)return publicResult(claim);
      const match=typeof claim?.key==='string'?/^v1\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.png$/.exec(claim.key):null;
      if(claim?.dispatch!==true||claim.objectId!==reservation.objectId||!match||!UUID.test(match[1])||match[2]!==claim.objectId)return unknown();
      // A committed claim may already authorize a writer. Cancellation/uncertainty
      // cannot refund it or claim that physical bytes are absent.
      if(!live())return unknown();
      let proof;
      try{proof=await step(s=>storage.upload({profileId:match[1],objectId:claim.objectId,derivative},{signal:s}),8250);}catch{return unknown();}
      const receipt=proof?.receipt;
      if(!['stored','stored_unverified'].includes(proof?.state)||proof.writeSettled!==true||
        proof.verified!==(proof.state==='stored')||!receipt||Object.keys(receipt).length!==9||
        receipt.profileId!==match[1]||receipt.objectId!==claim.objectId||receipt.key!==claim.key||!UUID.test(receipt.providerId)||
        !Object.entries(descriptor).every(([k,v])=>receipt[k]===v))return unknown();
      // Copy evidence before any asynchronous database operation can observe a
      // changed result from an injected transport.
      proof={state:proof.state,writeSettled:true,verified:proof.verified,receipt:{...receipt}};
      if(!proof.verified||!live())return await record(proof);
      let committed;
      try{committed=await step(s=>ledger.commitUpload(actorId,operationId,proof,{signal:s}),4750);}
      catch(e){return e?.outcome==='rejected'?await record(proof):unknown();}
      if(committed?.state==='committed')return publicResult(committed);
      if(committed?.state==='stale')return await record(proof);
      return unknown();
    }catch{return unknown();}
    finally{signal?.removeEventListener('abort',abort);controller.abort();active.delete(id);}
  }
  async function status(actorId,operationId,{signal}={}){
    if(enabled!==true||closed)return result('unavailable');
    if(!UUID.test(actorId)||!UUID.test(operationId))return result('invalid');
    // Receipt status has no committed version: don't manufacture one or return
    // object paths/provider evidence to a future browser response.
    try{const value=await bounded(s=>ledger.operationReceipt(actorId,operationId,{signal:s}),signal,Math.min(4500,timeoutMs));
      return value&&STATES.has(value.state)?result(value.state):unknown();}catch{return unknown();}
  }
  return Object.freeze({replace,status,close(){closed=true;for(const c of active.values())c.abort();}});
}
