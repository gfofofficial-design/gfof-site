import test from 'node:test';import assert from 'node:assert/strict';
import {createCandidateVerifier} from '../netlify/functions/_shared/watchtower-verify-candidate.mjs';
const account='1'.repeat(32),signature='1'.repeat(64),candidate={signature,slot:123,matchedAccounts:[account]};
const tx=()=>({slot:123,version:'legacy',meta:{err:null},transaction:{signatures:[signature],message:{accountKeys:[account]}}});
const state=()=>({context:{slot:125},value:[{owner:account,executable:false,data:[Buffer.from('fixture').toString('base64'),'base64']}]});
function setup(change={}){const calls=[];const reserveAllowance=async value=>{calls.push('reserve:'+value.method);return true;};
 const rpc=async req=>{calls.push(req);return {jsonrpc:'2.0',id:req.id,result:req.id===1?tx():state()};};
 return {calls,run:createCandidateVerifier({enabled:true,watchedAccounts:[account],reserveAllowance,rpc,...change})};}
test('two reservations precede bounded finalized reads and state hashes',async()=>{
 const {calls,run}=setup();const r=await run(candidate);assert.equal(r.method,'rpc_corroborated_candidate');assert.equal(r.emitsFinding,false);
 assert.equal(r.transactionSlot,123);assert.equal(r.accountSlot,125);assert.equal(r.states[0].ownerProgram,account);assert.equal(r.states[0].dataBytes,7);
 assert.deepEqual(calls.map(c=>typeof c==='string'?c:c.method),['reserve:getTransaction','getTransaction','reserve:getMultipleAccounts','getMultipleAccounts']);
 assert.equal(calls[1].params[1].commitment,'finalized');assert.equal(calls[3].params[1].minContextSlot,123);assert.ok(!JSON.stringify(r).includes('fixture'));
});
test('disabled, unsupported scope and denied allowance never issue RPC calls',async()=>{
 const disabled=await createCandidateVerifier()(candidate);assert.equal(disabled.reason,'verifier_disabled');
 const {calls,run}=setup({reserveAllowance:async()=>false});assert.equal((await run(candidate)).reason,'verification_failed');assert.equal(calls.length,0);
 const invalid=setup();assert.equal((await invalid.run({...candidate,matchedAccounts:['1'.repeat(31)+'2']})).reason,'invalid_candidate');assert.equal(invalid.calls.length,0);
});
test('null or mismatched transactions stop before account-state lookup',async()=>{
 for(const value of [null,{...tx(),slot:124},{...tx(),meta:{err:{failed:true}}},{...tx(),transaction:{signatures:['1'.repeat(63)+'2'],message:{accountKeys:[account]}}},
  {...tx(),version:0},{...tx(),transaction:{signatures:[signature],message:{accountKeys:['1'.repeat(31)+'2']}}}]){
  let count=0;const {run}=setup({rpc:async req=>{count++;return {jsonrpc:'2.0',id:req.id,result:value};}});
  assert.equal((await run(candidate)).method,'verification_unavailable');assert.equal(count,1);
 }
});
test('loaded version-zero accounts can corroborate scope; absent state stays explicit',async()=>{
 const {run}=setup({rpc:async req=>({jsonrpc:'2.0',id:req.id,result:req.id===1?{...tx(),version:0,meta:{err:null,loadedAddresses:{writable:[account],readonly:[]}},transaction:{signatures:[signature],message:{accountKeys:[]}}}:{context:{slot:123},value:[null]}})});
 const r=await run(candidate);assert.equal(r.method,'rpc_corroborated_candidate');assert.equal(r.states[0].state,'absent_at_account_slot');assert.equal(r.states[0].dataSha256,undefined);
});
test('older slots, missing data and malformed account bytes never corroborate state',async()=>{
 for(const snapshot of [{context:{slot:122},value:[null]},{context:{slot:125},value:[]},{context:{slot:125},value:[{owner:account,executable:false,data:['!!!!','base64']}]}]){
  const {run}=setup({rpc:async req=>({jsonrpc:'2.0',id:req.id,result:req.id===1?tx():snapshot})});assert.equal((await run(candidate)).method,'verification_unavailable');
 }
});
test('wrong RPC binding, provider errors and cancellation-ignoring transport fail closed',async()=>{
 for(const rpc of [async()=>({jsonrpc:'2.0',id:999,result:tx()}),async()=>({jsonrpc:'2.0',id:1,error:{message:'private provider detail'}}),()=>new Promise(()=>{})]){
  const {run}=setup({rpc,timeoutMs:10});const r=await run(candidate);assert.equal(r.method,'verification_unavailable');assert.ok(!JSON.stringify(r).includes('private provider'));
 }
});
