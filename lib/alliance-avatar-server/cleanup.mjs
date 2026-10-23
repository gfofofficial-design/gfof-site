// Disabled one-object server maintenance candidate. No route/schedule/env reads,
// automatic retry, batch loop or quota release from an uncertain/missing object.
import {performance} from 'node:perf_hooks';
import {isDeepStrictEqual} from 'node:util';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const result=state=>Object.freeze({state});
async function bounded(work,signal,ms){
  if(ms<=0)throw Error('cleanup_unavailable');const c=new AbortController(),abort=()=>c.abort();let timer;
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  try{return await Promise.race([Promise.resolve().then(()=>work(c.signal)),new Promise((_,reject)=>{timer=setTimeout(()=>{abort();reject(Error('cleanup_unavailable'));},ms);})]);}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);abort();}
}
export function createAvatarCleanup({enabled=false,ledger,storage,timeoutMs=25000}={}){
  if(!Number.isInteger(timeoutMs)||timeoutMs<60||timeoutMs>25000)throw Error('cleanup_unavailable');
  if(enabled===true&&(!['claimCleanup','beginCleanup','authorizeCleanup','unknownCleanup','finishCleanup'].every(k=>typeof ledger?.[k]==='function')||typeof storage?.remove!=='function'))throw Error('cleanup_unavailable');
  let active=false,closed=false;const running=new Set();const finalMs=Math.min(4500,Math.floor(timeoutMs/5));
  async function run(claimId,{signal}={}){
    if(enabled!==true||closed)return result('unavailable');if(!UUID.test(claimId))return result('invalid');if(signal?.aborted)return result('cancelled');if(active)return result('busy');
    active=true;const c=new AbortController(),abort=()=>c.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();running.add(c);
    const start=performance.now(),end=start+timeoutMs,workEnd=end-finalMs;
    const live=()=>!c.signal.aborted&&performance.now()<workEnd;
    const step=(fn,cap)=>bounded(fn,c.signal,Math.min(cap,workEnd-performance.now()));
    const unknown=async()=>{try{await bounded(s=>ledger.unknownCleanup(claimId,{signal:s}),undefined,Math.min(finalMs,end-performance.now()));}catch{}return result('unknown');};
    try{
      let claim;try{claim=await step(s=>ledger.claimCleanup(claimId,{signal:s}),4750);}catch{return result('unknown');}
      if(claim?.granted===false)return result(['empty','busy','claimed','expired','dispatched','unknown','deleted'].includes(claim.state)?claim.state:'unknown');
      if(claim?.granted!==true||claim.claimId!==claimId||!UUID.test(claim.objectId)||!claim.receipt||claim.receipt.objectId!==claim.objectId)return result('unknown');
      claim=JSON.parse(JSON.stringify(claim));
      if(!live())return result('cancelled'); // An undispatched claim alone may expire.
      let dispatch;try{dispatch=await step(s=>ledger.beginCleanup(claimId,{signal:s}),4750);}catch{return result('unknown');}
      if(dispatch?.dispatch===false)return result(['claimed','expired','dispatched','unknown','deleted'].includes(dispatch.state)?dispatch.state:'unknown');
      if(dispatch?.dispatch!==true||dispatch.claimId!==claimId||dispatch.objectId!==claim.objectId||!isDeepStrictEqual(dispatch.receipt,claim.receipt))return result('unknown');
      dispatch=JSON.parse(JSON.stringify(dispatch));
      if(!live())return await unknown();
      let proof;try{proof=await step(s=>storage.remove(dispatch.receipt,{writeSettled:true,signal:s,authorize:async record=>{
        if(!live()||s.aborted||!isDeepStrictEqual(record,dispatch.receipt))return false;
        return await bounded(a=>ledger.authorizeCleanup(claimId,record,{signal:a}),s,Math.min(4750,workEnd-performance.now()))===true&&live()&&!s.aborted;
      }}),8250);}catch{return await unknown();}
      if(proof?.state!=='deleted'||proof.writeSettled!==true||Object.keys(proof).length!==3||!isDeepStrictEqual(proof.receipt,dispatch.receipt))return await unknown();
      // Known evidence is recorded even after cancellation, within an awaited
      // finite final phase. Lost COMMIT remains unknown; no second DELETE.
      const copy=JSON.parse(JSON.stringify(proof));
      try{await bounded(s=>ledger.finishCleanup(claimId,copy,{signal:s}),undefined,Math.min(finalMs,end-performance.now()));return result('deleted');}catch{return result('unknown');}
    }catch{return result('unknown');}
    finally{signal?.removeEventListener('abort',abort);c.abort();running.delete(c);active=false;}
  }
  return Object.freeze({run,close(){closed=true;for(const c of running)c.abort();}});
}
