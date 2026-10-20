// Guarded disposable PostgreSQL fixture. No hosted URL, credentials or fallback.
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {candidateDDL,SCHEMA,ruleChecks,cases,denied} from './federation-email-signup-candidate.mjs';
const good=`'{"user":{"app_metadata":{"provider":"email","providers":["email"]},"is_anonymous":false,"email":"member@example.invalid","phone":""}}'::jsonb`;
const denial=label=>`do $deny$ begin
 begin perform ${SCHEMA}.email_provider_only(${good});raise exception 'Unexpected hook access';
 exception when insufficient_privilege then raise notice 'PASS ${label} SQLSTATE42501';end;
end $deny$;`;
export function nativeSql(version='170011'){
 if(!['170011','180006'].includes(version))throw Error('Only reviewed disposable PostgreSQL versions.');
 return `\\set ON_ERROR_STOP on
begin;
set local statement_timeout='8s';set local lock_timeout='2s';
do $preflight$ begin
 if current_database()<>'federation_email_signup_native_test' or session_user<>'postgres'
 or current_setting('server_version_num')<>'${version}' then raise exception 'Wrong disposable target';end if;
 if exists(select 1 from pg_roles where rolname in('supabase_auth_admin','anon','authenticated','service_role','federation_signup_outsider'))
 or exists(select 1 from pg_namespace where nspname in('auth','federation_auth_signup','${SCHEMA}'))
 then raise exception 'Fixture must be empty';end if;
end $preflight$;
create role supabase_auth_admin nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role anon nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role authenticated nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role service_role nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role federation_signup_outsider nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
${candidateDDL}
create table ${SCHEMA}.fixture_private(value integer);
revoke all on table ${SCHEMA}.fixture_private from public;
set local role supabase_auth_admin;
do $rights$ begin
 if current_user<>'supabase_auth_admin' or exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication or rolcanlogin))
 or exists(select 1 from pg_auth_members where member=(select oid from pg_roles where rolname=current_user))
 or has_schema_privilege(current_user,'${SCHEMA}','CREATE')
 or has_table_privilege(current_user,'${SCHEMA}.fixture_private','SELECT')
 or (select prosecdef from pg_proc where oid='${SCHEMA}.email_provider_only(jsonb)'::regprocedure)
 or (select proconfig from pg_proc where oid='${SCHEMA}.email_provider_only(jsonb)'::regprocedure) is distinct from array['search_path=""']::text[]
 then raise exception 'Unexpected hook privilege or configuration';end if;
 raise notice 'PASS least privilege and empty search path';
end $rights$;
${ruleChecks}
do $null$ begin if ${SCHEMA}.email_provider_only(null::jsonb) is distinct from '${JSON.stringify(denied)}'::jsonb then raise exception 'SQL NULL must deny';end if;raise notice 'PASS SQL NULL denied';end $null$;
reset role;
${['anon','authenticated','service_role','federation_signup_outsider'].map(role=>`set local role ${role};\n${denial(role)}\nreset role;`).join('\n')}
revoke execute on function ${SCHEMA}.email_provider_only(jsonb) from supabase_auth_admin;
set local role supabase_auth_admin;
${denial('Auth missing EXECUTE')}
reset role;
grant execute on function ${SCHEMA}.email_provider_only(jsonb) to supabase_auth_admin;
revoke usage on schema ${SCHEMA} from supabase_auth_admin;
set local role supabase_auth_admin;
${denial('Auth missing schema USAGE')}
reset role;
grant usage on schema ${SCHEMA} to supabase_auth_admin;
set local role supabase_auth_admin;
do $restored$ begin if ${SCHEMA}.email_provider_only(${good}) is distinct from '{}'::jsonb then raise exception 'Restored grants failed';end if;raise notice 'PASS restored grants';end $restored$;
reset role;
rollback;
do $cleanup$ begin
 if exists(select 1 from pg_namespace where nspname='${SCHEMA}')
 or exists(select 1 from pg_roles where rolname in('supabase_auth_admin','anon','authenticated','service_role','federation_signup_outsider'))
 then raise exception 'Fixture rollback incomplete';end if;
 raise notice 'PASS ${cases.length} rule cases plus SQL NULL, privileges, denials, restored grants and complete rollback';
end $cleanup$;
select current_setting('server_version') as fixture_version;
`;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 if(process.argv.length===3&&process.argv[2]==='--print-sql')process.stdout.write(nativeSql());
 else{
  if(process.argv.length!==2||process.env.FEDERATION_EMAIL_SIGNUP_TEST_CONFIRM!=='disposable_native_fixture')throw Error('Explicit disposable fixture confirmation required.');
  const container=process.env.FEDERATION_EMAIL_SIGNUP_TEST_CONTAINER||'';
  if(!/^[a-f0-9]{12,64}$/.test(container))throw Error('Expected an existing local container ID.');
  const config=JSON.parse(execFileSync('docker',['inspect','--format','{{json .Config}}',container],{encoding:'utf8',timeout:10000,maxBuffer:1048576}));
  if(config.Image!=='postgres:17.11-bookworm'||!config.Env.includes('POSTGRES_DB=federation_email_signup_native_test'))throw Error('Wrong disposable container.');
  execFileSync('docker',['exec','-i','-u','postgres',container,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','federation_email_signup_native_test'],{input:nativeSql(),stdio:['pipe','inherit','inherit'],timeout:60000});
 }
}
