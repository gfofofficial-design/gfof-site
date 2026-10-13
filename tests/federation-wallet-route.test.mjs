import {test} from 'node:test';
import assert from 'node:assert/strict';
import route from '../netlify/functions/federation-wallet.mjs';
const origin = 'https://deploy-preview-104--gfof.netlify.app';
const address = '11111111111111111111111111111111';
function request(body=JSON.stringify({address}), overrides={}) {
  return new Request(overrides.url || origin+'/api/federation-wallet', {
    method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/json'},
    body, ...overrides,
  });
}

test('modern wallet route keeps request boundaries and raw byte cap before providers', async()=>{
  const old=global.fetch; let calls=0;global.fetch=async()=>{calls++;throw Error('provider must not run');};
  try {
    const cases=[
      [request('{}',{method:'POST',url:origin+'/.netlify/functions/federation-wallet'}),404],
      [request(null,{method:'GET'}),405],
      [request('{}',{headers:{Origin:'https://elsewhere.example','Content-Type':'application/json'}}),403],
      [request('{}',{url:origin+'/api/federation-wallet?address=other'}),404],
      [request('{}',{headers:{Origin:origin,'Content-Type':'text/plain'}}),400],
      [request('invalid JSON'),400],
      [request(' '.repeat(256)+JSON.stringify({address})),400],
      [request(JSON.stringify({address,url:'https://elsewhere.example'})),400],
    ];
    for(const [req,status] of cases){const r=await route(req);assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'private, no-store');}
    assert.equal(calls,0);
  }finally{global.fetch=old;}
});

test('modern route preserves parsed balances, source slots and available reference price',async()=>{
  const old=global.fetch;let rpcCalls=0;
  global.fetch=async(url,options)=>{
    if(url.startsWith('https://api.jup.ag/'))return new Response(JSON.stringify({So11111111111111111111111111111111111111112:{usdPrice:100,decimals:9,blockId:10000}}));
    assert.equal(url,'https://api.mainnet-beta.solana.com');rpcCalls++;
    const data=JSON.parse(options.body);
    return new Response(JSON.stringify({result:data.method==='getBalance'?{context:{slot:10000},value:1234567890}:{context:{slot:10001},value:[]}}));
  };
  try{const r=await route(request());const d=await r.json();assert.equal(r.status,200);assert.equal(rpcCalls,3);assert.equal(d.sol,'1.23456789');assert.deepEqual(d.slots,[10000,10001,10001]);assert.equal(d.pricesAvailable,true);assert.equal(r.headers.get('netlify-cdn-cache-control'),'no-store');}finally{global.fetch=old;}
});

test('an ignored-cancellation inbound stream settles without a late provider call',{timeout:4000},async()=>{
  const old=global.fetch;let calls=0,cancelled=0,finish;
  global.fetch=async()=>{calls++;throw Error('provider must not run');};
  const req={url:origin+'/api/federation-wallet',method:'POST',headers:new Headers({Origin:origin,'Content-Type':'application/json'}),body:{getReader:()=>({read:()=>new Promise(r=>{finish=r;}),cancel(){cancelled++;return new Promise(()=>{});}})}};
  try{const r=await route(req);assert.equal(r.status,400);assert.equal(calls,0);assert.equal(cancelled,1);finish({done:false,value:new TextEncoder().encode(JSON.stringify({address}))});await new Promise(setImmediate);assert.equal(calls,0);}finally{global.fetch=old;}
});
