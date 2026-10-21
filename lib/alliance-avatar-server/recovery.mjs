// Disabled READ-ONLY operator inspector. No provider/Auth/network gateway,
// dispatch, mutation, retry, purge, environment lookup or browser route.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ZERO='00000000-0000-0000-0000-000000000000';
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>plain(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const fail=()=>Error('avatar_recovery_unavailable');
const iso=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():(()=>{throw fail();})();
export function recoveryResult(name,value,{before,after=ZERO,limit=20}={}){
  if(name==='retentionReview'){
    if(!exact(value,['before','items','next'])||iso(value.before)!==iso(before)||!Array.isArray(value.items)||value.items.length>limit)throw fail();
    let previous=after;
    const items=value.items.map(item=>{
      if(!exact(item,['objectId','reason','createdAt','lastChangedAt'])||!UUID.test(item.objectId)||item.objectId<=previous||
        !['keep_current','keep_open','keep_recent','keep_uncertain','review_deleted','review_never_dispatched'].includes(item.reason))throw fail();
      previous=item.objectId;const createdAt=iso(item.createdAt),lastChangedAt=iso(item.lastChangedAt);
      if(Date.parse(createdAt)>Date.parse(before)||Date.parse(lastChangedAt)<Date.parse(createdAt)||item.reason.startsWith('review_')&&Date.parse(lastChangedAt)>Date.parse(before))throw fail();
      return {objectId:item.objectId,reason:item.reason,createdAt,lastChangedAt};
    });
    if(value.next!==null&&(items.length!==limit||value.next!==items.at(-1)?.objectId))throw fail();
    return {before:iso(before),items,next:value.next};
  }
  if(exact(value,['state'])&&value.state==='missing')return {state:'missing'};
  const cleanup=name==='cleanupRecovery',fields=cleanup?['state','claimState','objectState','writeSettled','proofRecorded','dispatchRecorded']:['state','operationState','objectState','writeSettled','proofRecorded','current'];
  if(!exact(value,fields)||!['reserved','uploading','active','cleanup','deleted'].includes(value.objectState)||typeof value.writeSettled!=='boolean'||typeof value.proofRecorded!=='boolean')throw fail();
  if(cleanup){
    if(!['deleted','waiting','expired','unknown','inconsistent'].includes(value.state)||!['claimed','expired','dispatched','unknown','deleted'].includes(value.claimState)||typeof value.dispatchRecorded!=='boolean')throw fail();
    if(value.state==='deleted'&&(value.claimState!=='deleted'||value.objectState!=='deleted'||!value.writeSettled||!value.proofRecorded||!value.dispatchRecorded))throw fail();
    if(value.state==='waiting'&&(value.claimState!=='claimed'||value.dispatchRecorded||value.objectState!=='cleanup'))throw fail();
    if(value.state==='expired'&&(!['claimed','expired'].includes(value.claimState)||value.dispatchRecorded))throw fail();
    if(value.state==='unknown'&&(!['dispatched','unknown'].includes(value.claimState)||!value.dispatchRecorded||value.objectState!=='cleanup'))throw fail();
  }else{
    if(!['current','cleanup_pending','unsettled','deleted','never_dispatched','reserved','inconsistent'].includes(value.state)||!['reserved','uploading','committed','stale','cancelled'].includes(value.operationState)||typeof value.current!=='boolean')throw fail();
    if(value.state==='deleted'&&(value.objectState!=='deleted'||!value.writeSettled||!value.proofRecorded||value.current))throw fail();
    if(value.state==='current'&&(value.objectState!=='active'||value.operationState!=='committed'||!value.current||!value.writeSettled))throw fail();
    if(value.state==='cleanup_pending'&&(value.objectState!=='cleanup'||!value.writeSettled||value.current))throw fail();
    if(value.state==='unsettled'&&(value.writeSettled||value.current||!['uploading','cleanup'].includes(value.objectState)))throw fail();
    if(value.state==='never_dispatched'&&(value.objectState!=='deleted'||value.writeSettled||value.proofRecorded||value.current||!['stale','cancelled'].includes(value.operationState)))throw fail();
    if(value.state==='reserved'&&(value.objectState!=='reserved'||value.operationState!=='reserved'||value.writeSettled||value.current))throw fail();
  }
  return JSON.parse(JSON.stringify(value));
}
export function createAvatarRecovery({enabled=false,ledger,timeoutMs=4750}={}){
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>4750)throw fail();
  if(enabled===true&&!['cleanupRecovery','uploadRecovery','retentionReview'].every(k=>typeof ledger?.[k]==='function'))throw fail();
  let active=false,closed=false;const controllers=new Set();
  async function read(name,args,context,{signal}={}){
    if(enabled!==true||closed)return {state:'unavailable'};if(signal?.aborted)return {state:'cancelled'};if(active)return {state:'busy'};
    active=true;const c=new AbortController(),abort=()=>c.abort();let timer,onAbort;
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();controllers.add(c);
    const ended=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});});timer=setTimeout(abort,timeoutMs);
    try{
      if(c.signal.aborted)throw fail();
      const raw=await Promise.race([Promise.resolve().then(()=>{if(c.signal.aborted)throw fail();return ledger[name](...args,{signal:c.signal});}),ended]);
      if(c.signal.aborted)throw fail();return recoveryResult(name,raw,context);
    }catch{return {state:'unavailable'};}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();controllers.delete(c);active=false;}
  }
  const lookup=name=>(id,options)=>UUID.test(id)?read(name,[id],{},options):Promise.resolve({state:'invalid'});
  return Object.freeze({cleanup:lookup('cleanupRecovery'),upload:lookup('uploadRecovery'),
    retention({before,after=ZERO,limit=20}={},options){
      if(typeof before!=='string'||before.length!==24||!Number.isFinite(Date.parse(before))||new Date(before).toISOString()!==before||Date.parse(before)<0||Date.parse(before)>Date.now()||!UUID.test(after)||!Number.isInteger(limit)||limit<1||limit>20)return Promise.resolve({state:'invalid'});
      return read('retentionReview',[before,after,limit],{before,after,limit},options);
    },close(){closed=true;for(const c of controllers)c.abort();}});
}
