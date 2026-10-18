import test from 'node:test';
import assert from 'node:assert/strict';
import {createAllianceCreation,creationPlan,creationEvent} from './creation.mjs';
import {createAllianceProfileView} from './profile-view.mjs';
import {journalFixture} from './deletion-journal.fixture.mjs';
const actor='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222',profile='33333333-3333-4333-8333-333333333333',object='44444444-4444-4444-8444-444444444444',operation='55555555-5555-4555-8555-555555555555';
const ctx=()=>({actorId:actor,sessionId:session,expiresAt:Date.now()+120000});
const input=()=>({name:'Fixture Member',community:'',bio:'A synthetic admission bridge profile.',role:'builder',listed:false});
const plan=(kind='profile')=>({kind,profileId:profile,objectId:kind==='image'?object:null,operationId:kind==='image'?operation:null,version:0});
const saved=()=>({id:profile,...input(),publication:'private',updatedAt:'2026-10-17T16:00:00Z'});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(overrides={},options={}){
  const calls=[];const methods={prepareProfileSession:()=>plan(),prepareImageSession:()=>plan('image'),creationStatusSession:(_a,_s,kind)=>plan(kind),finishProfileSession:()=>saved(),finishImageSession:()=>({dispatch:true,state:'reserved',objectId:object}),admit:e=>({state:'admitted',event:e}),admission:e=>({state:'admitted',event:e}),authorize:()=>true};
  const deps=Object.fromEntries(Object.entries(methods).map(([name,fn])=>[name,async(...args)=>{calls.push({name,args});return (overrides[name]||fn)(...args);} ]));
  const service=createAllianceCreation({enabled:true,ledger:deps,journal:deps,serving:deps,...options});return {service,calls};
}
const names=f=>f.calls.map(x=>x.name),reject=(p,outcome)=>assert.rejects(p,e=>e.message==='alliance_creation_unavailable'&&e.outcome===outcome&&e.cause===undefined);
test('creation is closed by default with no dependency or credential access',async()=>{for(const enabled of [undefined,false,'true']){const f=fixture({}, {enabled});await reject(f.service.profile(ctx(),input()),'not_started');assert.deepEqual(f.calls,[]);}});
test('enabled creation requires every fixed dependency and bounded timeout',()=>{for(const options of [{ledger:{}},{journal:{}},{serving:{}},{timeoutMs:0},{timeoutMs:14001}])assert.throws(()=>fixture({},options));});
test('canonical plans and deterministic events reject private extras and inconsistent subject fields',()=>{
  assert.equal(creationEvent(plan()).kind,'profile_remove_requested');assert.equal(creationEvent(plan('image')).objectId,object);
  for(const p of [{...plan(),extra:'PRIVATE'},{...plan(),operationId:operation},{...plan('image'),objectId:null},{...plan(),profileId:'bad'},{...plan(),version:1}])assert.throws(()=>creationPlan(p));
});
test('invalid/expired account context and invalid text never dispatch preparation',async()=>{
  for(const context of [{...ctx(),expiresAt:1},{...ctx(),actorId:'bad'},{...ctx(),profileId:profile}]){const f=fixture();await reject(f.service.profile(context,input()),'not_started');assert.deepEqual(f.calls,[]);}
  const f=fixture();await reject(f.service.profile(ctx(),{...input(),listed:'true'}),'not_started');await reject(f.service.reserve(ctx(),'bad',0),'not_started');assert.deepEqual(f.calls,[]);
});
test('profile and image creation commit admission before exact member activation under fresh permits',async()=>{
  for(const kind of ['profile','image']){const f=fixture(),context=ctx();const result=kind==='profile'?await f.service.profile(context,input()):await f.service.reserve(context,operation,0);
    assert.deepEqual(names(f),['authorize',kind==='profile'?'prepareProfileSession':'prepareImageSession','authorize','admit','authorize',kind==='profile'?'finishProfileSession':'finishImageSession','authorize']);
    const final=f.calls.at(-2);assert.deepEqual(final.args.slice(0,2),[actor,session]);assert.deepEqual(final.args[2],plan(kind));assert.deepEqual(final.args[kind==='profile'?4:3],creationEvent(plan(kind)));assert.equal(kind==='profile'?result.id:result.objectId,kind==='profile'?profile:object);
  }
});
test('profile input is copied before waiting and no caller account or metadata reaches the journal',async()=>{
  const gate=deferred(),f=fixture({prepareProfileSession:()=>gate.promise}),data=input(),pending=f.service.profile(ctx(),data);data.name='CHANGED';await tick();gate.resolve(plan());assert.equal((await pending).name,input().name);assert.equal(f.calls.find(x=>x.name==='finishProfileSession').args[3].name,input().name);assert.deepEqual(Object.keys(f.calls.find(x=>x.name==='admit').args[0]),['id','kind','profileId','objectId']);
});
test('paused/full/removed/history-full admission cannot dispatch activation and faults further writes',async()=>{
  for(const state of ['paused','full','removed','history_full','profile_required']){const f=fixture({admit:()=>({state})});await reject(f.service.profile(ctx(),input()),'unknown');assert.equal(names(f).includes('finishProfileSession'),false);await reject(f.service.profile(ctx(),input()),'not_started');assert.equal(names(f).filter(x=>x==='admit').length,1);}
});
test('mismatched remote event and malformed preparation never authorize activation',async()=>{
  for(const overrides of [{admit:()=>({state:'admitted',event:{...creationEvent(plan()),profileId:actor}})},{prepareProfileSession:()=>({...plan(),private:'SECRET'})},{prepareImageSession:()=>({...plan('image'),operationId:actor})}]){const f=fixture(overrides);await reject(overrides.prepareImageSession?f.service.reserve(ctx(),operation,0):f.service.profile(ctx(),input()),'unknown');assert.equal(names(f).some(x=>/^finish/.test(x)),false);}
});
test('lost preparation/journal/activation acknowledgements never retry or automatically recover',async()=>{
  for(const name of ['prepareProfileSession','admit','finishProfileSession']){const f=fixture({[name]:()=>{throw {outcome:'unknown',message:'PRIVATE URL'};}});await reject(f.service.profile(ctx(),input()),'unknown');assert.equal(names(f).filter(x=>x===name).length,1);assert.equal(names(f).includes('admission'),false);}
});
test('read-only recovery uses exact saved preparation and committed remote admission without activation',async()=>{
  for(const kind of ['profile','image']){const f=fixture();assert.deepEqual(await f.service.inspect(ctx(),kind,kind==='image'?{operationId:operation,version:0}:undefined),{state:'admitted',plan:plan(kind)});assert.deepEqual(names(f),['authorize','creationStatusSession','authorize','admission','authorize']);}
  for(const state of ['missing','removed']){const f=fixture({admission:()=>({state})});assert.deepEqual(await f.service.inspect(ctx(),'profile'),{state});assert.equal(names(f).includes('admit'),false);}
  const empty=fixture({creationStatusSession:()=>null});assert.deepEqual(await empty.service.inspect(ctx(),'profile'),{state:'missing'});assert.deepEqual(names(empty),['authorize','creationStatusSession']);
});
test('closed startup gate and cancelled request cannot dispatch any preparation',async()=>{
  const f=fixture({authorize:()=>false});await reject(f.service.profile(ctx(),input()),'not_started');assert.deepEqual(names(f),['authorize']);
  const c=new AbortController();c.abort();const g=fixture();await reject(g.service.profile(ctx(),input(),{signal:c.signal}),'not_started');assert.deepEqual(g.calls,[]);
});
test('new freeze after journal commit preserves capacity without member activation',async()=>{
  let n=0;const f=fixture({authorize:()=>++n<3});await reject(f.service.profile(ctx(),input()),'unknown');assert.equal(names(f).includes('finishProfileSession'),false);assert.equal(names(f).filter(x=>x==='admit').length,1);
});
test('noncooperative preparation timeout cannot dispatch a late journal mutation',async()=>{
  const gate=deferred(),f=fixture({prepareProfileSession:()=>gate.promise},{timeoutMs:15});await reject(f.service.profile(ctx(),input()),'unknown');gate.resolve(plan());await tick();assert.deepEqual(names(f),['authorize','prepareProfileSession']);
});
test('noncooperative admission timeout cannot dispatch late activation or refund',async()=>{
  const gate=deferred(),f=fixture({admit:()=>gate.promise},{timeoutMs:15});await reject(f.service.profile(ctx(),input()),'unknown');gate.resolve({state:'admitted',event:creationEvent(plan())});await tick();assert.equal(names(f).includes('finishProfileSession'),false);assert.equal(f.calls.length,4);
});
test('only one operation runs per instance and close aborts pending work without later activation',async()=>{
  const gate=deferred(),f=fixture({admit:()=>gate.promise}),pending=f.service.profile(ctx(),input());await tick();await reject(f.service.profile(ctx(),input()),'not_started');f.service.close();await reject(pending,'unknown');gate.resolve({state:'admitted',event:creationEvent(plan())});await tick();assert.equal(names(f).includes('finishProfileSession'),false);
});
test('wrong activation identity and malformed replay cannot claim a confirmed object/profile',async()=>{
  for(const overrides of [{finishProfileSession:()=>({...saved(),id:actor})},{finishImageSession:()=>({dispatch:true,state:'reserved',objectId:actor})},{finishImageSession:()=>({dispatch:false,state:'committed',objectId:object,version:'1'})}]){const f=fixture(overrides);await reject(overrides.finishProfileSession?f.service.profile(ctx(),input()):f.service.reserve(ctx(),operation,0),'unknown');}
});
test('profile response-guard timeout aborts admission bridge and blocks late member activation',async()=>{
  const gate=deferred(),f=fixture({admit:()=>gate.promise}),signed=journalFixture({events:[]});
  const view=createAllianceProfileView({enabled:true,journal:signed.client,serving:{authorize:()=>true},timeoutMs:20});
  assert.deepEqual(await view.read({kind:'self'},{load:({signal})=>f.service.profile(ctx(),input(),{signal})}),{state:'unavailable'});
  gate.resolve({state:'admitted',event:creationEvent(plan())});await tick();assert.equal(names(f).includes('finishProfileSession'),false);view.close();
});
test('dependency cannot mutate canonical preparation or admission arguments across awaits',async()=>{
  const f=fixture({admit:e=>{e.profileId=actor;return {state:'admitted',event:e};}});await reject(f.service.profile(ctx(),input()),'unknown');assert.equal(names(f).includes('finishProfileSession'),false);
});
