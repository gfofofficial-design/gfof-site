import test from 'node:test';
import assert from 'node:assert/strict';
import {createAllianceRemoval,removalPlan,removalEvents} from './removal.mjs';
import {memoryRemovalJournal} from './removal.fixture.mjs';
import {projectRef,epoch,zero,profileId,objectId,other} from './deletion-journal.fixture.mjs';
const actorId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',sessionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',operationId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const input=()=>({actorId,sessionId,operationId,version:1,kind:'image',expiresAt:Date.now()+60000}),plan=(kind='image')=>({format:1,kind,operationId,profileId,version:1,objectIds:kind==='image'?[objectId,other]:[]}),tick=()=>new Promise(r=>setImmediate(r));
function fixture(overrides={},options={}){
  const journal=options.journal||memoryRemovalJournal(),calls=[];let prepared=false,committed=false;
  const ledger={async prepareRemovalSession(...args){calls.push('prepare');if(overrides.prepare)return overrides.prepare(...args);prepared=true;return committed?{state:'committed',version:2}:{state:'prepared',plan:plan(args[4])};},async finishRemovalSession(...args){calls.push('finish');if(overrides.finish)return overrides.finish(...args);committed=true;return {state:'committed',version:2};}};
  const serving={async authorize(){calls.push('permit');return overrides.permit?overrides.permit():true;}};
  const service=createAllianceRemoval({enabled:true,projectRef,epoch,minimum:{sequence:0,sha256:zero},ledger,journal,serving,...options});
  return {service,journal,ledger,calls,get prepared(){return prepared;},get committed(){return committed;}};
}
test('removal defaults closed without a journal, gate or SQL call',async()=>{for(const enabled of [undefined,false,'true']){const f=fixture({}, {enabled});assert.deepEqual(await f.service.run(input()),{state:'unavailable'});assert.deepEqual(f.calls,[]);}});
test('malformed configuration and plans are refused without partial event encoding',()=>{
  for(const options of [{projectRef:'bad'},{epoch:'bad'},{minimum:{sequence:0,sha256:'a'.repeat(64)}},{ledger:{}},{journal:{}},{serving:{}},{timeoutMs:30001}])assert.throws(()=>fixture({},options));
  for(const value of [{...plan(),objectIds:[other,objectId]},{...plan(),objectIds:[objectId,objectId]},{...plan(),objectIds:Array(5).fill(objectId)},{...plan('profile'),objectIds:[objectId]},{...plan(),actorId}])assert.throws(()=>removalPlan(value));
});
test('operation scope/context is exact and a closed serving gate starts no plan',async()=>{
  const f=fixture({permit:()=>false});for(const v of [{...input(),profileId},{...input(),expiresAt:1},{...input(),kind:'all'},{...input(),version:-1}])assert.deepEqual(await f.service.run(v),{state:'invalid'});assert.deepEqual(f.calls,[]);assert.deepEqual(await f.service.run(input()),{state:'unavailable'});assert.deepEqual(f.calls,['permit']);
});
test('all retained image identities are journaled before finish; repeats use durable completion',async()=>{
  const f=fixture({finish:()=>{assert.equal(f.journal.rows.length,2);return {state:'committed',version:2};}});assert.deepEqual(await f.service.run(input()),{state:'committed',version:2});assert.equal(f.journal.rows.length,2);assert.equal(f.calls.filter(x=>x==='finish').length,1);assert.deepEqual(f.journal.rows.map(x=>x.event.objectId),[objectId,other]);
});
test('profile removal records one profile intent, not a list that misses older objects',async()=>{
  const f=fixture();assert.deepEqual(await f.service.run({...input(),kind:'profile'}),{state:'committed',version:2});assert.equal(f.journal.rows.length,1);assert.equal(f.journal.rows[0].event.kind,'profile_remove_requested');assert.equal(f.journal.rows[0].event.objectId,null);
});
test('event identity is stable across retries and bound to kind, profile and object',()=>{
  const a=removalEvents(plan()),b=removalEvents({...plan(),operationId:other});assert.deepEqual(a,b);assert.notEqual(a[0].id,a[1].id);assert.notEqual(a[0].id,removalEvents(plan('profile'))[0].id);assert.notEqual(a[0].id,removalEvents({...plan(),profileId:other})[0].id);
});
test('committed plan replay returns its version without touching the journal or mutation',async()=>{
  const f=fixture();assert.equal((await f.service.run(input())).state,'committed');const count=f.journal.calls.length;assert.deepEqual(await f.service.run(input()),{state:'committed',version:2});assert.equal(f.journal.calls.length,count);assert.equal(f.calls.filter(x=>x==='finish').length,1);
});
test('partial lost append reply stays unknown, then an explicit run reconciles the chain without a duplicate',async()=>{
  const journal=memoryRemovalJournal(),append=journal.append.bind(journal);let lost=true;journal.append=async v=>{const r=await append(v);if(lost){lost=false;throw Error('lost private reply');}return r;};const f=fixture({}, {journal});
  assert.deepEqual(await f.service.run(input()),{state:'unknown'});assert.equal(journal.rows.length,1);assert.equal(f.calls.includes('finish'),false);assert.deepEqual(await f.service.run(input()),{state:'committed',version:2});assert.equal(journal.rows.length,2);assert.equal(journal.calls.filter(x=>x==='append').length,2);
});
test('lost member finish reply is recovered by its committed operation without reappending',async()=>{
  let done=false;const f=fixture({prepare:()=>done?{state:'committed',version:2}:{state:'prepared',plan:plan()},finish:()=>{done=true;throw Object.assign(Error('lost'),{outcome:'unknown'});}});
  assert.deepEqual(await f.service.run(input()),{state:'unknown'});const count=f.journal.calls.length;assert.deepEqual(await f.service.run(input()),{state:'committed',version:2});assert.equal(f.journal.calls.length,count);
});
test('paused/full/conflicting append never causes finish or automatic retry',async()=>{
  for(const state of ['paused','full','conflict']){const journal=memoryRemovalJournal();let calls=0;journal.append=async()=>{calls++;return {state};};const f=fixture({}, {journal});assert.deepEqual(await f.service.run(input()),{state:'removal_pending'});assert.equal(calls,1);assert.equal(f.calls.includes('finish'),false);}
});
test('wrong or truncated current chain and prefix forks cannot reach finish',async()=>{
  for(const mode of ['truncated','scope','fork']){const journal=memoryRemovalJournal();await journal.append({expected:{sequence:0,sha256:zero},event:removalEvents(plan())[0]});if(mode==='truncated')journal.records=async()=>[];if(mode==='scope')journal.tip=async()=>({projectRef:'z'.repeat(20),epoch,sequence:0,sha256:zero,enabled:true});
    const f=fixture({}, {journal,...(mode==='fork'?{minimum:{sequence:1,sha256:'a'.repeat(64)}}:{})});assert.deepEqual(await f.service.run(input()),{state:'removal_pending'});assert.equal(f.calls.includes('finish'),false);}
});
test('foreign/substituted prepared plan does not choose a journal subject',async()=>{
  for(const change of [{operationId:other},{version:2},{kind:'profile',objectIds:[]}]){const f=fixture({prepare:()=>({state:'prepared',plan:{...plan(),...change}})});assert.deepEqual(await f.service.run(input()),{state:'removal_pending'});assert.deepEqual(f.journal.calls,[]);}
});
test('wrong append hash or event cannot be accepted as deletion evidence',async()=>{
  for(const field of ['sha256','event']){const journal=memoryRemovalJournal(),append=journal.append.bind(journal);journal.append=async v=>{const r=await append(v);r.record[field]=field==='sha256'?zero:{...r.record.event,profileId:other};return r;};const f=fixture({}, {journal});assert.deepEqual(await f.service.run(input()),{state:'unknown'});assert.equal(f.calls.includes('finish'),false);}
});
test('known journal records are reused after pause and no second append is required',async()=>{
  const f=fixture();for(const e of removalEvents(plan()))await f.journal.append({expected:{sequence:f.journal.rows.length,sha256:f.journal.rows.at(-1)?.sha256||zero},event:e});f.journal.enabled=false;
  assert.deepEqual(await f.service.run(input()),{state:'committed',version:2});assert.equal(f.journal.calls.filter(x=>x==='append').length,2);
});
test('empty-image plan finishes only after valid current journal/gate checks',async()=>{
  const f=fixture({prepare:()=>({state:'prepared',plan:{...plan(),objectIds:[]}})});assert.deepEqual(await f.service.run(input()),{state:'committed',version:2});assert.equal(f.journal.rows.length,0);assert.deepEqual(f.journal.calls,['tip','records']);
});
test('freeze after append leaves the plan pending without member deletion',async()=>{
  const f=fixture({permit:()=>f.journal.rows.length===0});assert.deepEqual(await f.service.run(input()),{state:'removal_pending'});assert.equal(f.journal.rows.length,1);assert.equal(f.calls.includes('finish'),false);
});
test('timeout/cancellation cannot follow a late prepared plan with a journal request',async()=>{
  for(const mode of ['timeout','abort','close']){let finish;const gate=new Promise(r=>finish=r),f=fixture({prepare:async()=>{await gate;return {state:'prepared',plan:plan()};}},{timeoutMs:mode==='timeout'?20:30000}),c=new AbortController(),pending=f.service.run(input(),{signal:c.signal});await tick();if(mode==='abort')c.abort();if(mode==='close')f.service.close();assert.deepEqual(await pending,{state:'unknown'});finish();await tick();assert.deepEqual(f.journal.calls,[]);assert.deepEqual(await f.service.run(input()),{state:'unavailable'});}
});
test('pre-cancellation and single active capacity start no queued work',async()=>{
  let finish;const gate=new Promise(r=>finish=r),f=fixture({permit:async()=>{await gate;return false;}});assert.deepEqual(await f.service.run(input(),{signal:AbortSignal.abort()}),{state:'request_ended'});const pending=f.service.run(input());assert.deepEqual(await f.service.run(input()),{state:'busy'});finish();assert.deepEqual(await pending,{state:'unavailable'});
});
test('context is copied and raw dependency errors do not escape',async()=>{
  let finish;const gate=new Promise(r=>finish=r),seen=[],f=fixture({prepare:async(...args)=>{seen.push(args);await gate;throw Error('PRIVATE PASSWORD');}}),v=input(),pending=f.service.run(v);await tick();v.actorId=other;finish();assert.deepEqual(await pending,{state:'unknown'});assert.equal(seen[0][0],actorId);
});
