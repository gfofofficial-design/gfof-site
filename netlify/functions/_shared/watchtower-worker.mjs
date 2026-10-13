import {base58Bytes} from '../../../lib/watchtower-batch-core.mjs';
const integer=value=>typeof value==='string'&&/^[1-9][0-9]*$/.test(value)?Number(value):value;
const positive=value=>Number.isSafeInteger(value)&&value>0;
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function project(value,candidate){
 if(!value||value.schema!==1||value.method!=='rpc_corroborated_candidate'||value.emitsFinding!==false||value.signature!==candidate.signature||
  value.transactionSlot!==candidate.slot||!positive(value.accountSlot)||value.accountSlot<candidate.slot||
  value.sourceAuthenticity!=='rpc_response_not_cryptographically_verified'||value.finality!=='finalized_requested_from_reviewed_rpc'||
  !Array.isArray(value.states)||value.states.length!==candidate.matchedAccounts.length)return null;
 const states=[];
 for(let i=0;i<value.states.length;i++){
  const state=value.states[i];if(!state||state.account!==candidate.matchedAccounts[i]||state.slot!==value.accountSlot)return null;
  const item={account:state.account,state:state.state,slot:state.slot};
  if(state.state==='present_at_account_slot'){
   if(!base58Bytes(state.ownerProgram,32)||typeof state.executable!=='boolean'||!Number.isInteger(state.dataBytes)||state.dataBytes<0||state.dataBytes>32768||!sha(state.dataSha256)||!sha(state.stateSha256))return null;
   Object.assign(item,{ownerProgram:state.ownerProgram,executable:state.executable,dataBytes:state.dataBytes,dataSha256:state.dataSha256,stateSha256:state.stateSha256});
  }else if(state.state!=='absent_at_account_slot')return null;
  states.push(item);
 }
 return {schema:1,method:value.method,signature:candidate.signature,transactionSlot:candidate.slot,accountSlot:value.accountSlot,
  sourceAuthenticity:value.sourceAuthenticity,finality:value.finality,emitsFinding:false,states};
}
export function createWatchtowerWorker({enabled=false,query,verify,timeoutMs=10000}={}){
 if(typeof enabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw Error('Invalid worker configuration');
 return async()=>{
  const outcome=reason=>({schema:1,mode:'single_candidate_worker',reason,emitsFinding:false});
  if(!enabled||typeof query!=='function'||typeof verify!=='function')return outcome('worker_disabled');
  const controller=new AbortController();let timer;
  try{
   const work=(async()=>{
    const claim=await query('SELECT * FROM public.claim_watchtower_candidate()',[]);
    if(controller.signal.aborted)throw Error('deadline');
    if(claim.rowCount===0)return outcome('no_candidate');
    if(claim.rowCount!==1)throw Error('claim');
    const row=claim.rows[0],slot=integer(row?.slot),version=integer(row?.lease_version),accounts=row?.matched_accounts;
    if(!base58Bytes(row?.signature,64)||!positive(slot)||!positive(version)||row.state!=='leased'||!Array.isArray(accounts)||accounts.length<1||accounts.length>20||
     new Set(accounts).size!==accounts.length||!accounts.every(a=>base58Bytes(a,32))||accounts.join(',')!==[...accounts].sort().join(','))throw Error('claim');
    const candidate={signature:row.signature,slot,matchedAccounts:[...accounts]};
    const raw=await verify(candidate,{signal:controller.signal});if(controller.signal.aborted)throw Error('deadline');
    const evidence=project(raw,candidate);if(!evidence)return outcome('verification_not_completed');
    const result=await query('SELECT public.finish_watchtower_candidate($1,$2,$3::jsonb) AS finished',[candidate.signature,version,JSON.stringify(evidence)]);
    if(controller.signal.aborted)throw Error('deadline');
    return outcome(result.rowCount===1&&result.rows[0]?.finished===true?'corroboration_saved':'lease_or_completion_not_accepted');
   })();
   return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('deadline'));},timeoutMs);})]);
  }catch{return outcome('worker_failed');}finally{clearTimeout(timer);controller.abort();}
 };
}
