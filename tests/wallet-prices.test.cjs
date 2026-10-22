const {test}=require('node:test');const assert=require('node:assert/strict');const {readPrices,SOL}=require('../netlify/lib/wallet-prices.cjs');
const response=data=>async()=>new Response(JSON.stringify(data));
test('missing prices remain missing and stale or mismatched decimal prices are excluded',async()=>{const t=[{mint:'a',decimals:6},{mint:'b',decimals:6},{mint:'c',decimals:6}];const p=await readPrices(t,10000,response({[SOL]:{usdPrice:100,decimals:9,blockId:9999},a:{usdPrice:20,decimals:6,blockId:1},b:{usdPrice:30,decimals:9,blockId:9999}}));assert.deepEqual(Object.keys(p.prices),[SOL]);assert.equal(p.prices.c,undefined);});
test('price outage preserves a usable empty price result',async()=>{const p=await readPrices([],10000,async()=>new Response('error',{status:429}));assert.equal(p.status,'unavailable');assert.deepEqual(p.prices,{});});
test('requests are capped to fifty mints in one fixed-host request',async()=>{let calls=0;const p=await readPrices(Array.from({length:70},(_,i)=>({mint:'mint'+i,decimals:6})),10000,async url=>{calls++;assert.ok(url.startsWith('https://api.jup.ag/price/v3?ids='));assert.equal(url.split('=')[1].split(',').length,50);return new Response('{}');});assert.equal(calls,1);assert.equal(p.unrequested,21);});

test('native and wrapped SOL share one price request slot without displacing another mint',async()=>{
 const tokens=[{mint:SOL,decimals:9},...Array.from({length:49},(_,i)=>({mint:'mint'+i,decimals:6}))];
 let requested;
 const result=await readPrices(tokens,10000,async url=>{
  requested=url.split('=')[1].split(',');
  return new Response(JSON.stringify({[SOL]:{usdPrice:100,decimals:9,blockId:9999},mint48:{usdPrice:2,decimals:6,blockId:9999}}));
 });
 assert.equal(requested.length,50);assert.equal(new Set(requested).size,50);assert.ok(requested.includes('mint48'));
 assert.equal(result.requested,50);assert.equal(result.unrequested,0);assert.equal(result.prices[SOL].usdPrice,100);assert.equal(result.prices.mint48.usdPrice,2);
});
test('omitted price counts use distinct mints on success and outage',async()=>{
 const tokens=[{mint:SOL,decimals:9},{mint:'repeat',decimals:6},{mint:'repeat',decimals:6},...Array.from({length:50},(_,i)=>({mint:'mint'+i,decimals:6}))];
 for(const fail of [false,true]){
  const result=await readPrices(tokens,10000,async url=>{
   const ids=url.split('=')[1].split(',');assert.equal(ids.length,50);assert.equal(new Set(ids).size,50);
   return fail?new Response('busy',{status:429}):new Response('{}');
  });
  assert.equal(result.requested,50);assert.equal(result.unrequested,2);assert.equal(result.status,fail?'unavailable':'available');
 }
});
