'use strict';
const {readJsonBounded}=require('./read-json-bounded.cjs');
const {jupiterOptions}=require('./data-provider-config.cjs');
const SOL='So11111111111111111111111111111111111111112';
async function readPrices(tokens,slot,fetcher=fetch){
 const distinctIds=[...new Set([SOL,...tokens.map(t=>t.mint)])];const ids=distinctIds.slice(0,50);const prices={};
 try{const data=await readJsonBounded('https://api.jup.ag/price/v3?ids='+ids.join(','),jupiterOptions(),{timeoutMs:4000,maxBytes:100000,fetcher});if(!data||typeof data!=='object'||Array.isArray(data))throw Error();
  for(const id of ids){const p=data[id];const decimals=id===SOL?9:tokens.find(t=>t.mint===id)?.decimals;if(!p||!Number.isFinite(p.usdPrice)||p.usdPrice<=0||!Number.isSafeInteger(p.blockId)||!Number.isSafeInteger(slot)||p.decimals!==decimals)continue;const lag=slot-p.blockId;if(lag< -150||lag>9000)continue;prices[id]={usdPrice:p.usdPrice,blockId:p.blockId};}
  return {source:'Jupiter Price V3',status:'available',requested:ids.length,unrequested:Math.max(0,distinctIds.length-ids.length),prices};
 }catch{return {source:'Jupiter Price V3',status:'unavailable',requested:ids.length,unrequested:Math.max(0,distinctIds.length-ids.length),prices};}
}
module.exports={readPrices,SOL};

