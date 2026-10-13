import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createWatchtowerPilotRuntime} from '../netlify/functions/_shared/watchtower-pilot-runtime.mjs';
const config=JSON.parse(await readFile(new URL('../config/watchtower-pilot.json',import.meta.url),'utf8'));
const startup={additionalProviderSpendUsd:0,creditHeadroomChecked:true,automaticPurchasesDisabled:true,providerPauseReviewed:true,storageMigrationApproved:true,storageReady:true,limitsApproved:true,mainnetTransportReviewed:true};
const auth='Bearer '+'x'.repeat(43),key='synthetic-provider-key-not-real';
test('disabled runtime makes no storage or provider calls',async()=>{
 let calls=0;const runtime=createWatchtowerPilotRuntime({query:()=>{calls++;},fetcher:()=>{calls++;}});
 assert.equal(runtime.status,'disabled');assert.equal((await runtime.receive(new Request('https://example.invalid'))).status,503);
 assert.equal((await runtime.processOne()).reason,'worker_disabled');assert.equal(calls,0);
});
test('missing startup declarations refuse assembly before any side effect',()=>{
 for(const change of [{automaticPurchasesDisabled:false},{storageReady:false},{limitsApproved:false},{additionalProviderSpendUsd:49}])assert.throws(()=>createWatchtowerPilotRuntime({enabled:true,config,startup:{...startup,...change},query:async()=>{},apiKey:key,authorizationValue:auth}),/prerequisites/);
 const altered=structuredClone(config);altered.accounts.push(config.accounts[0]);assert.throws(()=>createWatchtowerPilotRuntime({enabled:true,config:altered,startup,query:async()=>{},apiKey:key,authorizationValue:auth}),/Invalid pilot preparation/);
});
test('configured fixture connects header intake, receipt, allowance, reads and atomic finish',async()=>{
 const account=config.accounts[0].address,signature='1'.repeat(64);const order=[];let stored;
 const query=async(sql,args)=>{
  if(sql.includes('enqueue_')){order.push('receipt');stored=JSON.parse(args[0])[0];return {rowCount:1,rows:[{accepted:1}]};}
  if(sql.includes('claim_')){order.push('claim');return {rowCount:1,rows:[{signature:stored.signature,slot:'123',lease_version:'1',state:'leased',matched_accounts:stored.matchedAccounts}]};}
  if(sql.includes('watchtower_rpc_allowance')){order.push('allowance');return {rowCount:1,rows:[{scope:'production'}]};}
  if(sql.includes('finish_')){order.push('finish');assert.equal(JSON.parse(args[2]).emitsFinding,false);return {rowCount:1,rows:[{finished:true}]};}
  throw Error('Unexpected query');
 };
 const fetcher=async(_,options)=>{order.push('rpc');const r=JSON.parse(options.body);return new Response(JSON.stringify({jsonrpc:'2.0',id:r.id,result:r.id===1?
  {slot:123,version:'legacy',meta:{err:null},transaction:{signatures:[signature],message:{accountKeys:[account]}}}:{context:{slot:125},value:[null]}}),{headers:{'content-type':'application/json'}});};
 const runtime=createWatchtowerPilotRuntime({enabled:true,config,startup,query,fetcher,apiKey:key,authorizationValue:auth});
 const response=await runtime.receive(new Request('https://example.invalid/intake',{method:'POST',headers:{authorization:auth,'content-type':'application/json'},body:JSON.stringify([{signature,slot:123,accountData:[{account}]}])}));
 assert.equal(response.status,200);assert.equal((await runtime.processOne()).reason,'corroboration_saved');
 assert.deepEqual(order,['receipt','claim','allowance','rpc','allowance','rpc','finish']);assert.equal(runtime.startupEvidence,'operator_declarations_not_independently_verified');
});
