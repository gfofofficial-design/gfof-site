// Test fixture loader only: reads the unapplied migration, never runs SQL.
import {readFileSync} from 'node:fs';

export const SCHEMA = 'federation_auth_signup';
export const MIGRATION = '20261009013602_federation_google_only_signup.sql';
const migration = readFileSync(new URL(`../supabase/migrations/${MIGRATION}`,import.meta.url),'utf8').replaceAll('\r\n','\n');
const start = migration.indexOf('\nbegin;\n');
const end = migration.lastIndexOf('\ncommit;');
if(start < 0 || end <= start || migration.slice(end).trim() !== 'commit;') {
  throw new Error('Candidate migration layout changed; review both disposable fixtures.');
}
export const candidateDDL = migration.slice(start + '\nbegin;\n'.length,end);
const functionStart = candidateDDL.indexOf(`create function ${SCHEMA}.google_only(event jsonb)`);
const functionEnd = candidateDDL.indexOf('$hook$;',functionStart) + '$hook$;'.length;
if(functionStart < 0 || functionEnd <= functionStart) throw new Error('Candidate hook body is missing.');
export const restoreFunction = candidateDDL.slice(functionStart,functionEnd).replace(/^create function /,'create or replace function ');

// Reuse the review probe's decisions/ACL assertions; its DDL is never deployed.
const probe = readFileSync(new URL('./federation-google-signup-probe.sql',import.meta.url),'utf8');
const checks = probe.indexOf('do $checks$');
const checksEnd = probe.indexOf('$checks$;',checks) + '$checks$;'.length;
if(checks < 0 || checksEnd <= checks || !probe.slice(checksEnd).trimStart().startsWith('rollback;')) {
  throw new Error('Review assertions changed; review the disposable fixtures.');
}
export const ruleChecks = probe.slice(checks,checksEnd).replaceAll('federation_signup_probe_20261007',SCHEMA);
