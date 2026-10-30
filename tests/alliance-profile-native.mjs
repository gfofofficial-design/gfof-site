// Runner-owned disposable PostgreSQL only. No hosted URL, credential or SDK.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const candidate=readFileSync(new URL('../sql/alliance-profile-candidate.sql',import.meta.url),'utf8');
const checks=readFileSync(new URL('./alliance-profile-native.sql',import.meta.url),'utf8');
const sql=`\\set ON_ERROR_STOP on
begin;
set local statement_timeout='8s';
set local lock_timeout='2s';
do $$ begin
  if current_database()<>'federation_alliance_profile_test' or session_user<>'postgres' or current_setting('server_version_num')::integer<>170011 then raise exception 'Only the dedicated PostgreSQL 17.11 fixture is allowed';end if;
  if exists(select 1 from pg_roles where rolname in('anon','authenticated','service_role')) or exists(select 1 from pg_namespace where nspname='auth') then raise exception 'Fixture must be empty';end if;
end $$;
create role anon nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role authenticated nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role service_role nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
revoke create on schema public from public;
grant usage on schema public to anon,authenticated,service_role;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('is_anonymous',nullif(current_setting('request.jwt.claim.is_anonymous',true),'')) $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid(),auth.jwt() to authenticated;
revoke all on auth.users from public,anon,authenticated,service_role;
${candidate}
${checks}
rollback;
do $$ begin
 if exists(select 1 from pg_roles where rolname in('anon','authenticated','service_role')) or exists(select 1 from pg_namespace where nspname='auth') or to_regclass('public.alliance_profiles') is not null then raise exception 'Fixture rollback failed';end if;
 raise notice 'PASS transaction rollback removed fixture roles and tables';
end $$;
`;
if(process.argv.length===3&&process.argv[2]==='--print-sql'){process.stdout.write(sql);}
else{
 if(process.argv.length!==2||process.env.ALLIANCE_PROFILE_TEST_CONFIRM!=='disposable_profile_fixture')throw Error('Explicit disposable fixture confirmation required.');
 const container=process.env.ALLIANCE_PROFILE_TEST_CONTAINER||'';if(!/^[a-f0-9]{12,64}$/.test(container))throw Error('Expected a local test container ID.');
 const config=JSON.parse(execFileSync('docker',['inspect','--format','{{json .Config}}',container],{encoding:'utf8',timeout:10000,maxBuffer:1024*1024}));
 if(config.Image!=='postgres:17.11-bookworm'||!config.Env?.includes('POSTGRES_DB=federation_alliance_profile_test'))throw Error('Container does not match the dedicated profile fixture.');
 execFileSync('docker',['exec','-i','-u','postgres',container,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','federation_alliance_profile_test'],{input:sql,stdio:['pipe','inherit','inherit'],timeout:60000});
}
