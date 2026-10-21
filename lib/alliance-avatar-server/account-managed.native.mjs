// Confirmed disposable fixture only. This reproduces PostgreSQL creator grants
// and a SMALL managed-schema shape, not Supabase's full platform/extension image.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {secondCreationFixture} from './creation-second-fixture.mjs';
import {managedAccountInstallSql} from './account-managed-install.mjs';
import {accountContractSQL,verifyAccountContract} from './account-contract.mjs';
import {createAccountHistoryStore,createAccountAckStore} from './account-store.mjs';
import {accountSubject,accountEvent} from './account-history.mjs';
export async function accountManagedNative({secondOptions}){
 if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture')throw Error('Wrong managed account fixture');
 const domains=[],stores=[],scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',epoch:randomUUID()},controlProjectRef='opqrstuvwxyzabcdefgh',zero={sequence:0,sha256:'0'.repeat(64)},password='synthetic-managed-'+randomUUID();
 const root=(d,sql)=>d.admin(sql,'fixture_root');
 const open=async(d,domain,{profile='supabase-managed',writer=true,afterCommit}={})=>{
  const factory=domain==='history'?createAccountHistoryStore:createAccountAckStore;let changed=false;
  const store=await factory({enabled:true,writeEnabled:writer,deploymentProfile:profile,...scope,controlProjectRef,connection:{...d.connection,password},openPool:config=>{
   const p=d.openPool(config);if(!afterCommit)return p;
   return {on:p.on.bind(p),end:p.end.bind(p),async connect(){const c=await p.connect();return {once:c.once.bind(c),removeListener:c.removeListener.bind(c),release:c.release.bind(c),async query(q){const result=await c.query(q);if(q.text==='COMMIT'&&!changed){changed=true;afterCommit();}return result;}};}};
  }});stores.push(store);return store;
 };
 try{
  for(const [purpose,domain] of [['journal','history'],['control','ack']]){
   const d=await secondCreationFixture({...secondOptions,purpose});domains.push(d);d.domain=domain;
   // Give the bootstrap OID its actual managed-provider name, then install as
   // a separate nonsuperuser postgres. All setup remains inside this fixture.
   d.admin('create role fixture_root login superuser;set session authorization fixture_root;alter role postgres rename to supabase_admin;create role postgres login noinherit nosuperuser createdb createrole noreplication nobypassrls;grant create on database postgres to postgres;');
   root(d,"create role anon nologin;create role authenticated nologin;create role service_role nologin;create role supabase_auth_admin nologin;create role supabase_storage_admin nologin;create schema auth authorization supabase_admin;create schema storage authorization supabase_admin;create table auth.users(id uuid);create table auth.identities(id uuid);create table auth.fixture_labels(id bigint generated always as identity primary key);create table storage.objects(id uuid);create table storage.buckets(id text);grant usage on schema auth,storage to postgres;grant select on auth.users,auth.identities,storage.objects,storage.buckets to postgres;revoke create on schema public from public;");
   root(d,"insert into auth.users values('00000000-0000-4000-8000-000000000001');");assert.throws(()=>d.admin(managedAccountInstallSql(domain)));assert.match(root(d,"select to_regnamespace('alliance_account') is null as absent;"),/\bt\b/);root(d,'truncate auth.users;');
   console.log('PASS managed installer rejects existing Auth data transactionally without roles/schema, using nonsuperuser postgres');
   root(d,'alter schema auth owner to fixture_root;');assert.throws(()=>d.admin(managedAccountInstallSql(domain)));assert.match(root(d,"select (to_regnamespace('alliance_account') is null and not exists(select 1 from pg_roles where rolname like 'alliance_account_%')) as clean;"),/\bt\b/);root(d,'alter schema auth owner to supabase_admin;');
   console.log('PASS final managed baseline refusal rolls back schema, functions and all four created roles including temporary grants');
   d.admin(managedAccountInstallSql(domain));
   assert.match(root(d,"select count(*) from pg_auth_members m join pg_roles r on r.oid=m.roleid where r.rolname like 'alliance_account_%' and pg_get_userbyid(m.grantor)='supabase_admin' and pg_get_userbyid(m.member)='postgres' and m.admin_option and not m.set_option and not m.inherit_option;"),/\n\s*4\s*\n/);
   assert.match(d.admin("select pg_has_role('postgres','alliance_account_owner','SET') as can_set;"),/\bf\b/);
   assert.match(root(d,"select count(*) from pg_authid where rolname like 'alliance_account_%' and not rolcanlogin and rolpassword is null;"),/\n\s*4\s*\n/);
   console.log('PASS managed installer retains exactly four bootstrap ADMIN-only edges, removes temporary SET and leaves all roles locked/password-free');
   root(d,`alter role alliance_account_reader login password '${password}';alter role alliance_account_writer login password '${password}';alter role alliance_account_operator login password '${password}';`);
   const cfg={host:d.connection.host,database:'postgres',user:'alliance_account_operator',password,ssl:{ca:d.connection.ca,rejectUnauthorized:true,servername:d.connection.host},options:'-c search_path=pg_catalog'};d.operator=d.openPool(cfg);
   const name=domain==='history'?'history':'ack';await d.operator.query(`select alliance_account.${name}_bootstrap($1::jsonb)`,[JSON.stringify(scope)]);await d.operator.query(`select alliance_account.${name}_mode($1::jsonb,true${domain==='history'?',true':''})`,[JSON.stringify(scope)]);
   const client=d.openPool({...cfg,user:'alliance_account_reader'}),catalogue=await client.query(accountContractSQL('supabase-managed'));assert.equal(verifyAccountContract(catalogue.rows[0].contract,domain,'supabase-managed'),true);
   const strict=await open(d,domain,{profile:'strict'});await assert.rejects(domain==='history'?strict.snapshot():strict.read(),e=>e.outcome==='not_started');
   d.store=await open(d,domain);assert.ok(domain==='history'?await d.store.snapshot():await d.store.read());
   console.log('PASS actual managed-shape TLS catalogue passes only explicit profile; unchanged strict profile refuses schema/membership shape');
  }
  const [h,a]=domains,event=accountEvent({kind:'account_admitted',subject:accountSubject({memberProjectRef:scope.memberProjectRef,epoch:scope.epoch,authUserId:randomUUID()})});
  assert.equal((await h.store.append({event,expected:zero})).state,'recorded');const snapshot=await h.store.snapshot();assert.equal((await a.store.advance({records:snapshot.records,head:snapshot.head,expected:zero})).state,'acknowledged');
  console.log('PASS real managed-profile append and separate acknowledgement commit/readback preserve canonical account history');
  for(const [change,undo] of [
   ['grant alliance_account_writer to postgres with admin true, inherit false, set true granted by supabase_admin;','grant alliance_account_writer to postgres with admin true, inherit false, set false granted by supabase_admin;'],
   ['grant alliance_account_writer to anon with inherit false, set false granted by supabase_admin;','revoke alliance_account_writer from anon granted by supabase_admin;'],
   ['grant anon to alliance_account_reader with inherit false, set false granted by supabase_admin;','revoke anon from alliance_account_reader granted by supabase_admin;'],
   ['grant usage on schema auth to alliance_account_reader;','revoke usage on schema auth from alliance_account_reader;'],
   ['grant select(id) on auth.users to alliance_account_reader;','revoke select(id) on auth.users from alliance_account_reader;'],
   ['grant usage on sequence auth.fixture_labels_id_seq to alliance_account_reader;','revoke usage on sequence auth.fixture_labels_id_seq from alliance_account_reader;'],
   ['create table public.unreviewed(id integer);','drop table public.unreviewed;'],
   ['alter schema auth owner to fixture_root;','alter schema auth owner to supabase_admin;'],
   ['alter table alliance_account.history_control alter column sequence set default 1;','alter table alliance_account.history_control alter column sequence set default 0;'],
   ['alter policy owner_only on alliance_account.entries using(false);','alter policy owner_only on alliance_account.entries using(true);']
  ]){root(h,change);try{await assert.rejects(h.store.snapshot(),e=>e.outcome==='not_started');}finally{root(h,undo);}assert.equal((await h.store.snapshot()).head.sequence,1);console.log('PASS managed-profile persistent grant/schema/public-object drift refuses before dispatch; exact fixture repair restores service');}
  const post=await open(a,'ack',{afterCommit:()=>root(a,'grant usage on schema storage to alliance_account_writer;')});
  try{await assert.rejects(post.advance({records:snapshot.records,head:snapshot.head,expected:snapshot.head}),e=>e.outcome==='unknown');}finally{root(a,'revoke usage on schema storage from alliance_account_writer;');}
  assert.deepEqual(await a.store.read(),snapshot.head);console.log('PASS managed grant drift after real COMMIT withholds evidence/returns unknown; independent unchanged acknowledgement remains readable');
 }finally{
  for(const store of stores)await store.close();
  for(const d of domains){try{root(d,"do $$ begin if to_regnamespace('alliance_account') is not null then alter role alliance_account_reader nologin password null;alter role alliance_account_writer nologin password null;alter role alliance_account_operator nologin password null;end if;end $$;");}finally{await d.close();}}
 }
 console.log('PASS exact two synthetic managed-shape clusters, temporary test logins and directories removed; no hosted platform acceptance claimed');
}
