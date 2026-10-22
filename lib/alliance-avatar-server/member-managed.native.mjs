// Disposable PostgreSQL managed-role fixture. Never accepts a hosted target.
import assert from 'node:assert/strict';
import {secondCreationFixture} from './creation-second-fixture.mjs';
import {managedMemberInstallSql} from './member-managed-install.mjs';
export async function memberManagedNative({secondOptions}){
  const d=await secondCreationFixture({...secondOptions,purpose:'control'});
  const root=sql=>d.admin(sql,'fixture_root');
  const actor='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222';
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
    const bad=managedMemberInstallSql().replace('begin\n  if p_actor is null','begin\n  if false and p_actor is null');
    assert.throws(()=>d.admin(bad));
    assert.match(root("select to_regnamespace('alliance_avatar') is null and to_regnamespace('alliance_auth_gate') is null and not exists(select 1 from pg_roles where rolname like 'alliance_avatar_%') and (select count(*) from auth.users)=1 as clean;"),/\bt\b/);
    console.log('PASS managed member final verification rolls back all thirteen extensions/roles and preserves existing Auth account');
    d.admin(managedMemberInstallSql());
    assert.match(root("select count(*) from pg_authid where rolname in('alliance_avatar_owner','alliance_avatar_executor') and not rolcanlogin and rolpassword is null;"),/\n\s*2\s*\n/);
    assert.match(d.admin("select not pg_has_role('postgres','alliance_avatar_owner','SET') and not has_schema_privilege('alliance_avatar_owner','auth','USAGE') as isolated;"),/\bt\b/);
    root(`set role alliance_avatar_owner;select alliance_avatar.require_account_session('${actor}','${session}');reset role;`);
    assert.throws(()=>root('set role alliance_avatar_owner;select id from auth.users;'));
    for(const role of ['anon','authenticated','service_role','alliance_avatar_executor'])assert.throws(()=>root(`set role ${role};select alliance_auth_gate.require_current_session('${actor}','${session}');`));
    console.log('PASS actual managed owner verifies only the fixed current-session predicate without direct Auth grants; API/executor roles cannot call verifier');
    for(const change of ["update auth.users set is_anonymous=true;","update auth.users set deleted_at=clock_timestamp();","update auth.users set banned_until=clock_timestamp()+interval '1 hour';","update auth.users set email_confirmed_at=null;","update auth.sessions set not_after=clock_timestamp()-interval '1 second';"]){
      assert.throws(()=>root('begin;'+change+`set local role alliance_avatar_owner;select alliance_avatar.require_account_session('${actor}','${session}');rollback;`));
    }
    root('delete from auth.sessions;');assert.throws(()=>root(`set role alliance_avatar_owner;select alliance_avatar.require_account_session('${actor}','${session}');`));
    assert.match(root('select not enabled and not creation_enabled and not cleanup_enabled and not profile_revision_enabled as closed from alliance_avatar.control;'),/\bt\b/);
    console.log('PASS revoked/expired/anonymous/deleted/banned/unconfirmed sessions refuse; no member mode, password or real record enabled');
  }finally{await d.close();}
}
