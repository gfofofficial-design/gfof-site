import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker,{PriceBudget} from '../workers/price-budget-preview/worker.mjs';
import wallet from '../netlify/lib/federation-wallet-handler.cjs';
function fixture(){const db=new DatabaseSync(':memory:');return {db,sql:{exec(q,...args){const statement=db.prepare(q);if(/^SELECT/.test(q))return {toArray:()=>statement.all(...args)};statement.run(...args);return {toArray:()=>[]};}},transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};}
const request=()=>new Request('https://budget.internal/reserve-wallet',{method:'POST'});

test('wallet counter survives recreation, limits simultaneous calls and retains existing price state',async()=>{
 const old=Date.now;let now=100000;Date.now=()=>now;
 try{const s=fixture(),a=new PriceBudget({storage:s});assert.equal(a.fetch().status,200);
  const priceBefore=s.db.prepare('SELECT * FROM budget').get();
  const results=await Promise.all(Array.from({length:100},()=>a.fetch(request())));
  assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===429).length,99);
  assert.deepEqual(s.db.prepare('SELECT * FROM budget').get(),priceBefore);
  const b=new PriceBudget({storage:s});assert.equal(b.fetch(request()).status,429);
  for(let n=1;n<500;n++){now=100000+n*1000;assert.equal(b.fetch(request()).status,200);}
  now+=1000;const denied=b.fetch(request());assert.equal(denied.status,429);assert.equal((await denied.json()).reason,'day');
  assert.equal(s.db.prepare('SELECT used FROM wallet_budget').get().used,500);
  assert.deepEqual(s.db.prepare('SELECT * FROM budget').get(),priceBefore);
  now=86401000;assert.equal(b.fetch(request()).status,200);assert.equal(s.db.prepare('SELECT used FROM wallet_budget').get().used,1);
  s.db.close();
 }finally{Date.now=old;}
});

test('wallet backwards clock and corrupt counter refuse instead of granting new capacity',()=>{
 const old=Date.now;let now=100000;Date.now=()=>now;
 try{const s=fixture(),a=new PriceBudget({storage:s});assert.equal(a.fetch(request()).status,200);
  now=99999;assert.equal(a.fetch(request()).status,503);now=102000;
  s.db.prepare('UPDATE wallet_budget SET used=501').run();assert.equal(a.fetch(request()).status,503);
  assert.equal(s.db.prepare('SELECT used FROM wallet_budget').get().used,501);s.db.close();
 }finally{Date.now=old;}
});

test('new wallet path retains authorization/payload checks and the existing object identity',async()=>{
 let calls=0;const secret='w'.repeat(43),env={BUDGET_SECRET:secret,PRICE_BUDGET:{idFromName(name){assert.equal(name,'price-preview-v1');return name;},get(){return {fetch:async(url)=>{calls++;assert.equal(url,'https://budget.internal/reserve-wallet');return new Response('{"allowed":true}');}};}}};
 for(const [options,status] of [[{method:'POST'},403],[{method:'GET'},405],[{method:'POST',headers:{Authorization:'Bearer '+secret},body:'wallet'},400]])assert.equal((await worker.fetch(new Request('https://example.test/reserve-wallet',options),env)).status,status);
 assert.equal(calls,0);assert.equal((await worker.fetch(new Request('https://example.test/reserve-wallet',{method:'POST',headers:{Authorization:'Bearer '+secret}}),env)).status,200);assert.equal(calls,1);
});

test('missing, partial, malformed and unavailable wallet gates never call Solana on production',async()=>{
 const oldFetch=global.fetch,previous=[process.env.WALLET_BUDGET_URL,process.env.WALLET_BUDGET_SECRET];
 const endpoint='https://gfof-price-budget-preview.gfofofficial.workers.dev/reserve-wallet';
 const event={rawUrl:'https://galacticfederation.co/api/federation-wallet',httpMethod:'POST',headers:{origin:'https://galacticfederation.co','content-type':'application/json'},body:'{"address":"11111111111111111111111111111111"}'};
 try{for(const mode of ['missing','partial','denied','spacing','unreachable','malformed']){
  delete process.env.WALLET_BUDGET_URL;delete process.env.WALLET_BUDGET_SECRET;
  if(mode!=='missing')process.env.WALLET_BUDGET_URL=endpoint;
  if(!['missing','partial'].includes(mode))process.env.WALLET_BUDGET_SECRET='w'.repeat(43);
  let calls=0;global.fetch=async(url,options)=>{calls++;assert.equal(url,endpoint);assert.equal(options.body,undefined);assert.deepEqual(Object.keys(options.headers),['Authorization']);
   if(mode==='unreachable')throw Error('synthetic private error');
   if(mode==='malformed')return new Response('{"allowed":true,"extra":1}');
   return new Response(JSON.stringify({allowed:false,reason:mode==='spacing'?'spacing':'day'}),{status:429});
  };
  const result=await wallet.handler(event);assert.equal(result.statusCode,['denied','spacing'].includes(mode)?429:503,mode);
  const data=JSON.parse(result.body);assert.equal(data.sol,undefined,mode);assert.equal(data.tokens,undefined,mode);
  assert.equal(calls,['missing','partial'].includes(mode)?0:1,mode);
 }}finally{global.fetch=oldFetch;for(const [i,key]of ['WALLET_BUDGET_URL','WALLET_BUDGET_SECRET'].entries()){if(previous[i]===undefined)delete process.env[key];else process.env[key]=previous[i];}}
});
