import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createAllianceAnchoredRemoval} from './anchored-removal.mjs';
import {removalAnchor,removalChain} from './removal-anchor.mjs';
import {memoryRemovalJournal} from './removal.fixture.mjs';
import {projectRef,epoch,profileId,other,zero,chain,event} from './deletion-journal.fixture.mjs';
const journalProjectRef='uvwxyzabcdefghijklmn',scope={memberProjectRef:projectRef,journalProjectRef,epoch};
const point=(sequence=0,sha256=zero)=>({format:1,...scope,sequence,sha256});
const plan={format:1,kind:'profile',operationId:other,profileId,version:0,objectIds:[]};
const input=()=>({actorId:profileId,sessionId:other,operationId:other,version:0,kind:'profile',expiresAt:Date.now()+60000});
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve};},tick=()=>new Promise(r=>setImmediate(r));
function fixture({prepare,finish,read,advance,preparedPlan=plan,options={}}={}){
 const journal=memoryRemovalJournal(),calls=[];let anchor=point(),finishes=0;
 const anchorStore={async read(o){calls.push('read_anchor');return read?read(o):structuredClone(anchor);},async advance(v,o){calls.push('advance_anchor');if(advance)return advance(v,o);removalChain(v.records,v.through,scope,{sequence:anchor.sequence,sha256:anchor.sha256});anchor=point(v.through.sequence,v.through.sha256);return {state:'anchored',anchor:structuredClone(anchor)};}};
 const ledger={async prepareAnchoredRemovalSession(){calls.push('prepare');return prepare?prepare():{state:'prepared',plan:structuredClone(preparedPlan)};},async finishAnchoredRemovalSession(...args){calls.push('finish');finishes++;return finish?finish(...args):{state:'committed',version:1};}};
 const make=overrides=>createAllianceAnchoredRemoval({enabled:true,projectRef,journalProjectRef,epoch,minimum:{sequence:0,sha256:zero},journal,ledger,anchorStore,serving:{authorize:()=>true},...options,...overrides});
 return {worker:make(),make,journal,calls,anchorStore,ledger,get anchor(){return anchor;},get finishes(){return finishes;}};
}
test('anchor protocol rejects absent scope, extra fields and incomplete/forked chains',()=>{
 assert.deepEqual(removalAnchor(point(),scope),point());for(const p of [{...point(),extra:'PRIVATE'},{...point(),epoch:other},{...point(),sequence:1}]){if(p.sequence===1)assert.equal(removalAnchor(p,scope).sequence,1);else assert.throws(()=>removalAnchor(p,scope));}
 const rows=chain([event()]);assert.deepEqual(removalChain(rows,{sequence:1,sha256:rows[0].sha256},scope),rows);for(const v of [[],[{...rows[0],extra:'PRIVATE'}],[{...rows[0],sha256:'f'.repeat(64)}]])assert.throws(()=>removalChain(v,{sequence:1,sha256:rows[0].sha256},scope));
 const circular=[];circular.push(circular);assert.throws(()=>removalChain(circular,{sequence:1,sha256:rows[0].sha256},scope),e=>e.message==='alliance_control_unavailable');
});
test('anchored removal defaults off and requires independent writer and replay-safe ledger',async()=>{
 for(const enabled of [undefined,false,'true']){const f=fixture({options:{enabled}});assert.deepEqual(await f.worker.run(input()),{state:'unavailable'});assert.deepEqual(f.calls,[]);}
 for(const options of [{anchorStore:{}},{ledger:{}},{journalProjectRef:projectRef}])assert.throws(()=>fixture({options}));
});
test('journal intent and confirmed independent anchor precede local finish and success',async()=>{
 const f=fixture();assert.deepEqual(await f.worker.run(input()),{state:'committed',version:1});assert.deepEqual(f.calls,['prepare','read_anchor','advance_anchor','finish']);assert.equal(f.journal.rows.length,1);assert.equal(f.anchor.sha256,f.journal.rows[0].sha256);
});
test('all image intents are covered by one complete independent point before finish',async()=>{
 const f=fixture({preparedPlan:{...plan,kind:'image',objectIds:['33333333-3333-4333-8333-333333333333','77777777-7777-4777-8777-777777777777']}});assert.deepEqual(await f.worker.run({...input(),kind:'image'}),{state:'committed',version:1});assert.equal(f.anchor.sequence,2);assert.equal(f.journal.rows.length,2);assert.equal(f.calls.filter(x=>x==='advance_anchor').length,1);
});
test('empty-image removal still verifies an independent genesis point before acknowledgement',async()=>{
 const f=fixture({preparedPlan:{...plan,kind:'image'}});assert.deepEqual(await f.worker.run({...input(),kind:'image'}),{state:'committed',version:1});assert.deepEqual(f.calls,['prepare','read_anchor','advance_anchor','finish']);assert.equal(f.journal.rows.length,0);
});
test('old committed fast path cannot bypass anchor revalidation',async()=>{
 const f=fixture({prepare:()=>({state:'committed',version:1})});assert.notEqual((await f.worker.run(input())).state,'committed');assert.equal(f.finishes,0);assert.deepEqual(f.calls,['prepare']);
});
test('lost anchor reply returns unknown and cannot start local finish',async()=>{
 const f=fixture({advance:()=>{throw Object.assign(Error('PRIVATE'),{outcome:'unknown'});}});assert.deepEqual(await f.worker.run(input()),{state:'unknown'});assert.equal(f.finishes,0);assert.equal(f.journal.rows.length,1);
});
test('explicit later request reconciles existing intent without another journal append',async()=>{
 let once=true;const f=fixture({advance:v=>{if(once){once=false;throw Error('Synthetic lost reply');}return {state:'anchored',anchor:point(v.through.sequence,v.through.sha256)};}});
 assert.deepEqual(await f.worker.run(input()),{state:'unknown'});assert.deepEqual(await f.make().run(input()),{state:'committed',version:1});assert.equal(f.journal.calls.filter(x=>x==='append').length,1);
});
test('a locally committed replay must check anchor again before returning success',async()=>{
 const f=fixture();assert.equal((await f.worker.run(input())).state,'committed');f.anchorStore.read=()=>{throw Error('Unavailable independent store');};assert.notEqual((await f.make().run(input())).state,'committed');assert.equal(f.finishes,1);
});
test('forked or later independent floor rejects old restored journal without mutation',async()=>{
 for(const read of [()=>point(2,'f'.repeat(64)),()=>point(1,'f'.repeat(64))]){const f=fixture({read});assert.deepEqual(await f.worker.run(input()),{state:'unknown'});assert.equal(f.finishes,0);assert.equal(f.calls.includes('advance_anchor'),false);}
});
test('conflict and malformed anchor acknowledgements cannot report removal complete',async()=>{
 for(const advance of [v=>({state:'conflict',anchor:point()}),v=>({state:'anchored',anchor:point()}),v=>({state:'anchored',anchor:{...point(v.through.sequence,v.through.sha256),secret:'PRIVATE'}})]){const f=fixture({advance});assert.notEqual((await f.worker.run(input())).state,'committed');assert.equal(f.finishes,0);}
});
test('late anchor completion after cancellation cannot start member finish',async()=>{
 const wait=deferred(),f=fixture({advance:()=>wait.promise}),c=new AbortController(),pending=f.worker.run(input(),{signal:c.signal});
 while(!f.calls.includes('advance_anchor'))await tick();c.abort();assert.deepEqual(await pending,{state:'unknown'});wait.resolve({state:'anchored',anchor:point(1,f.journal.rows[0].sha256)});await tick();assert.equal(f.finishes,0);
});
test('blocking anchor operation cannot extend deadline into member mutation',async()=>{
 const f=fixture({advance:v=>{const start=performance.now();while(performance.now()-start<20){}return {state:'anchored',anchor:point(v.through.sequence,v.through.sha256)};},options:{timeoutMs:10}});assert.notEqual((await f.worker.run(input())).state,'committed');assert.equal(f.finishes,0);
});
test('one active removal refuses queues and explicit close aborts pending work',async()=>{
 const wait=deferred(),f=fixture({read:()=>wait.promise}),pending=f.worker.run(input());assert.deepEqual(await f.worker.run(input()),{state:'busy'});f.worker.close();assert.notEqual((await pending).state,'committed');wait.resolve(point());await tick();assert.equal(f.finishes,0);
});
