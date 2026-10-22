// Disposable PostgreSQL managed-role fixture. Never accepts a hosted target.
import assert from 'node:assert/strict';
import {secondCreationFixture} from './creation-second-fixture.mjs';
import {managedMemberInstallSql,managedMemberClosedInspectionSql} from './member-managed-install.mjs';
import {createAvatarLedger} from './ledger.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {MANAGED_SESSION_GUARD_BODY} from './member-managed-auth.mjs';
import {creationEvent} from './creation.mjs';
import {managedMemberDiagnosticSql} from './member-managed-diagnostic.mjs';
export async function memberManagedNative({secondOptions}){
  const d=await secondCreationFixture({...secondOptions,purpose:'control'});
  const root=sql=>d.admin(sql,'fixture_root');
  const actor='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222';
  const stores=[];
  try{
    d.admin('create role fixture_root login superuser;set session authorization fixture_root;alter role postgres rename to supabase_admin;create role postgres login noinherit nosuperuser createdb createrole noreplication bypassrls;grant create on database postgres to postgres;');
    root(`create role anon nologin;create role authenticated nologin;create role service_role nologin;
      create schema auth authorization supabase_admin;create schema storage authorization supabase_admin;
      create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean,deleted_at timestamptz,banned_until timestamptz);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
      create table auth.identities(id uuid);create table storage.objects(id uuid);create table storage.buckets(id text);
      grant usage on schema auth to postgres,anon,authenticated,service_role;
      grant select on auth.users,auth.sessions,auth.identities to postgres;grant references(id) on auth.users to postgres;
      grant usage,create on schema public to postgres with grant option;revoke create on schema public from public;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      insert into auth.users values('${actor}',clock_timestamp(),false,null,null);insert into auth.sessions values('${session}','${actor}',null);`);
    assert.match(d.admin("select has_schema_privilege(current_user,'auth','USAGE WITH GRANT OPTION') as may_grant;"),/\bf\b/);
    // Model the actual hosted postgres defaults, rather than an empty PostgreSQL
    // default-ACL catalogue. Never change a hosted default privilege here.
    d.admin('alter default privileges in schema public grant all on tables to anon,authenticated,service_role;alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;');
    const diagnostic=sql=>{let detail;assert.throws(()=>d.admin(sql),e=>{if(!String(e.stderr).includes('Managed member rollback-only diagnostic'))return false;const line=String(e.stderr).match(/^DETAIL:\s+(\{.*\})$/m);if(!line)return false;detail=JSON.parse(line[1]);return true;});return detail;};
    const clean=()=>assert.match(root("select to_regnamespace('alliance_avatar') is null and to_regnamespace('alliance_auth_gate') is null and not exists(select 1 from pg_roles where rolname like 'alliance_avatar_%') and (select count(*) from auth.users)=1 as clean;"),/\bt\b/);
    const baseline=diagnostic(managedMemberDiagnosticSql());assert.equal(Object.keys(baseline.checks).length,15);assert.ok(Object.values(baseline.checks).every(v=>v===true));for(const key of ['roles_locked','temporary_set_removed','temporary_schema_access_removed','auth_counts_unchanged'])assert.equal(baseline[key],true);assert.deepEqual(baseline.verifier,{owner:'postgres',securityDefiner:true,returns:'void',settings:['search_path=""'],bodySha256:createHash('sha256').update(MANAGED_SESSION_GUARD_BODY).digest('hex')});clean();
    const changed=diagnostic(managedMemberDiagnosticSql().replace('DO $diagnostic$',"grant execute on function public.alliance_my_profile() to authenticated;\nDO $diagnostic$"));assert.equal(changed.checks.public_function_access_closed,false);assert.ok(Object.entries(changed.checks).every(([k,v])=>k==='public_function_access_closed'||v===true));clean();
    console.log('PASS rollback-only diagnostic reports fifteen fixed predicates plus cleanup booleans, isolates an injected API grant, and always removes all new objects under modeled provider defaults');
    const bad=managedMemberInstallSql().replace('begin\n  if p_actor is null','begin\n  if false and p_actor is null');
    assert.throws(()=>d.admin(bad),e=>String(e.stderr).includes('Managed member installed state refused'));
    assert.match(root("select to_regnamespace('alliance_avatar') is null and to_regnamespace('alliance_auth_gate') is null and not exists(select 1 from pg_roles where rolname like 'alliance_avatar_%') and (select count(*) from auth.users)=1 as clean;"),/\bt\b/);
    console.log('PASS managed member final verification rolls back all fourteen extensions/roles and preserves existing Auth account');
    d.admin(managedMemberInstallSql());
    assert.match(d.admin(managedMemberClosedInspectionSql()),/"closed": true/);
    assert.match(d.admin("select not pg_has_role('postgres','alliance_avatar_owner','SET') as inspection_rolled_back;"),/\bt\b/);
    root('update alliance_avatar.control set enabled=true;');
    assert.throws(()=>d.admin(managedMemberClosedInspectionSql()),e=>String(e.stderr).includes('Managed member is not closed'));
    assert.match(d.admin("select not pg_has_role('postgres','alliance_avatar_owner','SET') as failed_inspection_rolled_back;"),/\bt\b/);
    root('update alliance_avatar.control set enabled=false;');
    assert.match(root("select count(*) from pg_authid where rolname in('alliance_avatar_owner','alliance_avatar_executor') and not rolcanlogin and rolpassword is null;"),/\n\s*2\s*\n/);
    assert.match(d.admin("select not pg_has_role('postgres','alliance_avatar_owner','SET') and not has_schema_privilege('alliance_avatar_owner','auth','USAGE') as isolated;"),/\bt\b/);
    root(`set role alliance_avatar_owner;select alliance_avatar.require_account_session('${actor}','${session}');select alliance_avatar.require_removal_session('${actor}','${session}');reset role;`);
    assert.throws(()=>root('set role alliance_avatar_owner;select id from auth.users;'));
    for(const role of ['anon','authenticated','service_role','alliance_avatar_executor'])assert.throws(()=>root(`set role ${role};select alliance_auth_gate.require_current_session('${actor}','${session}');`));
    console.log('PASS actual managed owner verifies only the fixed current-session predicate without direct Auth grants; API/executor roles cannot call verifier');
    const password='synthetic-member-'+randomUUID();
    root(`alter role alliance_avatar_executor login password '${password}';update alliance_avatar.control set enabled=true;`);
    const open=async profile=>{const store=await createAvatarLedger({enabled:true,deploymentProfile:profile,connection:{...d.connection,password},openPool:d.openPool});stores.push(store);return store;};
    const strict=await open('strict');await assert.rejects(strict.authorizeAccountSession(actor,session));
    const managed=await open('supabase-managed');assert.deepEqual(await managed.authorizeAccountSession(actor,session),{actorId:actor,sessionId:session});
    root('alter role alliance_avatar_owner login;');await assert.rejects(managed.authorizeAccountSession(actor,session));root('alter role alliance_avatar_owner nologin;');
    for(const [grant,revoke]of [
      ['grant select on public.alliance_profiles to authenticated','revoke select on public.alliance_profiles from authenticated'],
      ['grant select(display_name) on public.alliance_profiles to authenticated','revoke select(display_name) on public.alliance_profiles from authenticated'],
      ['grant execute on function public.alliance_my_profile() to authenticated','revoke execute on function public.alliance_my_profile() from authenticated'],
    ]){root(grant+';');await assert.rejects(managed.authorizeAccountSession(actor,session));root(revoke+';');}
    assert.deepEqual(await managed.authorizeAccountSession(actor,session),{actorId:actor,sessionId:session});
    assert.deepEqual(await managed.directorySession(actor,session,null,20),{items:[],next:null});
    root('update alliance_avatar.control set creation_enabled=true,profile_revision_enabled=true;');
    const plan=await managed.prepareProfileSession(actor,session),input={name:'Managed Member',community:'',bio:'Synthetic managed save acceptance.',role:'builder',listed:true};
    const save=(revision,values)=>managed.finishProfileRevisionSession(actor,session,plan,values,creationEvent(plan),randomUUID(),revision);
    assert.equal((await save(0,input)).revision,1);assert.equal((await save(1,{...input,name:'Managed second edit'})).revision,2);
    assert.deepEqual(await save(1,input),{state:'conflict',revision:2});
    assert.equal((await save(2,{...input,listed:false})).profile.publication,'private');
    assert.equal((await managed.profileRevisionReadSession(actor,session)).revision,3);assert.deepEqual(await managed.directorySession(actor,session,null,20),{items:[],next:null});
    const removal=await managed.prepareProfileBoundAnchoredRemovalSession(actor,session,randomUUID(),0,plan.profileId);assert.equal(removal.state,'prepared');
    root(`delete from public.alliance_member_owners where user_id='${actor}';update alliance_avatar.control set creation_enabled=false,profile_revision_enabled=false;`);
    console.log('PASS managed private verifier supports real TLS create/repeat-edit/conflict/unlist and anchored-removal preparation; no direct Auth grant required');
    const a='33333333-3333-4333-8333-333333333333',b='44444444-4444-4444-8444-444444444444';
    root(`insert into auth.users(id,email_confirmed_at,is_anonymous) values
      ('${b}',clock_timestamp(),false),('55555555-5555-4555-8555-555555555555',clock_timestamp(),false),('66666666-6666-4666-8666-666666666666',clock_timestamp(),false);
      insert into public.alliance_member_owners(id,user_id) values ('${a}','${actor}'),('${b}','${b}'),('55555555-5555-4555-8555-555555555555','55555555-5555-4555-8555-555555555555'),('66666666-6666-4666-8666-666666666666','66666666-6666-4666-8666-666666666666');
      insert into public.alliance_profiles(id,display_name,community,bio,contribution_role,listed,moderation_state) values
      ('${a}','Listed One','','A synthetic directory entry.','builder',true,'visible'),
      ('${b}','Listed Two','','A second synthetic directory entry.','researcher',true,'visible'),
      ('55555555-5555-4555-8555-555555555555','Private Member','','A private synthetic entry.','explorer',false,'visible'),
      ('66666666-6666-4666-8666-666666666666','Held Member','','A held synthetic entry.','connector',true,'held');`);
    const first=await managed.directorySession(actor,session,null,1);assert.equal(first.items[0].id,a);assert.equal(first.next,a);
    const second=await managed.directorySession(actor,session,a,1);assert.equal(second.items[0].id,b);assert.equal(second.next,null);
    assert.equal((await managed.directorySession(actor,session,null,20)).items.length,2);
    for(const target of ['public.alliance_profiles','public.alliance_member_owners'])assert.throws(()=>root(`set role authenticated;select * from ${target};`));
    assert.throws(()=>root('set role authenticated;select public.alliance_my_profile();'));
    root('update alliance_avatar.control set enabled=false;alter role alliance_avatar_executor nologin password null;');
    console.log('PASS actual TLS managed driver verifies private Auth, directory visibility/pagination and bootstrap edges; strict/owner-login drift refuse');
    for(const change of ["update auth.users set is_anonymous=true;","update auth.users set deleted_at=clock_timestamp();","update auth.users set banned_until=clock_timestamp()+interval '1 hour';","update auth.users set email_confirmed_at=null;","update auth.sessions set not_after=clock_timestamp()-interval '1 second';"]){
      for(const guard of ['require_account_session','require_removal_session'])assert.throws(()=>root('begin;'+change+`set local role alliance_avatar_owner;select alliance_avatar.${guard}('${actor}','${session}');rollback;`));
    }
    root('delete from auth.sessions;');assert.throws(()=>root(`set role alliance_avatar_owner;select alliance_avatar.require_account_session('${actor}','${session}');`));
    assert.match(root('select not enabled and not creation_enabled and not cleanup_enabled and not profile_revision_enabled as closed from alliance_avatar.control;'),/\bt\b/);
    console.log('PASS revoked/expired/anonymous/deleted/banned/unconfirmed sessions refuse; no member mode, password or real record enabled');
  }finally{for(const store of stores)await store.close();await d.close();}
}
