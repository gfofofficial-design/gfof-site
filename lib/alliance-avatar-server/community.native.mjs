// Disposable managed-role PostgreSQL only. No target/credential input or provider.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {secondCreationFixture} from './creation-second-fixture.mjs';
import {managedMemberInstallSql} from './member-managed-install.mjs';
import {managedCommunityExtensionSql,managedCommunityClosedInspectionSql} from './community-managed-install.mjs';
import {createAllianceCommunityStore} from './community-store.mjs';
import {createAvatarLedger} from './ledger.mjs';
import {createAllianceCommunityService} from './community-service.mjs';
import {journalFixture,event} from './deletion-journal.fixture.mjs';
import {deletionRecord} from './deletion-journal.mjs';
export async function communityNative({secondOptions}){
 const d=await secondCreationFixture({...secondOptions,purpose:'control'}),root=q=>d.admin(q,'fixture_root'),stores=[],services=[];let pool,store;
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',o='33333333-3333-4333-8333-333333333333';
 const sa='44444444-4444-4444-8444-444444444444',sb='55555555-5555-4555-8555-555555555555',so='66666666-6666-4666-8666-666666666666';
 const id=n=>`${String(n).padStart(8,'0')}-7777-4777-8777-777777777777`;
 const invite=(n,target=b,kit='research')=>({operationId:id(n),challengeId:id(n),revision:0,action:'invite',target,kit,scope:'members',days:7,goal:1,note:'Compare public evidence without sharing account details.',format:1});
 try{
  d.admin('create role fixture_root login superuser;set session authorization fixture_root;alter role postgres rename to supabase_admin;create role postgres login inherit nosuperuser createdb createrole noreplication bypassrls;grant create on database postgres to postgres;');
  root(`create role anon nologin;create role authenticated nologin;create role service_role nologin;
   create schema auth authorization supabase_admin;create schema storage authorization supabase_admin;
   create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean,deleted_at timestamptz,banned_until timestamptz);
   create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);create table auth.identities(id uuid);
   create table storage.objects(id uuid);create table storage.buckets(id text);
   grant usage on schema auth,storage to postgres;grant select on auth.users,auth.sessions,auth.identities,storage.objects,storage.buckets to postgres;grant references(id) on auth.users to postgres;
   grant usage,create on schema public to postgres with grant option;revoke create on schema public from public;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   set role supabase_admin;grant pg_read_all_data to postgres with admin true,inherit true,set true;reset role;`);
  d.admin(managedMemberInstallSql());
  const install=managedCommunityExtensionSql(),inspect=managedCommunityClosedInspectionSql();
  const clean=()=>assert.match(d.admin("select not pg_has_role('postgres','alliance_avatar_owner','SET') and not has_column_privilege('alliance_avatar_owner','public.alliance_profiles','id','REFERENCES') and to_regnamespace('alliance_community') is null as clean;"),/\bt\b/);
  const sabotage='grant select(note) on alliance_community.contributions to alliance_avatar_executor;\nRESET ROLE;\nREVOKE alliance_avatar_owner FROM postgres GRANTED BY postgres;\nDO $community_verify$';
  const marker='RESET ROLE;\nREVOKE alliance_avatar_owner FROM postgres GRANTED BY postgres;\nDO $community_verify$';
  assert.equal(install.split(marker).length,2);
  assert.throws(()=>d.admin(install.replace(marker,sabotage)),/Managed community verification refused/);clean();
  root('update alliance_avatar.control set enabled=true;');
  assert.throws(()=>d.admin(install),/Community requires an empty closed member foundation/);clean();root('update alliance_avatar.control set enabled=false;');
  d.admin(install);d.admin(inspect);
  assert.throws(()=>d.admin(install),/Managed community preflight refused/);
  root('update alliance_community.control set enabled=true;');
  assert.throws(()=>d.admin(inspect),/Community is not empty and closed/);root('update alliance_community.control set enabled=false;');
  assert.match(d.admin("select not pg_has_role('postgres','alliance_avatar_owner','SET') as clean;"),/\bt\b/);
  assert.match(root("select not enabled and mutations=0 from alliance_community.control;"),/\bt\b/);
  console.log('PASS atomic managed upgrade refuses permission drift/nonclosed foundation and removes all failed objects/grants; separate successful/failed inspections roll back temporary access');
  for(const [actor,session,name,community] of [[a,sa,'Fictional builder','Ion Crew'],[b,sb,'Fictional researcher','Orbit Crew'],[o,so,'Fictional outsider','Elsewhere']]){
   root(`insert into auth.users values('${actor}',clock_timestamp(),false,null,null);insert into auth.sessions values('${session}','${actor}',null);
    insert into public.alliance_member_owners(id,user_id) values('${actor}','${actor}');insert into public.alliance_profiles(id,display_name,bio,community,contribution_role,listed) values('${actor}','${name}','Disposable collaboration acceptance only.','${community}','builder',true);`);
  }
  const password='synthetic-community-'+randomUUID();root(`alter role alliance_avatar_executor login password '${password}';`);
  const config={host:d.connection.host,user:'alliance_avatar_executor',database:'postgres',password,ssl:{ca:d.connection.ca,rejectUnauthorized:true,servername:d.connection.host},options:'-c search_path=pg_catalog',max:4,statement_timeout:2000,lock_timeout:750};
  pool=d.openPool(config);
  const open=async()=>{const s=await createAllianceCommunityStore({enabled:true,deploymentProfile:'supabase-managed',connection:{...d.connection,password},openPool:d.openPool});stores.push(s);return s;};
  store=await open();
  const query=async(fn,types,values)=>{const c=await pool.connect();try{await c.query('begin');await c.query("set local synchronous_commit='on';set local search_path=pg_catalog");const r=await c.query('select alliance_community.'+fn+'('+types.map((t,i)=>'$'+(i+1)+'::'+t).join(',')+') as result',values);await c.query('commit');return r.rows[0].result;}catch(e){await c.query('rollback');throw e;}finally{c.release();}};
  const change=(actor,session,input)=>store.change(actor,session,input);
  const get=(actor,session,cid)=>store.read(actor,session,cid);
  const list=(actor,session,after=null,limit=5)=>store.list(actor,session,{after,limit});
  const block=(actor,session,target,hidden)=>store.block(actor,session,{target,hidden});
  const denied=work=>assert.rejects(work,e=>e.code==='42501'||['rejected','not_started'].includes(e.outcome));
  await denied(()=>change(a,sa,invite(1)));root('update alliance_avatar.control set enabled=true;update alliance_community.control set enabled=true;');
  for(const role of ['anon','authenticated','service_role','alliance_avatar_executor']){
   for(const t of ['control','challenges','contributions','operations','blocks'])assert.throws(()=>root(`set role ${role};select * from alliance_community.${t};`));
  }
  for(const q of ['select * from auth.users','select alliance_community.snapshot(null,null)','select alliance_community.member(null,null,false)','set role alliance_avatar_owner','set role postgres'])await denied(()=>pool.query(q));
  console.log('PASS default-off community storage, five forced-RLS/private tables, fixed entry-point grants and Auth/helper/owner isolation');
  let r=await change(a,sa,invite(1));assert.equal(r.state,'applied');assert.equal(r.challenge.revision,1);assert.equal(r.challenge.status,'invited');
  assert.equal((await change(a,sa,invite(1))).state,'replayed');await denied(()=>change(a,sa,{...invite(1),note:'Changed the earlier request.'}));
  await denied(()=>get(o,so,id(1)));await denied(()=>change(a,sa,{operationId:id(2),challengeId:id(1),revision:1,action:'accept'}));
  const accept={operationId:id(3),challengeId:id(1),revision:1,action:'accept'};r=await change(b,sb,accept);assert.equal(r.challenge.status,'active');assert.equal(r.challenge.revision,2);assert.equal(Date.parse(r.challenge.endsAt)-Date.parse(r.challenge.acceptedAt),7*86400000);
  assert.equal((await change(a,sa,invite(1))).state,'conflict');
  const proof={operationId:id(4),challengeId:id(1),revision:2,action:'contribute',note:'A source-backed explanation with its important limits.'};
  r=await change(a,sa,proof);assert.equal(r.challenge.proofs[0].owner,a);assert.equal((await change(a,sa,proof)).state,'replayed');
  await denied(()=>change(a,sa,{operationId:id(5),challengeId:id(1),revision:3,action:'acknowledge',proofId:id(4)}));
  await denied(()=>change(o,so,{operationId:id(5),challengeId:id(1),revision:3,action:'acknowledge',proofId:id(4)}));
  r=await change(b,sb,{operationId:id(6),challengeId:id(1),revision:3,action:'acknowledge',proofId:id(4)});assert.equal(r.challenge.status,'complete');assert.equal(r.challenge.winner,a);
  await denied(()=>change(a,sa,{...proof,operationId:id(7),revision:4}));
  console.log('PASS durable invitation, recipient-only consent, contribution/other-participant acknowledgement and goal completion; exact replay, changed request and outsider/self-review refusals');
  await change(a,sa,invite(10,b,'feedback'));
  const secondStore=await open();
  const race=await Promise.all([change(b,sb,{operationId:id(11),challengeId:id(10),revision:1,action:'accept'}),secondStore.change(b,sb,{operationId:id(12),challengeId:id(10),revision:1,action:'decline'})]);
  assert.deepEqual(race.map(x=>x.state).sort(),['applied','conflict']);
  await block(b,sb,a,true);await block(b,sb,a,true);await denied(()=>get(a,sa,id(1)));await denied(()=>change(a,sa,invite(20)));assert.equal((await list(a,sa)).items.length,0);
  await block(b,sb,a,false);assert.equal((await get(a,sa,id(1))).status,'complete');
  const first=await list(a,sa,null,1);assert.equal(first.items.length,1);assert.equal(first.next,id(1));assert.equal((await list(a,sa,first.next,1)).items[0].id,id(10));
  await change(a,sa,invite(30,b,'prototype'));root(`update public.alliance_profiles set listed=false where id='${b}';`);
  assert.equal((await change(b,sb,{operationId:id(31),challengeId:id(30),revision:1,action:'accept'})).challenge.status,'active');await denied(()=>change(a,sa,invite(40,b,'teach-back')));
  assert.equal((await change(b,sb,invite(41,a,'teach-back'))).state,'applied');root(`update public.alliance_profiles set listed=true where id='${b}';`);
  console.log('PASS concurrent consent resolves one revision, explicit idempotent hiding blocks both directions, private pagination and unlisting preserves existing conversations/outgoing choice');
  root(`update alliance_community.challenges set created_at='2025-12-31T00:00:00Z',accepted_at='2026-01-01T00:00:00Z',ends_at='2026-01-01T00:00:00Z'::timestamptz+days*interval '1 day' where id='${id(30)}';`);
  assert.equal((await get(a,sa,id(30))).status,'expired');await denied(()=>change(a,sa,{operationId:id(42),challengeId:id(30),revision:2,action:'contribute',note:'This contribution is after the accepted window.'}));
  assert.equal((await change(a,sa,invite(43,b,'prototype'))).state,'applied');
  root(`delete from auth.sessions where id='${sa}';`);await denied(()=>get(a,sa,id(1)));root(`insert into auth.sessions values('${sa}','${a}',null);`);
  await store.close();store=await open();assert.equal((await get(b,sb,id(1))).proofs[0].status,'acknowledged');
  for(const [changeSql,restoreSql] of [
   ['grant select(note) on alliance_community.contributions to alliance_avatar_executor;','revoke select(note) on alliance_community.contributions from alliance_avatar_executor;'],
   ['alter table alliance_community.operations disable row level security;','alter table alliance_community.operations enable row level security;'],
   ['alter function alliance_community.change_session(uuid,uuid,jsonb) security invoker;','alter function alliance_community.change_session(uuid,uuid,jsonb) security definer;'],
  ]){
   const drift=await open();root(changeSql);try{await assert.rejects(drift.read(a,sa,id(1)),{outcome:'not_started'});}finally{root(restoreSql);}
   await assert.rejects(drift.read(a,sa,id(1)),{outcome:'not_started'});
  }
  let sabotageCommit=true;
  const uncertain=await createAllianceCommunityStore({enabled:true,deploymentProfile:'supabase-managed',connection:{...d.connection,password},openPool:config=>{
   const p=d.openPool(config),connect=p.connect.bind(p);
   p.connect=async()=>{const c=await connect();return {release:destroy=>c.release(destroy),query:async q=>{
    const r=await c.query(q);if(q.text==='COMMIT'&&sabotageCommit){sabotageCommit=false;root('grant select(note) on alliance_community.contributions to alliance_avatar_executor;');}return r;
   }};};return p;
  }});stores.push(uncertain);
  try{await assert.rejects(uncertain.change(a,sa,invite(50,b,'translate')),{outcome:'unknown'});}
  finally{root('revoke select(note) on alliance_community.contributions from alliance_avatar_executor;');}
  await assert.rejects(uncertain.read(a,sa,id(50)),{outcome:'not_started'});
  assert.equal((await get(a,sa,id(50))).status,'invited');assert.equal((await change(a,sa,invite(50,b,'translate'))).state,'replayed');
  console.log('PASS post-COMMIT permission drift withholds a durable mutation as unknown, retires its connection and requires explicit fresh-instance reconciliation without a duplicate write');
  const ledger=await createAvatarLedger({enabled:true,deploymentProfile:'supabase-managed',connection:{...d.connection,password},openPool:d.openPool});stores.push(ledger);
  const evidence=journalFixture({events:[]});services.push({close:()=>evidence.client.close()});
  const facade=createAllianceCommunityService({enabled:true,ledger,store,journal:evidence.client,serving:{authorizeCommunity:async()=>true}});services.push(facade);
  const context=(actorId,sessionId)=>({actorId,sessionId,expiresAt:Date.now()+60000});
  let result=await facade.change(context(b,sb),{operationId:id(45),challengeId:id(43),revision:1,action:'accept'});assert.equal(result.challenge.status,'active');
  result=await facade.change(context(a,sa),{operationId:id(46),challengeId:id(43),revision:2,action:'contribute',note:'A fictional prototype with a documented limitation.'});assert.equal(result.challenge.proofs.length,1);
  result=await facade.change(context(b,sb),{operationId:id(47),challengeId:id(43),revision:3,action:'acknowledge',proofId:id(46)});assert.equal(result.challenge.status,'complete');
  // Model restoration of old member rows while independent deletion evidence
  // survives: the raw SQL row exists, but neither private page nor record leaks.
  evidence.history.push(deletionRecord({projectRef:'abcdefghijklmnopqrst',epoch:'11111111-1111-4111-8111-111111111111',sequence:1,previous:'0'.repeat(64),event:event({profileId:b})}));
  assert.equal((await get(a,sa,id(43))).status,'complete');assert.deepEqual(await facade.read(context(a,sa),id(43)),{state:'unavailable'});assert.deepEqual(await facade.list(context(a,sa)),{state:'unavailable'});
  console.log('PASS real restricted driver refuses column/RLS/function drift without reopening; SQL-session service composes signed journal review and withholds restored private collaboration rows');
  root('update alliance_community.control set mutations=1024;');await denied(()=>change(a,sa,invite(44,b,'roundtable')));assert.equal((await get(a,sa,id(1))).status,'complete');
  root('update alliance_avatar.control set enabled=false;update alliance_community.control set enabled=false;');
  const inventory=await store.inventory();assert.equal(inventory.tables.length,5);assert.equal(inventory.tables.find(t=>t.table==='alliance_community.challenges').rows,6);
  root(`delete from public.alliance_member_owners where id='${a}';`);
  const after=await store.inventory();for(const t of after.tables)assert.equal(t.rows,t.table.endsWith('.control')?1:0);assert.notDeepEqual(after,inventory);
  console.log('PASS server-enforced accepted window, revoked SQL session, fresh connection durability, nonrefundable mutation cap and closed complete inventory/profile cascade with no cached private text');
 }finally{try{for(const s of services)s.close();for(const s of stores)await s.close();if(pool&&!pool.ended)await pool.end();}finally{await d.close();}}
 console.log('PASS community disposable managed cluster and fictional data removed; no hosted grant or account changed');
}
