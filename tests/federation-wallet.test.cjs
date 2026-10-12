const {test}=require('node:test');
const assert=require('node:assert/strict');
const {handler,addressOK,quantity}=require('../netlify/functions/federation-wallet.cjs');
const address='11111111111111111111111111111111';
const origin='https://deploy-preview-104--gfof.netlify.app';
const event={rawUrl:origin+'/api/federation-wallet',httpMethod:'POST',headers:{origin,'content-type':'application/json','sec-fetch-site':'same-origin'},body:JSON.stringify({address})};

test('production without a usable reservation cannot call pricing and keeps confirmed balances',async()=>{
 const oldFetch=global.fetch,oldUrl=process.env.PRICE_BUDGET_URL,oldSecret=process.env.PRICE_BUDGET_SECRET;
 const endpoint='https://gfof-price-budget-preview.example.workers.dev/reserve-price';
 const live='https://galacticfederation.co';
 try{for(const mode of ['missing','partial','denied','unreachable','allowed']){
  delete process.env.PRICE_BUDGET_URL;delete process.env.PRICE_BUDGET_SECRET;
  if(mode!=='missing')process.env.PRICE_BUDGET_URL=endpoint;
  if(!['missing','partial'].includes(mode))process.env.PRICE_BUDGET_SECRET='x'.repeat(43);
  let balanceCalls=0,reservations=0,priceCalls=0;
  global.fetch=async(url,options)=>{
   if(url===endpoint){reservations++;assert.equal(options.body,undefined);
    if(mode==='unreachable')throw Error('synthetic private failure');
    return new Response(JSON.stringify({allowed:mode==='allowed'}),{status:mode==='allowed'?200:429});
   }
   if(url.startsWith('https://api.jup.ag/')){
    priceCalls++;assert.equal(mode,'allowed');assert.equal(reservations,1);
    return new Response(JSON.stringify({So11111111111111111111111111111111111111112:{usdPrice:100,decimals:9,blockId:10000}}));
   }
   balanceCalls++;const req=JSON.parse(options.body);
   return new Response(JSON.stringify({result:req.method==='getBalance'?{context:{slot:10000},value:1234567890}:{context:{slot:10000},value:[]}}));
  };
  const result=await handler({...event,rawUrl:live+'/api/federation-wallet',headers:{...event.headers,origin:live}});
  const data=JSON.parse(result.body);assert.equal(result.statusCode,200,mode);
  assert.equal(balanceCalls,3,mode);assert.equal(data.sol,'1.23456789',mode);
  assert.equal(priceCalls,mode==='allowed'?1:0,mode);
  assert.equal(reservations,['missing','partial'].includes(mode)?0:1,mode);
  assert.equal(data.pricing.status,mode==='allowed'?'available':'unavailable',mode);
  assert.equal(data.pricesAvailable,mode==='allowed',mode);
 }}finally{global.fetch=oldFetch;for(const [key,value] of [['PRICE_BUDGET_URL',oldUrl],['PRICE_BUDGET_SECRET',oldSecret]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

test('canonical production requests read balances while hosts stay isolated',async()=>{
 const old=global.fetch;let calls=0;
 global.fetch=async(url,options)=>{
  if(url.startsWith('https://api.jup.ag/'))return new Response('{}');
  assert.equal(url,'https://api.mainnet-beta.solana.com');calls++;
  const req=JSON.parse(options.body);
  return new Response(JSON.stringify({result:req.method==='getBalance'?{context:{slot:20},value:0}:{context:{slot:21},value:[]}}));
 };
 const live='https://galacticfederation.co';
 try{
  const res=await handler({...event,rawUrl:live+'/api/federation-wallet',headers:{...event.headers,origin:live}});
  assert.equal(res.statusCode,200);assert.equal(calls,3);
  const before=calls;
  for(const bad of [
   {...event,rawUrl:live+'/api/federation-wallet'},
   {...event,headers:{...event.headers,origin:live}},
   {...event,rawUrl:'https://deploy-preview-100--gfof.netlify.app/api/federation-wallet',headers:{...event.headers,origin:'https://deploy-preview-100--gfof.netlify.app'}},
   {...event,rawUrl:live+'/.netlify/functions/federation-wallet',headers:{...event.headers,origin:live}},
   {...event,rawUrl:'https://galacticfederation.co.evil.example/api/federation-wallet',headers:{...event.headers,origin:'https://galacticfederation.co.evil.example'}}
  ])assert.ok((await handler(bad)).statusCode>=400);
  assert.equal(calls,before);
 }finally{global.fetch=old;}
});
test('base58 validation requires exactly 32 decoded bytes',()=>{assert.ok(addressOK(address));assert.ok(addressOK('Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV'));assert.equal(addressOK('1'.repeat(33)),false);assert.equal(addressOK('0'.repeat(32)),false);});
test('quantities preserve integer precision and trim only fractional zeros',()=>{assert.equal(quantity(1000n,0),'1000');assert.equal(quantity(9007199254740993123n,6),'9007199254740.993123');assert.equal(quantity(0n,9),'0');assert.equal(quantity(120000000n,6),'120');});
test('wrong host, direct function, cross-origin and arbitrary payload never query RPC',async()=>{const old=global.fetch;let calls=0;global.fetch=()=>{calls++;throw Error();};try{for(const bad of [{...event,rawUrl:'https://galacticfederation.co/api/federation-wallet'},{...event,rawUrl:origin+'/.netlify/functions/federation-wallet'},{...event,headers:{...event.headers,origin:'https://evil.example'}},{...event,body:JSON.stringify({address,url:'https://evil.example'})},{...event,body:JSON.stringify({address:'1'.repeat(33)})}])assert.ok((await handler(bad)).statusCode>=400);assert.equal(calls,0);}finally{global.fetch=old;}});
test('aggregates same-mint accounts exactly across both token programs',async()=>{const old=global.fetch;let calls=0;const mint='Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV';global.fetch=async(url,options)=>{if(url.startsWith('https://api.jup.ag/'))return new Response('{}');assert.equal(url,'https://api.mainnet-beta.solana.com');const req=JSON.parse(options.body);assert.equal(req.params.at(-1).commitment,'confirmed');calls++;const result=req.method==='getBalance'?{context:{slot:1},value:1234567890}:{context:{slot:2},value:[{pubkey:req.params[1].programId.startsWith('Tokenkeg')?address:mint,account:{owner:req.params[1].programId,data:{parsed:{type:'account',info:{owner:address,mint,tokenAmount:{amount:'9007199254740993123',decimals:6}}}}}}]};return new Response(JSON.stringify({result}));};try{const res=await handler(event);assert.equal(res.statusCode,200);const data=JSON.parse(res.body);assert.equal(calls,3);assert.equal(data.sol,'1.23456789');assert.equal(data.commitment,'confirmed');assert.deepEqual(data.slots,[1,2,2]);assert.equal(data.tokens[0].quantity,'18014398509481.986246');assert.equal(data.tokens[0].symbol,'GFOF');assert.equal(data.pricesAvailable,false);assert.match(res.headers['Cache-Control'],/no-store/);}finally{global.fetch=old;}});
test('an upstream partial failure returns no misleading balances or raw error',async()=>{const old=global.fetch;global.fetch=async()=>new Response(JSON.stringify({error:{message:'private upstream detail'}}));try{const res=await handler(event);assert.equal(res.statusCode,503);assert.ok(!res.body.includes('private upstream detail'));assert.ok(!res.body.includes('tokens'));}finally{global.fetch=old;}});
test('numeric token amounts are rejected instead of being silently rounded',async()=>{const mint='Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV';const old=global.fetch;global.fetch=async(url,options)=>{if(url.startsWith('https://api.jup.ag/'))return new Response('{}');const req=JSON.parse(options.body);const result=req.method==='getBalance'?{context:{slot:10000},value:100}:{context:{slot:10000},value:[{pubkey:req.params[1].programId.startsWith('Tokenkeg')?address:mint,account:{owner:req.params[1].programId,data:{parsed:{type:'account',info:{owner:address,mint:'Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV',tokenAmount:{amount:9007199254740993123,decimals:6}}}}}}]};return new Response(JSON.stringify({result}));};try{const res=await handler(event);assert.equal(res.statusCode,503);assert.ok(!res.body.includes('tokens'));}finally{global.fetch=old;}});
test('missing, negative or unsafe RPC context slots reject the whole balance read',async()=>{const old=global.fetch;try{for(const slot of [null,-1,9007199254740992]){global.fetch=async(url,options)=>{if(url.startsWith('https://api.jup.ag/'))return new Response('{}');const req=JSON.parse(options.body);const result=req.method==='getBalance'?{context:{slot},value:100}:{context:{slot:10000},value:[]};return new Response(JSON.stringify({result}));};assert.equal((await handler(event)).statusCode,503);}}finally{global.fetch=old;}});

test('duplicate account identities and mismatched token programs reject all balances',async()=>{
 const old=global.fetch;const mint='Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV';
 try{for(const mode of ['duplicate-within','duplicate-across','wrong-program','missing-pubkey','wrong-type','over-u64']){
  global.fetch=async(url,options)=>{
   if(url.startsWith('https://api.jup.ag/'))throw Error('Invalid balances must not reach pricing');
   const req=JSON.parse(options.body);
   if(req.method==='getBalance')return new Response(JSON.stringify({result:{context:{slot:1},value:100}}));
   const program=req.params[1].programId;const original=program.startsWith('Tokenkeg');
   const account={pubkey:original?address:mint,account:{owner:program,data:{parsed:{type:'account',info:{owner:address,mint,tokenAmount:{amount:'1',decimals:6}}}}}};
   if(mode==='duplicate-across')account.pubkey=address;
   if(mode==='wrong-program')account.account.owner=address;
   if(mode==='missing-pubkey')delete account.pubkey;
   if(mode==='wrong-type')account.account.data.parsed.type='mint';
   if(mode==='over-u64')account.account.data.parsed.info.tokenAmount.amount='18446744073709551616';
   return new Response(JSON.stringify({result:{context:{slot:2},value:mode==='duplicate-within'?[account,account]:[account]}}));
  };
  const result=await handler(event);assert.equal(result.statusCode,503,mode);
  assert.equal(JSON.parse(result.body).tokens,undefined,mode);
 }}finally{global.fetch=old;}
});
test('the maximum unsigned 64-bit account amount remains exact',async()=>{
 const old=global.fetch;const mint='Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV';
 global.fetch=async(url,options)=>{
  if(url.startsWith('https://api.jup.ag/'))return new Response('{}');
  const req=JSON.parse(options.body);const result=req.method==='getBalance'?{context:{slot:1},value:0}:{context:{slot:2},value:req.params[1].programId.startsWith('Tokenkeg')?[{pubkey:address,account:{owner:req.params[1].programId,data:{parsed:{type:'account',info:{owner:address,mint,tokenAmount:{amount:'18446744073709551615',decimals:6}}}}}}]:[]};
  return new Response(JSON.stringify({result}));
 };
 try{const result=await handler(event);assert.equal(result.statusCode,200);assert.equal(JSON.parse(result.body).tokens[0].quantity,'18446744073709.551615');}finally{global.fetch=old;}
});
