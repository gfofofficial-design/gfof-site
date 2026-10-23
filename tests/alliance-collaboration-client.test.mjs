import test from 'node:test';
import assert from 'node:assert/strict';
import {createAllianceCollaborationClient} from '../assets/federation/fed-alliance-collaboration-client.mjs';
const origin='https://deploy-preview-124--gfof.netlify.app',id='11111111-1111-4111-8111-111111111111',from='22222222-2222-4222-8222-222222222222',to='33333333-3333-4333-8333-333333333333';
const command=()=>({operationId:id,challengeId:id,revision:0,action:'invite',target:to,kit:'research',scope:'members',days:7,goal:1,note:'A fictional public research brief.',format:1});
const snapshot=()=>({id,from,to,kit:'research',scope:'members',days:7,goal:1,note:'A fictional public research brief.',status:'invited',revision:1,winner:null,createdAt:new Date().toISOString(),acceptedAt:null,endsAt:null,proofs:[]});
const reply=(v,status=200,headers={})=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'private, no-store',...headers}});
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(work){const calls=[],states=[],client=createAllianceCollaborationClient({enabled:true,origin,onState:s=>states.push(s),fetcher:async(url,init)=>{calls.push({url,init});assert.equal(init.credentials,'same-origin');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.equal(Object.hasOwn(init.headers,'Authorization'),false);if(work)return work(url,init,calls.length);return reply(url.includes('/challenges?')?{state:'ready',page:{items:[snapshot()],next:null}}:url.includes('/challenge?')?{state:'ready',challenge:snapshot()}:url.endsWith('/visibility')?{state:'set',...JSON.parse(init.body)}:{state:'applied',operationId:id,challenge:snapshot()});}});return {client,calls,states};}
test('closed client has no startup requests or storage/identity inputs',async()=>{let n=0;const c=createAllianceCollaborationClient({fetcher:()=>n++});assert.equal(n,0);await assert.rejects(c.list(),{code:'closed'});assert.equal(n,0);c.dispose();});
test('private bounded reads, invitation command and hide use only same-origin cookies and exact DTOs',async()=>{const f=fixture();try{assert.equal(f.calls.length,0);assert.equal((await f.client.list()).page.items.length,1);assert.equal((await f.client.read(id)).challenge.id,id);assert.equal((await f.client.change(command())).state,'applied');assert.equal((await f.client.visibility({target:to,hidden:true})).state,'set');assert.equal(f.calls.length,4);assert.deepEqual(JSON.parse(f.calls[2].init.body),command());}finally{f.client.dispose();}});
test('lost reply pauses new writes even after a read; explicit previous-save action reuses the exact command',async()=>{
 const f=fixture((url,init,n)=>n===1?Promise.reject(Error('lost response')):reply(init.method==='GET'?{state:'ready',challenge:snapshot()}:{state:'replayed',operationId:id,challenge:snapshot()}));
 try{await assert.rejects(f.client.change(command()),{code:'unknown'});await f.client.read(id);await assert.rejects(f.client.change({...command(),note:'A different attempt.'}),{code:'unknown'});assert.equal(f.calls.length,2);assert.equal((await f.client.checkOrFinishPrevious()).state,'replayed');assert.deepEqual(JSON.parse(f.calls[2].init.body),command());}finally{f.client.dispose();}
});
test('refusal during explicit reconciliation cannot erase uncertainty about the original save',async()=>{
 const f=fixture((u,i,n)=>n===1?Promise.reject(Error('lost')):reply({state:'refused'},403));try{await assert.rejects(f.client.change(command()),{code:'unknown'});await assert.rejects(f.client.checkOrFinishPrevious(),{code:'refused'});await assert.rejects(f.client.visibility({target:to,hidden:false}),{code:'unknown'});assert.equal(f.calls.length,2);}finally{f.client.dispose();}
});
test('revision conflict requires a fresh exact challenge read before a new intention',async()=>{
 const f=fixture((u,i,n)=>n===1?reply({state:'conflict',revision:4},409):reply({state:'ready',challenge:snapshot()}));try{assert.deepEqual(await f.client.change(command()),{state:'conflict',revision:4});await assert.rejects(f.client.change(command()),{code:'conflict'});assert.equal(f.calls.length,1);await f.client.read(id);assert.equal(f.calls.length,2);}finally{f.client.dispose();}
});
test('cancelled ignored save stays unknown, holds its latch and discards late private content',async()=>{
 let resume;const wait=new Promise(r=>resume=r),f=fixture(async()=>{await wait;return reply({state:'applied',operationId:id,challenge:snapshot()});});
 try{const pending=f.client.change(command());await tick();f.client.cancel();await assert.rejects(pending,{code:'unknown'});await assert.rejects(f.client.read(id),{code:'busy'});resume();await tick();await assert.rejects(f.client.change(command()),{code:'unknown'});assert.equal(f.states.some(s=>s.status==='saved'),false);assert.equal(f.calls.length,1);}finally{resume();f.client.dispose();}
});
test('dispose during ignored read cannot deliver a later private snapshot',async()=>{
 let resume;const wait=new Promise(r=>resume=r),f=fixture(async()=>{await wait;return reply({state:'ready',challenge:snapshot()});});try{const p=f.client.read(id);await tick();f.client.dispose();await assert.rejects(p,{code:'cancelled'});resume();await tick();assert.equal(f.states.some(s=>s.challenge),false);}finally{resume();f.client.dispose();}
});
for(const [name,work]of [
 ['mismatched operation',()=>reply({state:'applied',operationId:to,challenge:snapshot()})],
 ['wrong challenge',()=>reply({state:'applied',operationId:id,challenge:{...snapshot(),id:to}})],
 ['cacheable reply',()=>reply({state:'applied',operationId:id,challenge:snapshot()},200,{'cache-control':'public'})],
 ['oversized stream',()=>new Response(' '.repeat(262145),{headers:{'content-type':'application/json','cache-control':'no-store'}})],
 ['malformed JSON',()=>new Response('{',{headers:{'content-type':'application/json','cache-control':'no-store'}})],
])test(name+' cannot be a confirmed save',async()=>{const f=fixture(work);try{await assert.rejects(f.client.change(command()),{code:'unknown'});await assert.rejects(f.client.change(command()),{code:'unknown'});assert.equal(f.calls.length,1);}finally{f.client.dispose();}});
test('caller identity, duplicate pagination fields and excessive limits refuse before fetching',()=>{const f=fixture();try{assert.throws(()=>f.client.change({...command(),actor:from}));assert.throws(()=>f.client.list({after:null,limit:20}));assert.throws(()=>f.client.visibility({target:to,hidden:true,actor:from}));assert.equal(f.calls.length,0);}finally{f.client.dispose();}});
