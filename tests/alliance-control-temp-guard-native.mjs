// Disposable upstream PostgreSQL behavior drill. Never accepts a host or DSN.
// This does not prove Supabase event-trigger installation or pooler isolation.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const confirmation=process.env.ALLIANCE_TEMP_GUARD_TEST_CONFIRM;
const container=process.env.ALLIANCE_TEMP_GUARD_TEST_CONTAINER;
if(confirmation!=='disposable_control_temp_guard'||typeof container!=='string'||!/^[a-f0-9]{12,64}$/.test(container))throw Error('Disposable temp-guard fixture confirmation required');
const run=sql=>execFileSync('docker',['exec','-i',container,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{input:sql,encoding:'utf8',timeout:25000,maxBuffer:1048576});
// An empty container is required before any fixture role is created. No network
// client, password lookup, hosted project, login enablement or persistent grant.
const baseline=run(`SELECT current_user,session_user,current_database(),current_setting('server_version'),
 (SELECT count(*) FROM pg_roles WHERE rolname<>'supabase_admin' AND rolname NOT LIKE 'pg_%'),
 (SELECT count(*) FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname NOT IN('public','information_schema')),
 (SELECT count(*) FROM pg_event_trigger),
 (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace),
 (SELECT count(*) FROM pg_database WHERE datname NOT IN('postgres','template0','template1'));`);
assert.match(baseline.trim(),/^supabase_admin\|supabase_admin\|postgres\|17\.11(?:[^|]*)\|0\|0\|0\|0\|0$/);
const source=readFileSync(new URL('../sql/alliance-control-temp-guard-branch-drill.sql',import.meta.url),'utf8');
assert.equal((source.match(/^BEGIN;$/gm)||[]).length,1);
assert.equal((source.match(/^ROLLBACK;$/gm)||[]).length,1);
assert.doesNotMatch(source,/^\s*COMMIT\s*;/im);
assert.match(source,/ROLLBACK;\s*$/);
// The container bootstrap role is named supabase_admin so PostgreSQL records
// the synthetic management grants under that bootstrap identity. A transaction-
// local NOLOGIN postgres superuser reproduces only SQL shape, not managed rights.
const bootstrap=`
CREATE ROLE postgres SUPERUSER NOLOGIN;
SET LOCAL SESSION AUTHORIZATION postgres;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE ROLE alliance_control_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
CREATE ROLE alliance_control_reader NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
CREATE ROLE alliance_control_operator NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
CREATE ROLE alliance_control_anchor_writer NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION;
GRANT alliance_control_owner,alliance_control_reader,alliance_control_operator,alliance_control_anchor_writer
 TO postgres WITH ADMIN TRUE,INHERIT FALSE,SET FALSE GRANTED BY supabase_admin;
RESET ROLE;
`;
let failure;
try{
 const output=run(source.replace(/^BEGIN;$/m,'BEGIN;\n'+bootstrap));
 assert.match(output,/Control temp guard branch assertions reached; installation and trial changes will roll back\./);
 assert.match(output,/ROLLBACK\s*$/);
 console.log('PASS four locked roles refuse all five temporary object forms; tampering and definer seam assertions reached');
}catch(error){failure=error;}
// A separate connection verifies rollback even after a failed assertion. Never
// repair or drop a surviving object: unexpected state fails and container dies.
try{
 const after=run(`SELECT
 (SELECT count(*) FROM pg_roles WHERE rolname IN('postgres','anon','authenticated','service_role','alliance_control_owner','alliance_control_reader','alliance_control_operator','alliance_control_anchor_writer')),
 (SELECT count(*) FROM pg_namespace WHERE nspname IN('alliance_control_temp_guard_trial','alliance_control_trial_definer')),
 (SELECT count(*) FROM pg_event_trigger WHERE evtname='alliance_control_temp_guard_trial'),
 (SELECT count(*) FROM pg_class WHERE relpersistence='t'),
 has_database_privilege('supabase_admin','postgres','TEMPORARY');`);
 assert.equal(after.trim(),'0|0|0|0|t');
 console.log('PASS fresh connection confirms all fixture roles, schemas, trigger and temporary objects rolled back; TEMP retained');
}catch(error){failure??=error;}
if(failure)throw failure;
console.log('PASS upstream disposable behavior only; hosted Supabase installation, services and future LOGIN isolation remain NOT RUN');
