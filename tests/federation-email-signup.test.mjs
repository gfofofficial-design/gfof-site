import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {candidate,candidateDDL,cases,SCHEMA,denied} from './federation-email-signup-candidate.mjs';
import {nativeSql} from './federation-email-signup-native.mjs';

test('candidate is a new unapplied schema; existing Google-only migration is untouched',()=>{
 assert.ok(candidate.startsWith('-- UNAPPLIED'));assert.ok(candidateDDL.includes('create schema '+SCHEMA));assert.ok(!candidate.includes('create or replace'));
 const old=readFileSync(new URL('../supabase/migrations/20261009013602_federation_google_only_signup.sql',import.meta.url),'utf8');assert.ok(old.includes('google_only')&&!old.includes(SCHEMA));
});
test('candidate has no table, network, secret lookup or security definer privilege',()=>{
 assert.ok(candidateDDL.includes('security invoker set search_path=\'\''));
 assert.ok(!/\b(create table|security definer|http_post|http_get|dblink|current_setting)\b/i.test(candidateDDL));
 assert.ok(candidateDDL.includes('from public,anon,authenticated,service_role'));assert.ok(candidateDDL.includes('to supabase_auth_admin'));
});
test('fixtures expose the provider limitation and forbid forged/anonymous/other-provider input',()=>{
 assert.equal(new Set(cases.map(c=>c[0])).size,cases.length);
 const otp=cases.find(c=>c[0]==='email OTP-shaped creation'),password=cases.find(c=>c[0]==='email password-shaped creation is indistinguishable');assert.deepEqual(otp[1],password[1]);assert.equal(otp[2],true);assert.equal(password[2],true);
 assert.equal(cases.find(c=>c[0]==='forged user metadata email provider denied')[2],false);assert.equal(denied.error.http_code,403);
});
test('printing native SQL is offline and the default runner refuses absent confirmation',()=>{
 const path=fileURLToPath(new URL('./federation-email-signup-native.mjs',import.meta.url));
 const result=spawnSync(process.execPath,[path,'--print-sql'],{encoding:'utf8',timeout:5000});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,nativeSql());
 const closed=spawnSync(process.execPath,[path],{encoding:'utf8',timeout:5000,env:{PATH:process.env.PATH||''}});assert.notEqual(closed.status,0);assert.ok(closed.stderr.includes('Explicit disposable fixture confirmation'));
});
test('native target is bounded, rollback-only and includes genuine role denial probes',()=>{
 const sql=nativeSql();assert.ok(sql.includes("current_database()<>'federation_email_signup_native_test'"));assert.ok(sql.includes("current_setting('server_version_num')<>'170011'"));assert.ok(sql.includes('set local role supabase_auth_admin'));assert.ok(sql.includes('exception when insufficient_privilege'));assert.ok(sql.includes('rollback;'));
 assert.ok(!sql.includes('drop schema'));assert.throws(()=>nativeSql('999999'));
});
