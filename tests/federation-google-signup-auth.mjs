// Disposable self-hosted Auth acceptance; no hosted URL or real credentials accepted.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const DB = 'federation_signup_auth_test';
const AUTH_IMAGE = 'supabase/gotrue:v2.197.0';
const MAIL_IMAGE = 'axllent/mailpit:v1.31.4';
const SCHEMA = 'federation_signup_probe_20261007';
const FN = `${SCHEMA}.google_only`;
if (process.env.FEDERATION_AUTH_TEST_CONFIRM !== 'disposable_auth_fixture') {
  throw new Error('Explicit disposable Auth fixture confirmation is required.');
}
const pg = process.env.FEDERATION_AUTH_TEST_POSTGRES || '';
if (!/^[a-f0-9]{12,64}$/.test(pg)) throw new Error('Expected a local fixture Docker container ID.');

const credentials = [randomBytes(32).toString('hex'), randomBytes(32).toString('hex')];
const [dbPassword, jwtSecret] = credentials;
const password = `Fixture-${randomBytes(18).toString('hex')}!`;
credentials.push(password);
function redact(s) {
  for (const value of credentials) s = s.replaceAll(value, '[fixture credential]');
  return s.replace(/eyJ[A-Za-z0-9_.-]+/g, '[fixture token]');
}
function docker(args, input) {
  try {
    return execFileSync('docker', args, { input, encoding: 'utf8', timeout: 60000,
      maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    throw new Error(`Docker ${args[0]} failed: ${redact(String(error.stderr || '')).slice(-1800)}`);
  }
}
function query(sql) {
  return docker(['exec', '-i', '-u', 'postgres', pg, 'psql', '-X', '-At', '-v',
    'ON_ERROR_STOP=1', '-U', 'postgres', '-d', DB], sql);
}
const pgConfig = JSON.parse(docker(['inspect', '--format', '{{json .Config}}', pg]));
assert.equal(pgConfig.Image, 'postgres:17.11-bookworm', 'Wrong fixture image');
assert(pgConfig.Env.includes(`POSTGRES_DB=${DB}`), 'Wrong fixture database');
assert.equal(query("select current_setting('server_version_num');"), '170011');
assert.equal(query(`select count(*) from pg_namespace where nspname in ('auth','${SCHEMA}');`), '0');
assert.equal(query("select count(*) from pg_roles where rolname in ('supabase_auth_admin','anon','authenticated','service_role');"), '0');

const probe = readFileSync(new URL('./federation-google-signup-probe.sql', import.meta.url), 'utf8');
const begin = probe.indexOf('\nbegin;\n');
const checks = probe.indexOf('do $checks$');
const functionStart = probe.indexOf(`create function ${FN}(event jsonb)`);
const functionEnd = probe.indexOf('$hook$;', functionStart) + '$hook$;'.length;
assert(begin >= 0 && checks > begin && functionStart > begin && functionEnd < checks,
  'Probe layout changed; review the Auth harness');
const candidateDDL = probe.slice(begin + '\nbegin;\n'.length, checks);
const restoreFunction = probe.slice(functionStart, functionEnd).replace(/^create function /, 'create or replace function ');

let network, mail, auth, authOrigin, mailOrigin;
const ownedContainers = new Set();
const fixtureOrigins = new Set();
const baseURL = 'http://127.0.0.1:9999';
const controlEmail = 'existing-owner@example.invalid';
let controlID;
const jwt = (role) => {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ role, aud: 'authenticated', iss: baseURL,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url');
  const token = `${head}.${body}.${createHmac('sha256', jwtSecret).update(`${head}.${body}`).digest('base64url')}`;
  credentials.push(token);
  return token;
};
const adminToken = jwt('service_role');
function localOrigin(container, port) {
  const info = JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings}}', container]));
  assert.deepEqual(Object.keys(info.Networks), [network], 'Only the owned internal network is allowed');
  assert(Object.values(info.Ports || {}).every(value => value === null), 'No published ports are allowed');
  const ip = info.Networks[network].IPAddress;
  assert(/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)[0-9.]+$/.test(ip), 'Expected a private fixture address');
  const origin = `http://${ip}:${port}`;
  fixtureOrigins.add(origin);
  return origin;
}
async function http(origin, path, body, token, method = body === undefined ? 'GET' : 'POST') {
  assert(fixtureOrigins.has(origin), 'Only addresses derived from owned fixture containers are allowed');
  const res = await fetch(origin + path, { method, redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const raw = await res.text();
  let json; try { json = JSON.parse(raw); } catch { json = {}; }
  if (json.access_token) credentials.push(json.access_token);
  if (json.refresh_token) credentials.push(json.refresh_token);
  return { status: res.status, json };
}
function status(result, expected, label) {
  assert.equal(result.status, expected, `${label}: HTTP ${result.status}, error ${result.json.error_code || 'none'}`);
}
async function waitReady(origin, path) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { const r = await http(origin, path); if (r.status === 200) return r; } catch {}
    await delay(500);
  }
  // Startup diagnostic only; never dump request/response bodies or Auth user rows.
  const logs = spawnSync('docker', ['logs', '--tail', '15', auth || mail], {
    encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 });
  throw new Error(`Fixture startup failed: ${redact(String(logs.stdout || '') + String(logs.stderr || '')).slice(-2000)}`);
}
async function mailCount() {
  const r = await http(mailOrigin, '/api/v1/messages?limit=1');
  status(r, 200, 'Mail sink count');
  assert(Number.isSafeInteger(r.json.total) && r.json.total >= 0, 'Invalid sink count');
  return r.json.total;
}
function counts() {
  const r = query('select (select count(*) from auth.users)::text || \'/\' || (select count(*) from auth.identities)::text;');
  assert(/^[0-9]+\/[0-9]+$/.test(r), 'Invalid aggregate counts');
  return r;
}
async function unchanged(label) {
  assert.equal(counts(), '2/2', `${label}: account/identity insertion`);
  await delay(100);
  assert.equal(await mailCount(), 2, `${label}: unexpected email delivery`);
}
async function startAuth(disableSignup, enableHook) {
  if (auth) { docker(['rm', '-f', auth]); ownedContainers.delete(auth); auth = undefined; }
  const env = {
    GOTRUE_API_HOST: '0.0.0.0', GOTRUE_API_PORT: '9999', API_EXTERNAL_URL: baseURL,
    GOTRUE_DB_DRIVER: 'postgres', GOTRUE_DB_DATABASE_URL:
      `postgres://supabase_auth_admin:${dbPassword}@fixture-postgres:5432/${DB}?sslmode=disable`,
    GOTRUE_DB_NAMESPACE: 'auth', GOTRUE_DB_MAX_POOL_SIZE: '5',
    GOTRUE_SITE_URL: 'http://127.0.0.1:3000', GOTRUE_DISABLE_SIGNUP: String(disableSignup),
    GOTRUE_JWT_SECRET: jwtSecret, GOTRUE_JWT_EXP: '3600', GOTRUE_JWT_ISSUER: baseURL,
    GOTRUE_JWT_AUD: 'authenticated', GOTRUE_JWT_ADMIN_ROLES: 'service_role',
    GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated', GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true',
    GOTRUE_EXTERNAL_PHONE_ENABLED: 'false', GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED: 'false',
    GOTRUE_MAILER_AUTOCONFIRM: 'false', GOTRUE_SMTP_HOST: 'fixture-mail', GOTRUE_SMTP_PORT: '1025',
    GOTRUE_SMTP_ADMIN_EMAIL: 'fixture@example.invalid', GOTRUE_SMTP_SENDER_NAME: 'Disposable fixture',
    GOTRUE_SMTP_MAX_FREQUENCY: '1s', GOTRUE_LOG_LEVEL: 'error',
    GOTRUE_HOOK_BEFORE_USER_CREATED_ENABLED: String(enableHook),
    ...(enableHook ? { GOTRUE_HOOK_BEFORE_USER_CREATED_URI: `pg-functions://postgres/${SCHEMA}/google_only` } : {}),
  };
  auth = docker(['run', '-d', '--network', network,
    ...Object.entries(env).flatMap(([key,value]) => ['-e', `${key}=${value}`]), AUTH_IMAGE]);
  ownedContainers.add(auth);
  authOrigin = localOrigin(auth, 9999);
  const health = await waitReady(authOrigin, '/health');
  assert(String(health.json.version).includes('2.197.0'), 'Unexpected Auth service version');
  const settings = await http(authOrigin, '/settings');
  status(settings, 200, 'Auth settings');
  assert.equal(settings.json.disable_signup, disableSignup, 'Wrong global signup state');
  assert.equal(settings.json.external.email, true, 'Email provider must remain enabled');
  const nets = JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings.Networks}}', auth]));
  assert.deepEqual(Object.keys(nets), [network], 'Auth must use only the internal test network');
}
async function login(label) {
  const r = await http(authOrigin, '/token?grant_type=password', { email: controlEmail, password });
  status(r, 200, label);
  assert.equal(r.json.user?.id, controlID, 'Existing synthetic account changed');
  assert.equal(typeof r.json.access_token, 'string', 'Missing login access token');
  const user = await http(authOrigin, '/user', undefined, r.json.access_token);
  status(user, 200, `${label} authenticated user read`);
  assert.equal(user.json.id, controlID);
  const out = await http(authOrigin, '/logout?scope=local', {}, r.json.access_token);
  status(out, 204, `${label} logout`);
  const refresh = await http(authOrigin, '/token?grant_type=refresh_token', { refresh_token: r.json.refresh_token });
  assert(refresh.status >= 400 && refresh.status < 500, `${label}: old refresh token still accepted`);
  await unchanged(label);
  console.log(`PASS ${label}: exact existing account, user read, logout and refresh rejection`);
}
async function denied(label, path, body, expected = 403) {
  const r = await http(authOrigin, path, body);
  status(r, expected, label);
  if (expected === 403) {
    assert.equal(r.json.msg || r.json.message, 'Account creation is unavailable for this sign-in method.',
      `${label}: response did not come from the candidate decision`);
  }
  assert(!r.json.access_token && !r.json.refresh_token, `${label}: unexpected session`);
  await unchanged(label);
  console.log(`PASS ${label}: HTTP ${expected}, zero insertion and zero new sink mail`);
}

try {
  docker(['pull', AUTH_IMAGE]); docker(['pull', MAIL_IMAGE]);
  network = docker(['network', 'create', '--internal', `federation-auth-${randomBytes(6).toString('hex')}`]);
  // Docker returns a network ID; retain its actual name for inspection and bindings.
  network = JSON.parse(docker(['network', 'inspect', network]))[0].Name;
  assert.equal(JSON.parse(docker(['network', 'inspect', network]))[0].Internal, true);
  docker(['network', 'connect', '--alias', 'fixture-postgres', network, pg]);
  query(`begin;
    create role supabase_auth_admin login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password '${dbPassword}';
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth authorization supabase_auth_admin;
    alter role supabase_auth_admin set search_path = auth;
    commit;`);
  mail = docker(['run', '-d', '--network', network, '--network-alias', 'fixture-mail',
    MAIL_IMAGE]); ownedContainers.add(mail);
  mailOrigin = localOrigin(mail, 8025); await waitReady(mailOrigin, '/api/v1/messages?limit=1');
  assert.equal(await mailCount(), 0, 'Mail sink must start empty');

  // Positive controls prove neither global closure nor broken delivery can fake a deny.
  await startAuth(false, false);
  assert.equal(counts(), '0/0', 'Auth service must start empty');
  const control = await http(authOrigin, '/signup', { email: controlEmail, password });
  status(control, 200, 'Unhooked password-signup positive control');
  controlID = control.json.id || control.json.user?.id;
  assert(/^[0-9a-f-]{36}$/.test(controlID), 'Missing synthetic control user');
  const otp = await http(authOrigin, '/otp', { email: 'otp-control@example.invalid', create_user: true });
  status(otp, 200, 'Unhooked OTP positive control');
  for (let n=0; n<30 && await mailCount() !== 2; n++) await delay(100);
  await unchanged('Positive controls');
  const confirm = await http(authOrigin, `/admin/users/${controlID}`, { email_confirm: true }, adminToken, 'PUT');
  status(confirm, 200, 'Confirm synthetic password control via local admin');
  console.log('PASS unhooked password and OTP positive controls: two users, two identities and two sink emails');

  docker(['rm', '-f', auth]); ownedContainers.delete(auth); auth = undefined;
  query(`begin;\n${candidateDDL}\ncommit;`);
  await startAuth(true, true);
  const closed = await http(authOrigin, '/signup', { email: 'closed@example.invalid', password });
  status(closed, 422, 'Closed attachment');
  assert.equal(closed.json.error_code, 'signup_disabled');
  await login('Hook attached with signup closed');

  await startAuth(false, true);
  await denied('Direct Email/password', '/signup', { email: 'denied-password@example.invalid', password });
  await denied('Direct Email OTP create_user=true', '/otp', { email: 'denied-otp@example.invalid', create_user: true });
  await denied('Spoofed user metadata', '/signup', { email: 'denied-metadata@example.invalid', password,
    data: { provider: 'google', app_metadata: { provider: 'google' } } });
  await denied('Spoofed provider and app metadata fields', '/signup', { email: 'denied-provider@example.invalid', password,
    provider: 'google', app_metadata: { provider: 'google' }, user_metadata: { provider: 'google' } });
  await denied('Spoofed OTP metadata', '/otp', { email: 'denied-otp-metadata@example.invalid', create_user: true,
    data: { provider: 'google' } });
  await login('Hook active with signup enabled');

  query(`revoke execute on function ${FN}(jsonb) from supabase_auth_admin;`);
  await denied('Missing hook EXECUTE', '/signup', { email: 'missing-execute@example.invalid', password }, 500);
  await login('Existing login while hook EXECUTE is missing');
  query(`grant execute on function ${FN}(jsonb) to supabase_auth_admin; revoke usage on schema ${SCHEMA} from supabase_auth_admin;`);
  await denied('Missing hook schema USAGE', '/otp', { email: 'missing-usage@example.invalid', create_user: true }, 500);
  query(`grant usage on schema ${SCHEMA} to supabase_auth_admin; alter function ${FN}(jsonb) rename to google_only_unavailable;`);
  await denied('Unavailable hook function', '/signup', { email: 'unavailable-hook@example.invalid', password }, 500);
  query(`alter function ${SCHEMA}.google_only_unavailable(jsonb) rename to google_only;`);
  query(`create or replace function ${FN}(event jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$ begin raise exception 'Synthetic hook failure'; end; $$;`);
  await denied('Hook runtime error', '/signup', { email: 'runtime-error@example.invalid', password }, 500);
  // The unconfigured v2.197.0 service did not cancel a 3-second hook in the
  // earlier isolated run. This verifies explicit database cancellation only;
  // it must not be reported as proof of Auth's advertised/default hook deadline.
  query("alter role supabase_auth_admin set statement_timeout = '2s';");
  await startAuth(false, true); // New pool inherits the explicit fixture role deadline.
  query(`create or replace function ${FN}(event jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$ begin perform pg_catalog.pg_sleep(3); return '{}'::jsonb; end; $$;`);
  await denied('Explicit database statement timeout', '/otp', { email: 'timeout-hook@example.invalid', create_user: true }, 500);
  // Independently check the service's default outer request deadline, without
  // retaining the fixture-only two-second database setting.
  query("alter role supabase_auth_admin reset statement_timeout;");
  await startAuth(false, true);
  query(`create or replace function ${FN}(event jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$ begin perform pg_catalog.pg_sleep(12); return '{}'::jsonb; end; $$;`);
  const started = performance.now();
  await denied('Default API request deadline', '/otp', { email: 'request-timeout@example.invalid', create_user: true }, 504);
  const elapsed = performance.now() - started;
  assert(elapsed >= 9000 && elapsed < 14000, 'Outer deadline did not match the default ten-second window');
  console.log(`PASS default request cancellation observed in ${Math.round(elapsed)} ms with no fixture role timeout`);
  query(restoreFunction);
  await denied('Restored exact candidate', '/signup', { email: 'restored-rule@example.invalid', password });
  await login('Existing login after candidate restoration');
  await startAuth(true, true);
  const finalClosed = await http(authOrigin, '/signup', { email: 'final-closed@example.invalid', password });
  status(finalClosed, 422, 'Final signup closure');
  assert.equal(finalClosed.json.error_code, 'signup_disabled');
  await unchanged('Final closure');
  console.log('PASS final closure: signup disabled, two synthetic controls only, no additional sink mail');
  console.log('PASS self-hosted Auth v2.197.0 route acceptance; real Google, hosted configuration/default timeout and browser acceptance still pending');
} finally {
  let cleanupFailed = false;
  for (const container of ownedContainers) {
    try { docker(['rm', '-f', container]); } catch { cleanupFailed = true; }
  }
  if (network) {
    try { docker(['network', 'disconnect', network, pg]); } catch { cleanupFailed = true; }
    try { docker(['network', 'rm', network]); } catch { cleanupFailed = true; }
  }
  if (cleanupFailed) throw new Error('Disposable child-container/network cleanup failed');
  console.log('PASS disposable Auth/mail containers and internal network removed');
}
