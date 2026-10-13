'use strict';
const {readJsonBounded}=require('./read-json-bounded.cjs');
function env(name){return globalThis.Netlify?.env?.get?globalThis.Netlify.env.get(name):process.env[name];}
async function reserveWallet(fetcher=fetch,{required=false}={}){
 const endpoint=env('WALLET_BUDGET_URL'),secret=env('WALLET_BUDGET_SECRET');
 if(!endpoint&&!secret)return {allowed:!required,reason:required?'unavailable':null};
 if(endpoint!=='https://gfof-price-budget-preview.gfofofficial.workers.dev/reserve-wallet'||typeof secret!=='string'||!/^[-A-Za-z0-9_]{43,128}$/.test(secret))return {allowed:false,reason:'unavailable'};
 let status;
 try{
  const data=await readJsonBounded(endpoint,{method:'POST',headers:{Authorization:'Bearer '+secret}},{timeoutMs:1500,maxBytes:128,fetcher:async(url,options)=>{
   const response=await fetcher(url,options);status=response.status;
   // Only the service's bounded 429 refusal envelope is parsed as a failure.
   return status===429?{ok:true,body:response.body}:response;
  }});
  if(status===200&&data?.allowed===true&&Object.keys(data).length===1)return {allowed:true,reason:null};
  if(status===429&&data?.allowed===false&&Object.keys(data).sort().join(',')==='allowed,reason'&&['day','spacing'].includes(data.reason))return {allowed:false,reason:data.reason};
 }catch{}
 return {allowed:false,reason:'unavailable'};
}
module.exports={reserveWallet};
