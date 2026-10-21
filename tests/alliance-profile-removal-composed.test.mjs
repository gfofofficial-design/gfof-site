import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileRemovalClient} from '../assets/federation/fed-alliance-profile-removal-client.mjs';
import {createProfileRemovalApi} from '../lib/alliance-profile-removal-api.mjs';
import {createAllianceAvatarMemberService} from '../lib/alliance-avatar-server/member.mjs';
import {createAllianceRemoval} from '../lib/alliance-avatar-server/removal.mjs';
import {memoryRemovalJournal} from '../lib/alliance-avatar-server/removal.fixture.mjs';
import {projectRef,epoch,zero} from '../lib/alliance-avatar-server/deletion-journal.fixture.mjs';
const origin='https://deploy-preview-124--gfof.netlify.app',url='https://abcdefghijklmnopqrst.supabase.co';
const actor='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222',profile='33333333-3333-4333-8333-333333333333',operation='44444444-4444-4444-8444-444444444444';
const token='fixtureHeader.'+Buffer.from(JSON.stringify({sub:actor,session_id:session,iss:url+'/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+120})).toString('base64url')+'.fixtureSignature';
function fixture({loseMemberReply=false,loseJournalReply=false,authStatus=200}={}){
 const journal=memoryRemovalJournal(),calls=[];let committed=false,appends=0,finishes=0,requests=0;
 const originalAppend=journal.append.bind(journal);journal.append=async input=>{calls.push('append');appends++;const result=await originalAppend(input);if(loseJournalReply){loseJournalReply=false;throw Error('Synthetic discarded append acknowledgement');}return result;};
 const ledger={prepareRemovalSession:async(a,s,op,v,kind)=>{calls.push('prepare');assert.deepEqual([a,s,op,v,kind],[actor,session,operation,7,'profile']);return committed?{state:'committed',version:8}:{state:'prepared',plan:{format:1,kind:'profile',operationId:op,profileId:profile,version:v,objectIds:[]}};},finishRemovalSession:async(a,s,op,plan,receipt)=>{calls.push('finish');assert.equal(journal.rows.length,1);assert.equal(receipt.records[0].sha256,journal.rows[0].sha256);assert.deepEqual([a,s,op],[actor,session,operation]);assert.equal(plan.profileId,profile);committed=true;finishes++;return {state:'committed',version:8};}};
 for(const k of ['authorizeSession','reserveSession','claimUploadSession','commitUploadSession','cancelReservedSession','operationReceiptSession','removeImageSession','settleUnpublished'])ledger[k]=()=>{throw Error('Legacy mutation must not be reached');};
 const removal=createAllianceRemoval({enabled:true,projectRef,epoch,minimum:{sequence:0,sha256:zero},ledger,journal,serving:{authorize:async()=>true}});
 const service=createAllianceAvatarMemberService({enabled:true,origin,url,key:'sb_publishable_synthetic_fixture_only_12345',ledger,removal,processor:{process(){throw Error('No processing');}},storage:{upload(){throw Error('No physical cleanup');}},fetcher:async(endpoint,init)=>{calls.push('auth');assert.equal(endpoint,url+'/auth/v1/user');assert.equal(init.headers.Authorization,'Bearer '+token);return new Response(JSON.stringify({id:actor,is_anonymous:false,email_confirmed_at:'2026-10-17T12:00:00Z'}),{status:authStatus});}});
 const api=createProfileRemovalApi({enabled:true,origin,service});
 const client=createProfileRemovalClient({enabled:true,origin,newOperationId:()=>operation,fetcher:async(endpoint,init)=>{requests++;const response=await api(new Request(endpoint,{...init,headers:{...init.headers,origin,'sec-fetch-site':'same-origin',cookie:'__Host-gf-access='+token}}));if(loseMemberReply){loseMemberReply=false;throw Error('Synthetic discarded committed response');}return response;}});
 return {client,journal,calls,get counts(){return {appends,finishes,requests};},close(){client.dispose();api.close();service.close();removal.close();}};
}
test('actual client -> HTTP adapter -> member Auth facade -> journal coordinator commits in journal-first order',async()=>{
 const f=fixture();try{assert.deepEqual(await f.client.confirm({version:7,confirm:'remove_my_profile'}),{state:'committed',version:8});assert.deepEqual(f.calls,['auth','prepare','append','finish']);assert.deepEqual(f.counts,{appends:1,finishes:1,requests:1});assert.equal(f.journal.rows[0].event.kind,'profile_remove_requested');assert.equal(f.journal.rows[0].event.profileId,profile);assert.equal(Object.hasOwn(f.journal.rows[0].event,'actorId'),false);}finally{f.close();}
});
test('discarded committed member response reconciles the identical operation without another append or finish',async()=>{
 const f=fixture({loseMemberReply:true});try{assert.equal((await f.client.confirm({version:7,confirm:'remove_my_profile'})).state,'unknown');assert.deepEqual(f.client.pendingOperation(),{operationId:operation,version:7});assert.deepEqual(f.counts,{appends:1,finishes:1,requests:1});assert.equal((await f.client.reconcile()).state,'committed');assert.deepEqual(f.counts,{appends:1,finishes:1,requests:2});}finally{f.close();}
});
test('discarded journal acknowledgement leaves unknown, then explicit complete-chain reconciliation finishes once',async()=>{
 const f=fixture({loseJournalReply:true});try{assert.equal((await f.client.confirm({version:7,confirm:'remove_my_profile'})).state,'unknown');assert.deepEqual(f.counts,{appends:1,finishes:0,requests:1});assert.equal((await f.client.reconcile()).state,'committed');assert.deepEqual(f.counts,{appends:1,finishes:1,requests:2});}finally{f.close();}
});
test('actual facade refuses an unverified account before preparation or journal work',async()=>{
 const f=fixture({authStatus:401});try{assert.equal((await f.client.confirm({version:7,confirm:'remove_my_profile'})).state,'sign_in_required');assert.deepEqual(f.calls,['auth']);assert.deepEqual(f.counts,{appends:0,finishes:0,requests:1});}finally{f.close();}
});
