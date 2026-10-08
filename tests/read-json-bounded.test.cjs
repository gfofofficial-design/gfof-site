const {test}=require('node:test');const assert=require('node:assert/strict');const {readFileSync}=require('node:fs');const {runInNewContext}=require('node:vm');const {readJsonBounded}=require('../netlify/lib/read-json-bounded.cjs');
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:(x)=>resolve(x)};};
test('headers that ignore abort still settle at the deadline',{timeout:1000},async()=>{
 let signal;await assert.rejects(readJsonBounded('https://fixture.invalid',{}, {timeoutMs:5,maxBytes:100,fetcher:async(_u,o)=>{signal=o.signal;return new Promise(()=>{});}}),{name:'AbortError'});assert.equal(signal.aborted,true);
});
test('a stuck body and stuck cancellation cannot hold the deadline open',{timeout:1000},async()=>{
 let cancelled=0;await assert.rejects(readJsonBounded('https://fixture.invalid',{}, {timeoutMs:5,maxBytes:100,fetcher:async()=>({ok:true,body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel(){cancelled++;return new Promise(()=>{});}})}})}),{name:'AbortError'});assert.equal(cancelled,1);
});
test('oversized bytes reject before parsing even if body cancellation never settles',{timeout:1000},async()=>{
 let cancelled=0;await assert.rejects(readJsonBounded('https://fixture.invalid',{}, {timeoutMs:100,maxBytes:3,fetcher:async()=>({ok:true,body:{getReader:()=>({read:async()=>({done:false,value:Buffer.from('{"secret":1}')}),cancel(){cancelled++;return new Promise(()=>{});}})}})}),/Response unavailable/);assert.equal(cancelled,1);
});
test('late headers cannot start a body read after the deadline',{timeout:1000},async()=>{
 const later=deferred();let reads=0;await assert.rejects(readJsonBounded('https://fixture.invalid',{}, {timeoutMs:5,maxBytes:100,fetcher:()=>later.promise}),{name:'AbortError'});
 later.resolve({ok:true,body:{getReader(){reads++;throw Error('must not read');}}});await new Promise(setImmediate);assert.equal(reads,0);
});
test('successful bounded JSON reads preserve exact text and reject redirects',{timeout:1000},async()=>{
 let signal;const result=await readJsonBounded('https://fixture.invalid',{method:'POST'}, {timeoutMs:100,maxBytes:100,fetcher:async(_u,o)=>{assert.equal(o.redirect,'error');assert.equal(o.method,'POST');signal=o.signal;return new Response('{"amount":"9007199254740993123"}');}});assert.equal(result.amount,'9007199254740993123');assert.equal(signal.aborted,true);
});
function apiFixture(stage){
 const stuck=()=>({ok:true,body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:()=>new Promise(()=>{})})}});
 const fetcher=async(url,options)=>{
  if(url.startsWith('https://api.jup.ag/'))return stage==='price-headers'?new Promise(()=>{}):stage==='price-body'?stuck():new Response('{}');
  if(stage==='rpc-headers')return new Promise(()=>{});if(stage==='rpc-body')return stuck();
  const q=JSON.parse(options.body);return new Response(JSON.stringify({result:q.method==='getBalance'?{context:{slot:2},value:100}:{context:{slot:2},value:[]}}));
 };
 const requests=[];const bounded=(url,options,settings)=>{requests.push({url,timeoutMs:settings.timeoutMs,maxBytes:settings.maxBytes});return readJsonBounded(url,options,{...settings,timeoutMs:5,fetcher});};
 const priceModule={exports:{}};runInNewContext(readFileSync(require('node:path').join(__dirname,'../netlify/lib/wallet-prices.cjs'),'utf8'),{module:priceModule,require:()=>({readJsonBounded:bounded}),fetch:fetcher});
 const walletModule={exports:{}};runInNewContext(readFileSync(require('node:path').join(__dirname,'../netlify/functions/federation-wallet.cjs'),'utf8'),{exports:walletModule.exports,require:p=>p.includes('wallet-prices')?priceModule.exports:{readJsonBounded:bounded},URL,Buffer,fetch:fetcher});
 const origin='https://deploy-preview-99--gfof.netlify.app';return {requests,read:()=>walletModule.exports.handler({rawUrl:origin+'/api/federation-wallet',httpMethod:'POST',headers:{origin,'content-type':'application/json','sec-fetch-site':'same-origin'},body:JSON.stringify({address:'11111111111111111111111111111111'})})};
}
test('RPC header and body deadlines return no partial wallet balances',{timeout:1000},async()=>{
 for(const stage of ['rpc-headers','rpc-body']){const app=apiFixture(stage);const r=await app.read();assert.equal(r.statusCode,503);assert.equal(JSON.parse(r.body).tokens,undefined);assert.equal(app.requests.length,3);for(const q of app.requests){assert.equal(q.timeoutMs,8000);assert.equal(q.maxBytes,2000000);}}
});
test('price header and body deadlines preserve checked on-chain quantities',{timeout:1000},async()=>{
 for(const stage of ['price-headers','price-body']){const app=apiFixture(stage);const r=await app.read();assert.equal(r.statusCode,200);const data=JSON.parse(r.body);assert.equal(data.sol,'0.0000001');assert.equal(data.pricing.status,'unavailable');assert.deepEqual(data.pricing.prices,{});const q=app.requests.find(q=>q.url.startsWith('https://api.jup.ag/'));assert.equal(q.timeoutMs,4000);assert.equal(q.maxBytes,100000);}
});

test('late body bytes cannot continue decoding after a deadline',{timeout:1000},async()=>{
 const later=deferred();let reads=0;
 await assert.rejects(readJsonBounded('https://fixture.invalid',{}, {timeoutMs:5,maxBytes:100,fetcher:async()=>({ok:true,body:{getReader:()=>({read(){reads++;return later.promise;},cancel:()=>new Promise(()=>{})})}})}),{name:'AbortError'});
 later.resolve({done:false,value:Buffer.from('{"amount":"99"}')});await new Promise(setImmediate);assert.equal(reads,1);
});
