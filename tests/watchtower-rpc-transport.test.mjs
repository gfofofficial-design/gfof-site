import test from 'node:test';import assert from 'node:assert/strict';
import {createWatchtowerRpcTransport} from '../netlify/functions/_shared/watchtower-rpc-transport.mjs';
import {createCandidateVerifier} from '../netlify/functions/_shared/watchtower-verify-candidate.mjs';
const request=()=>({jsonrpc:'2.0',id:1,method:'getTransaction',params:['1'.repeat(64),{commitment:'finalized',encoding:'json',maxSupportedTransactionVersion:0}]});
const key='synthetic-fixture-key-not-a-real-key';
const reply=(value={jsonrpc:'2.0',id:1,result:null})=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
test('disabled and unsupported methods issue no request',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return reply();};
 await assert.rejects(createWatchtowerRpcTransport({fetcher})(request()),/disabled/);
 const run=createWatchtowerRpcTransport({enabled:true,apiKey:key,fetcher});
 for(const r of [{...request(),method:'sendTransaction'},{...request(),extra:true},{...request(),params:['1'.repeat(64),{commitment:'confirmed',encoding:'json',maxSupportedTransactionVersion:0}]}])await assert.rejects(run(r),/refused/);
 assert.equal(calls,0);
});
test('allowed request stays on fixed HTTPS origin with redirects and credentials disabled',async()=>{
 const run=createWatchtowerRpcTransport({enabled:true,apiKey:key,fetcher:async(url,options)=>{
  const u=new URL(url);assert.equal(u.origin,'https://mainnet.helius-rpc.com');assert.equal(u.pathname,'/');assert.equal(u.searchParams.get('api-key'),key);
  assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.deepEqual(JSON.parse(options.body),request());return reply({jsonrpc:'2.0',id:1,result:null,extra:'private detail'});
 }});assert.deepEqual(await run(request()),{jsonrpc:'2.0',id:1,result:null});
});
test('account reads enforce bounded finalized options',async()=>{
 let calls=0;const run=createWatchtowerRpcTransport({enabled:true,apiKey:key,fetcher:async()=>{calls++;return reply({jsonrpc:'2.0',id:2,result:{}});}});
 const r={jsonrpc:'2.0',id:2,method:'getMultipleAccounts',params:[['1'.repeat(32)],{commitment:'finalized',encoding:'base64',minContextSlot:123}]};
 assert.equal((await run(r)).id,2);await assert.rejects(run({...r,params:[Array(21).fill('1'.repeat(32)),r.params[1]]}),/refused/);assert.equal(calls,1);
});
test('provider errors and wrong RPC IDs return only sanitized failures',async()=>{
 for(const fetcher of [async()=>reply({jsonrpc:'2.0',id:999,result:null}),async()=>reply({jsonrpc:'2.0',id:1,error:{message:'private detail '+key}}),async()=>{throw Error('endpoint '+key);}]){
  await assert.rejects(createWatchtowerRpcTransport({enabled:true,apiKey:key,fetcher})(request()),error=>error.message==='RPC unavailable');
 }
});
test('oversized, malformed UTF-8 and wrong content-type bodies fail closed',async()=>{
 for(const response of [new Response('x'.repeat(1048577),{headers:{'content-type':'application/json'}}),new Response(Buffer.from([0xff]),{headers:{'content-type':'application/json'}}),new Response('{}',{headers:{'content-type':'text/html'}})]){
  await assert.rejects(createWatchtowerRpcTransport({enabled:true,apiKey:key,fetcher:async()=>response})(request()),/RPC unavailable/);
 }
});
test('stalled headers or body time out even when cancellation is ignored',async()=>{
 for(const fetcher of [()=>new Promise(()=>{}),async()=>new Response(new ReadableStream({start(){}}),{headers:{'content-type':'application/json'}})])await assert.rejects(createWatchtowerRpcTransport({enabled:true,apiKey:key,fetcher,timeoutMs:10})(request()),/RPC unavailable/);
});
test('external cancellation stops before fetch and bounds an in-flight request',async()=>{
 let calls=0;const controller=new AbortController();const run=createWatchtowerRpcTransport({enabled:true,apiKey:key,fetcher:()=>{calls++;return new Promise(()=>{});}});
 controller.abort();await assert.rejects(run(request(),{signal:controller.signal}),/RPC unavailable/);assert.equal(calls,0);
 const next=new AbortController();const promise=run(request(),{signal:next.signal});next.abort();await assert.rejects(promise,/RPC unavailable/);assert.equal(calls,1);
});
test('response ID stays bound to the submitted request after caller mutation',async()=>{
 const r=request();let release;const run=createWatchtowerRpcTransport({enabled:true,apiKey:key,fetcher:()=>new Promise(resolve=>{release=resolve;})});
 const pending=run(r);r.id=99;release(reply());assert.equal((await pending).id,1);
});
test('transport and verifier compose with synthetic responses and two reserved reads',async()=>{
 const account='1'.repeat(32),signature='1'.repeat(64);let requests=0,reservations=0;
 const rpc=createWatchtowerRpcTransport({enabled:true,apiKey:key,fetcher:async(_,options)=>{
  requests++;const r=JSON.parse(options.body);return reply({jsonrpc:'2.0',id:r.id,result:r.id===1?
   {slot:123,version:'legacy',meta:{err:null},transaction:{signatures:[signature],message:{accountKeys:[account]}}}:
   {context:{slot:125},value:[null]}});
 }});
 const verify=createCandidateVerifier({enabled:true,watchedAccounts:[account],rpc,reserveAllowance:async()=>{reservations++;return true;}});
 const r=await verify({signature,slot:123,matchedAccounts:[account]});assert.equal(r.method,'rpc_corroborated_candidate');assert.equal(r.emitsFinding,false);assert.equal(requests,2);assert.equal(reservations,2);
});
