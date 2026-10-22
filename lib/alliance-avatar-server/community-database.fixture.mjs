// Literal disposable managed-role model. No endpoint or secret input.
import {managedMemberInstallSql} from './member-managed-install.mjs';
export function prepareCommunityMemberFixture(d){
 if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture')throw Error('Wrong community fixture');
 d.admin('create role fixture_root login superuser;set session authorization fixture_root;alter role postgres rename to supabase_admin;create role postgres login inherit nosuperuser createdb createrole noreplication bypassrls;grant create on database postgres to postgres;');
 d.admin(`create role anon nologin;create role authenticated nologin;create role service_role nologin;
  create schema auth authorization supabase_admin;create schema storage authorization supabase_admin;
  create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean,deleted_at timestamptz,banned_until timestamptz);
  create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);create table auth.identities(id uuid);
  create table storage.objects(id uuid);create table storage.buckets(id text);
  grant usage on schema auth,storage to postgres;grant select on auth.users,auth.sessions,auth.identities,storage.objects,storage.buckets to postgres;grant references(id) on auth.users to postgres;
  grant usage,create on schema public to postgres with grant option;revoke create on schema public from public;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  set role supabase_admin;grant pg_read_all_data to postgres with admin true,inherit true,set true;reset role;`,'fixture_root');
 d.admin(managedMemberInstallSql());
}
