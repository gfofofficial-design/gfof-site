// Guarded disposable member database only; journal transport is synthetic here.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createAllianceRemoval,removalEvents} from './removal.mjs';
import {createAllianceAvatarMemberService} from './member.mjs';
import {memoryRemovalJournal} from './removal.fixture.mjs';
import {projectRef,epoch,zero} from './deletion-journal.fixture.mjs';
export async function removalNative({admin,ledger,png}){
  const actor='12121212-1212-4212-8212-121212121212',session='13131313-1313-4313-8313-131313131313',profile='14141414-1414-4414-8414-141414141414';
  const upload='15151515-1515-4515-8515-151515151515',pending='16161616-1616-4616-8616-161616161616',removed='17171717-1717-4717-8717-171717171717',removeProfile='18181818-1818-4818-8818-181818181818',oldObject='19191919-1919-4919-8919-191919191919';
  admin(`update alliance_avatar.control set enabled=true,cleanup_enabled=false;insert into auth.users(id) values('${actor}');insert into auth.sessions values('${session}','${actor}',null);insert into public.alliance_member_owners values('${profile}','${actor}');insert into public.alliance_profiles(id,display_name,bio,contribution_role) values('${profile}','Removal fixture','A synthetic removal integration fixture.','builder');`);
  const descriptor={bytes:png.length,width:1,height:1,mime:'image/png',sha256:createHash('sha256').update(png).digest('hex')};
  await ledger.reserveSession(actor,session,upload,0);const claim=await ledger.claimUploadSession(actor,session,upload,descriptor);
  const proof={state:'stored',writeSettled:true,verified:true,receipt:{...descriptor,profileId:profile,objectId:claim.objectId,key:claim.key,providerId:'20212121-2121-4121-8121-212121212121'}};
  await ledger.commitUploadSession(actor,session,upload,proof);
  await ledger.reserveSession(actor,session,pending,1);const inFlight=await ledger.claimUploadSession(actor,session,pending,descriptor);
  admin(`insert into alliance_avatar.objects(id,profile_id,state,deleted_at) values('${oldObject}','${profile}','deleted',clock_timestamp());begin;${readFileSync(new URL('../../sql/alliance-avatar-removal-candidate.sql',import.meta.url),'utf8')}commit;`);
  await assert.rejects(ledger.removeImageSession(actor,session,removed,1),e=>e.outcome==='rejected');
  const rights=admin("select has_table_privilege('authenticated','public.alliance_profiles','DELETE'),has_table_privilege('authenticated','public.alliance_member_owners','DELETE'),has_function_privilege('authenticated','public.alliance_remove_profile()','EXECUTE'),has_function_privilege('service_role','alliance_avatar.finish_removal_session(uuid,uuid,uuid,jsonb,jsonb)','EXECUTE');");assert.match(rights,/f\s*\|\s*f\s*\|\s*f\s*\|\s*f/);
  console.log('PASS removal extension revokes legacy image/profile bypasses; no new login, direct table or member/service finish permission');
  const prepared=await ledger.prepareRemovalSession(actor,session,removed,1,'image');assert.equal(prepared.state,'prepared');assert.deepEqual(prepared.plan.objectIds,[claim.objectId,inFlight.objectId,oldObject].sort());
  assert.deepEqual(await ledger.prepareRemovalSession(actor,session,removed,1,'image'),prepared);
  assert.match(admin(`select removals from alliance_avatar.daily where actor_id='${actor}';`),/\b1\b/);
  await assert.rejects(ledger.reserveSession(actor,session,removeProfile,1),e=>e.outcome==='rejected');
  await assert.rejects(ledger.commitUploadSession(actor,session,pending,{...proof,receipt:{...proof.receipt,objectId:inFlight.objectId,key:inFlight.key,providerId:removeProfile}}),e=>e.outcome==='rejected');
  await assert.rejects(ledger.mineSession(actor,session),e=>e.outcome==='rejected');
  console.log('PASS durable plan captures retained deleted/current/inflight identities, spends once and fences new reserve/publication/private reads');
  const race=await Promise.allSettled([ledger.prepareRemovalSession(actor,session,removed,1,'image'),ledger.prepareRemovalSession(actor,session,removeProfile,1,'profile')]);
  assert.equal(race[0].status,'fulfilled');assert.equal(race[1].status,'rejected');assert.equal(race[1].reason.outcome,'rejected');
  assert.match(admin(`select removals from alliance_avatar.daily where actor_id='${actor}';`),/\b1\b/);
  console.log('PASS competing removal intent cannot replace the staged plan or spend another quota; exact repeated plan remains stable');
  const wrong=removalEvents(prepared.plan).map((e,i)=>({id:i===0?removeProfile:e.id,sequence:i+1,sha256:'a'.repeat(64)}));
  await assert.rejects(ledger.finishRemovalSession(actor,session,removed,prepared.plan,{records:wrong}),e=>e.outcome==='rejected');
  await assert.rejects(ledger.prepareRemovalSession(actor,removeProfile,removed,1,'image'),e=>e.outcome==='rejected');
  assert.match(admin(`select object_id from alliance_avatar.heads where profile_id='${profile}';`),new RegExp(claim.objectId));
  console.log('PASS SQL finish refuses substituted journal event identities and foreign session before detaching the current head');
  const journal=memoryRemovalJournal(),append=journal.append.bind(journal);let lostAppend=true,lostFinish=true;
  journal.append=async v=>{const r=await append(v);if(lostAppend){lostAppend=false;throw Error('Synthetic journal acknowledgement lost');}return r;};
  const removal=createAllianceRemoval({enabled:true,projectRef,epoch,minimum:{sequence:0,sha256:zero},ledger:{...ledger,async finishRemovalSession(...args){const r=await ledger.finishRemovalSession(...args);if(lostFinish){lostFinish=false;throw Object.assign(Error('Synthetic committed member acknowledgement lost'),{outcome:'unknown'});}return r;}},journal,serving:{authorize:async()=>true}});
  const input={actorId:actor,sessionId:session,operationId:removed,version:1,kind:'image',expiresAt:Date.now()+120000};
  assert.deepEqual(await removal.run(input),{state:'unknown'});assert.equal(journal.rows.length,1);
  assert.match(admin(`select object_id from alliance_avatar.heads where profile_id='${profile}';`),new RegExp(claim.objectId));
  console.log('PASS synthetic lost journal reply leaves the real member head attached and the same durable plan recoverable');
  assert.deepEqual(await removal.run(input),{state:'unknown'});assert.equal(journal.rows.length,3);
  assert.deepEqual(await removal.run(input),{state:'committed',version:2});assert.equal(journal.rows.length,3);assert.equal((await ledger.mineSession(actor,session)).objectId,null);
  assert.match(admin(`select removals from alliance_avatar.daily where actor_id='${actor}';`),/\b1\b/);
  console.log('PASS real committed finish with synthetic lost caller reply recovers once; retained identities journal once, quotas/version are not repeated');
  // The actual member request verifies its cookie then delegates profile removal;
  // its replay still works after the profile no longer exists.
  const origin='https://deploy-preview-124--gfof.netlify.app',url=`https://${projectRef}.supabase.co`,key='sb_publishable_synthetic_fixture_only_12345';
  const token='syntheticHeader.'+Buffer.from(JSON.stringify({sub:actor,session_id:session,iss:url+'/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+120})).toString('base64url')+'.syntheticSignature';
  const service=createAllianceAvatarMemberService({enabled:true,origin,url,key,ledger,removal,processor:{process(){}},storage:{upload(){}},fetcher:async()=>new Response(JSON.stringify({id:actor,is_anonymous:false,email_confirmed_at:'2026-10-17T12:00:00Z'}),{headers:{'Content-Type':'application/json'}})});
  const request=()=>new Request(origin+'/api/alliance-members/me/profile',{method:'DELETE',headers:{Origin:origin,'Sec-Fetch-Site':'same-origin',Cookie:'__Host-gf-access='+token}}),body={operationId:removeProfile,version:2,confirm:'remove_my_profile'};
  assert.deepEqual(await service.handle(request(),body),{state:'committed',version:3});assert.equal(journal.rows.length,4);assert.equal(journal.rows.at(-1).event.kind,'profile_remove_requested');
  assert.deepEqual(await service.handle(request(),body),{state:'committed',version:3});assert.equal(journal.rows.length,4);
  assert.match(admin(`select count(*) from public.alliance_member_owners where id='${profile}';`),/\b0\b/);
  await assert.rejects(ledger.authorizeSession(actor,session),e=>e.outcome==='rejected');
  console.log('PASS actual Auth-bound member profile removal commits its profile intent first and replays after profile cascade without a second intent');
  service.close();removal.close();
  // A fifth retained identity refuses a new image plan instead of silently
  // omitting history. A single profile intent remains the bounded alternative.
  const profile2='22232323-2323-4323-8323-232323232323';
  admin(`insert into public.alliance_member_owners values('${profile2}','${actor}');insert into public.alliance_profiles(id,display_name,bio,contribution_role) values('${profile2}','History fixture','A synthetic capacity integration fixture.','builder');insert into alliance_avatar.objects(id,profile_id,state,deleted_at) select md5('removal-capacity-'||n)::uuid,'${profile2}','deleted',clock_timestamp() from generate_series(1,5)n;`);
  await assert.rejects(ledger.prepareRemovalSession(actor,session,'24242424-2424-4424-8424-242424242424',0,'image'),e=>e.outcome==='rejected');
  assert.match(admin(`select count(*) from alliance_avatar.operations where profile_id='${profile2}' and removal_manifest is not null;`),/\b0\b/);
  console.log('PASS finite image-history capacity refuses before staging/spending or discarding old denial subjects');
}
