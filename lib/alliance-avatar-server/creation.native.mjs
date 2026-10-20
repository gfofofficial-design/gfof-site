// Synthetic two-server integration. Called only by the guarded disposable runner.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAvatarLedger} from './ledger.mjs';
import {createDeletionJournalStore} from './journal-store.mjs';
import {createAllianceCreation,creationEvent} from './creation.mjs';
import {createAllianceRemoval} from './removal.mjs';
import {createAllianceAvatarMemberService} from './member.mjs';
import {createAllianceAvatarStorage} from '../alliance-avatar-storage.mjs';
import {secondCreationFixture} from './creation-second-fixture.mjs';
import {recoveryPairNative} from './recovery-pair.native.mjs';
import {authDeletionGuardNative} from './auth-deletion-guard.native.mjs';
import {createAllianceProfileApi} from '../alliance-profile-api.mjs';
import {createMemberProfileClient} from '../../assets/federation/fed-alliance-member-client.mjs';
import {journalFixture} from './deletion-journal.fixture.mjs';
const sql=name=>readFileSync(new URL('../../sql/'+name,import.meta.url),'utf8');
export async function creationNative({admin,bootstrap,avatar,connection,openPool,secondOptions}){
  const second=await secondCreationFixture(secondOptions),ja=second.admin;
  const actor='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222',foreign='33333333-3333-4333-8333-333333333333';
  const ref='abcdefghijklmnopqrst',epoch='44444444-4444-4444-8444-444444444444',zero='0'.repeat(64);
  const ctx={actorId:actor,sessionId:session,expiresAt:Date.now()+120000},serving={authorize:()=>true};
  const data={name:'Creation Fixture',community:'',bio:'Synthetic profile for two separate database servers.',role:'builder',listed:false};
  const origin='https://deploy-preview-124--gfof.netlify.app',url='https://abcdefghijklmnopqrst.supabase.co',key='sb_publishable_synthetic_creation_fixture_only';
  let ledger,journal;const coordinators=[];
  const profileFixtures=[];
  const make=(l=ledger,j=journal)=>{const c=createAllianceCreation({enabled:true,ledger:l,journal:j,serving});coordinators.push(c);return c;};
  // Explicit synthetic owner review after the test has received a successful
  // response. Never called for a lost acknowledgement or from member code.
  const reviewKnownProfile=async(context,input,received)=>{
    const status=await ledger.profileWriteStatusSession(context.actorId,context.sessionId);assert.equal(status.pending,true);
    const literal=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
    const digest=v=>{const out=admin(`select 'GF_FENCE_SHA:'||encode(sha256(convert_to(${literal(v)}::text,'UTF8')),'hex');`);return out.split('\n').map(s=>s.trim()).find(s=>s.startsWith('GF_FENCE_SHA:')).slice('GF_FENCE_SHA:'.length);};
    assert.equal(status.inputSha256,digest(input));assert.equal(status.resultSha256,digest(received));
    const call=(seq=status.sequence,hash=status.resultSha256)=>`alliance_avatar.review_profile_write('${context.actorId}',${seq},'${status.inputSha256}','${hash}')`;
    admin(`begin;set local role alliance_avatar_owner;do $$ begin begin perform ${call()};raise exception 'Expected open-store review refusal';exception when insufficient_privilege then null;end;end $$;rollback;`);
    admin(`begin;update alliance_avatar.control set enabled=false,creation_enabled=false,cleanup_enabled=false;set local role alliance_avatar_owner;
      do $$ begin begin perform ${call(status.sequence-1)};raise exception 'Expected stale receipt refusal';exception when insufficient_privilege then null;end;
      begin perform ${call(status.sequence,(status.resultSha256[0]==='0'?'1':'0')+status.resultSha256.slice(1))};raise exception 'Expected changed receipt refusal';exception when insufficient_privilege then null;end;
      begin update public.alliance_profiles set bio='Synthetic changed profile receipt.' where id='${status.profileId}';perform ${call()};raise exception 'Expected changed profile refusal';exception when insufficient_privilege then null;end;end $$;
      select ${call()};reset role;update alliance_avatar.control set enabled=true,creation_enabled=true;commit;`);
    assert.equal((await ledger.profileWriteStatusSession(context.actorId,context.sessionId)).pending,false);
    return status;
  };
  // Synthetic Auth/HTTP bridge; only fixed SQL reads run as the modeled member
  // role. Creation/session/admission use real restricted-driver TLS connections.
  const profileTransport=(context,creation=make())=>{
    const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    assert.match(context.actorId,UUID);assert.match(context.sessionId,UUID);
    const token='syntheticHeader.'+Buffer.from(JSON.stringify({sub:context.actorId,session_id:context.sessionId,iss:url+'/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(context.expiresAt/1000)})).toString('base64url')+'.syntheticSignature';
    const signed=journalFixture({events:[]}),states=[];let loads=0,requests=0;
    const asMember=expression=>{
      const output=admin(`begin read only;set local statement_timeout='2000ms';set local role authenticated;
        select set_config('request.jwt.claim.sub','${context.actorId}',true),set_config('request.jwt.claim.is_anonymous','false',true);
        select 'GF_PROFILE_FLOW_RESULT:'||coalesce((${expression}),'null'::jsonb)::text as result;rollback;`);
      const matches=output.split('\n').map(s=>s.trim()).filter(s=>s.startsWith('GF_PROFILE_FLOW_RESULT:'));
      assert.equal(matches.length,1);return JSON.parse(matches[0].slice('GF_PROFILE_FLOW_RESULT:'.length));
    };
    const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
    const api=createAllianceProfileApi({enabled:true,origin,url,key,ledger,creation,journal:signed.client,serving,fetcher:async(endpoint,init)=>{
      assert.equal(init.headers.Authorization,'Bearer '+token);const target=new URL(endpoint);
      if(target.pathname==='/auth/v1/user')return json({id:context.actorId,is_anonymous:false,email_confirmed_at:'2026-10-17T12:00:00Z'});
      loads++;
      if(target.pathname==='/rest/v1/rpc/alliance_my_profile')return json(asMember('select public.alliance_my_profile()'));
      assert.equal(target.pathname,'/rest/v1/alliance_profiles');
      const limit=target.searchParams.get('limit'),after=target.searchParams.get('id');assert.match(limit,/^(?:[1-9]|1[0-9]|2[01])$/);
      assert.ok(after===null||after.startsWith('gt.')&&UUID.test(after.slice(3)));
      return json(asMember(`select coalesce(jsonb_agg(p),'[]'::jsonb) from (select id,display_name,community,bio,contribution_role from public.alliance_profiles where listed and moderation_state='visible' ${after?`and id>'${after.slice(3)}'::uuid`:''} order by id limit ${Number(limit)})p`));
    }});
    const dispatch=(path='/me',init={})=>{requests++;return api(new Request(origin+'/api/alliance-members'+path,{...init,headers:{Cookie:'__Host-gf-access='+token,'Sec-Fetch-Site':'same-origin',...(init.method==='POST'?{Origin:origin,'Content-Type':'application/json'}:{}),...init.headers}}));};
    const client=createMemberProfileClient({enabled:true,origin,onState:s=>states.push(s),fetcher:(endpoint,init)=>dispatch(new URL(endpoint).pathname.replace('/api/alliance-members','')+new URL(endpoint).search,init)});
    const fixture={client,dispatch,states,get loads(){return loads;},get requests(){return requests;},visibleProfile(id){assert.match(id,UUID);return asMember(`select to_jsonb(p) from public.alliance_profiles p where id='${id}'::uuid`);},close(){api.close();client.dispose();signed.client.close();}};
    profileFixtures.push(fixture);return fixture;
  };
  try{
    admin(bootstrap+'\n'+avatar+`\nalter table auth.users add column email_confirmed_at timestamptz default clock_timestamp(),add column is_anonymous boolean default false,add column deleted_at timestamptz,add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);\n`+
      sql('alliance-avatar-session-candidate.sql')+'\n'+sql('alliance-avatar-cleanup-candidate.sql')+'\n'+sql('alliance-avatar-recovery-candidate.sql')+'\n'+sql('alliance-avatar-removal-candidate.sql')+'\n'+sql('alliance-creation-admission-candidate.sql')+'\n'+sql('alliance-profile-write-fence-candidate.sql')+`\nalter role alliance_avatar_executor login password '${connection.password}';insert into auth.users(id) values('${actor}');insert into auth.sessions values('${session}','${actor}',null);commit;`);
    ja("begin;create role anon nologin;create role authenticated nologin;create role service_role nologin;"+sql('alliance-deletion-journal-store-candidate.sql')+'\n'+sql('alliance-journal-admission-candidate.sql')+`\nupdate alliance_journal.control set project_ref='${ref}',epoch='${epoch}',enabled=true;alter role alliance_journal_executor login password '${second.connection.password}';commit;`);
    ledger=await createAvatarLedger({enabled:true,connection,openPool});journal=await createDeletionJournalStore({enabled:true,projectRef:ref,epoch,connection:second.connection,openPool:second.openPool});
    await assert.rejects(ledger.prepareProfileSession(actor,session),e=>e.outcome==='rejected');
    assert.match(admin('select count(*) from alliance_avatar.creation_plans;'),/\n\s*0\s*\n/);
    console.log('PASS two independent TLS servers start closed with no profile/object/preparation, no hosted inputs');
    admin('update alliance_avatar.control set enabled=true,creation_enabled=true;');
    const preparedRace=await Promise.all([ledger.prepareProfileSession(actor,session),ledger.prepareProfileSession(actor,session)]),prepared=preparedRace[0];assert.deepEqual(preparedRace[1],prepared);assert.deepEqual(await ledger.prepareProfileSession(actor,session),prepared);
    assert.match(admin('select count(*) from public.alliance_profiles;'),/\n\s*0\s*\n/);
    await assert.rejects(make().profile(ctx,data),e=>e.outcome==='unknown');assert.deepEqual(await make().inspect(ctx,'profile'),{state:'missing'});
    assert.match(admin('select count(*) from public.alliance_member_owners;'),/\n\s*0\s*\n/);
    console.log('PASS concurrent durable profile preparation is replay-stable; paused remote admission cannot create a profile or owner');
    ja('update alliance_journal.control set admission_enabled=true;');
    const checkedJournal={admission:journal.admission,admit:async(event,opts)=>{
      assert.match(admin("select count(*) from pg_stat_activity where usename='alliance_avatar_executor' and state='idle in transaction';"),/\n\s*0\s*\n/);
      if(event.objectId)assert.match(admin(`select count(*) from alliance_avatar.objects where id='${event.objectId}';`),/\n\s*0\s*\n/);
      const proof=await journal.admit(event,opts);assert.deepEqual(await journal.admission(event),proof);return proof;
    }};
    const ownTransport=profileTransport(ctx,make(ledger,checkedJournal));assert.deepEqual(await ownTransport.client.load(),{profile:null,writeState:'available'});
    const {profile}=await ownTransport.client.save(data);assert.equal(profile.id,prepared.profileId);
    assert.equal((await ownTransport.client.load()).profile.id,profile.id);
    await reviewKnownProfile(ctx,data,profile);
    console.log('PASS composed browser client and profile API create the first profile through real session/preparation/admission/commit and read it through member RLS');
    const updated=await make().profile(ctx,{...data,name:'Updated Fixture'});assert.equal(updated.id,profile.id);await reviewKnownProfile(ctx,{...data,name:'Updated Fixture'},updated);
    const racingInput={...data,name:'Concurrent Fence Fixture'},race=await Promise.allSettled([ledger.finishProfileSession(actor,session,prepared,racingInput,creationEvent(prepared)),ledger.finishProfileSession(actor,session,prepared,racingInput,creationEvent(prepared))]);
    assert.equal(race.filter(x=>x.status==='fulfilled').length,1);assert.equal(race.filter(x=>x.status==='rejected'&&x.reason.outcome==='rejected').length,1);
    await reviewKnownProfile(ctx,racingInput,race.find(x=>x.status==='fulfilled').value);
    console.log('PASS concurrent profile finishes commit one exact durable receipt; open-store, stale and changed owner-review proofs cannot clear it');
    assert.match(ja('select count(*) from alliance_journal.admissions;'),/\n\s*1\s*\n/);
    console.log('PASS profile creation/update uses its one committed independent reservation with no cross-server transaction held');
    admin(`update public.alliance_profiles set moderation_state='held' where id='${profile.id}';`);
    const held=await make().profile(ctx,{...data,name:'Held Fixture'});assert.equal(held.publication,'held');await reviewKnownProfile(ctx,{...data,name:'Held Fixture'},held);admin(`update public.alliance_profiles set moderation_state='visible' where id='${profile.id}';`);
    assert.match(admin("select has_column_privilege('alliance_avatar_owner','public.alliance_profiles','moderation_state','UPDATE');"),/\n\s*f\s*\n/);
    console.log('PASS profile edits preserve held moderation while creation owner cannot directly change moderation state');
    const rights=admin("select has_column_privilege('authenticated','public.alliance_member_owners','user_id','INSERT'),has_column_privilege('authenticated','public.alliance_profiles','display_name','INSERT'),has_column_privilege('authenticated','public.alliance_profiles','bio','UPDATE'),has_function_privilege('authenticated','public.alliance_save_profile(text,text,text,text,boolean)','EXECUTE'),has_function_privilege('alliance_avatar_executor','alliance_avatar.reserve_session(uuid,uuid,uuid,bigint)','EXECUTE'),has_table_privilege('alliance_avatar_executor','alliance_avatar.creation_plans','SELECT');");assert.match(rights,/f\s*\|\s*f\s*\|\s*f\s*\|\s*f\s*\|\s*f\s*\|\s*f/);
    await assert.rejects(ledger.reserveSession(actor,session,foreign,0),e=>e.outcome==='rejected');await assert.rejects(ledger.prepareProfileSession(actor,foreign),e=>e.outcome==='rejected');
    await assert.rejects(ledger.finishProfileSession(actor,session,prepared,data,{...creationEvent(prepared),id:foreign}),e=>e.outcome==='rejected');
    console.log('PASS legacy/direct creation bypass, foreign session and mismatched admission proof are denied by actual SQL');
    admin(`begin;set local role alliance_avatar_executor;set local synchronous_commit='off';do $$ begin perform alliance_avatar.prepare_profile_session('${actor}','${session}');raise exception 'Expected durable preparation refusal';exception when insufficient_privilege then null;end $$;rollback;`);
    console.log('PASS asynchronous preparation cannot weaken the durable prospective identity needed for later recovery');
    const otherActor='b1111111-1111-4111-8111-111111111111',oldSession='c1111111-1111-4111-8111-111111111111',newSession='d1111111-1111-4111-8111-111111111111';
    admin(`insert into auth.users(id) values('${otherActor}');insert into auth.sessions values('${oldSession}','${otherActor}',null);`);
    const oldCtx={actorId:otherActor,sessionId:oldSession,expiresAt:ctx.expiresAt};
    await assert.rejects(make(ledger,{...journal,admit:async(...args)=>{const proof=await journal.admit(...args);admin(`delete from auth.sessions where id='${oldSession}';`);return proof;}}).profile(oldCtx,data),e=>e.outcome==='unknown');
    assert.match(admin(`select count(*) from public.alliance_member_owners where user_id='${otherActor}';`),/\n\s*0\s*\n/);
    admin(`insert into auth.sessions values('${newSession}','${otherActor}',null);`);const newCtx={...oldCtx,sessionId:newSession};
    const recoveredPlan=await make().inspect(newCtx,'profile');assert.equal(recoveredPlan.state,'admitted');const recoveredProfile=await make().profile(newCtx,data);assert.equal(recoveredProfile.id,recoveredPlan.plan.profileId);await reviewKnownProfile(newCtx,data,recoveredProfile);
    console.log('PASS logout after independent admission blocks member creation; a new verified session recovers the same prepared identity');
    const otherTransport=profileTransport(newCtx),otherProfile=(await otherTransport.client.load()).profile;
    assert.notEqual(otherProfile.id,profile.id);assert.equal(ownTransport.visibleProfile(otherProfile.id),null);assert.equal(otherTransport.visibleProfile(profile.id),null);
    assert.deepEqual(await otherTransport.client.directory(),{items:[],next:null});
    assert.equal((await ownTransport.client.load()).writeState,'available');
    const edited={...data,name:'Account A edited',listed:true};const editedProfile=(await ownTransport.client.save(edited)).profile;await reviewKnownProfile(ctx,edited,editedProfile);
    assert.equal((await otherTransport.client.load()).profile.name,data.name);
    const directory=await otherTransport.client.directory();assert.deepEqual(directory.items.map(p=>p.id),[profile.id]);assert.equal(directory.items[0].name,edited.name);
    assert.equal(JSON.stringify(directory).includes(otherProfile.id),false);
    const rejected=await otherTransport.dispatch('/me',{method:'POST',body:JSON.stringify({...data,id:profile.id,user_id:actor})});assert.equal(rejected.status,400);
    assert.equal((await otherTransport.dispatch('/me?user_id='+actor)).status,400);assert.equal((await ownTransport.client.load()).profile.name,edited.name);
    const mismatched=profileTransport({...ctx,sessionId:newSession});assert.equal((await mismatched.dispatch()).status,503);assert.equal(mismatched.loads,0);
    console.log('PASS two composed member clients retain separate private profiles, expose only listed directory fields and reject forged owner/profile IDs or another account session');
    let dispatchedSaves=0;const committed=make(),lost=profileTransport(ctx,{profile:async(...args)=>{dispatchedSaves++;await committed.profile(...args);throw Object.assign(Error('Synthetic lost committed profile reply'),{outcome:'unknown'});}});
    const uncertainData={...data,name:'Committed acknowledgement lost'};await assert.rejects(lost.client.save(uncertainData),e=>e.code==='unknown');
    const afterSave=lost.requests;await assert.rejects(lost.client.save(uncertainData),e=>e.code==='unknown');assert.equal(lost.requests,afterSave);
    const directRetry=await lost.dispatch('/me',{method:'POST',body:JSON.stringify(uncertainData)});assert.equal(directRetry.status,503);assert.equal((await directRetry.json()).error.code,'profile_changes_paused');assert.equal(dispatchedSaves,1);
    assert.equal((await lost.client.load()).profile.name,uncertainData.name);assert.equal(lost.states.at(-1).status,'review_required');
    const afterRead=lost.requests;await assert.rejects(lost.client.save(uncertainData),e=>e.code==='unknown');assert.equal(lost.requests,afterRead);assert.equal(dispatchedSaves,1);
    assert.equal((await otherTransport.client.load()).profile.name,data.name);assert.deepEqual(await otherTransport.client.directory(),{items:[],next:null});
    assert.match(ja('select count(*) from alliance_journal.admissions;'),/\n\s*2\s*\n/);
    console.log('PASS a committed SQL profile save with lost acknowledgement leaves browser writes paused after readback, with one dispatch and no duplicate admission');
    const durableBefore=await ledger.profileWriteStatusSession(actor,session);assert.equal(durableBefore.pending,true);
    for(const fixture of profileFixtures)fixture.close();await ledger.close();ledger=await createAvatarLedger({enabled:true,connection,openPool});
    assert.deepEqual(await ledger.profileWriteStatusSession(actor,session),durableBefore);
    const restarted=profileTransport(ctx);const refused=await restarted.dispatch('/me',{method:'POST',body:JSON.stringify({...data,name:'Must never overwrite uncertain save'})});assert.equal(refused.status,503);
    assert.equal((await refused.json()).error.code,'profile_changes_paused');
    await assert.rejects(ledger.finishProfileSession(actor,session,prepared,data,creationEvent(prepared)),e=>e.outcome==='rejected');
    assert.equal((await restarted.client.load()).profile.name,uncertainData.name);assert.equal(restarted.states.at(-1).status,'review_pending');const beforeBlockedSave=restarted.requests;await assert.rejects(restarted.client.save(uncertainData),{code:'review_pending'});assert.equal(restarted.requests,beforeBlockedSave);assert.deepEqual(await ledger.profileWriteStatusSession(actor,session),durableBefore);
    const fenceRights=admin("select has_function_privilege('alliance_avatar_executor','alliance_avatar.finish_profile_unfenced(uuid,uuid,jsonb,jsonb,jsonb)','EXECUTE'),has_function_privilege('alliance_avatar_executor','alliance_avatar.review_profile_write(uuid,bigint,text,text)','EXECUTE'),has_function_privilege('authenticated','alliance_avatar.profile_write_status_session(uuid,uuid)','EXECUTE');");assert.match(fenceRights,/f\s*\|\s*f\s*\|\s*f/);
    await assert.rejects(ledger.profileWriteStatusSession(otherActor,session),e=>e.outcome==='rejected');
    console.log('PASS durable committed profile receipt survives fresh driver/API/service instances and refuses another save without owner review; executor cannot clear or bypass it');
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWMQjG34DwADXwHuQa7szAAAAABJRU5ErkJggg==','base64');
    let providerCalls=0;
    const storage=createAllianceAvatarStorage({enabled:true,origin:url,apiKey:key,bearerToken:'syntheticHeader.syntheticClaims.syntheticSignature',fetcher:async(endpoint,init)=>{providerCalls++;if(init.method==='POST')return new Response(JSON.stringify({Key:'alliance-member-images-v1/'+decodeURIComponent(new URL(endpoint).pathname.split('/alliance-member-images-v1/')[1]),Id:foreign}),{headers:{'Content-Type':'application/json'}});return new Response(png,{headers:{'Content-Type':'image/png'}});}});
    const token='syntheticHeader.'+Buffer.from(JSON.stringify({sub:actor,session_id:session,iss:url+'/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(ctx.expiresAt/1000)})).toString('base64url')+'.syntheticSignature';
    const op='51111111-1111-4111-8111-111111111111';
    const service=createAllianceAvatarMemberService({enabled:true,origin,url,key,ledger,creation:make(ledger,checkedJournal),storage,processor:{process:async()=>({bytes:png,mime:'image/png',width:1,height:1})},fetcher:async()=>new Response(JSON.stringify({id:actor,is_anonymous:false,email_confirmed_at:'2026-10-17T12:00:00Z'}))});
    const response=await service.handle(new Request(origin+'/api/alliance-members/me/image',{method:'PUT',headers:{Origin:origin,Cookie:'__Host-gf-access='+token,'Sec-Fetch-Site':'same-origin'}}),{operationId:op,version:0,bytes:png,mime:'image/png'});service.close();assert.deepEqual(response,{state:'committed',version:1});assert.equal(providerCalls,2);
    const firstImage=await ledger.creationStatusSession(actor,session,'image',op);assert.equal((await journal.admission(creationEvent(firstImage))).state,'admitted');
    console.log('PASS cookie-Auth member facade prepares and admits before real ledger reservation/one gateway upload and publication');
    const operations=['61111111-1111-4111-8111-111111111111','71111111-1111-4111-8111-111111111111','81111111-1111-4111-8111-111111111111'];
    for(let index=0;index<operations.length;index++){
      const operation=operations[index];let before;
      const l={...ledger},j={...journal};
      if(index===0)l.prepareImageSession=async(...args)=>{before=await ledger.prepareImageSession(...args);throw Object.assign(Error('Synthetic lost preparation reply'),{outcome:'unknown'});};
      if(index===1)j.admit=async(...args)=>{const value=await journal.admit(...args);throw Object.assign(Error('Synthetic lost journal reply'),{outcome:'unknown'});};
      if(index===2)l.finishImageSession=async(...args)=>{const value=await ledger.finishImageSession(...args);throw Object.assign(Error('Synthetic lost activation reply'),{outcome:'unknown'});};
      await assert.rejects(make(l,j).reserve(ctx,operation,1),e=>e.outcome==='unknown');
      await ledger.close();await journal.close();
      ledger=await createAvatarLedger({enabled:true,connection,openPool});
      journal=await createDeletionJournalStore({enabled:true,projectRef:ref,epoch,connection:second.connection,openPool:second.openPool});
      const stable=await ledger.creationStatusSession(actor,session,'image',operation),lookup=await make().inspect(ctx,'image',{operationId:operation,version:1});
      assert.equal(lookup.state,index===0?'missing':'admitted');if(before)assert.deepEqual(stable,before);
      const reserved=await make().reserve(ctx,operation,1);assert.equal(reserved.objectId,stable.objectId);assert.equal(reserved.dispatch,index!==2);
      await ledger.cancelReservedSession(actor,session,operation);assert.equal(providerCalls,2);
    }
    assert.match(ja('select count(*) from alliance_journal.admissions;'),/\n\s*6\s*\n/);
    assert.match(admin(`select attempts from alliance_avatar.daily where actor_id='${actor}';`),/\n\s*4\s*\n/);
    console.log('PASS lost preparation/journal/activation acknowledgements recover exact IDs across fresh requests without duplicate quota, provider dispatch or admission');
    await assert.rejects(make().reserve(ctx,'91111111-1111-4111-8111-111111111111',1),e=>e.outcome==='unknown');assert.match(ja('select count(*) from alliance_journal.admissions;'),/\n\s*6\s*\n/);
    console.log('PASS four lifetime image preparations include abandoned/deleted attempts and refuse before a fifth remote admission');
    // Independent removal committed before local removal completion must also
    // close creation; a later coordinator reconciles the same exact record.
    const tip=await journal.tip();await journal.append({expected:{sequence:tip.sequence,sha256:tip.sha256},event:creationEvent(prepared)});
    await assert.rejects(make().profile(ctx,data),e=>e.outcome==='unknown');assert.equal(providerCalls,2);
    const removal=createAllianceRemoval({enabled:true,projectRef:ref,epoch,minimum:{sequence:0,sha256:zero},ledger,journal,serving});
    assert.deepEqual(await removal.run({...ctx,operationId:'a1111111-1111-4111-8111-111111111111',version:1,kind:'profile'}),{state:'committed',version:2});removal.close();
    assert.match(admin(`select count(*) from public.alliance_profiles where id='${profile.id}';`),/\n\s*0\s*\n/);await assert.rejects(ledger.prepareProfileSession(actor,session),e=>e.outcome==='rejected');
    console.log('PASS independent recorded removal blocks re-creation; journal-first local removal preserves the tombstone and stable identity');
    admin('update alliance_avatar.control set creation_enabled=false;');assert.equal((await make().inspect(ctx,'profile')).state,'removed');
    assert.match(admin('select count(*) from alliance_avatar.creation_plans;'),/\n\s*6\s*\n/);
    console.log('PASS readonly admission recovery still works with creation closed and never resumes or refunds preparations');
    // Inventory entrypoint is installed by recoveryPairNative, before this hook.
    await recoveryPairNative({admin,ja,ledger,journal,ref,journalRef:'uvwxyzabcdefghijklmn',epoch,mainTarget:secondOptions,journalTarget:second.archiveTarget,authGuard:()=>authDeletionGuardNative({admin,journal})});
  }finally{
    for(const fixture of profileFixtures)fixture.close();
    for(const c of coordinators)c.close();await ledger?.close();await journal?.close();
    try{try{
    admin("begin;drop owned by alliance_avatar_owner,alliance_avatar_executor,anon,authenticated,service_role cascade;drop schema if exists alliance_avatar cascade;drop table if exists public.alliance_profiles,public.alliance_member_owners cascade;drop schema if exists auth cascade;drop function if exists public.alliance_member_eligible(),public.alliance_profile_stamp(),public.alliance_save_profile(text,text,text,text,boolean),public.alliance_my_profile(),public.alliance_remove_profile();drop role alliance_avatar_owner,alliance_avatar_executor,anon,authenticated,service_role;commit;");
    }finally{
    ja('begin;drop owned by alliance_journal_owner,alliance_journal_executor,anon,authenticated,service_role cascade;drop schema if exists alliance_journal cascade;drop role alliance_journal_owner,alliance_journal_executor,anon,authenticated,service_role;commit;');
    }}finally{await second.close();}
    console.log('PASS both exact synthetic creation domains/roles/data and second database server removed; no hosted project or real provider call');
  }
}
