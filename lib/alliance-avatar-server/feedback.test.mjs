import test from 'node:test';
import assert from 'node:assert/strict';
import {rootCertificates} from 'node:tls';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {feedbackCommand,feedbackInternal,feedbackPublicPage,feedbackPublicMutation} from '../../assets/federation/fed-alliance-feedback-contract.mjs';
import {createAllianceFeedbackStore} from './feedback-store.mjs';
import {createAllianceFeedbackService} from './feedback-service.mjs';
import {FEEDBACK_SOURCE_SHA256} from './feedback-boundary.mjs';
import {managedFeedbackExtensionSql,managedFeedbackClosedInspectionSql} from './feedback-managed-install.mjs';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,p=id(3),other=id(4),iid=id(5),supporter=id(6);
const ctx=()=>({actorId:id(1),sessionId:id(2),expiresAt:Date.now()+300000});
const post=()=>({action:'post',id:iid,title:'A practical tool',category:'tools',detail:'A fictional tool with a clear limitation.'});
const idea=()=>({id:iid,owner:p,...Object.fromEntries(['title','category','detail'].map(k=>[k,post()[k]])),createdAt:'2026-10-24T12:00:00.000Z',supportCount:1,supported:false});
const row=()=>({idea:idea(),evidenceProfiles:[p,supporter]});
const tick=()=>new Promise(r=>setImmediate(r));
function serviceFixture({afterChange,delayedRead,deletedAt=Infinity}={}){
 let writes=0,reads=0,views=0,closes=0,permits=0,allowed=true;const deleted=new Set();
 const ledger={authorizeSession:async(a,s)=>({actorId:a,sessionId:s,profileId:p})};
 const store={read:async()=>{reads++;await delayedRead;return row();},list:async()=>({items:[row()],next:null}),change:async(_a,_s,v)=>{writes++;await afterChange?.(deleted);return v.action==='post'?{state:'applied',record:row()}:v.action==='remove'?{state:'removed',id:v.id}:v.action==='report'?{state:'recorded',id:v.id,kind:v.kind,target:v.target,removed:false}:{state:'set',id:v.id,supported:v.supported};}};
 const community={read:async()=>{throw Error('No challenge fixture');}};
 const journal={review:async()=>{views++;return {state:'verified_evidence',checkProfile:({profileId})=>views>=deletedAt||deleted.has(profileId)?{state:'blocked',scope:'profile'}:{state:'not_listed'},close(){closes++;}};}};
 const serving={authorizeFeedback:async()=>{permits++;return allowed;}};
 const deps={enabled:true,ledger,store,community,journal,serving};
 return {service:createAllianceFeedbackService(deps),deps,deleted,set allowed(v){allowed=v;},get counts(){return {writes,reads,views,closes,permits};}};
}
test('feedback exact source/fingerprints, atomic install and rollback inspection remain offline',()=>{
 const source=readFileSync(new URL('../../sql/alliance-feedback-candidate.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 assert.equal(createHash('sha256').update(source).digest('hex'),FEEDBACK_SOURCE_SHA256);
 assert.ok(managedFeedbackExtensionSql().includes(source));assert.match(managedFeedbackExtensionSql(),/COMMIT;\s*$/);assert.match(managedFeedbackClosedInspectionSql(),/ROLLBACK;\s*$/);
 assert.doesNotMatch(source,/\b(?:create|alter)\s+role\b/i);
});
test('commands reject forged ownership, ambiguous toggles, extra metadata and unsafe text',()=>{
 assert.deepEqual(feedbackCommand(post()),post());
 for(const v of [null,{...post(),owner:other},{...post(),title:' <tool>'},{...post(),detail:'\u202eevil text in a long detail'},{...post(),category:'reward'},{action:'toggle',id:iid},{action:'support',id:iid,supported:'true'},{action:'report',id:iid,kind:'wallet',target:other},{action:'remove',id:'00000000-0000-0000-0000-000000000000'}])assert.throws(()=>feedbackCommand(v));
});
test('internal provenance is bounded and the public contract cannot leak supporter IDs',()=>{
 assert.deepEqual(feedbackInternal(row()),row());
 for(const v of [{...row(),evidenceProfiles:[p,p]},{...row(),evidenceProfiles:[p]},{...row(),idea:{...idea(),supported:true,supportCount:0}},{...row(),idea:{...idea(),accountId:ctx().actorId}}])assert.throws(()=>feedbackInternal(v));
 assert.throws(()=>feedbackPublicPage({items:[row()],next:null}));assert.throws(()=>feedbackPublicMutation({state:'applied',record:row()},post()));
 assert.deepEqual(feedbackPublicPage({items:[idea()],next:null}),{items:[idea()],next:null});
});
test('default off performs no lookup and old capability cannot authorize feedback',async()=>{
 const trap=new Proxy({},{get(){throw Error('lookup');}}),s=createAllianceFeedbackService({store:trap});assert.deepEqual(await s.read(trap,trap),{state:'unavailable'});s.close();
 const store=await createAllianceFeedbackStore({connection:trap,openPool:trap});await assert.rejects(store.inventory(),{outcome:'not_started'});await store.close();
 const f=serviceFixture();assert.throws(()=>createAllianceFeedbackService({...f.deps,serving:{authorizeCommunity:async()=>true}}));f.service.close();
});
test('current SQL binding and fresh deletion reviews release only the public idea/page',async()=>{
 const f=serviceFixture();try{
  assert.deepEqual(await f.service.read(ctx(),iid),{state:'ready',idea:idea()});
  assert.deepEqual(await f.service.list(ctx()),{state:'ready',page:{items:[idea()],next:null}});
  assert.equal(f.counts.views,4);assert.equal(f.counts.views,f.counts.closes);
 }finally{f.service.close();}
});
for(const kind of ['read','list'])test('a restored deleted supporter withholds '+kind+' even when its displayed count is zero',async()=>{
 const f=serviceFixture();f.deleted.add(supporter);f.deps.store[kind]=async()=>kind==='read'?{...row(),idea:{...idea(),supportCount:0}}:{items:[{...row(),idea:{...idea(),supportCount:0}}],next:null};
 try{assert.deepEqual(await f.service[kind](ctx(),...(kind==='read'?[iid]:[])),{state:'unavailable'});assert.equal(f.counts.writes,0);}finally{f.service.close();}
});
test('author-only result binding withholds forged post owner and never retries an uncertain mutation',async()=>{
 const f=serviceFixture();f.deps.store.change=async()=>({state:'applied',record:{...row(),idea:{...idea(),owner:other},evidenceProfiles:[other,supporter]}});
 try{assert.deepEqual(await f.service.change(ctx(),post()),{state:'unknown'});assert.deepEqual(await f.service.change(ctx(),post()),{state:'unavailable'});}finally{f.service.close();}
});
test('deletion after commit returns unknown and retires the service; deletion before dispatch prevents write',async()=>{
 const f=serviceFixture({afterChange:deleted=>deleted.add(supporter)});try{assert.deepEqual(await f.service.change(ctx(),post()),{state:'unknown'});assert.deepEqual(await f.service.change(ctx(),post()),{state:'unavailable'});assert.equal(f.counts.writes,1);}finally{f.service.close();}
 const g=serviceFixture();g.deleted.add(supporter);try{assert.deepEqual(await g.service.change(ctx(),{action:'support',id:iid,supported:true}),{state:'unavailable'});assert.equal(g.counts.writes,0);}finally{g.service.close();}
});
test('report receipt is private and never claims removal; own support removal needs no hidden target read',async()=>{
 const f=serviceFixture();try{
  const report={action:'report',id:id(7),kind:'member',target:other};assert.deepEqual(await f.service.change(ctx(),report),{state:'recorded',id:report.id,kind:'member',target:other,removed:false});
  assert.deepEqual(await f.service.change(ctx(),{action:'support',id:iid,supported:false}),{state:'set',id:iid,supported:false});assert.equal(f.counts.reads,0);
 }finally{f.service.close();}
});
test('a mismatched pre-read target cannot authorize support or an idea report',async()=>{
 for(const command of [{action:'support',id:id(9),supported:true},{action:'report',id:id(8),kind:'idea',target:id(9)}]){
  const f=serviceFixture();try{assert.deepEqual(await f.service.change(ctx(),command),{state:'unavailable'});assert.equal(f.counts.writes,0);}finally{f.service.close();}
 }
});
test('authority withdrawal and cancelled late read cannot reopen or leak a result',async()=>{
 const f=serviceFixture();f.allowed=false;try{assert.deepEqual(await f.service.read(ctx(),iid),{state:'unavailable'});f.allowed=true;assert.deepEqual(await f.service.read(ctx(),iid),{state:'unavailable'});}finally{f.service.close();}
 let resume;const g=serviceFixture({delayedRead:new Promise(r=>resume=r)}),c=new AbortController();
 try{const pending=g.service.read(ctx(),iid,{signal:c.signal});await tick();c.abort();assert.deepEqual(await pending,{state:'unavailable'});resume();await tick();assert.deepEqual(await g.service.read(ctx(),iid),{state:'unavailable'});assert.equal(g.counts.views,g.counts.closes);}finally{resume();g.service.close();}
});
async function driverFixture({drift=false,commitFailure=false,who}={}){
 const calls=[],releases=[];let acquired=0;
 const identity=who??{database:'postgres',actor:'alliance_avatar_executor',login:'alliance_avatar_executor',tls:true,restricted:true,isolated:true,limited:true};
 const client={async query(q){calls.push(q);if(q.text.startsWith('select current_database'))return {rows:[identity]};if(q.text.endsWith('AS feedback_boundary'))return {rows:[{feedback_boundary:!drift}]};if(q.text.startsWith('SELECT alliance_feedback.'))return {rows:[{result:{state:'applied',record:row()}}]};if(q.text==='COMMIT'){if(commitFailure)throw Error('PRIVATE database failure');return {command:'COMMIT'};}return {rows:[]};},release(v){releases.push(v);}};
 const pool={connect:async()=>{acquired++;return client;},on(){},end:async()=>{}};
 const store=await createAllianceFeedbackStore({enabled:true,connection:{host:'db.abcdefghijklmnopqrst.supabase.co',password:'synthetic-test-password-only-123456',ca:rootCertificates[0]},openPool:()=>pool});
 return {store,calls,releases,get acquired(){return acquired;}};
}
test('restricted adapter refuses wrong identity or changed permissions before dispatch',async()=>{
 for(const options of [{drift:true},{who:{database:'postgres',actor:'postgres',login:'postgres',tls:true,restricted:true,isolated:true,limited:true}}]){
  const f=await driverFixture(options);try{await assert.rejects(f.store.change(ctx().actorId,ctx().sessionId,post()),{message:'feedback_store_unavailable',outcome:'not_started'});assert.ok(!f.calls.some(q=>q.text.startsWith('SELECT alliance_feedback.')));assert.deepEqual(f.releases,[true]);}finally{await f.store.close();}
 }
});
test('lost commit acknowledgement is unknown, redacted and permanently retires the connection',async()=>{
 const f=await driverFixture({commitFailure:true});try{
  await assert.rejects(f.store.change(ctx().actorId,ctx().sessionId,post()),{message:'feedback_store_unavailable',outcome:'unknown'});
  await assert.rejects(f.store.change(ctx().actorId,ctx().sessionId,post()),{outcome:'not_started'});assert.equal(f.acquired,1);assert.deepEqual(f.releases,[true]);
 }finally{await f.store.close();}
});
