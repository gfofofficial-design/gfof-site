const {test}=require('node:test');
const assert=require('node:assert/strict');
const {handler}=require('../netlify/functions/federation-wallet.cjs');
const {readPrices}=require('../netlify/lib/wallet-prices.cjs');
const {solanaProvider,jupiterOptions}=require('../netlify/lib/data-provider-config.cjs');
const origin='https://deploy-preview-104--gfof.netlify.app';
const event={rawUrl:origin+'/api/federation-wallet',httpMethod:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({address:'11111111111111111111111111111111'})};
test('runtime keys reach only their fixed upstream and never the wallet response',async()=>{
 const previous=global.Netlify,previousFetch=global.fetch;const calls=[];
 global.Netlify={env:{get:name=>({HELIUS_API_KEY:'fixture-helius-key',JUPITER_API_KEY:'fixture-jupiter-key'})[name]}};
 global.fetch=async(url,options)=>{calls.push({url,options});assert.equal(options.redirect,'error');
  if(url.startsWith('https://api.jup.ag/')){assert.deepEqual(options.headers,{'x-api-key':'fixture-jupiter-key'});return new Response('{}');}
  assert.equal(url,'https://mainnet.helius-rpc.com/?api-key=fixture-helius-key');assert.equal(options.headers['x-api-key'],undefined);
  const req=JSON.parse(options.body);return new Response(JSON.stringify({result:req.method==='getBalance'?{context:{slot:20},value:0}:{context:{slot:20},value:[]}}));
 };
 try{const r=await handler(event);assert.equal(r.statusCode,200);assert.equal(calls.length,4);assert.equal(JSON.parse(r.body).source,'Helius Solana RPC');assert.doesNotMatch(r.body,/fixture-|api-key|helius-rpc/);}
 finally{global.Netlify=previous;global.fetch=previousFetch;}
});
test('malformed Helius configuration fails before any network request or key disclosure',async()=>{
 const previous=global.Netlify,previousFetch=global.fetch;let calls=0;
 global.Netlify={env:{get:()=> 'bad\nprivate-value'}};global.fetch=()=>{calls++;throw Error();};
 try{const r=await handler(event);assert.equal(r.statusCode,503);assert.equal(calls,0);assert.doesNotMatch(r.body,/private-value/);}
 finally{global.Netlify=previous;global.fetch=previousFetch;}
});
test('malformed Jupiter configuration preserves unavailable pricing without network calls',async()=>{
 const previous=global.Netlify;global.Netlify={env:{get:()=> 'bad\nprivate-value'}};let calls=0;
 try{const r=await readPrices([],20,()=>{calls++;throw Error();});assert.equal(r.status,'unavailable');assert.equal(calls,0);assert.doesNotMatch(JSON.stringify(r),/private-value/);}
 finally{global.Netlify=previous;}
});
test('missing runtime keys retain the explicit public preview path',()=>{
 const previous=global.Netlify;global.Netlify={env:{get:()=>undefined}};
 try{assert.equal(solanaProvider().url,'https://api.mainnet-beta.solana.com');assert.deepEqual(jupiterOptions(),{});}
 finally{global.Netlify=previous;}
});
