// Test-only Docker harness. Never connects to a hosted database or Auth service.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const source = readFileSync(new URL('./federation-google-signup-probe.sql', import.meta.url), 'utf8');
const begin = source.indexOf('\nbegin;\n');
const checks = source.indexOf('do $checks$');
const checksEnd = source.indexOf('$checks$;', checks) + '$checks$;'.length;
if (begin < 0 || checks <= begin || checksEnd <= checks ||
    !source.slice(checksEnd).trimStart().startsWith('rollback;')) {
  throw new Error('Probe layout changed: review the native harness before running it.');
}

// Reuse the exact candidate DDL and all 21 rule assertions; do not copy its rule.
const candidate = source.slice(begin + '\nbegin;\n'.length, checks);
const ruleChecks = source.slice(checks, checksEnd);
const google = `'{"user":{"app_metadata":{"provider":"google"},"is_anonymous":false}}'::jsonb`;
const denyCall = (label) => `
do $denied$
begin
  begin
    perform federation_signup_probe_20261007.google_only(${google});
    raise exception '${label}: unexpected function access';
  exception when insufficient_privilege then
    raise notice 'PASS ${label} denied with SQLSTATE 42501';
  end;
end;
$denied$;
`;

const sql = `
\\set ON_ERROR_STOP on
begin;
set local statement_timeout = '8s';
set local lock_timeout = '2s';
do $preflight$
begin
  if current_database() <> 'federation_signup_native_test'
     or session_user <> 'postgres'
     or current_setting('server_version_num')::integer <> 170011 then
    raise exception 'Only the disposable PostgreSQL 17.11 fixture is allowed';
  end if;
  if exists (select 1 from pg_roles where rolname in
      ('supabase_auth_admin','anon','authenticated','service_role','federation_signup_outsider'))
     or exists (select 1 from pg_namespace where nspname in
      ('auth','federation_signup_probe_20261007')) then
    raise exception 'Fixture is not empty; no existing roles or Auth data may be used';
  end if;
end;
$preflight$;
create role supabase_auth_admin nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role anon nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role authenticated nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role service_role nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
create role federation_signup_outsider nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
${candidate}
create table federation_signup_probe_20261007.fixture_private (value integer);
revoke all on table federation_signup_probe_20261007.fixture_private from public;

set local role supabase_auth_admin;
do $role$
begin
  if current_user <> 'supabase_auth_admin' then raise exception 'Wrong executing role'; end if;
  if exists (select 1 from pg_roles where rolname=current_user and
      (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication or rolcanlogin))
     or exists (select 1 from pg_auth_members where member=(select oid from pg_roles where rolname=current_user)) then
    raise exception 'Auth fixture has unexpected privilege or membership';
  end if;
  if has_schema_privilege(current_user,'federation_signup_probe_20261007','CREATE')
     or has_table_privilege(current_user,'federation_signup_probe_20261007.fixture_private','SELECT') then
    raise exception 'Auth fixture received unnecessary access';
  end if;
  if (select proconfig from pg_proc where oid='federation_signup_probe_20261007.google_only(jsonb)'::regprocedure)
      is distinct from array['search_path=""']::text[] then
    raise exception 'Hook search path is not empty';
  end if;
end;
$role$;
${ruleChecks}
do $auth_pass$
begin
  raise notice 'PASS 21 rule assertions executed as restricted supabase_auth_admin';
end;
$auth_pass$;
reset role;

${['anon','authenticated','service_role','federation_signup_outsider'].map(role => `
set local role ${role};
${denyCall(role)}
reset role;
`).join('')}

revoke execute on function federation_signup_probe_20261007.google_only(jsonb) from supabase_auth_admin;
set local role supabase_auth_admin;
${denyCall('Auth without EXECUTE')}
reset role;
grant execute on function federation_signup_probe_20261007.google_only(jsonb) to supabase_auth_admin;
revoke usage on schema federation_signup_probe_20261007 from supabase_auth_admin;
set local role supabase_auth_admin;
${denyCall('Auth without schema USAGE')}
reset role;
grant usage on schema federation_signup_probe_20261007 to supabase_auth_admin;
set local role supabase_auth_admin;
do $restored$
begin
  if federation_signup_probe_20261007.google_only(${google}) is distinct from '{}'::jsonb then
    raise exception 'Restored grants did not restore expected execution';
  end if;
  raise notice 'PASS restored grants permit the expected Google decision';
end;
$restored$;
reset role;
rollback;

do $cleanup$
begin
  if exists (select 1 from pg_namespace where nspname='federation_signup_probe_20261007')
     or exists (select 1 from pg_roles where rolname in
      ('supabase_auth_admin','anon','authenticated','service_role','federation_signup_outsider')) then
    raise exception 'Rollback did not remove the disposable fixture';
  end if;
  raise notice 'PASS rollback removed every fixture role and schema';
end;
$cleanup$;
select current_setting('server_version') as postgres_version;
`;

if (process.argv.length === 3 && process.argv[2] === '--print-sql') {
  process.stdout.write(sql);
} else {
  if (process.argv.length !== 2 || process.env.FEDERATION_SIGNUP_TEST_CONFIRM !== 'disposable_native_fixture') {
    throw new Error('Explicit disposable fixture confirmation is required.');
  }
  const container = process.env.FEDERATION_SIGNUP_TEST_CONTAINER || '';
  if (!/^[a-f0-9]{12,64}$/.test(container)) throw new Error('Expected a local Docker container ID.');
  const config = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .Config}}', container],
    { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 }));
  if (config.Image !== 'postgres:17.11-bookworm' ||
      !config.Env.includes('POSTGRES_DB=federation_signup_native_test')) {
    throw new Error('Container does not match the dedicated test fixture.');
  }
  execFileSync('docker', ['exec', '-i', '-u', 'postgres', container, 'psql', '-X', '-v',
    'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'federation_signup_native_test'], {
    input: sql, stdio: ['pipe', 'inherit', 'inherit'], timeout: 60000,
  });
}
