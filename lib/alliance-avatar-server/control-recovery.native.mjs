// Actual synthetic schema+data restore, not a production backup/restore tool.
// Global roles are deliberately preserved and locked, never imported from a dump.
import assert from 'node:assert/strict';
import {fixtureArchive} from './recovery-archive.fixture.mjs';
export function controlRecoveryNative({target,admin,scope,policy,anchor}){
 if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture')throw Error('Wrong control recovery fixture');
 const roles="'alliance_control_owner','alliance_control_reader','alliance_control_operator','alliance_control_anchor_writer'";
 const parse=text=>text.split('\n').map(x=>x.trim()).find(x=>/^[0-9a-f]{64}$/.test(x));
 const catalog=()=>parse(admin(`select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(jsonb_build_object(
 'tables',(select jsonb_agg(jsonb_build_array(c.relname,r.rolname,c.relrowsecurity,c.relforcerowsecurity) order by c.relname) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace join pg_catalog.pg_roles r on r.oid=c.relowner where n.nspname='alliance_control' and c.relkind='r'),
 'functions',(select jsonb_agg(jsonb_build_array(p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid),r.rolname,p.prosecdef,p.proconfig,pg_catalog.pg_get_functiondef(p.oid)) order by p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid)) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace join pg_catalog.pg_roles r on r.oid=p.proowner where n.nspname='alliance_control'),
 'policies',(select jsonb_agg(jsonb_build_array(tablename,policyname,permissive,roles,cmd,qual,with_check) order by tablename,policyname) from pg_catalog.pg_policies where schemaname='alliance_control'),
 'constraints',(select jsonb_agg(jsonb_build_array(c.relname,k.conname,pg_catalog.pg_get_constraintdef(k.oid)) order by c.relname,k.conname) from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.conrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='alliance_control')
 )::text,'UTF8')),'hex');`));
 const grants=()=>parse(admin(`select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(jsonb_build_object(
 'schema',(select jsonb_agg(jsonb_build_array(r.rolname,has_schema_privilege(r.rolname,'alliance_control','USAGE'),has_schema_privilege(r.rolname,'alliance_control','CREATE')) order by r.rolname) from pg_catalog.pg_roles r where r.rolname in(${roles},'anon','authenticated','service_role')),
 'functions',(select jsonb_agg(jsonb_build_array(r.rolname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid),has_function_privilege(r.rolname,p.oid,'EXECUTE')) order by r.rolname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid)) from pg_catalog.pg_roles r cross join pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where r.rolname in(${roles},'anon','authenticated','service_role') and n.nspname='alliance_control'),
 'tables',(select jsonb_agg(jsonb_build_array(r.rolname,c.relname,k,has_table_privilege(r.rolname,c.oid,k)) order by r.rolname,c.relname,k) from pg_catalog.pg_roles r cross join pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) k where r.rolname in(${roles},'anon','authenticated','service_role') and n.nspname='alliance_control' and c.relkind='r')
 )::text,'UTF8')),'hex');`));
 const globals=()=>admin(`select rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication,rolinherit,rolconnlimit,rolconfig from pg_catalog.pg_roles where rolname in(${roles}) order by rolname;`);
 const data=()=>JSON.parse(admin(`select jsonb_build_object('policy',alliance_control.read_policy('${scope.memberProjectRef}','${scope.journalProjectRef}','${scope.epoch}'),'anchor',alliance_control.read_anchor('${scope.memberProjectRef}','${scope.journalProjectRef}','${scope.epoch}'));`).split('\n').map(x=>x.trim()).find(x=>x.startsWith('{')));
 const before={catalog:catalog(),grants:grants(),globals:globals(),data:data()};
 assert.match(before.catalog,/^[0-9a-f]{64}$/);assert.match(before.grants,/^[0-9a-f]{64}$/);assert.deepEqual(before.data,{policy,anchor});assert.equal(policy.state,'closed');
 const archive=fixtureArchive({domain:'control',mode:'schema-and-data',...target});
 try{
  admin('grant alliance_control_reader to alliance_control_operator;');try{assert.throws(()=>archive.dump());}finally{admin('revoke alliance_control_reader from alliance_control_operator;');}
  admin('alter role alliance_control_reader login;');try{assert.throws(()=>archive.dump());}finally{admin('alter role alliance_control_reader nologin;');}
  const handle=archive.dump();assert.deepEqual(handle.tables,['alliance_control.policy','alliance_control.removal_anchor']);assert.equal(handle.mode,'schema-and-data');assert.ok(handle.toc.some(x=>x.includes('FUNCTION ')));assert.ok(handle.toc.some(x=>x.includes('POLICY ')));assert.ok(handle.toc.some(x=>x.includes('ACL ')));
  assert.throws(()=>archive.dump());assert.throws(()=>archive.restore({...handle}));assert.throws(()=>archive.restore(handle));assert.deepEqual(data(),before.data);
  console.log('PASS control custom archive includes both tables, functions, forced-RLS policies, owners and ACLs; unexpected memberships, one-shot handle and empty-target/locked-role guards reject unsafe restore');
  admin('begin;drop schema alliance_control cascade;commit;');
  // Failure is deliberately after CREATE SCHEMA/functions/first table. A single
  // transaction must remove all partial DDL, not just roll back the row inserts.
  admin("create function public.synthetic_control_restore_stop() returns event_trigger language plpgsql as $$ begin if pg_catalog.to_regclass('alliance_control.policy') is not null then raise exception 'Synthetic mid-restore interruption';end if;end $$;create event trigger synthetic_control_restore_stop on ddl_command_start when tag in('CREATE TABLE') execute function public.synthetic_control_restore_stop();");
  try{assert.throws(()=>archive.restore(handle));assert.match(admin("select pg_catalog.to_regnamespace('alliance_control') is null as empty;"),/\n\s*t\s*\n/);assert.equal(globals(),before.globals);}finally{admin('drop event trigger synthetic_control_restore_stop;drop function public.synthetic_control_restore_stop();');}
  console.log('PASS injected mid-restore DDL failure rolls back the entire control schema, preserves locked global roles and leaves an empty target for a separate explicit restore');
  archive.restore(handle);assert.deepEqual(data(),before.data);
  console.log('PASS actual control schema drop and single-transaction restore recover exact closed policy revision and later acknowledged removal anchor without genesis reset');
  assert.equal(catalog(),before.catalog);assert.equal(grants(),before.grants);assert.equal(globals(),before.globals);
  assert.match(admin("select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='alliance_control' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity;"),/\n\s*2\s*\n/);
  console.log('PASS restored control function definitions/owners/search paths, constraints, effective schema/function/table permissions and forced RLS match the source; global roles remain unchanged and locked');
 }finally{archive.close();}
 console.log('PASS exact synthetic control archive removed; no real data, encryption key, hosted restore, Auth or Storage recovery is claimed');
}
