import test from 'node:test';
import assert from 'node:assert/strict';
import {createAvatarRecovery,recoveryResult} from './recovery.mjs';
const id='11111111-1111-4111-8111-111111111111',id2='22222222-2222-4222-8222-222222222222',zero='00000000-0000-0000-0000-000000000000';
const before='2026-01-01T00:00:00.000Z';
const deleted=()=>({state:'deleted',claimState:'deleted',objectState:'deleted',writeSettled:true,proofRecorded:true,dispatchRecorded:true});
const upload=()=>({state:'unsettled',operationState:'stale',objectState:'cleanup',writeSettled:false,proofRecorded:false,current:false});
const review=()=>({before,items:[{objectId:id,reason:'review_deleted',createdAt:'2025-01-01T00:00:00Z',lastChangedAt:'2025-12-01T00:00:00Z'}],next:null});
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(overrides={},options={}){
  const calls=[],defaults={cleanupRecovery:deleted,uploadRecovery:upload,retentionReview:review};
  const ledger=Object.fromEntries(Object.entries(defaults).map(([name,fn])=>[name,(...args)=>{calls.push({name,args});return (overrides[name]||fn)(...args);} ]));
  return {calls,recovery:createAvatarRecovery({enabled:true,ledger,...options})};
}
test('default-closed and non-boolean inspectors cannot issue queries',async()=>{
  for(const enabled of [undefined,false,'true']){const f=fixture({}, {enabled});assert.deepEqual(await f.recovery.cleanup(id),{state:'unavailable'});assert.deepEqual(await f.recovery.upload(id),{state:'unavailable'});assert.deepEqual(await f.recovery.retention({before}),{state:'unavailable'});assert.equal(f.calls.length,0);}
});
test('enabled dependencies and finite deadlines are required',()=>{
  assert.throws(()=>createAvatarRecovery({enabled:true}));for(const timeoutMs of [0,4751,NaN,1.1])assert.throws(()=>createAvatarRecovery({timeoutMs}));
});
test('invalid IDs, dates, bounds and cursors stop before SQL',async()=>{
  const f=fixture();assert.deepEqual(await f.recovery.cleanup('bad'),{state:'invalid'});assert.deepEqual(await f.recovery.upload('bad'),{state:'invalid'});
  for(const input of [{before:'bad'},{before:'2099-01-01T00:00:00.000Z'},{before:'2026-01-01'},{before,limit:0},{before,limit:21},{before,after:'bad'}])assert.deepEqual(await f.recovery.retention(input),{state:'invalid'});assert.equal(f.calls.length,0);
});
test('durable matching deletion evidence can resolve an acknowledgement lost by the caller',async()=>{
  const f=fixture();assert.deepEqual(await f.recovery.cleanup(id),deleted());assert.deepEqual(f.calls.map(x=>x.name),['cleanupRecovery']);
});
test('true missing proof stays unknown with no delete, mutation, retry or quota action',async()=>{
  const value={state:'unknown',claimState:'unknown',objectState:'cleanup',writeSettled:true,proofRecorded:false,dispatchRecorded:true},f=fixture({cleanupRecovery:()=>value});assert.deepEqual(await f.recovery.cleanup(id),value);assert.equal(f.calls.length,1);
});
test('waiting and expired claims are observations, not dispatch grants',async()=>{
  for(const value of [{state:'waiting',claimState:'claimed',objectState:'cleanup',writeSettled:true,proofRecorded:false,dispatchRecorded:false},{state:'expired',claimState:'expired',objectState:'deleted',writeSettled:true,proofRecorded:true,dispatchRecorded:false}]){const f=fixture({cleanupRecovery:()=>value});assert.deepEqual(await f.recovery.cleanup(id),value);assert.equal(f.calls.length,1);}
});
test('absent IDs stay missing rather than confirmed deletion',async()=>{
  const f=fixture({cleanupRecovery:()=>({state:'missing'}),uploadRecovery:()=>({state:'missing'})});assert.deepEqual(await f.recovery.cleanup(id),{state:'missing'});assert.deepEqual(await f.recovery.upload(id),{state:'missing'});
});
test('upload recovery reports uncertainty without settling or republishing it',async()=>{
  const f=fixture();assert.deepEqual(await f.recovery.upload(id),upload());assert.deepEqual(f.calls.map(x=>x.name),['uploadRecovery']);
});
test('current, removed, deleted and never-dispatched states stay distinct',()=>{
  for(const value of [
    {state:'current',operationState:'committed',objectState:'active',writeSettled:true,proofRecorded:false,current:true},
    {state:'cleanup_pending',operationState:'stale',objectState:'cleanup',writeSettled:true,proofRecorded:false,current:false},
    {state:'deleted',operationState:'committed',objectState:'deleted',writeSettled:true,proofRecorded:true,current:false},
    {state:'never_dispatched',operationState:'cancelled',objectState:'deleted',writeSettled:false,proofRecorded:false,current:false}
  ])assert.deepEqual(recoveryResult('uploadRecovery',value),value);
});
test('malformed, contradictory and extra-field deletion data cannot confirm success',async()=>{
  for(const value of [{...deleted(),proofRecorded:false},{...deleted(),dispatchRecorded:false},{...deleted(),objectState:'active'},{...deleted(),private:'SECRET'},{...deleted(),claimState:'unknown'}]){const f=fixture({cleanupRecovery:()=>value});assert.deepEqual(await f.recovery.cleanup(id),{state:'unavailable'});}
});
test('contradictory upload states refuse without exposing provider data',async()=>{
  for(const value of [{...upload(),writeSettled:true},{...upload(),current:true},{...upload(),receipt:'PRIVATE'},{state:'deleted',operationState:'committed',objectState:'deleted',writeSettled:true,proofRecorded:false,current:false}]){const f=fixture({uploadRecovery:()=>value});assert.deepEqual(await f.recovery.upload(id),{state:'unavailable'});}
});
test('retention is a bounded review with normalized dates and no deletion authorization',async()=>{
  const f=fixture(),value=await f.recovery.retention({before,limit:1});assert.deepEqual(f.calls[0].args.slice(0,3),[before,zero,1]);assert.equal(value.items[0].lastChangedAt,'2025-12-01T00:00:00.000Z');assert.equal(value.items[0].reason,'review_deleted');assert.equal(value.items[0].mayDelete,undefined);assert.equal(f.calls.length,1);
});
test('retention guards current/open/uncertain/recent items without converting them to candidates',()=>{
  for(const reason of ['keep_current','keep_open','keep_uncertain','keep_recent'])assert.equal(recoveryResult('retentionReview',{...review(),items:[{...review().items[0],reason}]},{before,after:zero,limit:20}).items[0].reason,reason);
});
test('retention refuses mismatched cutoff, excess rows, unordered IDs and invalid cursor',async()=>{
  for(const value of [{...review(),before:'2025-12-31T00:00:00Z'},{...review(),items:[review().items[0],review().items[0]]},{...review(),next:id2},{...review(),items:[{...review().items[0],objectId:zero}]},{...review(),secret:'PRIVATE'}]){const f=fixture({retentionReview:()=>value});assert.deepEqual(await f.recovery.retention({before,limit:1}),{state:'unavailable'});}
});
test('recently changed records cannot be labeled reviewable based on old creation time',async()=>{
  const f=fixture({retentionReview:()=>({...review(),items:[{...review().items[0],lastChangedAt:'2026-01-02T00:00:00Z'}]})});assert.deepEqual(await f.recovery.retention({before}),{state:'unavailable'});
});
test('SQL/commit failures are unavailable, never missing, deleted or a retry',async()=>{
  const f=fixture({cleanupRecovery:()=>{throw Error('PRIVATE URL');}});assert.deepEqual(await f.recovery.cleanup(id),{state:'unavailable'});assert.equal(f.calls.length,1);
});
test('cancellation before dispatch performs no query',async()=>{
  const f=fixture();assert.deepEqual(await f.recovery.cleanup(id,{signal:AbortSignal.abort()}),{state:'cancelled'});assert.equal(f.calls.length,0);
});
test('non-cooperative late reads cannot restore a result or initiate follow-up work',async()=>{
  const gate=deferred(),f=fixture({cleanupRecovery:()=>gate.promise},{timeoutMs:20});assert.deepEqual(await f.recovery.cleanup(id),{state:'unavailable'});gate.resolve(deleted());await tick();assert.equal(f.calls.length,1);
});
test('one read is active locally and close aborts it then refuses new work',async()=>{
  const gate=deferred(),f=fixture({cleanupRecovery:()=>gate.promise});const pending=f.recovery.cleanup(id);assert.deepEqual(await f.recovery.upload(id),{state:'busy'});f.recovery.close();assert.deepEqual(await pending,{state:'unavailable'});gate.resolve(deleted());assert.deepEqual(await f.recovery.cleanup(id),{state:'unavailable'});
});
test('reports are copied rather than returning mutable dependency state',async()=>{
  const value=deleted(),f=fixture({cleanupRecovery:()=>value});const output=await f.recovery.cleanup(id);value.state='unknown';assert.equal(output.state,'deleted');
});
