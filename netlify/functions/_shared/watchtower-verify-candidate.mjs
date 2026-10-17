import {createHash} from 'node:crypto';
import {base58Bytes} from '../../../lib/watchtower-batch-core.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
const validSlot=value=>Number.isSafeInteger(value)&&value>0;
function result(response,id){
 if(!response||response.jsonrpc!=='2.0'||response.id!==id||Object.hasOwn(response,'error')||!Object.hasOwn(response,'result')||
  Buffer.byteLength(JSON.stringify(response),'utf8')>1048576)throw Error('rpc');
 return response.result;
}
export function createCandidateVerifier({enabled=false,watchedAccounts,rpc,reserveAllowance,timeoutMs=8000}={}){
 if(typeof enabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>8000)throw Error('Invalid verifier configuration');
 const configured=Array.isArray(watchedAccounts)&&watchedAccounts.length>=1&&watchedAccounts.length<=20&&
  new Set(watchedAccounts).size===watchedAccounts.length&&watchedAccounts.every(a=>base58Bytes(a,32))&&typeof rpc==='function'&&typeof reserveAllowance==='function';
 const watched=new Set(configured?watchedAccounts:[]);
 return async(candidate,{signal}={})=>{
  const unavailable=reason=>({schema:1,method:'verification_unavailable',reason,emitsFinding:false});
  if(!enabled||!configured)return unavailable('verifier_disabled');
  if((signal!==undefined&&!(signal instanceof AbortSignal))||signal?.aborted)return unavailable('verification_failed');
  if(!candidate||Object.keys(candidate).sort().join(',')!=='matchedAccounts,signature,slot'||!base58Bytes(candidate.signature,64)||!validSlot(candidate.slot)||
   !Array.isArray(candidate.matchedAccounts)||candidate.matchedAccounts.length<1||candidate.matchedAccounts.length>20||
   new Set(candidate.matchedAccounts).size!==candidate.matchedAccounts.length||!candidate.matchedAccounts.every(a=>watched.has(a)))return unavailable('invalid_candidate');
  const signature=candidate.signature,slot=candidate.slot,accounts=[...candidate.matchedAccounts].sort();
  const controller=new AbortController();let timer;
  const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  const stopped=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Error('deadline')),{once:true}));
  const read=async(id,method,params)=>{
   if(controller.signal.aborted)throw Error('deadline');
   if(await reserveAllowance({purpose:'watchtower_candidate_verification',method,maxRequests:1,maxResponseBytes:1048576},{signal:controller.signal})!==true||controller.signal.aborted)throw Error('allowance');
   const response=await rpc({jsonrpc:'2.0',id,method,params},{signal:controller.signal});
   if(controller.signal.aborted)throw Error('deadline');return result(response,id);
  };
  try{
   const work=(async()=>{
    const tx=await read(1,'getTransaction',[signature,{commitment:'finalized',encoding:'json',maxSupportedTransactionVersion:0}]);
    if(tx===null)return unavailable('transaction_not_available_at_finalized');
    if(!tx||tx.slot!==slot||!tx.meta||tx.meta.err!==null||![0,'legacy'].includes(tx.version)||
     !Array.isArray(tx.transaction?.signatures)||tx.transaction.signatures.length<1||tx.transaction.signatures.length>64||
     tx.transaction.signatures[0]!==signature||!tx.transaction.signatures.every(s=>base58Bytes(s,64))||
     !Array.isArray(tx.transaction.message?.accountKeys))return unavailable('transaction_evidence_mismatch');
    const keys=[...tx.transaction.message.accountKeys];
    const loaded=tx.meta.loadedAddresses;
    if(tx.version===0&&(!loaded||!Array.isArray(loaded.writable)||!Array.isArray(loaded.readonly)))return unavailable('loaded_accounts_unavailable');
    if(loaded){if(!Array.isArray(loaded.writable)||!Array.isArray(loaded.readonly))return unavailable('loaded_accounts_unavailable');keys.push(...loaded.writable,...loaded.readonly);}
    if(keys.length>256||!keys.every(a=>base58Bytes(a,32))||!accounts.every(a=>keys.includes(a)))return unavailable('watched_accounts_not_corroborated');
    const snapshot=await read(2,'getMultipleAccounts',[accounts,{commitment:'finalized',encoding:'base64',minContextSlot:slot}]);
    if(!snapshot||!validSlot(snapshot.context?.slot)||snapshot.context.slot<slot||!Array.isArray(snapshot.value)||snapshot.value.length!==accounts.length)return unavailable('account_context_mismatch');
    const states=snapshot.value.map((value,index)=>{
     if(value===null)return {account:accounts[index],state:'absent_at_account_slot',slot:snapshot.context.slot};
     if(!value||!base58Bytes(value.owner,32)||typeof value.executable!=='boolean'||!Array.isArray(value.data)||value.data.length!==2||value.data[1]!=='base64'||
      typeof value.data[0]!=='string'||value.data[0].length>43692)throw Error('account');
     const bytes=Buffer.from(value.data[0],'base64');if(bytes.length>32768||bytes.toString('base64')!==value.data[0])throw Error('account');
     return {account:accounts[index],state:'present_at_account_slot',slot:snapshot.context.slot,ownerProgram:value.owner,executable:value.executable,
      dataBytes:bytes.length,dataSha256:digest(bytes),stateSha256:digest(JSON.stringify({owner:value.owner,executable:value.executable,data:value.data[0]}))};
    });
    return {schema:1,method:'rpc_corroborated_candidate',signature,transactionSlot:slot,accountSlot:snapshot.context.slot,states,emitsFinding:false,
     sourceAuthenticity:'rpc_response_not_cryptographically_verified',finality:'finalized_requested_from_reviewed_rpc',
     limitations:['Transaction and account reads are separate observations.','Current account state is not necessarily the state immediately after this transaction.','No transfer, sale, owner identity, authority change, lock effect or safety verdict is inferred.','Reviewed mainnet RPC provenance and authenticated transport are caller requirements.']};
   })();
   timer=setTimeout(abort,timeoutMs);
   return await Promise.race([work,stopped]);
  }catch{return unavailable('verification_failed');}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.abort();}
 };
}
