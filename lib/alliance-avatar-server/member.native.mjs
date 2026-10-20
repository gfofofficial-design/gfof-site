// Called only from the already identity-checked disposable TLS runner.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAllianceAvatarMemberService} from './member.mjs';
import {createAllianceAvatarStorage} from '../alliance-avatar-storage.mjs';
import {createAllianceProfileApi} from '../alliance-profile-api.mjs';
import {journalFixture} from './deletion-journal.fixture.mjs';
export async function memberNative({admin,ledger,actor,png}){
  const session='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',foreign='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  // Only the fixture's simplified Auth schema is extended to model documented
  // columns. No claim is made that this substitutes for hosted Auth acceptance.
  admin(`alter table auth.users add column email_confirmed_at timestamptz default clock_timestamp(),add column is_anonymous boolean default false,add column deleted_at timestamptz,add column banned_until timestamptz;
    create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
    insert into auth.sessions values('${session}','${actor}',null);
    begin;${readFileSync(new URL('../../sql/alliance-avatar-session-candidate.sql',import.meta.url),'utf8')}commit;`);
  const context=await ledger.authorizeSession(actor,session);assert.equal(context.actorId,actor);assert.equal(context.sessionId,session);assert.match(context.profileId,/^[a-f0-9-]{36}$/);
  console.log('PASS session extension authorizes a current confirmed account and its own live profile through real TLS');
  assert.deepEqual(await ledger.authorizeAccountSession(actor,session),{actorId:actor,sessionId:session});
  const newcomer='abababab-abab-4bab-8bab-abababababab';
  admin(`insert into auth.users(id) values('${newcomer}');insert into auth.sessions values('${newcomer}','${newcomer}',null);`);
  assert.deepEqual(await ledger.authorizeAccountSession(newcomer,newcomer),{actorId:newcomer,sessionId:newcomer});
  await assert.rejects(ledger.authorizeSession(newcomer,newcomer),e=>e.outcome==='rejected');
  admin(`delete from auth.sessions where id='${newcomer}';`);
  await assert.rejects(ledger.authorizeAccountSession(newcomer,newcomer),e=>e.outcome==='rejected');
  admin(`delete from auth.users where id='${newcomer}';`);
  console.log('PASS account authorization needs no profile and refuses a removed session through real SQL');
  await assert.rejects(ledger.mine(actor),e=>e.outcome==='rejected');
  await assert.rejects(ledger.reserve(actor,foreign,4),e=>e.outcome==='rejected');
  console.log('PASS execution role cannot bypass session wrappers using actor-only read or mutation functions');
  await assert.rejects(ledger.authorizeSession(foreign,session),e=>e.outcome==='rejected');
  await assert.rejects(ledger.authorizeSession(actor,foreign),e=>e.outcome==='rejected');
  await assert.rejects(ledger.authorizeAccountSession(foreign,session),e=>e.outcome==='rejected');
  await assert.rejects(ledger.authorizeAccountSession(actor,foreign),e=>e.outcome==='rejected');
  console.log('PASS foreign-account and nonexistent session IDs are rejected before processing');
  for(const [change,undo] of [
    ["update auth.sessions set not_after=clock_timestamp()-interval '1 second'","update auth.sessions set not_after=null"],
    ["update auth.users set is_anonymous=true","update auth.users set is_anonymous=false"],
    ["update auth.users set email_confirmed_at=null","update auth.users set email_confirmed_at=clock_timestamp()"],
    ["update auth.users set deleted_at=clock_timestamp()","update auth.users set deleted_at=null"],
    ["update auth.users set banned_until=clock_timestamp()+interval '1 hour'","update auth.users set banned_until=null"]
  ]){admin(change);await assert.rejects(ledger.authorizeSession(actor,session),e=>e.outcome==='rejected');await assert.rejects(ledger.authorizeAccountSession(actor,session),e=>e.outcome==='rejected');admin(undo);}
  console.log('PASS expired session and anonymous/unconfirmed/deleted/banned account are refused by actual SQL');
  admin("update public.alliance_profiles set moderation_state='held'");
  await ledger.authorizeSession(actor,session);
  await assert.rejects(ledger.reserveSession(actor,session,foreign,4),e=>e.outcome==='rejected');
  admin("update public.alliance_profiles set moderation_state='visible'");
  console.log('PASS held profile cannot reserve new image work while its owner retains self-state access');
  const origin='https://deploy-preview-124--gfof.netlify.app',url='https://abcdefghijklmnopqrst.supabase.co',key='sb_publishable_synthetic_fixture_only_12345';
  const token='syntheticHeader.'+Buffer.from(JSON.stringify({sub:actor,session_id:session,iss:url+'/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+120})).toString('base64url')+'.syntheticSignature';
  const request=method=>new Request(origin+'/api/alliance-members/me/image',{method,headers:{Origin:origin,'Sec-Fetch-Site':'same-origin',Cookie:'__Host-gf-access='+token}});
  const operation='dddddddd-dddd-4ddd-8ddd-dddddddddddd';let calls=0;
  const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
  const signed=journalFixture({events:[]});let revokeRead=false,profileLoads=0;
  const profileApi=createAllianceProfileApi({enabled:true,origin,url,key,ledger,journal:signed.client,serving:{authorize:()=>true},fetcher:async endpoint=>{
    if(endpoint.endsWith('/auth/v1/user'))return json({id:actor,is_anonymous:false,email_confirmed_at:'2026-10-17T12:00:00Z'});
    profileLoads++;if(revokeRead)admin(`delete from auth.sessions where id='${session}';`);
    return json({id:context.profileId,name:'Synthetic member',community:'',bio:'Disposable profile response.',role:'builder',listed:false,publication:'private',updatedAt:'2026-10-17T16:00:00Z'});
  }});
  const profileRequest=()=>new Request(origin+'/api/alliance-members/me',{headers:{Cookie:'__Host-gf-access='+token,'Sec-Fetch-Site':'same-origin'}});
  assert.equal((await profileApi(profileRequest())).status,200);
  revokeRead=true;const revokedRead=await profileApi(profileRequest());assert.equal(revokedRead.status,503);assert.doesNotMatch(await revokedRead.text(),/Synthetic member|Disposable profile/);
  assert.equal((await profileApi(profileRequest())).status,503);assert.equal(profileLoads,2);
  profileApi.close();signed.client.close();admin(`insert into auth.sessions values('${session}','${actor}',null);`);
  console.log('PASS composed profile API with real TLS session ledger withholds a read revoked during loading and refuses the next load');
  const storage=createAllianceAvatarStorage({enabled:true,origin:url,apiKey:key,bearerToken:'syntheticHeader.syntheticClaims.syntheticSignature',fetcher:async(endpoint,init)=>{
    calls++;
    if(init.method==='POST'){
      // Simulates logout after the writer dispatched, before publication.
      admin(`delete from auth.sessions where id='${session}';`);
      return json({Key:'alliance-member-images-v1/'+new URL(endpoint).pathname.split('/alliance-member-images-v1/')[1],Id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'});
    }
    return new Response(png,{headers:{'Content-Type':'image/png'}});
  }});
  // Earlier core tests intentionally left two exact settled cleanup receipts.
  // Delete only those fixture objects via matching in-memory gateway evidence.
  for(const row of await ledger.cleanupBatch(20)){
    const cleanupStorage=createAllianceAvatarStorage({enabled:true,origin:url,apiKey:key,bearerToken:'syntheticHeader.syntheticClaims.syntheticSignature',fetcher:async(_url,init)=>init.method==='DELETE'?json([{id:row.receipt.providerId,name:row.key}]):json({code:'NoSuchKey'},404)});
    await ledger.ackDeleted(row.objectId,await cleanupStorage.remove(row.receipt,{writeSettled:true,authorize:async()=>true}));
  }
  // Legacy session fixture supplies its reservation seam explicitly. The separate
  // creation fixture exercises the full admission-backed path and revoked bypass.
  const service=createAllianceAvatarMemberService({enabled:true,origin,url,key,ledger,creation:{reserve:(ctx,op,v,opts)=>ledger.reserveSession(ctx.actorId,ctx.sessionId,op,v,opts)},processor:{process:async()=>({bytes:png,mime:'image/png',width:1,height:1})},storage,fetcher:async()=>json({id:actor,is_anonymous:false,email_confirmed_at:'2026-10-17T12:00:00Z'})});
  assert.deepEqual(await service.handle(request('PUT'),{operationId:operation,version:4,bytes:png,mime:'image/png'}),{state:'cleanup_pending'});
  assert.equal(calls,2);
  console.log('PASS complete member facade with real SQL denies publication after logout during delivery and records known receipt');
  assert.deepEqual(await service.handle(request('GET'),{operationId:operation}),{state:'sign_in_required'});assert.equal(calls,2);
  console.log('PASS revoked session cannot read status or trigger another provider call even when synthetic Auth still accepts its token');
  admin(`insert into auth.sessions values('${session}','${actor}',null);`);
  const evidence=await ledger.operationReceiptSession(actor,session,operation);assert.equal(evidence.state,'stale');assert.equal(evidence.writeSettled,true);assert.equal(evidence.verified,true);
  assert.equal((await ledger.mineSession(actor,session)).version,4);assert.equal((await ledger.mineSession(actor,session)).objectId,null);
  console.log('PASS fresh live session recovers settled unpublished evidence without resurrecting the image or uploading again');
  admin("update public.alliance_profiles set moderation_state='held'");
  assert.deepEqual(await service.handle(request('DELETE'),{operationId:foreign,version:4,confirm:'remove_my_image'}),{state:'unavailable'});assert.equal(calls,2);
  // Legacy setup only, before the later removal extension revokes this entry.
  // Preserve the earlier fixture's version; no member-service bypass is enabled.
  await ledger.removeImageSession(actor,session,foreign,4);
  service.close();
  console.log('PASS member removal stays closed without its journal coordinator; legacy fixture-only version setup makes no Storage request');
  const rights=admin("select has_column_privilege('alliance_avatar_executor','auth.sessions','id','SELECT'),has_column_privilege('alliance_avatar_executor','auth.users','id','SELECT'),has_function_privilege('authenticated','alliance_avatar.authorize_session(uuid,uuid)','EXECUTE'),has_function_privilege('alliance_avatar_executor','alliance_avatar.require_session(uuid,uuid)','EXECUTE');");
  assert.match(rights,/f\s*\|\s*f\s*\|\s*f\s*\|\s*f/);
  const accountRights=admin("select has_function_privilege('anon','alliance_avatar.authorize_account_session(uuid,uuid)','EXECUTE'),has_function_privilege('authenticated','alliance_avatar.authorize_account_session(uuid,uuid)','EXECUTE'),has_function_privilege('service_role','alliance_avatar.authorize_account_session(uuid,uuid)','EXECUTE'),has_function_privilege('alliance_avatar_executor','alliance_avatar.require_account_session(uuid,uuid)','EXECUTE');");
  assert.match(accountRights,/f\s*\|\s*f\s*\|\s*f\s*\|\s*f/);
  console.log('PASS execution/member roles cannot directly read Auth rows or call the private session helper');
}
