'use strict';
const {readJsonBounded}=require('./read-json-bounded.cjs');
function env(name){return globalThis.Netlify?.env?.get?globalThis.Netlify.env.get(name):process.env[name];}
async function reservePrice(fetcher=fetch){
 const endpoint=env('PRICE_BUDGET_URL'),secret=env('PRICE_BUDGET_SECRET');
 // Inactive until the isolated preview service is explicitly connected.
 if(!endpoint&&!secret)return true;
 if(typeof endpoint!=='string'||!/^https:\/\/gfof-price-budget-preview\.[a-z0-9-]+\.workers\.dev\/reserve-price$/.test(endpoint)||typeof secret!=='string'||!/^[-A-Za-z0-9_]{43,128}$/.test(secret))return false;
 try{const result=await readJsonBounded(endpoint,{method:'POST',headers:{Authorization:'Bearer '+secret}},{timeoutMs:1500,maxBytes:128,fetcher});return result?.allowed===true&&Object.keys(result).length===1;}catch{return false;}
}
module.exports={reservePrice};
