import {base58Bytes} from '../../../lib/watchtower-batch-core.mjs';
export function createWatchtowerReceiptSink({query}={}){
 if(typeof query!=='function')throw Error('Invalid receipt sink configuration');
 return async(receipt,{signal}={})=>{
  if(signal?.aborted||!receipt||receipt.schema!==1||receipt.chain!=='solana-mainnet'||receipt.provider!=='helius_enhanced_webhook'||
   receipt.headerAuthentication!=='shared_authorization_value_matched'||receipt.finality!=='verification_required'||
   !Array.isArray(receipt.candidates)||receipt.candidates.length>100)return false;
  const seen=new Set();const items=[];
  for(const item of receipt.candidates){
   if(!item||!base58Bytes(item.signature,64)||seen.has(item.signature)||!Number.isSafeInteger(item.slot)||item.slot<1||
    !Array.isArray(item.matchedAccounts)||item.matchedAccounts.length<1||item.matchedAccounts.length>20||
    new Set(item.matchedAccounts).size!==item.matchedAccounts.length||!item.matchedAccounts.every(a=>base58Bytes(a,32)))return false;
   seen.add(item.signature);items.push({signature:item.signature,slot:item.slot,matchedAccounts:[...item.matchedAccounts].sort()});
  }
  items.sort((a,b)=>a.signature.localeCompare(b.signature));
  try{const result=await query('SELECT public.enqueue_watchtower_candidates($1::jsonb) AS accepted',[JSON.stringify(items)]);
   return !signal?.aborted&&result.rowCount===1&&result.rows[0]?.accepted===items.length;
  }catch{return false;}
 };
}
