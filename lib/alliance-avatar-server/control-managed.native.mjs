// Real disposable TLS sessions only. No hosted project or actual custody keys.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {secondCreationFixture} from './creation-second-fixture.mjs';
import {managedControlInstallSql} from './control-managed-install.mjs';
import {createAllianceControlStore,createAllianceAnchorStore} from './control-store.mjs';
import {chain,event,projectRef,epoch,other} from './deletion-journal.fixture.mjs';
export async function controlManagedNative({secondOptions}){
 const d=await secondCreationFixture({...secondOptions,purpose:'control'}),stores=[],pools=[];
 const root=sql=>d.admin(sql,'fixture_root'),scope={memberProjectRef:projectRef,journalProjectRef:'uvwxyzabcdefghijklmn',controlProjectRef:'opqrstuvwxyzabcdefgh',epoch};
 const password='synthetic-managed-control-'+randomUUID(),zero={sequence:0,sha256:'0'.repeat(64)};
 const open=async({anchor=false,writer=false,profile='supabase-managed',afterCommit}={})=>{
  let changed=false;
  const factory=anchor?createAllianceAnchorStore:createAllianceControlStore;
  const store=await factory({enabled:true,writeEnabled:writer,deploymentProfile:profile,...scope,connection:{...d.connection,password},openPool:config=>{
   const pool=d.openPool(config);if(!afterCommit)return pool;
   return {on:pool.on.bind(pool),end:pool.end.bind(pool),async connect(){const c=await pool.connect();return {once:c.once.bind(c),removeListener:c.removeListener.bind(c),release:c.release.bind(c),async query(q){const r=await c.query(q);if(q.text==='COMMIT'&&!changed){changed=true;afterCommit();}return r;}};}};
  }});stores.push(store);return store;
 };
 try{
  d.admin('create role fixture_root login superuser;set session authorization fixture_root;alter role postgres rename to supabase_admin;create role postgres login noinherit nosuperuser createdb createrole noreplication bypassrls;grant create on database postgres to postgres;');
  root("create role anon nologin;create role authenticated nologin;create role service_role nologin;create schema auth authorization supabase_admin;create schema storage authorization supabase_admin;create table auth.users(id uuid);create table auth.identities(id uuid);create table storage.objects(id uuid);create table storage.buckets(id text);create table auth.fixture_labels(id bigint generated always as identity);grant usage on schema auth,storage to postgres;grant select on auth.users,auth.identities,storage.objects,storage.buckets to postgres;revoke create on schema public from public;");
  root("insert into auth.users values('00000000-0000-4000-8000-000000000001');");assert.throws(()=>d.admin(managedControlInstallSql()));assert.match(root("select to_regnamespace('alliance_control') is null as clean;"),/\bt\b/);root('truncate auth.users;');
  console.log('PASS managed control preflight refuses existing Auth data without installing roles or schema');
  root('alter schema auth owner to fixture_root;');assert.throws(()=>d.admin(managedControlInstallSql()));assert.match(root("select to_regnamespace('alliance_control') is null and not exists(select 1 from pg_roles where rolname like 'alliance_control_%') as clean;"),/\bt\b/);root('alter schema auth owner to supabase_admin;');
  console.log('PASS final managed control refusal rolls back both SQL extensions, four roles and temporary grants');
  d.admin(managedControlInstallSql());
  assert.match(root("select count(*) from pg_authid where rolname like 'alliance_control_%' and not rolcanlogin and rolpassword is null;"),/\n\s*4\s*\n/);
  assert.match(root("select count(*) from pg_auth_members m join pg_roles r on r.oid=m.roleid where r.rolname like 'alliance_control_%' and pg_get_userbyid(m.grantor)='supabase_admin' and pg_get_userbyid(m.member)='postgres' and m.admin_option and not m.set_option and not m.inherit_option;"),/\n\s*4\s*\n/);
  assert.match(d.admin("select pg_has_role('postgres','alliance_control_owner','SET');"),/\bf\b/);
  console.log('PASS managed control installs exactly four locked password-free roles, four fixed creator edges and no temporary SET edge');
  root(`alter role alliance_control_reader login password '${password}';alter role alliance_control_operator login password '${password}';alter role alliance_control_anchor_writer login password '${password}';`);
  const cfg={host:d.connection.host,database:'postgres',user:'alliance_control_operator',password,ssl:{ca:d.connection.ca,rejectUnauthorized:true,servername:d.connection.host},options:'-c search_path=pg_catalog'};
  const operator=d.openPool(cfg);pools.push(operator);
  await operator.query('select alliance_control.bootstrap($1,$2,$3,$4)',[scope.memberProjectRef,scope.journalProjectRef,scope.epoch,randomUUID()]);
  const strict=await open({profile:'strict'});await assert.rejects(strict.read());
  const reader=await open(),anchor=await open({anchor:true}),writer=await open({anchor:true,writer:true});
  const policy=await reader.read();assert.equal(policy.state,'closed');assert.equal(policy.revision,1);assert.equal((await anchor.read()).sequence,0);
  console.log('PASS actual managed TLS reader/anchor sessions succeed only with explicit profile; strict still refuses creator memberships');
  const records=chain([event()]),through={sequence:1,sha256:records[0].sha256};
  assert.equal((await writer.advance({expected:zero,through,records})).state,'anchored');assert.equal((await anchor.read()).sequence,1);
  console.log('PASS separate actual managed anchor writer commits a canonical chain and reader independently confirms it');
  for(const [change,undo] of [
   ['grant alliance_control_reader to postgres with admin true, inherit false, set true granted by supabase_admin;','grant alliance_control_reader to postgres with admin true, inherit false, set false granted by supabase_admin;'],
   ['grant alliance_control_anchor_writer to anon with inherit false, set false granted by supabase_admin;','revoke alliance_control_anchor_writer from anon granted by supabase_admin;'],
   ['grant anon to alliance_control_reader with inherit false, set false granted by supabase_admin;','revoke anon from alliance_control_reader granted by supabase_admin;'],
   ['grant usage on schema auth to alliance_control_reader;','revoke usage on schema auth from alliance_control_reader;'],
   ['grant select(id) on auth.users to alliance_control_operator;','revoke select(id) on auth.users from alliance_control_operator;'],
   ['grant usage on sequence auth.fixture_labels_id_seq to alliance_control_anchor_writer;','revoke usage on sequence auth.fixture_labels_id_seq from alliance_control_anchor_writer;'],
   ['alter role alliance_control_owner login;','alter role alliance_control_owner nologin;'],
   ['create schema alliance_account;','drop schema alliance_account;'],
   ['create table public.unreviewed(id integer);','drop table public.unreviewed;'],
   ['alter schema storage owner to fixture_root;','alter schema storage owner to supabase_admin;'],
   ['grant execute on function alliance_control.advance_anchor(text,text,uuid,integer,text,integer,text,jsonb) to alliance_control_reader;','revoke execute on function alliance_control.advance_anchor(text,text,uuid,integer,text,integer,text,jsonb) from alliance_control_reader;'],
   ['grant select(revision) on alliance_control.policy to alliance_control_reader;','revoke select(revision) on alliance_control.policy from alliance_control_reader;'],
   ['grant execute on function alliance_control.transition_startup_only(text,text,uuid,integer,text,uuid,jsonb,jsonb) to alliance_control_operator;','revoke execute on function alliance_control.transition_startup_only(text,text,uuid,integer,text,uuid,jsonb,jsonb) from alliance_control_operator;'],
   ['alter function alliance_control.read_policy(text,text,uuid) rename to fixture_missing_policy;','alter function alliance_control.fixture_missing_policy(text,text,uuid) rename to read_policy;']
  ]){root(change);try{await assert.rejects(reader.read());await assert.rejects(writer.advance({expected:through,through,records}),e=>e.outcome==='not_started');}finally{root(undo);}assert.deepEqual(await reader.read(),policy);}
  console.log('PASS fourteen real managed role/namespace/table/column/sequence/function/owner drifts refuse read and write before dispatch; exact repairs retain original policy');
  for(const role of ['alliance_control_reader','alliance_control_anchor_writer']){
   const pool=d.openPool({...cfg,user:role});pools.push(pool);
   for(const sql of ['select * from auth.users','select * from storage.objects','select * from alliance_control.policy','set role alliance_control_owner','set role postgres'])await assert.rejects(pool.query(sql),e=>e.code==='42501');
  }
  console.log('PASS both real restricted roles denied managed Auth/Storage, direct control tables and SET ROLE owner/administrator');
  const nextRecords=chain([event(),event({id:other})]),next={sequence:2,sha256:nextRecords[1].sha256};
  const post=await open({anchor:true,writer:true,afterCommit:()=>root('grant usage on schema storage to alliance_control_anchor_writer;')});
  try{await assert.rejects(post.advance({expected:through,through:next,records:nextRecords}),e=>e.outcome==='unknown');}finally{root('revoke usage on schema storage from alliance_control_anchor_writer;');}
  assert.equal((await anchor.read()).sequence,2);
  console.log('PASS actual post-COMMIT grant drift withholds anchor write evidence as unknown; independent read proves single committed effect');
 }finally{
  for(const store of stores)await store.close();for(const pool of pools)if(!pool.ended)await pool.end();
  try{root("do $$ begin if exists(select 1 from pg_roles where rolname='alliance_control_reader') then alter role alliance_control_reader nologin password null;alter role alliance_control_operator nologin password null;alter role alliance_control_anchor_writer nologin password null;end if;end $$;");}finally{await d.close();}
 }
 console.log('PASS exact managed control fixture, synthetic credentials and cluster removed; no hosted compatibility acceptance claimed');
}
