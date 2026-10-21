// Guarded disposable TLS acceptance; Auth/HTTP/serving authority are modeled.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAvatarLedger} from './ledger.mjs';
import {creationEvent,createAllianceCreation} from './creation.mjs';
import {secondCreationFixture} from './creation-second-fixture.mjs';
import {createDeletionJournalStore} from './journal-store.mjs';
import {createJournalWitness} from './journal-witness.mjs';
import {createAvatarDeletionJournal} from './deletion-journal.mjs';
import {journalFixture} from './deletion-journal.fixture.mjs';
import {createAllianceRemoval} from './removal.mjs';
import {createAllianceProfileApi} from '../alliance-profile-api.mjs';
import {createMemberProfileClient} from '../../assets/federation/fed-alliance-member-client.mjs';
import {createAllianceRecoveryPair,RECOVERY_TABLES} from './recovery-pair.mjs';
import {fixtureArchive} from './recovery-archive.fixture.mjs';
import {startupFixture} from './startup-gate.fixture.mjs';
const sql=name=>readFileSync(new URL('../../sql/'+name,import.meta.url),'utf8');
export async function profileRevisionNative({admin,bootstrap,avatar,connection,openPool,secondOptions}){
 const actor='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222';
 const other='33333333-3333-4333-8333-333333333333',otherSession='44444444-4444-4444-8444-444444444444';
 const operation=n=>`${String(n).padStart(8,'0')}-5555-4555-8555-555555555555`;
 const data={name:'Revision Fixture',community:'',bio:'Only synthetic profile revision acceptance.',role:'builder',listed:false};
 let ledger,pool,installed=false;
 try{
  admin(bootstrap+'\n'+avatar+`\nalter table auth.users add column email_confirmed_at timestamptz default clock_timestamp(),add column is_anonymous boolean default false,add column deleted_at timestamptz,add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);\n`+
   ['alliance-avatar-session-candidate.sql','alliance-avatar-cleanup-candidate.sql','alliance-avatar-recovery-candidate.sql','alliance-avatar-removal-candidate.sql','alliance-creation-admission-candidate.sql','alliance-profile-write-fence-candidate.sql','alliance-profile-revision-candidate.sql'].map(sql).join('\n')+
   `\nalter role alliance_avatar_executor login password '${connection.password}';insert into auth.users(id) values('${actor}'),('${other}');insert into auth.sessions values('${session}','${actor}',null),('${otherSession}','${other}',null);commit;`);
  installed=true;
  ledger=await createAvatarLedger({enabled:true,connection,openPool});
  pool=openPool({host:connection.host,user:'alliance_avatar_executor',password:connection.password,database:'postgres',ssl:{ca:connection.ca,rejectUnauthorized:true},max:3,connectionTimeoutMillis:2000,statement_timeout:2000,lock_timeout:750,idle_in_transaction_session_timeout:3000});
  const who=await pool.query('select current_user as actor, (select ssl from pg_stat_ssl where pid=pg_backend_pid()) as tls');assert.deepEqual(who.rows,[{actor:'alliance_avatar_executor',tls:true}]);
  admin('update alliance_avatar.control set enabled=true,creation_enabled=true;');
  const plan=await ledger.prepareProfileSession(actor,session),legacyPlan=await ledger.prepareProfileSession(other,otherSession);
  const save=async(op,revision,input=data,{rollback=false,boundActor=actor,boundSession=session,boundPlan=plan}={})=>{
   const c=await pool.connect();
   try{await c.query('begin');await c.query("set local synchronous_commit='on';set local statement_timeout='2000ms';set local lock_timeout='750ms'");
    const r=await c.query('select alliance_avatar.finish_profile_revision_session($1::uuid,$2::uuid,$3::jsonb,$4::jsonb,$5::jsonb,$6::uuid,$7::bigint) as value',[boundActor,boundSession,boundPlan,input,creationEvent(boundPlan),op,revision]);
    await c.query(rollback?'rollback':'commit');return r.rows[0].value;
   }catch(e){await c.query('rollback');throw e;}finally{c.release();}
  };
  const denied=work=>assert.rejects(work,e=>e.code==='42501');
  await denied(()=>save(operation(1),0));
  await assert.rejects(ledger.profileRevisionReadSession(actor,session),e=>e.outcome==='rejected');
  // A legacy held write must stay held after the new mode is selected.
  await ledger.finishProfileSession(other,otherSession,legacyPlan,data,creationEvent(legacyPlan));
  const legacyReceipt=await ledger.profileWriteStatusSession(other,otherSession);
  admin('update alliance_avatar.control set profile_revision_enabled=true;');
  assert.deepEqual(await ledger.profileRevisionReadSession(actor,session),{profile:null,revision:0});
  await assert.rejects(()=>ledger.finishProfileSession(actor,session,plan,data,creationEvent(plan)),e=>e.outcome==='rejected');
  for(const [op,revision] of [[null,0],[operation(1),null],[operation(1),-1],[operation(1),'9007199254740991']])await denied(()=>save(op,revision));
  await denied(()=>save(operation(10),1,data,{boundActor:other,boundSession:otherSession,boundPlan:legacyPlan}));
  assert.deepEqual(await ledger.profileWriteStatusSession(other,otherSession),legacyReceipt);
  console.log('PASS revision protocol is default-off, blocks revisionless legacy writers when selected and cannot clear a legacy pending receipt');
  const first=await save(operation(1),0);assert.equal(first.state,'saved');assert.equal(first.revision,1);assert.equal(first.profile.id,plan.profileId);
  const edited={...data,name:'Second ordinary edit',listed:true};
  const second=await save(operation(2),1,edited);assert.equal(second.state,'saved');assert.equal(second.revision,2);assert.equal(second.profile.name,edited.name);
  assert.deepEqual(await ledger.profileRevisionReadSession(actor,session),{profile:second.profile,revision:2});
  const unlisted={...edited,listed:false};const third=await save(operation(3),2,unlisted);assert.equal(third.state,'saved');assert.equal(third.profile.publication,'private');
  assert.equal((await ledger.profileWriteStatusSession(actor,session)).pending,false);
  console.log('PASS restricted TLS caller creates, edits again and unlists without owner review; each atomic save advances one revision');
  const replay=await save(operation(3),2,unlisted);assert.deepEqual(replay,{...third,state:'replayed'});
  assert.deepEqual(await save(operation(3),2,{...unlisted,name:'Changed reuse'}),{state:'conflict',revision:3});
  assert.deepEqual(await save(operation(1),0),{state:'conflict',revision:3});
  assert.deepEqual(await save(operation(4),1),{state:'conflict',revision:3});
  const raced=await Promise.all([save(operation(4),3,{...data,name:'Concurrent A'}),save(operation(5),3,{...data,name:'Concurrent B'})]);
  assert.equal(raced.filter(v=>v.state==='saved'&&v.revision===4).length,1);assert.equal(raced.filter(v=>v.state==='conflict'&&v.revision===4).length,1);
  console.log('PASS exact last-operation replay preserves the timestamp; changed reuse, delayed old saves and one of two concurrent editors cannot overwrite a newer revision');
  const beforeRollback=await ledger.profileWriteStatusSession(actor,session);
  assert.equal((await save(operation(6),4,data,{rollback:true})).state,'saved');
  assert.deepEqual(await ledger.profileWriteStatusSession(actor,session),beforeRollback);
  // Model a committed reply being lost, discard it, then use a fresh connection.
  await save(operation(7),4,{...data,name:'Committed reply lost'});
  const recovered=await save(operation(7),4,{...data,name:'Committed reply lost'});assert.equal(recovered.state,'replayed');assert.equal(recovered.revision,5);
  assert.deepEqual(await save(operation(8),4),{state:'conflict',revision:5});
  console.log('PASS rollback preserves the prior revision; lost-commit acknowledgement has exact operation readback and stale follow-up cannot execute');
  await revisionJourney({admin,ledger,secondOptions});
  await denied(()=>save(operation(8),5,{...data,user_id:other}));
  await denied(()=>save(operation(8),5,data,{boundSession:otherSession}));
  await denied(()=>save(operation(8),5,data,{boundActor:other,boundSession:otherSession}));
  await denied(()=>pool.query('select * from alliance_avatar.creation_plans'));
  await denied(()=>pool.query('select alliance_avatar.finish_profile_unfenced($1,$2,$3,$4,$5)',[actor,session,plan,data,creationEvent(plan)]));
  const rights=admin("select has_function_privilege('authenticated','alliance_avatar.finish_profile_revision_session(uuid,uuid,jsonb,jsonb,jsonb,uuid,bigint)','EXECUTE'),has_function_privilege('alliance_avatar_executor','alliance_avatar.review_profile_write(uuid,bigint,text,text)','EXECUTE');");assert.match(rights,/f\s*\|\s*f/);
  admin(`delete from auth.sessions where id='${session}';`);
  await denied(()=>save(operation(7),4,{...data,name:'Committed reply lost'}));
  await assert.rejects(ledger.profileRevisionReadSession(actor,session),e=>e.outcome==='rejected');
  admin(`insert into auth.sessions values('${session}','${actor}',null);`);
  admin(`update public.alliance_profiles set bio='Synthetic out-of-protocol change' where id='${plan.profileId}';`);
  await denied(()=>save(operation(8),5));
  await assert.rejects(ledger.profileRevisionReadSession(actor,session),e=>e.outcome==='rejected');
  admin(`update public.alliance_profiles set bio='${data.bio}' where id='${plan.profileId}';`);
  // The timestamp changed too, so restoring just the visible field cannot clear
  // the integrity check. No automatic digest replacement is attempted.
  await denied(()=>save(operation(8),5));
  admin(`delete from public.alliance_profiles where id='${plan.profileId}';`);
  await denied(()=>save(operation(7),4,{...data,name:'Committed reply lost'}));
  console.log('PASS owner/session forgery, extra fields, direct tables, unfenced/owner-review bypass, revoked-session replay, out-of-protocol changes and removed-profile replay all refuse');
 }finally{
  await ledger?.close();await pool?.end();
  if(installed)admin("begin;drop owned by alliance_avatar_owner,alliance_avatar_executor,anon,authenticated,service_role cascade;drop schema if exists alliance_avatar cascade;drop table if exists public.alliance_profiles,public.alliance_member_owners cascade;drop schema if exists auth cascade;drop function if exists public.alliance_member_eligible(),public.alliance_profile_stamp(),public.alliance_save_profile(text,text,text,text,boolean),public.alliance_my_profile(),public.alliance_remove_profile();drop role alliance_avatar_owner,alliance_avatar_executor,anon,authenticated,service_role;commit;");
  assert.match(admin("select to_regnamespace('alliance_avatar') is null and to_regnamespace('auth') is null and not exists(select 1 from pg_roles where rolname like 'alliance_avatar_%');"),/\n\s*t\s*\n/);
  console.log('PASS exact revision fixture roles, tables and synthetic records removed; no hosted access, provider call or public route');
 }
}

async function revisionJourney({admin,ledger,secondOptions}){
 const second=await secondCreationFixture(secondOptions),ja=second.admin;
 const projectRef='abcdefghijklmnopqrst',epoch='11111111-1111-4111-8111-111111111111',minimum={sequence:0,sha256:'0'.repeat(64)};
 const actor='55555555-1111-4111-8111-111111111111',session='66666666-2222-4222-8222-222222222222';
 const origin='https://deploy-preview-124--gfof.netlify.app',url='https://abcdefghijklmnopqrst.supabase.co',key='sb_publishable_synthetic_revision_native_fixture';
 const data={name:'Composed Revision Member',community:'',bio:'Synthetic two-server profile revision journey.',role:'builder',listed:false};
 const serving={authorize:()=>true},signer=journalFixture({events:[]}),fixtures=[];let journal,witness,removal,installed=false,count=100;
 try{
  ja("begin;create role anon nologin;create role authenticated nologin;create role service_role nologin;"+sql('alliance-deletion-journal-store-candidate.sql')+'\n'+sql('alliance-journal-admission-candidate.sql')+`\nupdate alliance_journal.control set project_ref='${projectRef}',epoch='${epoch}',enabled=true,admission_enabled=true;alter role alliance_journal_executor login password '${second.connection.password}';commit;`);installed=true;
  journal=await createDeletionJournalStore({enabled:true,projectRef,epoch,connection:second.connection,openPool:second.openPool});
  witness=createJournalWitness({enabled:true,projectRef,epoch,minimum,store:journal,verificationKey:signer.verificationKey,signBytes:signer.signBytes});
  admin(`insert into auth.users(id) values('${actor}');insert into auth.sessions values('${session}','${actor}',null);`);
  const token='fixture.'+Buffer.from(JSON.stringify({sub:actor,session_id:session,iss:url+'/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+120})).toString('base64url')+'.signature';
  const make=({loseReply=false}={})=>{
   const states=[],creator=createAllianceCreation({enabled:true,profileRevisions:true,ledger,journal,serving});
   const view=createAvatarDeletionJournal({enabled:true,projectRef,epoch,minimum,verificationKey:signer.verificationKey,
    readWitness:async({challenge,signal})=>{const v=await witness.issue({challenge},{signal});assert.equal(v.state,'signed');return v.bytes;},
    readRecords:async({through,sha256,signal})=>Buffer.from(JSON.stringify(await journal.records({sequence:through,sha256},{signal})))});
   const api=createAllianceProfileApi({enabled:true,profileRevisions:true,origin,url,key,ledger,creation:creator,journal:view,serving,fetcher:async(endpoint)=>{
    assert.equal(endpoint,url+'/auth/v1/user');return new Response(JSON.stringify({id:actor,email_confirmed_at:'2026-10-20T12:00:00Z',is_anonymous:false}),{headers:{'Content-Type':'application/json'}});
   }});
   let requests=0,posts=0,lost=false;
   const client=createMemberProfileClient({enabled:true,profileRevisions:true,origin,newOperationId:()=>`${String(++count).padStart(8,'0')}-5555-4555-8555-555555555555`,onState:s=>states.push(s),fetcher:async(endpoint,init)=>{
    requests++;if(init.method==='POST')posts++;
    const response=await api(new Request(endpoint,{...init,headers:{...init.headers,Origin:origin,'Sec-Fetch-Site':'same-origin',Cookie:'__Host-gf-access='+token}}));
    if(loseReply&&!lost&&init.method==='POST'){assert.equal(response.status,200);lost=true;throw Error('Synthetic committed response loss');}return response;
   }});
   const f={client,states,get requests(){return requests;},get posts(){return posts;},close(){client.dispose();api.close();creator.close();view.close();}};fixtures.push(f);return f;
  };
  const own=make(),stale=make();assert.deepEqual(await own.client.load(),{profile:null,revision:0});await stale.client.load();
  const first=await own.client.save(data);assert.equal(first.revision,1);
  assert.equal((await own.client.save({...data,name:'Second member edit',listed:true})).revision,2);
  assert.equal((await own.client.save({...data,name:'Unlisted member'})).revision,3);
  const admitted=await ledger.creationStatusSession(actor,session,'profile','00000000-0000-0000-0000-000000000000');assert.equal((await journal.admission(creationEvent(admitted))).state,'admitted');
  const draft={...data,name:'Preserved conflicting draft'};assert.deepEqual(await stale.client.save(draft),{state:'conflict',revision:3});
  const conflictRequests=stale.requests;await assert.rejects(stale.client.save(draft),{code:'conflict'});assert.equal(stale.requests,conflictRequests);
  const current=await stale.client.load();assert.equal(stale.states.at(-1).status,'comparison_ready');stale.client.acceptCurrent(current.revision);assert.equal((await stale.client.save(draft)).revision,4);
  const unknown=make({loseReply:true});await unknown.client.load();await assert.rejects(unknown.client.save({...data,name:'Committed response lost'}),{code:'unknown'});assert.equal(unknown.posts,1);
  const latest=await unknown.client.load();assert.equal(latest.revision,5);assert.equal(unknown.states.at(-1).status,'comparison_ready');await assert.rejects(unknown.client.save(data),{code:'unknown'});assert.equal(unknown.posts,1);
  unknown.client.acceptCurrent(latest.revision);assert.equal((await unknown.client.save({...data,name:'Explicit new intention'})).revision,6);
  assert.equal((await ledger.profileRevisionReadSession(actor,session)).revision,6);
  console.log('PASS composed client/cookie Auth/coordinator/two independent TLS databases create, edit, unlist and recover conflict/unknown only after explicit comparison, with real journal admission and signed read guards');
  admin(`begin;delete from public.alliance_profiles where id='${first.profile.id}';do $$ begin if exists(select 1 from alliance_avatar.creation_plans where profile_id='${first.profile.id}' and profile_last_result is not null) then raise exception 'Deleted replay text remains';end if;end $$;rollback;`);
  assert.equal((await ledger.profileRevisionReadSession(actor,session)).revision,6);
  removal=createAllianceRemoval({enabled:true,projectRef,epoch,minimum,ledger,journal,serving});
  assert.deepEqual(await removal.run({actorId:actor,sessionId:session,expiresAt:Date.now()+60000,operationId:'77777777-1111-4111-8111-111111111111',version:0,kind:'profile'}),{state:'committed',version:1});
  await assert.rejects(ledger.profileRevisionReadSession(actor,session),e=>e.outcome==='rejected');
  await assert.rejects(unknown.client.load(),{code:'unavailable'});
  assert.match(admin(`select count(*) from public.alliance_profiles where id='${first.profile.id}';`),/\n\s*0\s*\n/);
  assert.match(admin(`select profile_last_operation is null and profile_last_expected is null and profile_last_result is null and profile_write_sequence=6 from alliance_avatar.creation_plans where profile_id='${first.profile.id}';`),/\n\s*t\s*\n/);
  assert.equal((await journal.tip()).sequence,1);
  console.log('PASS composed journal-first own removal uses the separate avatar/removal version, clears replayed profile text atomically and denies later revision reads; no browser deletion route is claimed');
  for(const f of fixtures)f.close();removal.close();witness.close();
  await revisionRecovery({admin,ja,ledger,journal,secondOptions,journalTarget:second.archiveTarget,projectRef,epoch,profileId:first.profile.id});
 }finally{
  for(const f of fixtures)f.close();removal?.close();witness?.close();signer.client.close();await journal?.close();
  try{if(installed)ja('begin;drop owned by alliance_journal_owner,alliance_journal_executor,anon,authenticated,service_role cascade;drop schema if exists alliance_journal cascade;drop role alliance_journal_owner,alliance_journal_executor,anon,authenticated,service_role;commit;');}finally{await second.close();}
 }
}

async function revisionRecovery({admin,ja,ledger,journal,secondOptions,journalTarget,projectRef,epoch,profileId}){
 admin('update alliance_avatar.control set enabled=false,creation_enabled=false,cleanup_enabled=false,profile_revision_enabled=false;');
 ja('update alliance_journal.control set enabled=false,admission_enabled=false;');
 admin('begin;'+sql('alliance-member-recovery-inventory-candidate.sql')+'commit;');ja('begin;'+sql('alliance-journal-recovery-inventory-candidate.sql')+'commit;');
 const member=await ledger.recoveryInventory(),independent=await journal.recoveryInventory(),minimum={sequence:independent.sequence,sha256:independent.sha256};
 const freezeId='88888888-1111-4111-8111-111111111111',evidence={freezeId,frozenAt:new Date(Date.now()-1000).toISOString(),checkpoint:{format:2,memberProjectRef:projectRef,journalProjectRef:'uvwxyzabcdefghijklmn',epoch,freezeId,capturedAt:new Date().toISOString(),member,journal:independent}};
 const review=createAllianceRecoveryPair({enabled:true,ledger,journal,memberProjectRef:projectRef,journalProjectRef:'uvwxyzabcdefghijklmn',epoch,minimum});
 const archive=fixtureArchive({domain:'member',local:secondOptions.local,scratch:secondOptions.scratch,container:secondOptions.container});
 const journalArchive=fixtureArchive({domain:'journal',...journalTarget}),expected={state:'matches_checkpoint',access:'closed'};
 try{
  assert.deepEqual(await review.inspect(evidence),expected);const handle=archive.dump(),journalHandle=journalArchive.dump();
  const restore=()=>{admin('truncate '+RECOVERY_TABLES.member.join(',')+';');archive.restore(handle);};
  admin(`update alliance_avatar.creation_plans set profile_write_sequence=5 where profile_id='${profileId}';`);
  assert.equal((await review.inspect(evidence)).reason,'member_mismatch');
  const restart=startupFixture({checkpoint:evidence.checkpoint,ledger,journal});restart.control.frozenAt=evidence.frozenAt;
  assert.deepEqual(await restart.gate.prepare(evidence.checkpoint),{state:'quarantine',access:'closed'});assert.equal(await restart.gate.authorize(),false);restart.gate.close();
  restore();assert.deepEqual(await review.inspect(evidence),expected);
  admin("update alliance_avatar.creation_plans set profile_last_operation=gen_random_uuid() where profile_last_operation is not null;");
  assert.equal((await review.inspect(evidence)).reason,'member_mismatch');restore();assert.deepEqual(await review.inspect(evidence),expected);
  admin("update alliance_avatar.creation_plans set profile_last_result=jsonb_set(profile_last_result,'{bio}','\"Synthetic changed replay text\"'::jsonb) where profile_last_result is not null;");
  assert.equal((await review.inspect(evidence)).reason,'member_mismatch');restore();assert.deepEqual(await review.inspect(evidence),expected);
  admin('update alliance_avatar.control set profile_revision_enabled=true;');assert.equal((await review.inspect(evidence)).reason,'member_mismatch');restore();
  assert.deepEqual(await review.inspect(evidence),expected);assert.deepEqual(await journal.recoveryInventory(),independent);
  ja('truncate '+RECOVERY_TABLES.journal.join(',')+';');journalArchive.restore(journalHandle);assert.deepEqual(await review.inspect(evidence),expected);
  assert.match(admin(`select profile_last_result is null and profile_write_sequence=6 from alliance_avatar.creation_plans where profile_id='${profileId}';`),/\n\s*t\s*\n/);
  console.log('PASS actual paired archives preserve revision operation/result/flag and cleared removal receipt; same-count revision regression, receipt/content/flag corruption quarantine and fresh startup refuses without reopening');
 }finally{
  review.close();archive.close();journalArchive.close();
  // Only the disposable outer fixture resumes its remaining legacy denial tests.
  admin('update alliance_avatar.control set enabled=true,creation_enabled=true,profile_revision_enabled=true;');
 }
}
