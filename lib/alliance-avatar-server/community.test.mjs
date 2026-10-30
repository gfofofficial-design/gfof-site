import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createAllianceCommunityStore} from './community-store.mjs';
import {createAllianceCommunityService} from './community-service.mjs';
import {COMMUNITY_SOURCE_SHA256} from './community-boundary.mjs';
import {managedCommunityExtensionSql,managedCommunityClosedInspectionSql} from './community-managed-install.mjs';
import {collaborationCommand,collaborationSnapshot,collaborationPage} from '../../assets/federation/fed-alliance-collaboration-contract.mjs';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`,ctx={actorId:id(1),sessionId:id(2),expiresAt:Date.now()+300000};
const p=id(3),other=id(4),cid=id(5),invite=()=>({operationId:cid,challengeId:cid,revision:0,action:'invite',target:other,kit:'research',scope:'members',days:7,goal:1,note:'Compare the public evidence and remaining unknowns.',format:1});
const row=()=>({id:cid,from:p,to:other,kit:'research',scope:'members',days:7,goal:1,note:invite().note,status:'invited',revision:1,winner:null,createdAt:new Date().toISOString(),acceptedAt:null,endsAt:null,proofs:[]});
function fixture({afterChange,blockedAt=Infinity,delayedRead}={}){
 let writes=0,reads=0,views=0,closes=0,allowed=true,permitCalls=0,authorizations=0;const blocked=new Set();
 const ledger={authorizeSession:async(a,s)=>{authorizations++;assert.deepEqual([a,s],[ctx.actorId,ctx.sessionId]);return {actorId:a,sessionId:s,profileId:p};}};
 const store={read:async()=>{reads++;await delayedRead;return row();},list:async()=>({items:[row()],next:null}),change:async(_a,_s,v)=>{writes++;await afterChange?.(blocked);return {state:'applied',operationId:v.operationId,challenge:row()};},block:async(_a,_s,v)=>{writes++;return {...v};}};
 const journal={review:async()=>{views++;return {state:'verified_evidence',checkProfile:({profileId})=>views>=blockedAt||blocked.has(profileId)?{state:'blocked',scope:'profile'}:{state:'not_listed'},close(){closes++;}};}};
 const serving={authorizeCommunity:async()=>{permitCalls++;return allowed;}};
 const service=createAllianceCommunityService({enabled:true,ledger,store,journal,serving});
 return {service,store,ledger,journal,serving,get counts(){return {writes,reads,views,closes,permitCalls,authorizations};},set allowed(v){allowed=v;}};
}
test('community schema and runtime fingerprints stay bound to the reviewed source',()=>{
 const source=readFileSync(new URL('../../sql/alliance-community-candidate.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 assert.equal(createHash('sha256').update(source).digest('hex'),COMMUNITY_SOURCE_SHA256);
 const install=managedCommunityExtensionSql(),inspection=managedCommunityClosedInspectionSql();
 assert.equal(install.includes(source),true);assert.match(install,/COMMIT;\s*$/);assert.match(inspection,/ROLLBACK;\s*$/);
 assert.doesNotMatch(install,/^\s*(?:CREATE|ALTER)\s+ROLE\b/im);
});
test('strict commands reject forged identities, extra metadata and unsafe ambiguous retries',()=>{
 assert.equal(collaborationCommand(invite()).target,other);
 for(const value of [{...invite(),actorId:id(8)},{...invite(),admin:true},{...invite(),operationId:id(8)},{...invite(),revision:1},{...invite(),days:8},{...invite(),goal:'1'},{...invite(),note:'<script>'},{...invite(),target:'owner@example.invalid'}])assert.throws(()=>collaborationCommand(value));
 for(const action of ['publish','award','delete_account','grant_role'])assert.throws(()=>collaborationCommand({...invite(),action}));
});
test('private output validates peer provenance, revision, deadline and pagination without account fields',()=>{
 assert.equal(collaborationSnapshot(row()).from,p);
 for(const v of [{...row(),accountId:ctx.actorId},{...row(),from:other},{...row(),status:'complete',winner:p},{...row(),proofs:[{id:id(9),owner:id(8),note:'An outsider contribution.',status:'pending'}]}])assert.throws(()=>collaborationSnapshot(v));
 assert.throws(()=>collaborationPage({items:[row(),row()],next:null}));
 assert.throws(()=>collaborationPage({items:[row()],next:id(9)}));
});
test('default service/store perform no lookup and the old profile-only authority cannot open this capability',async()=>{
 const trap=new Proxy({},{get(){throw Error('No lookup');}}),s=createAllianceCommunityService({ledger:trap,store:trap,journal:trap,serving:trap});
 assert.deepEqual(await s.change(trap,trap),{state:'unavailable'});s.close();
 const store=await createAllianceCommunityStore({connection:trap,openPool:trap});await assert.rejects(store.inventory(),{outcome:'not_started'});await store.close();
 const f=fixture();assert.throws(()=>createAllianceCommunityService({enabled:true,ledger:f.ledger,store:f.store,journal:f.journal,serving:{authorize:async()=>true}}));f.service.close();
});
test('verified current SQL identity plus two independent journal views gates private output',async()=>{
 const f=fixture();try{const r=await f.service.read(ctx,cid);assert.equal(r.state,'ready');assert.equal(r.challenge.id,cid);assert.deepEqual(f.counts,{writes:0,reads:1,views:2,closes:2,permitCalls:4,authorizations:2});}finally{f.service.close();}
});
test('a removed participant in either journal view withholds the whole record/page',async()=>{
 for(const blockedAt of [1,2])for(const kind of ['read','list']){
  const f=fixture({blockedAt});try{const r=await f.service[kind](ctx,...(kind==='read'?[cid]:[]));assert.equal(r.state,'unavailable');assert.equal(f.counts.writes,0);assert.equal(f.counts.views,f.counts.closes);assert.equal(Object.hasOwn(r,'challenge'),false);}finally{f.service.close();}
 }
});
test('a tombstone before a mutation prevents dispatch; changed evidence after commit returns unknown and quarantines',async()=>{
 const first=fixture({blockedAt:1});try{assert.equal((await first.service.change(ctx,invite())).state,'unavailable');assert.equal(first.counts.writes,0);}finally{first.service.close();}
 const f=fixture({afterChange:blocked=>blocked.add(other)});try{
  assert.deepEqual(await f.service.change(ctx,invite()),{state:'unknown'});assert.equal(f.counts.writes,1);
  assert.deepEqual(await f.service.change(ctx,invite()),{state:'unavailable'});assert.equal(f.counts.writes,1);
 }finally{f.service.close();}
});
test('authority withdrawal closes without borrowing the former permit or auto-reopening',async()=>{
 const f=fixture();try{f.allowed=false;assert.deepEqual(await f.service.read(ctx,cid),{state:'unavailable'});f.allowed=true;assert.deepEqual(await f.service.read(ctx,cid),{state:'unavailable'});assert.equal(f.counts.reads,0);}finally{f.service.close();}
});
test('cancellation retires an uncooperative read and never releases its late private record',async()=>{
 let release;const delayedRead=new Promise(r=>release=r),f=fixture({delayedRead}),controller=new AbortController();
 try{
  const waiting=f.service.read(ctx,cid,{signal:controller.signal});await new Promise(r=>setImmediate(r));controller.abort();
  assert.deepEqual(await waiting,{state:'unavailable'});assert.deepEqual(await f.service.read(ctx,cid),{state:'unavailable'});release();await new Promise(r=>setImmediate(r));assert.equal(f.counts.views,f.counts.closes);
 }finally{release();f.service.close();}
});
