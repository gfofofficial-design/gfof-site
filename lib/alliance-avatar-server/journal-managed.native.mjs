// Guarded disposable PostgreSQL only. No hosted target or actual credential.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {secondCreationFixture} from './creation-second-fixture.mjs';
import {managedJournalExtensionSql,managedJournalClosedInspectionSql,journalManagedBoundarySql,managedJournalReaderExtensionSql,managedJournalReaderInspectionSql} from './journal-managed-install.mjs';
import {createDeletionJournalStore,createJournalAuthorityReader} from './journal-store.mjs';
import {removalEvents} from './removal.mjs';
import {projectRef,epoch,profileId,other,zero} from './deletion-journal.fixture.mjs';
export async function journalManagedNative({secondOptions}){
 const d=await secondCreationFixture({...secondOptions,purpose:'control'}),stores=[];
 const root=q=>d.admin(q,'fixture_root');
 const boundary=stage=>assert.match(d.admin(`select ${journalManagedBoundarySql(stage)} as verified;`),/\bt\b/);
 const noSet=()=>assert.match(d.admin("select not pg_has_role('postgres','alliance_journal_owner','SET') as removed;"),/\bt\b/);
 try{
  d.admin('create role fixture_root login superuser;set session authorization fixture_root;alter role postgres rename to supabase_admin;create role postgres login inherit nosuperuser createdb createrole noreplication bypassrls;grant create on database postgres to postgres;');
  root("create role anon nologin;create role authenticated nologin;create role service_role nologin;create schema auth authorization supabase_admin;create schema storage authorization supabase_admin;create table auth.users(id uuid);create table auth.identities(id uuid);create table storage.objects(id uuid);create table storage.buckets(id text);grant usage,create on schema public to postgres;revoke create on schema public from public;set role supabase_admin;grant pg_read_all_data to postgres with admin true,inherit true,set true;reset role;");
  let base=readFileSync(new URL('../../sql/alliance-deletion-journal-store-candidate.sql',import.meta.url),'utf8');
  base=base.replace('create schema alliance_journal authorization alliance_journal_owner;','grant alliance_journal_owner to postgres with inherit false,set true;create schema alliance_journal authorization alliance_journal_owner;set local role alliance_journal_owner;');
  d.admin('begin;'+base+'revoke alliance_journal_owner from postgres granted by postgres;commit;');
  boundary('base');noSet();
  console.log('PASS original source-generated managed journal catalogue, private ACLs, locked roles and exact administrator creator edges match fixed baseline');
  const sql=managedJournalExtensionSql();
  root(`update alliance_journal.control set project_ref='${projectRef}',epoch='${epoch}';`);
  assert.throws(()=>d.admin(sql),e=>String(e.stderr).includes('Empty closed journal required'));noSet();
  root('update alliance_journal.control set project_ref=null,epoch=null;');boundary('base');
  root(`insert into auth.users values('${other}');`);
  assert.throws(()=>d.admin(sql),e=>String(e.stderr).includes('Managed journal extension preflight refused'));noSet();
  root(`delete from auth.users where id='${other}';`);boundary('base');
  root('grant select on alliance_journal.entries to authenticated;');
  assert.throws(()=>d.admin(sql),e=>String(e.stderr).includes('Managed journal extension preflight refused'));
  root('revoke select on alliance_journal.entries from authenticated;');boundary('base');
  root('grant usage on schema alliance_journal to fixture_root;');
  assert.throws(()=>d.admin(sql),e=>String(e.stderr).includes('Managed journal extension preflight refused'));
  root('revoke usage on schema alliance_journal from fixture_root;');boundary('base');
  console.log('PASS configured/nonempty-domain and API-readable baseline refusals preserve original journal and remove temporary SET access');
  for(const injection of [
   'grant execute on function alliance_journal.append_unreserved(text,uuid,integer,text,jsonb) to alliance_journal_executor;',
   'grant select on alliance_journal.admissions to authenticated;',
   'alter table alliance_journal.admissions disable row level security;',
   'alter table alliance_journal.admissions add column unexpected text;',
   'grant select(event_id) on alliance_journal.admissions to fixture_root;',
   'update alliance_journal.control set admission_enabled=true;',
  ]){
   const bad=sql.replace('REVOKE alliance_journal_owner FROM postgres GRANTED BY postgres;',`SET LOCAL ROLE alliance_journal_owner;${injection}RESET ROLE;REVOKE alliance_journal_owner FROM postgres GRANTED BY postgres;`);
   assert.throws(()=>d.admin(bad),e=>String(e.stderr).includes('Managed journal extension verification refused'));
   boundary('base');noSet();
  }
  console.log('PASS final helper-bypass/API grant, RLS and table-shape faults atomically roll back admissions, control column, rename and all new functions');
  d.admin(sql);boundary('extended');noSet();
  assert.match(d.admin(managedJournalClosedInspectionSql()),/"closed": true/);noSet();
  assert.match(root("select count(*) from pg_authid where rolname in('alliance_journal_owner','alliance_journal_executor') and not rolcanlogin and rolpassword is null;"),/\n\s*2\s*\n/);
  root('update alliance_journal.control set admission_enabled=true;');
  assert.throws(()=>d.admin(managedJournalClosedInspectionSql()),e=>String(e.stderr).includes('Empty closed journal required'));noSet();
  root('update alliance_journal.control set admission_enabled=false;');boundary('extended');
  assert.throws(()=>d.admin(sql),e=>String(e.stderr).includes('Managed journal extension preflight refused'));boundary('extended');noSet();
  console.log('PASS managed extension/rollback-only inspection leave both roles password-free/locked, both switches off and unconfigured genesis; failed inspection and repeat installation preserve state');
  const readerSql=managedJournalReaderExtensionSql();
  for(const [injection,asOwner] of [
   ['grant execute on function alliance_journal.append(text,uuid,integer,text,jsonb) to alliance_journal_reader;',true],
   ['grant select(event_id) on alliance_journal.entries to alliance_journal_reader;',true],
   ['alter role alliance_journal_reader login;',false],
   ['grant alliance_journal_executor to alliance_journal_reader;',false],
  ]){
   // Deliberate fault injection through the fixture's actual administrator/owner.
   const marker=asOwner?'RESET ROLE;':'GRANT alliance_journal_owner TO postgres WITH INHERIT false, SET true;';
   const bad=readerSql.replace(marker,injection+marker);
   assert.throws(()=>d.admin(bad),e=>String(e.stderr).includes('Managed journal reader verification refused'));
   assert.match(root("select to_regrole('alliance_journal_reader') is null;"),/\bt\b/);boundary('extended');noSet();
  }
  d.admin(readerSql);boundary('authority-reader');noSet();
  assert.match(d.admin(managedJournalReaderInspectionSql()),/\bt\b/);
  assert.throws(()=>d.admin(readerSql),e=>String(e.stderr).includes('Managed journal reader preflight refused'));
  boundary('authority-reader');noSet();
  console.log('PASS locked reader adds exactly schema USAGE/tip/records; write/column/LOGIN/membership faults roll back the whole role and grants, independent read-only inspection and repeat refusal pass');
  const password='synthetic-journal-extension-'+randomUUID();
  root(`update alliance_journal.control set project_ref='${projectRef}',epoch='${epoch}',enabled=true,admission_enabled=true;alter role alliance_journal_executor login password '${password}';alter role alliance_journal_reader login password '${password}';`);
  const store=await createDeletionJournalStore({enabled:true,projectRef,epoch,connection:{...d.connection,password},openPool:d.openPool});stores.push(store);
  const event=removalEvents({format:1,kind:'profile',operationId:other,profileId,version:0,objectIds:[]})[0];
  assert.deepEqual(await store.admit(event),{state:'admitted',event});
  assert.deepEqual(await store.admission(event),{state:'admitted',event});
  assert.equal((await store.recoveryInventory()).tables.find(t=>t.table==='alliance_journal.admissions').rows,1);
  root('update alliance_journal.control set admission_enabled=false;');
  assert.equal((await store.append({expected:{sequence:0,sha256:zero},event})).state,'recorded');
  assert.deepEqual(await store.admission(event),{state:'removed'});
  const inventory=await store.recoveryInventory();assert.equal(inventory.sequence,1);assert.equal(inventory.tables.find(t=>t.table==='alliance_journal.entries').rows,1);
  const reader=await createJournalAuthorityReader({enabled:true,projectRef,journalProjectRef:d.connection.host.split('.')[1],epoch,connection:{...d.connection,password},openPool:d.openPool});stores.push(reader);
  assert.deepEqual(Object.keys(reader).sort(),['close','records','tip']);
  const readTip=await reader.tip();assert.equal(readTip.sequence,1);
  assert.equal((await reader.records({sequence:readTip.sequence,sha256:readTip.sha256})).length,1);
  assert.throws(()=>root(`set role alliance_journal_reader;select alliance_journal.append('${projectRef}','${epoch}',0,'${zero}','${JSON.stringify(event)}'::jsonb);`),e=>String(e.stderr).includes('permission denied'));
  root('grant execute on function alliance_journal.append(text,uuid,integer,text,jsonb) to alliance_journal_reader;');
  await assert.rejects(reader.tip(),/alliance_journal_unavailable/);
  root('revoke execute on function alliance_journal.append(text,uuid,integer,text,jsonb) from alliance_journal_reader;');
  assert.equal((await reader.tip()).sequence,1);
  root('grant select(event_id) on alliance_journal.entries to alliance_journal_reader;');
  await assert.rejects(reader.tip(),/alliance_journal_unavailable/);
  root('revoke select(event_id) on alliance_journal.entries from alliance_journal_reader;');
  assert.equal((await reader.tip()).sequence,1);
  console.log('PASS real restricted reader TLS tip/history and SQL write denial; extra function or column authority is detected before dispatch, current executor still works');
  assert.throws(()=>root(`set role alliance_journal_executor;select alliance_journal.append_unreserved('${projectRef}','${epoch}',0,'${zero}','${JSON.stringify(event)}'::jsonb);`));
  console.log('PASS real restricted TLS admission, independent read/inventory and later removal after new admission closes; direct unreserved append stays denied');
 }finally{for(const store of stores)await store.close();await d.close();}
}
