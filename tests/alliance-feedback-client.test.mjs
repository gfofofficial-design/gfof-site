import test from 'node:test';
import assert from 'node:assert/strict';
import {createAllianceFeedbackClient} from '../assets/federation/fed-alliance-feedback-client.mjs';
const origin='https://deploy-preview-124--gfof.netlify.app',id='11111111-1111-4111-8111-111111111111',from='22222222-2222-4222-8222-222222222222',to='33333333-3333-4333-8333-333333333333';
const command=()=>({action:'post',id,title:'A practical fictional tool',category:'tools',detail:'A fictional public research brief.'});
const snapshot=()=>({id,owner:from,title:command().title,category:'tools',detail:command().detail,createdAt:new Date().toISOString(),supportCount:0,supported:false});
const reply=(v,status=200,headers={})=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'private, no-store',...headers}});
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(work){const calls=[],states=[],client=createAllianceFeedbackClient({enabled:true,origin,onState:s=>states.push(s),fetcher:async(url,init)=>{calls.push({url,init});assert.equal(init.credentials,'same-origin');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.equal(Object.hasOwn(init.headers,'Authorization'),false);if(work)return work(url,init,calls.length);return reply(url.includes('/ideas?')?{state:'ready',page:{items:[snapshot()],next:null}}:url.includes('/idea?')?{state:'ready',idea:snapshot()}:{state:'applied',idea:snapshot()});}});return {client,calls,states};}
test('closed client has no startup requests or storage/identity inputs',async()=>{let n=0;const c=createAllianceFeedbackClient({fetcher:()=>n++});assert.equal(n,0);await assert.rejects(c.list(),{code:'closed'});assert.equal(n,0);c.dispose();});
test('private bounded reads and an idea post use only same-origin cookies and exact DTOs',async()=>{const f=fixture();try{assert.equal(f.calls.length,0);assert.equal((await f.client.list()).page.items.length,1);assert.equal((await f.client.read(id)).idea.id,id);assert.equal((await f.client.change(command())).state,'applied');assert.equal(f.calls.length,3);assert.deepEqual(JSON.parse(f.calls[2].init.body),command());}finally{f.client.dispose();}});
test('lost reply pauses new writes even after a read; explicit previous-save action reuses the exact command',async()=>{
 const f=fixture((url,init,n)=>n===1?Promise.reject(Error('lost response')):reply(init.method==='GET'?{state:'ready',idea:snapshot()}:{state:'replayed',idea:snapshot()}));
 try{await assert.rejects(f.client.change(command()),{code:'unknown'});await f.client.read(id);await assert.rejects(f.client.change({...command(),title:'A different attempt.'}),{code:'unknown'});assert.equal(f.calls.length,2);assert.equal((await f.client.checkOrFinishPrevious()).state,'replayed');assert.deepEqual(JSON.parse(f.calls[2].init.body),command());}finally{f.client.dispose();}
});
test('refusal during explicit reconciliation cannot erase uncertainty about the original save',async()=>{
 const f=fixture((u,i,n)=>n===1?Promise.reject(Error('lost')):reply({state:'refused'},403));try{await assert.rejects(f.client.change(command()),{code:'unknown'});await assert.rejects(f.client.checkOrFinishPrevious(),{code:'refused'});await assert.rejects(f.client.change({action:'support',id,supported:false}),{code:'unknown'});assert.equal(f.calls.length,2);}finally{f.client.dispose();}
});
test('cancelled ignored save stays unknown, holds its latch and discards late private content',async()=>{
 let resume;const wait=new Promise(r=>resume=r),f=fixture(async()=>{await wait;return reply({state:'applied',idea:snapshot()});});
 try{const pending=f.client.change(command());await tick();f.client.cancel();await assert.rejects(pending,{code:'unknown'});await assert.rejects(f.client.read(id),{code:'busy'});resume();await tick();await assert.rejects(f.client.change(command()),{code:'unknown'});assert.equal(f.states.some(s=>s.status==='saved'),false);assert.equal(f.calls.length,1);}finally{resume();f.client.dispose();}
});
test('dispose during ignored read cannot deliver a later private snapshot',async()=>{
 let resume;const wait=new Promise(r=>resume=r),f=fixture(async()=>{await wait;return reply({state:'ready',idea:snapshot()});});try{const p=f.client.read(id);await tick();f.client.dispose();await assert.rejects(p,{code:'cancelled'});resume();await tick();assert.equal(f.states.some(s=>s.idea),false);}finally{resume();f.client.dispose();}
});
for(const [name,work]of [
 ['wrong post fields',()=>reply({state:'applied',idea:{...snapshot(),title:'An unrelated idea title'}})],
 ['wrong idea',()=>reply({state:'applied',idea:{...snapshot(),id:to}})],
 ['cacheable reply',()=>reply({state:'applied',idea:snapshot()},200,{'cache-control':'public'})],
 ['oversized stream',()=>new Response(' '.repeat(262145),{headers:{'content-type':'application/json','cache-control':'no-store'}})],
 ['malformed JSON',()=>new Response('{',{headers:{'content-type':'application/json','cache-control':'no-store'}})],
])test(name+' cannot be a confirmed save',async()=>{const f=fixture(work);try{await assert.rejects(f.client.change(command()),{code:'unknown'});await assert.rejects(f.client.change(command()),{code:'unknown'});assert.equal(f.calls.length,1);}finally{f.client.dispose();}});
test('caller identity, duplicate pagination fields and excessive limits refuse before fetching',()=>{const f=fixture();try{assert.throws(()=>f.client.change({...command(),actor:from}));assert.throws(()=>f.client.list({after:null,limit:20}));assert.throws(()=>f.client.change({action:'support',id,supported:true,actor:from}));assert.equal(f.calls.length,0);}finally{f.client.dispose();}});

for(const command of [{action:'support',id,supported:true},{action:'support',id,supported:false},{action:'remove',id},{action:'report',id,kind:'idea',target:to}])test('lost '+command.action+' explicitly reconciles the same desired state/target, with no automatic repeat',async()=>{
 const result=command.action==='support'?{state:'set',id,supported:command.supported}:command.action==='remove'?{state:'removed',id}:{state:'recorded',id,kind:command.kind,target:command.target,removed:false};
 const f=fixture((u,i,n)=>n===1?Promise.reject(Error('Lost fictional reply')):reply(result));
 try{await assert.rejects(f.client.change(command),{code:'unknown'});assert.equal(f.calls.length,1);assert.deepEqual(await f.client.checkOrFinishPrevious(),result);assert.equal(f.calls.length,2);assert.equal(f.calls[1].init.body,f.calls[0].init.body);}finally{f.client.dispose();}
});
test('report receipt cannot claim removal or leak internal deletion evidence',async()=>{
 const command={action:'report',id,kind:'idea',target:to};
 for(const result of [{state:'recorded',id,kind:'idea',target:to,removed:true},{state:'recorded',id,kind:'idea',target:to,removed:false,evidenceProfiles:[from]}]){
  const f=fixture(()=>reply(result));try{await assert.rejects(f.client.change(command),{code:'unknown'});assert.equal(f.calls.length,1);}finally{f.client.dispose();}
 }
});
