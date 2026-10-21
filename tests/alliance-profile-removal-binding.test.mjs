import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileRemovalClient} from '../assets/federation/fed-alliance-profile-removal-client.mjs';
import {createProfileRemovalStatusClient} from '../assets/federation/fed-alliance-profile-removal-status-client.mjs';
import {createProfileRemovalApi} from '../lib/alliance-profile-removal-api.mjs';
import {createProfileRemovalStatusApi} from '../lib/alliance-profile-removal-status-api.mjs';
import {createAllianceAvatarMemberService} from '../lib/alliance-avatar-server/member.mjs';
import {createAllianceAnchoredRemoval} from '../lib/alliance-avatar-server/anchored-removal.mjs';
import {memoryRemovalJournal} from '../lib/alliance-avatar-server/removal.fixture.mjs';
import {projectRef,epoch,zero} from '../lib/alliance-avatar-server/deletion-journal.fixture.mjs';
const origin='https://deploy-preview-124--gfof.netlify.app',url='https://abcdefghijklmnopqrst.supabase.co';
const actor='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222',oldProfile='33333333-3333-4333-8333-333333333333',newProfile='44444444-4444-4444-8444-444444444444',op='55555555-5555-4555-8555-555555555555',journalProjectRef='uvwxyzabcdefghijklmn';
const token='fixtureHeader.'+Buffer.from(JSON.stringify({sub:actor,session_id:session,iss:url+'/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+120})).toString('base64url')+'.fixtureSignature';
function fixture({loseReply=false,wrongPlan=false}={}){
 let current={profileId:oldProfile,version:0},quota=0,finishes=0;const operations=new Map(),journal=memoryRemovalJournal(),requests=[];
 let anchor={format:1,memberProjectRef:projectRef,journalProjectRef,epoch,sequence:0,sha256:zero};
 const reject=()=>{throw Object.assign(Error('Synthetic SQL refusal'),{outcome:'rejected'});};
 const ledger={authorizeSession:async()=>{if(!current)reject();return {actorId:actor,sessionId:session,profileId:current.profileId};},mineSession:async()=>{if(!current)reject();return {version:current.version,objectId:null,pending:[]};},
  async prepareProfileBoundAnchoredRemovalSession(a,s,id,version,profileId){
   assert.deepEqual([a,s],[actor,session]);let entry=operations.get(id);
   if(entry){if(entry.plan.profileId!==profileId||entry.plan.version!==version)reject();}
   else{if(!current||current.profileId!==profileId||current.version!==version)reject();entry={plan:{format:1,kind:'profile',operationId:id,profileId:wrongPlan?newProfile:profileId,version,objectIds:[]},committed:false};operations.set(id,entry);quota++;}
   return {state:'prepared',plan:structuredClone(entry.plan)};
  },
  prepareAnchoredRemovalSession:reject,
  async finishAnchoredRemovalSession(a,s,id,plan,receipt,proof){
   assert.deepEqual([a,s],[actor,session]);assert.equal(proof.sha256,anchor.sha256);assert.equal(journal.rows.length,1);assert.equal(receipt.records[0].sha256,journal.rows[0].sha256);const entry=operations.get(id);assert.deepEqual(entry.plan,plan);
   if(!entry.committed){if(current?.profileId!==plan.profileId||current.version!==plan.version)reject();current=null;entry.committed=true;finishes++;}return {state:'committed',version:plan.version+1};
  }};
 for(const name of ['reserveSession','claimUploadSession','commitUploadSession','cancelReservedSession','operationReceiptSession','removeImageSession','settleUnpublished'])ledger[name]=reject;
 journal.review=async()=>({state:'verified_evidence',checkProfile:({profileId})=>journal.rows.some(r=>r.event.profileId===profileId)?{state:'blocked',scope:'profile'}:{state:'not_listed'},close(){}});
 const serving={authorize:async()=>true},anchorStore={read:async()=>structuredClone(anchor),advance:async v=>{anchor={...anchor,...v.through};return {state:'anchored',anchor:structuredClone(anchor)};}};
 const removal=createAllianceAnchoredRemoval({enabled:true,profileBinding:true,projectRef,journalProjectRef,epoch,minimum:{sequence:0,sha256:zero},ledger,journal,anchorStore,serving});
 const service=createAllianceAvatarMemberService({enabled:true,removalVersionEnabled:true,profileBindingEnabled:true,origin,url,key:'sb_publishable_synthetic_fixture_only_12345',ledger,journal,serving,removal,processor:{process:reject},storage:{upload:reject},fetcher:async()=>new Response(JSON.stringify({id:actor,is_anonymous:false,email_confirmed_at:'2026-10-17T12:00:00Z'}))});
 const api=createProfileRemovalApi({enabled:true,profileBinding:true,origin,service}),statusApi=createProfileRemovalStatusApi({enabled:true,origin,service});
 const fetcher=async(endpoint,init)=>{requests.push({endpoint,body:init.body?JSON.parse(init.body):null});const response=await (init.method==='GET'?statusApi:api)(new Request(endpoint,{...init,headers:{...init.headers,origin,'sec-fetch-site':'same-origin',cookie:'__Host-gf-access='+token}}));if(init.method==='DELETE'&&loseReply){loseReply=false;throw Error('Synthetic committed reply lost');}return response;};
 const client=createProfileRemovalClient({enabled:true,profileBinding:true,origin,newOperationId:()=>op,fetcher}),reader=createProfileRemovalStatusClient({enabled:true,origin,fetcher});
 return {client,reader,journal,requests,operations,get current(){return current;},get counts(){return {quota,finishes,anchorSequence:anchor.sequence};},recreate(){current={profileId:newProfile,version:0};},close(){client.dispose();reader.dispose();api.close();statusApi.close();service.close();removal.close();}};
}
test('old confirmation cannot remove a recreated profile with the same numeric version',async()=>{
 const f=fixture();try{const snapshot=await f.reader.read();assert.deepEqual(snapshot,{profileId:oldProfile,version:0});f.recreate();assert.notEqual((await f.client.confirm({...snapshot,confirm:'remove_my_profile'})).state,'committed');assert.deepEqual(f.current,{profileId:newProfile,version:0});assert.equal(f.operations.size,0);assert.equal(f.journal.rows.length,0);assert.deepEqual(f.counts,{quota:0,finishes:0,anchorSequence:0});assert.deepEqual(f.client.pendingOperation(),{operationId:op,profileId:oldProfile,version:0});}finally{f.close();}
});
test('lost committed reply reconciles original profile after recreation without deleting the new profile',async()=>{
 const f=fixture({loseReply:true});try{const snapshot=await f.reader.read();assert.equal((await f.client.confirm({...snapshot,confirm:'remove_my_profile'})).state,'unknown');f.recreate();assert.equal((await f.client.reconcile()).state,'committed');assert.deepEqual(f.current,{profileId:newProfile,version:0});assert.equal(f.journal.rows.length,1);assert.deepEqual(f.counts,{quota:1,finishes:1,anchorSequence:1});const writes=f.requests.filter(r=>r.body);assert.deepEqual(writes[0].body,writes[1].body);assert.equal(writes[0].body.profileId,oldProfile);}finally{f.close();}
});
test('mismatched prepared identity is refused before any independent journal or anchor write',async()=>{
 const f=fixture({wrongPlan:true});try{const snapshot=await f.reader.read();assert.notEqual((await f.client.confirm({...snapshot,confirm:'remove_my_profile'})).state,'committed');assert.equal(f.current.profileId,oldProfile);assert.equal(f.journal.rows.length,0);assert.equal(f.counts.anchorSequence,0);assert.equal(f.counts.finishes,0);}finally{f.close();}
});
test('bound client requires exact profile precondition and cannot accept an actor selector instead',()=>{
 let calls=0;const c=createProfileRemovalClient({enabled:true,profileBinding:true,origin,fetcher:()=>{calls++;}});for(const input of [{version:0,confirm:'remove_my_profile'},{profileId:'bad',version:0,confirm:'remove_my_profile'},{profileId:oldProfile,actorId:actor,version:0,confirm:'remove_my_profile'}])assert.throws(()=>c.confirm(input));assert.equal(calls,0);c.dispose();
});
test('bound HTTP route refuses missing identity before dispatch and never upgrades a legacy request',async()=>{
 let calls=0;const api=createProfileRemovalApi({enabled:true,profileBinding:true,origin,service:{handle(){calls++;}}});const response=await api(new Request(origin+'/api/alliance-members/me/profile',{method:'DELETE',headers:{origin,'content-type':'application/json'},body:JSON.stringify({operationId:op,version:0,confirm:'remove_my_profile'})}));assert.equal(response.status,400);assert.equal(calls,0);api.close();
});
