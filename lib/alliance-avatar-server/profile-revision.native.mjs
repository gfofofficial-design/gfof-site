// SQL protocol acceptance only, inside the existing guarded disposable TLS runner.
// Admission event is synthetic: this does NOT establish end-to-end journal/API use.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAvatarLedger} from './ledger.mjs';
import {creationEvent} from './creation.mjs';
const sql=name=>readFileSync(new URL('../../sql/'+name,import.meta.url),'utf8');
export async function profileRevisionNative({admin,bootstrap,avatar,connection,openPool}){
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
  // A legacy held write must stay held after the new mode is selected.
  await ledger.finishProfileSession(other,otherSession,legacyPlan,data,creationEvent(legacyPlan));
  const legacyReceipt=await ledger.profileWriteStatusSession(other,otherSession);
  admin('update alliance_avatar.control set profile_revision_enabled=true;');
  await assert.rejects(()=>ledger.finishProfileSession(actor,session,plan,data,creationEvent(plan)),e=>e.outcome==='rejected');
  for(const [op,revision] of [[null,0],[operation(1),null],[operation(1),-1],[operation(1),'9007199254740991']])await denied(()=>save(op,revision));
  await denied(()=>save(operation(10),1,data,{boundActor:other,boundSession:otherSession,boundPlan:legacyPlan}));
  assert.deepEqual(await ledger.profileWriteStatusSession(other,otherSession),legacyReceipt);
  console.log('PASS revision protocol is default-off, blocks revisionless legacy writers when selected and cannot clear a legacy pending receipt');
  const first=await save(operation(1),0);assert.equal(first.state,'saved');assert.equal(first.revision,1);assert.equal(first.profile.id,plan.profileId);
  const edited={...data,name:'Second ordinary edit',listed:true};
  const second=await save(operation(2),1,edited);assert.equal(second.state,'saved');assert.equal(second.revision,2);assert.equal(second.profile.name,edited.name);
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
  await denied(()=>save(operation(8),5,{...data,user_id:other}));
  await denied(()=>save(operation(8),5,data,{boundSession:otherSession}));
  await denied(()=>save(operation(8),5,data,{boundActor:other,boundSession:otherSession}));
  await denied(()=>pool.query('select * from alliance_avatar.creation_plans'));
  await denied(()=>pool.query('select alliance_avatar.finish_profile_unfenced($1,$2,$3,$4,$5)',[actor,session,plan,data,creationEvent(plan)]));
  const rights=admin("select has_function_privilege('authenticated','alliance_avatar.finish_profile_revision_session(uuid,uuid,jsonb,jsonb,jsonb,uuid,bigint)','EXECUTE'),has_function_privilege('alliance_avatar_executor','alliance_avatar.review_profile_write(uuid,bigint,text,text)','EXECUTE');");assert.match(rights,/f\s*\|\s*f/);
  admin(`delete from auth.sessions where id='${session}';`);
  await denied(()=>save(operation(7),4,{...data,name:'Committed reply lost'}));
  admin(`insert into auth.sessions values('${session}','${actor}',null);`);
  admin(`update public.alliance_profiles set bio='Synthetic out-of-protocol change' where id='${plan.profileId}';`);
  await denied(()=>save(operation(8),5));
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
