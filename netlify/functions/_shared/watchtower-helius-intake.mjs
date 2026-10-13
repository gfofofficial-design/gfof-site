import {createHash,timingSafeEqual} from 'node:crypto';
import {base58Bytes} from '../../../lib/watchtower-batch-core.mjs';
const hash=value=>createHash('sha256').update(value).digest();
const response=(status,code)=>new Response(JSON.stringify({schema:1,code}),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
function candidates(payload,watched){
 if(!Array.isArray(payload)||payload.length>100)throw Error('payload');
 const unique=new Map();let duplicates=0,ignored=0;
 for(const tx of payload){
  if(!tx||typeof tx!=='object'||Array.isArray(tx)||!base58Bytes(tx.signature,64)||!Number.isSafeInteger(tx.slot)||tx.slot<1||
   !Array.isArray(tx.accountData)||tx.accountData.length>256||tx.transactionError!=null)throw Error('payload');
  const matched=new Set();
  for(const item of tx.accountData){
   if(!item||!base58Bytes(item.account,32))throw Error('payload');
   if(watched.has(item.account))matched.add(item.account);
  }
  const item={signature:tx.signature,slot:tx.slot,matchedAccounts:[...matched].sort()};
  const prior=unique.get(tx.signature);
  if(prior){if(JSON.stringify(prior)!==JSON.stringify(item))throw Error('conflict');duplicates++;continue;}
  unique.set(tx.signature,item);
 }
 const selected=[];for(const item of unique.values()){if(item.matchedAccounts.length)selected.push(item);else ignored++;}
 selected.sort((a,b)=>a.signature.localeCompare(b.signature));
 return {candidates:selected,duplicates,ignored};
}
// Server-only preparation: no exported HTTP handler/config, environment lookup,
// provider request or actual durable sink is activated by importing this module.
export function createHeliusIntake({enabled=false,authorizationValue,watchedAccounts,acceptReceipt,now=Date.now,timeoutMs=750}={}){
 if(typeof enabled!=='boolean'||typeof now!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>750)throw Error('Invalid intake configuration');
 const configured=typeof authorizationValue==='string'&&/^Bearer [-A-Za-z0-9_]{43,128}$/.test(authorizationValue)&&
  Array.isArray(watchedAccounts)&&watchedAccounts.length>=1&&watchedAccounts.length<=20&&
  watchedAccounts.every(account=>base58Bytes(account,32))&&new Set(watchedAccounts).size===watchedAccounts.length&&typeof acceptReceipt==='function';
 const watched=new Set(configured?watchedAccounts:[]);const expected=configured?hash(authorizationValue):null;
 return async request=>{
  if(!enabled||!configured)return response(503,'INTAKE_DISABLED');
  if(request.method!=='POST')return response(405,'METHOD_NOT_ALLOWED');
  const auth=request.headers.get('authorization');
  if(typeof auth!=='string'||auth.length>256||!timingSafeEqual(expected,hash(auth)))return response(403,'AUTH_FAILED');
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||'')||request.headers.has('content-encoding'))return response(415,'UNSUPPORTED_CONTENT');
  const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>262144))return response(413,'PAYLOAD_LIMIT');
  if(!request.body)return response(400,'INVALID_PAYLOAD');
  const reader=request.body.getReader();const controller=new AbortController();let timer;
  try{
   const work=(async()=>{
    const chunks=[];let bytes=0;
    for(;;){const part=await reader.read();if(controller.signal.aborted)throw Error('deadline');if(part.done)break;bytes+=part.value.byteLength;if(bytes>262144)throw Error('limit');chunks.push(Buffer.from(part.value));}
    const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
    const selected=candidates(parsed,watched);const clock=now();if(!Number.isSafeInteger(clock)||clock<0)throw Error('clock');
    const receipt={schema:1,chain:'solana-mainnet',provider:'helius_enhanced_webhook',receivedAt:new Date(clock).toISOString(),
     headerAuthentication:'shared_authorization_value_matched',sourceAuthenticity:'not_independently_verified',finality:'verification_required',
     ...selected,receiptId:hash(JSON.stringify(selected.candidates)).toString('hex')};
    const accepted=await acceptReceipt(receipt,{signal:controller.signal});
    if(controller.signal.aborted||accepted!==true)throw Error('sink');
    return response(200,'RECEIPT_ACCEPTED');
   })();
   return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('deadline'));},timeoutMs);})]);
  }catch{return response(503,'RECEIPT_NOT_ACCEPTED');}
  finally{clearTimeout(timer);controller.abort();try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}}
 };
}
