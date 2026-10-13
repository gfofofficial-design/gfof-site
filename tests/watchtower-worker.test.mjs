import test from 'node:test';import assert from 'node:assert/strict';
import {createWatchtowerWorker} from '../netlify/functions/_shared/watchtower-worker.mjs';
const account='1'.repeat(32),signature='1'.repeat(64);
const row={signature,slot:'123',lease_version:'2',matched_accounts:[account],state:'leased'};
const verified={schema:1,method:'rpc_corroborated_candidate',signature,transactionSlot:123,accountSlot:125,sourceAuthenticity:'rpc_response_not_cryptographically_verified',finality:'finalized_requested_from_reviewed_rpc',emitsFinding:false,states:[{account,state:'absent_at_account_slot',slot:125}]};
test('one claim verifies and atomically saves projected evidence',async()=>{
 const calls=[];const run=createWatchtowerWorker({enabled:true,verify:async candidate=>{calls.push('verify');assert.equal(candidate.slot,123);return {...verified,raw:'private detail'};},query:async(sql,args)=>{
  calls.push(sql);if(sql.includes('claim_'))return {rowCount:1,rows:[row]};
  assert.equal(args[1],2);assert.ok(!args[2].includes('private detail'));assert.deepEqual(JSON.parse(args[2]),verified);return {rowCount:1,rows:[{finished:true}]};
 }});assert.equal((await run()).reason,'corroboration_saved');assert.equal(calls.length,3);
});
test('failed or incorrectly bound verification never finishes queue work',async()=>{
 for(const result of [{method:'verification_unavailable'},{...verified,signature:'1'.repeat(63)+'2'},{...verified,accountSlot:122},{...verified,emitsFinding:true}]){
  let calls=0;const run=createWatchtowerWorker({enabled:true,query:async()=>{calls++;return {rowCount:1,rows:[row]};},verify:async()=>result});
  assert.equal((await run()).reason,'verification_not_completed');assert.equal(calls,1);
 }
});
test('disabled, empty queue and rejected lease completion remain explicit',async()=>{
 assert.equal((await createWatchtowerWorker()()).reason,'worker_disabled');
 const empty=createWatchtowerWorker({enabled:true,query:async()=>({rowCount:0,rows:[]}),verify:async()=>{throw Error('should not run');}});assert.equal((await empty()).reason,'no_candidate');
 let calls=0;const denied=createWatchtowerWorker({enabled:true,verify:async()=>verified,query:async()=>++calls===1?{rowCount:1,rows:[row]}:{rowCount:1,rows:[{finished:false}]}});assert.equal((await denied()).reason,'lease_or_completion_not_accepted');
});
test('timed-out verification cannot finish later and errors reveal no details',async()=>{
 let calls=0,resolve;const run=createWatchtowerWorker({enabled:true,timeoutMs:10,query:async()=>{calls++;return {rowCount:1,rows:[row]};},verify:()=>new Promise(r=>{resolve=r;})});
 assert.equal((await run()).reason,'worker_failed');resolve(verified);await new Promise(r=>setTimeout(r,0));assert.equal(calls,1);
 const bad=createWatchtowerWorker({enabled:true,query:async()=>{throw Error('private database detail');},verify:async()=>verified});assert.ok(!JSON.stringify(await bad()).includes('private database'));
});
