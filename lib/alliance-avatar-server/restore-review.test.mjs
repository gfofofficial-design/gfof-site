import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarInventory,createAvatarRestoreReview} from './restore-review.mjs';
const projectRef='abcdefghijklmnopqrst',freezeId='11111111-1111-4111-8111-111111111111';
const inventory=()=>({format:1,closed:true,tables:['control','heads','operations','objects','daily','cleanup_attempts'].map((table,i)=>({table,rows:i===0?1:2,sha256:String(i).repeat(64)}))});
const input=()=>({freezeId,frozenAt:'2026-01-01T00:00:00.000Z',checkpoint:{format:1,projectRef,freezeId,capturedAt:'2026-01-01T00:01:00.000Z',inventory:inventory()}});
function fixture({read=inventory,...options}={}){
  const calls=[];const review=createAvatarRestoreReview({enabled:true,projectRef,ledger:{restoreInventory:o=>{calls.push(o);return read(o);}},...options});return {review,calls};
}
const q=reason=>({state:'quarantine',access:'closed',reason});
const wait=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
test('disabled or truthy-only configuration makes no inventory read',async()=>{
  for(const enabled of [undefined,false,'true']){const f=fixture({enabled});assert.deepEqual(await f.review.inspect(input()),q('unavailable'));assert.equal(f.calls.length,0);}
});
test('enabled configuration pins scope, dependency and finite deadline',()=>{
  for(const options of [{enabled:true},{timeoutMs:0},{timeoutMs:4751},{timeoutMs:1.5}])assert.throws(()=>createAvatarRestoreReview(options));
  for(const projectRef of ['other','ABCDEFGHIJKLMNOPQRST'])assert.throws(()=>fixture({projectRef}));
});
test('matching frozen ledger is equality evidence and never permission to reopen',async()=>{
  const f=fixture();assert.deepEqual(await f.review.inspect(input()),{state:'matches_checkpoint',access:'closed'});assert.equal(f.calls.length,1);assert.ok(f.calls[0].signal.aborted);
});
test('missing, malformed or extra-field evidence refuses before SQL',async()=>{
  for(const value of [undefined,{}, {...input(),token:'PRIVATE'},{...input(),freezeId:'bad'},{...input(),frozenAt:'2026-01-01'},{...input(),checkpoint:{...input().checkpoint,password:'PRIVATE'}}]){
    const f=fixture();assert.deepEqual(await f.review.inspect(value),q('invalid_evidence'));assert.equal(f.calls.length,0);
  }
});
test('different project and previous recovery-incident checkpoint cannot qualify',async()=>{
  for(const [change,reason] of [[{projectRef:'bbbbbbbbbbbbbbbbbbbb'},'scope_mismatch'],[{freezeId:'22222222-2222-4222-8222-222222222222'},'freeze_mismatch']]){
    const value=input();Object.assign(value.checkpoint,change);const f=fixture();assert.deepEqual(await f.review.inspect(value),q(reason));assert.equal(f.calls.length,0);
  }
});
test('a checkpoint preceding the current freeze cannot qualify even with identical rows',async()=>{
  const value=input();value.frozenAt='2026-01-01T00:02:00.000Z';const f=fixture();assert.deepEqual(await f.review.inspect(value),q('checkpoint_predates_freeze'));assert.equal(f.calls.length,0);
});
test('future or ambiguous timestamps are not accepted evidence',async()=>{
  for(const stamp of ['2099-01-01T00:00:00.000Z','2026-01-01T00:01:00Z','2026-02-30T00:00:00.000Z']){const value=input();value.checkpoint.capturedAt=stamp;const f=fixture();assert.deepEqual(await f.review.inspect(value),q('invalid_evidence'));assert.equal(f.calls.length,0);}
});
test('an open checkpoint is refused without reading the restored database',async()=>{
  const value=input();value.checkpoint.inventory.closed=false;const f=fixture();assert.deepEqual(await f.review.inspect(value),q('feature_open'));assert.equal(f.calls.length,0);
});
test('an open restored feature stays quarantined despite a matching row digest',async()=>{
  const f=fixture({read:()=>({...inventory(),closed:false})});assert.deepEqual(await f.review.inspect(input()),q('feature_open'));assert.equal(f.calls.length,1);
});
test('each ledger table catches older heads, replays, receipts, counters or claims',async()=>{
  for(let i=0;i<6;i++){const raw=inventory();raw.tables[i].sha256='f'.repeat(64);const f=fixture({read:()=>raw});assert.deepEqual(await f.review.inspect(input()),q('ledger_mismatch'));assert.equal(f.calls.length,1);}
});
test('missing rows or restored duplicate rows fail equality independently of digest',async()=>{
  const raw=inventory();raw.tables[3].rows--;const f=fixture({read:()=>raw});assert.deepEqual(await f.review.inspect(input()),q('ledger_mismatch'));
});
test('bounded inventory refuses missing/reordered/oversized tables and private row content',()=>{
  for(const alter of [v=>v.tables.pop(),v=>v.tables.reverse(),v=>v.tables[1].rows=1001,v=>v.tables[1].sha256='bad',v=>v.tables[0].rows=0,v=>v.tables[2].receipt='PRIVATE',v=>v.secret='PRIVATE']){const raw=inventory();alter(raw);assert.throws(()=>avatarInventory(raw));}
});
test('malformed SQL output and errors expose no raw content and never retry',async()=>{
  for(const read of [()=>({...inventory(),receipt:'PRIVATE'}),()=>{throw Error('PRIVATE endpoint');}]){const f=fixture({read});assert.deepEqual(await f.review.inspect(input()),q('unavailable'));assert.equal(f.calls.length,1);}
});
test('checkpoint is copied before asynchronous SQL can observe caller mutation',async()=>{
  const gate=wait(),value=input(),f=fixture({read:()=>gate.promise});const pending=f.review.inspect(value);value.checkpoint.inventory.tables[3].sha256='f'.repeat(64);gate.resolve(inventory());assert.deepEqual(await pending,{state:'matches_checkpoint',access:'closed'});
});
test('inventory copies results rather than leaking mutable private objects',()=>{
  const raw=inventory(),copy=avatarInventory(raw);raw.tables[1].rows=99;assert.equal(copy.tables[1].rows,2);assert.notEqual(copy.tables,raw.tables);
});
test('pre-cancelled review performs no SQL',async()=>{const f=fixture();assert.deepEqual(await f.review.inspect(input(),{signal:AbortSignal.abort()}),q('cancelled'));assert.equal(f.calls.length,0);});
test('a stalled or late SQL result remains quarantined with no follow-up action',async()=>{
  const gate=wait(),f=fixture({read:()=>gate.promise,timeoutMs:15});assert.deepEqual(await f.review.inspect(input()),q('unavailable'));gate.resolve(inventory());await new Promise(r=>setImmediate(r));assert.equal(f.calls.length,1);
});
test('one active inspection refuses an unbounded queue; close cancels and stays closed',async()=>{
  const f=fixture({read:()=>new Promise(()=>{})});const pending=f.review.inspect(input());assert.deepEqual(await f.review.inspect(input()),q('busy'));f.review.close();assert.deepEqual(await pending,q('unavailable'));assert.deepEqual(await f.review.inspect(input()),q('unavailable'));assert.equal(f.calls.length,1);
});
