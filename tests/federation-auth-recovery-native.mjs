// Synthetic recovery rehearsal only. No hosted URL, real account or file export.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import account from '../netlify/functions/federation-account.cjs';
import { planAuthReconciliation } from '../scripts/plan-federation-auth-reconciliation.mjs';

const SOURCE_DB = 'federation_auth_recovery_source';
const TARGET_DB = 'federation_auth_recovery_target';
const IMAGE = 'supabase/gotrue:v2.197.0';
const SOURCE_REF = 's'.repeat(20), TARGET_REF = 't'.repeat(20);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
if (process.env.FEDERATION_RECOVERY_TEST_CONFIRM !== 'disposable_recovery_fixture') {
  throw new Error('Explicit disposable recovery fixture confirmation is required.');
}
const pg = process.env.FEDERATION_RECOVERY_TEST_POSTGRES || '';
if (!/^[a-f0-9]{12,64}$/.test(pg)) throw new Error('Expected a local fixture Docker container ID.');

// Fixture secrets exist only in memory and disposable container configuration.
const dbPassword = randomBytes(32).toString('hex');
const jwtSecret = randomBytes(32).toString('hex');
const password = `Fixture-${randomBytes(24).toString('hex')}!`;
function docker(args, input) {
  try {
    return execFileSync('docker', args, { input, encoding: 'utf8', timeout: 60000,
      maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    // A COPY/restore error can contain a whole row. Never echo client output.
    throw new Error(`Disposable Docker ${args[0]} failed; raw diagnostics withheld.`);
  }
}
function query(db, sql) {
  assert([SOURCE_DB, TARGET_DB, 'postgres'].includes(db), 'Unknown fixture database');
  return docker(['exec', '-i', '-u', 'postgres', pg, 'psql', '-X', '-At', '-v',
    'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db], sql);
}
const pgConfig = JSON.parse(docker(['inspect', '--format', '{{json .Config}}', pg]));
assert.equal(pgConfig.Image, 'postgres:17.11-bookworm', 'Wrong fixture image');
assert(pgConfig.Env.includes(`POSTGRES_DB=${SOURCE_DB}`), 'Wrong fixture database');
assert.equal(query(SOURCE_DB, "select current_setting('server_version_num');"), '170011');
assert.equal(query(SOURCE_DB, "select count(*) from pg_namespace where nspname='auth';"), '0');
assert.equal(query('postgres', `select count(*) from pg_database where datname='${TARGET_DB}';`), '0');
assert.equal(query('postgres', "select count(*) from pg_roles where rolname in ('supabase_auth_admin','anon','authenticated','service_role');"), '0');

let network, dump;
const owned = new Set(), services = new Map(), origins = new Set();
const issuer = 'http://127.0.0.1:9999';
const jwtHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
const jwtBody = Buffer.from(JSON.stringify({ role: 'service_role', aud: 'authenticated', iss: issuer,
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url');
const adminToken = `${jwtHeader}.${jwtBody}.${createHmac('sha256', jwtSecret).update(`${jwtHeader}.${jwtBody}`).digest('base64url')}`;

function localOrigin(container) {
  const info = JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings}}', container]));
  assert.deepEqual(Object.keys(info.Networks), [network], 'Auth must use only the owned internal network');
  assert(Object.values(info.Ports || {}).every(value => value === null), 'No published ports allowed');
  const ip = info.Networks[network].IPAddress;
  assert(/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)[0-9.]+$/.test(ip), 'Expected a private fixture IP');
  const origin = `http://${ip}:9999`;
  origins.add(origin);
  return origin;
}
async function http(origin, path, body, token, method = body === undefined ? 'GET' : 'POST') {
  assert(origins.has(origin), 'Only owned fixture origins allowed');
  const res = await fetch(origin + path, { method, redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  let json; try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, json };
}
function status(result, expected, label) {
  // Print no response body, dynamic identifiers, user rows or tokens on failure.
  assert.equal(result.status, expected, `${label}: HTTP ${result.status}`);
}
async function startAuth(db) {
  const env = {
    GOTRUE_API_HOST: '0.0.0.0', GOTRUE_API_PORT: '9999', API_EXTERNAL_URL: issuer,
    GOTRUE_DB_DRIVER: 'postgres', GOTRUE_DB_DATABASE_URL:
      `postgres://supabase_auth_admin:${dbPassword}@fixture-postgres:5432/${db}?sslmode=disable`,
    GOTRUE_DB_NAMESPACE: 'auth', GOTRUE_DB_MAX_POOL_SIZE: '5',
    GOTRUE_SITE_URL: 'http://127.0.0.1:3000', GOTRUE_DISABLE_SIGNUP: 'true',
    GOTRUE_JWT_SECRET: jwtSecret, GOTRUE_JWT_EXP: '3600', GOTRUE_JWT_ISSUER: issuer,
    GOTRUE_JWT_AUD: 'authenticated', GOTRUE_JWT_ADMIN_ROLES: 'service_role',
    GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true', GOTRUE_EXTERNAL_PHONE_ENABLED: 'false',
    GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED: 'false', GOTRUE_MAILER_AUTOCONFIRM: 'true',
    GOTRUE_LOG_LEVEL: 'error', GOTRUE_HOOK_BEFORE_USER_CREATED_ENABLED: 'false',
  };
  const container = docker(['run', '-d', '--network', network,
    ...Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]), IMAGE]);
  owned.add(container);
  const origin = localOrigin(container);
  services.set(db, { container, origin });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const r = await http(origin, '/health');
      if (r.status === 200) {
        assert(String(r.json.version).includes('2.197.0'), 'Wrong Auth version'); ready = true; break;
      }
    } catch {}
    await delay(500);
  }
  assert(ready, 'Disposable Auth startup did not finish');
  const settings = await http(origin, '/settings');
  status(settings, 200, 'Fixture settings');
  assert.equal(settings.json.disable_signup, true, 'Signup must stay closed');
  assert.equal(settings.json.external.email, true, 'Fixture password login required');
  return origin;
}
function stopAuth(db) {
  const service = services.get(db);
  assert(service && owned.has(service.container), 'Only owned Auth service may stop');
  docker(['rm', '-f', service.container]);
  owned.delete(service.container); origins.delete(service.origin); services.delete(db);
}
function counts(db) {
  return query(db, `select (select count(*) from auth.users)::text || '/' ||
    (select count(*) from auth.identities)::text || '/' ||
    (select count(*) from auth.sessions)::text || '/' || (select count(*) from auth.refresh_tokens)::text;`);
}
function present(db, id) {
  assert(UUID.test(id), 'Exact synthetic UUID required');
  return query(db, `select count(*) from auth.users where id='${id}'::uuid;`) === '1';
}
async function login(origin, email, expectedID) {
  const r = await http(origin, '/token?grant_type=password', { email, password });
  status(r, 200, 'Synthetic login');
  assert(r.json.user?.id === expectedID, 'Wrong synthetic user');
  assert.equal(typeof r.json.access_token, 'string', 'Missing access token');
  assert.equal(typeof r.json.refresh_token, 'string', 'Missing refresh token');
  const u = await http(origin, '/user', undefined, r.json.access_token);
  status(u, 200, 'Synthetic user read'); assert(u.json.id === expectedID, 'Synthetic user-read ID mismatch');
  return r.json;
}
async function rejected(origin, email, oldSession) {
  const fresh = await http(origin, '/token?grant_type=password', { email, password });
  assert(fresh.status >= 400 && fresh.status < 500, 'Deleted account fresh login accepted');
  assert(!fresh.json.access_token && !fresh.json.refresh_token, 'Deleted account session created');
  const user = await http(origin, '/user', undefined, oldSession.access_token);
  assert([401, 403].includes(user.status), 'Deleted account old user read accepted');
  const refresh = await http(origin, '/token?grant_type=refresh_token', { refresh_token: oldSession.refresh_token });
  assert(refresh.status >= 400 && refresh.status < 500, 'Deleted account old refresh accepted');
}
function appHandler(origin) {
  const fakeAuthOrigin = `https://${SOURCE_REF}.supabase.co`;
  return account.createHandler({ env: {
    FEDERATION_ACCOUNT_ENABLED: 'true', FEDERATION_ACCOUNT_ORIGIN: 'https://galacticfederation.co',
    FEDERATION_AUTH_URL: fakeAuthOrigin, FEDERATION_AUTH_PUBLISHABLE_KEY: 'sb_publishable_fixture_only',
    FEDERATION_AUTH_GOOGLE_ENABLED: 'true',
  }, fetchImpl: async (url, options) => {
    const u = new URL(url);
    assert.equal(u.origin, fakeAuthOrigin, 'Only synthetic adapter origin allowed');
    assert(['/auth/v1/user', '/auth/v1/token', '/auth/v1/logout'].includes(u.pathname), 'Unknown fixture Auth path');
    assert(origins.has(origin), 'Fixture no longer owned');
    // This adapter targets the owned real Auth service; responses are not mocks.
    return fetch(origin + u.pathname.slice('/auth/v1'.length) + u.search, options);
  } });
}
async function appCheck(origin, session, expectedID, expectedStatus) {
  const handler = appHandler(origin);
  const cookie = `__Host-gf-access=${encodeURIComponent(session.access_token)}; __Host-gf-refresh=${encodeURIComponent(session.refresh_token)}`;
  const event = action => ({ path: `/api/federation-account/${action}`,
    rawUrl: `https://galacticfederation.co/api/federation-account/${action}`,
    httpMethod: action === 'session' ? 'GET' : 'POST', body: '{}',
    headers: { origin: 'https://galacticfederation.co', 'sec-fetch-site': 'same-origin', cookie } });
  const r = await handler(event('session'));
  assert.equal(r.statusCode, expectedStatus, 'Federation session result');
  if (expectedStatus === 200) assert(JSON.parse(r.body).user?.id === expectedID, 'Federation user ID mismatch');
  else {
    const refreshed = await handler(event('refresh'));
    assert.equal(refreshed.statusCode, 401, 'Federation deleted-account refresh must reject');
    assert(refreshed.multiValueHeaders['Set-Cookie'].every(c => c.includes('Max-Age=0')), 'Cookies not cleared');
  }
}
function inventory(db) {
  return JSON.parse(query(db, `select jsonb_build_object('projectRef','${TARGET_REF}',
    'observedAtUtc','${new Date().toISOString()}',
    'users',coalesce((select jsonb_agg(jsonb_build_object('id',id)) from auth.users),'[]'::jsonb),
    'identities',coalesce((select jsonb_agg(jsonb_build_object('id',id,'userId',user_id)) from auth.identities),'[]'::jsonb),
    'sessionRows',(select count(*) from auth.sessions),
    'refreshTokenRows',(select count(*) from auth.refresh_tokens));`));
}

try {
  docker(['pull', IMAGE]);
  network = docker(['network', 'create', '--internal', `federation-recovery-${randomBytes(6).toString('hex')}`]);
  network = JSON.parse(docker(['network', 'inspect', network]))[0].Name;
  assert.equal(JSON.parse(docker(['network', 'inspect', network]))[0].Internal, true);
  docker(['network', 'connect', '--alias', 'fixture-postgres', network, pg]);
  query('postgres', `create role supabase_auth_admin login noinherit nosuperuser nocreatedb nocreaterole
    noreplication nobypassrls password '${dbPassword}'; alter role supabase_auth_admin set search_path=auth;
    create role anon nologin; create role authenticated nologin; create role service_role nologin;`);
  query('postgres', `create database ${TARGET_DB} template template0;`);
  for (const db of [SOURCE_DB, TARGET_DB]) query(db, 'create schema auth authorization supabase_auth_admin;');
  const source = await startAuth(SOURCE_DB);
  let target = await startAuth(TARGET_DB);
  assert.equal(counts(SOURCE_DB), '0/0/0/0'); assert.equal(counts(TARGET_DB), '0/0/0/0');
  for (const origin of [source, target]) {
    const closed = await http(origin, '/signup', { email: 'closed-control@example.invalid', password });
    status(closed, 422, 'Registration closure'); assert.equal(closed.json.error_code, 'signup_disabled');
  }
  const removeEmail = 'delete-me@example.invalid', keepEmail = 'keep-me@example.invalid';
  const ids = [];
  for (const email of [removeEmail, keepEmail]) {
    const r = await http(source, '/admin/users', { email, password, email_confirm: true }, adminToken);
    status(r, 200, 'Create synthetic admin fixture');
    const id = r.json.id || r.json.user?.id; assert(UUID.test(id), 'Missing fixture UUID'); ids.push(id);
  }
  const [removeID, keepID] = ids;
  assert.notEqual(removeID, keepID);
  const oldSession = await login(source, removeEmail, removeID);
  await appCheck(source, oldSession, removeID, 200);
  const capturedAtUtc = new Date().toISOString();
  dump = docker(['exec', '-u', 'postgres', pg, 'pg_dump', '-U', 'postgres', '-d', SOURCE_DB,
    '--data-only', '--no-owner', '--no-privileges', '--table=auth.users', '--table=auth.identities']);
  assert(dump.includes('COPY auth.users') && dump.includes('COPY auth.identities'), 'Incomplete fixture dump');
  assert(!dump.includes('COPY auth.sessions') && !dump.includes('COPY auth.refresh_tokens'), 'Sessions in dump');
  const archiveSha256 = createHash('sha256').update(dump).digest('hex');
  status(await http(source, '/logout?scope=global', {}, oldSession.access_token), 204, 'Revoke synthetic sessions');
  status(await http(source, `/admin/users/${removeID}`, undefined, adminToken, 'DELETE'), 200, 'Delete exact synthetic user');
  const recordedAtUtc = new Date().toISOString();
  assert(!present(SOURCE_DB, removeID) && present(SOURCE_DB, keepID), 'Source deletion changed wrong user');
  await rejected(source, removeEmail, oldSession); await appCheck(source, oldSession, removeID, 401);
  console.log('PASS source exact-user deletion: fresh login, old Auth/Federation session and refresh rejected');

  stopAuth(TARGET_DB);
  assert.equal(counts(TARGET_DB), '0/0/0/0', 'Target must be empty before one-transaction restore');
  query(TARGET_DB, `begin;\n${dump}\ncommit;`);
  dump = undefined;
  assert.equal(counts(TARGET_DB), '2/2/0/0', 'Restore must exclude session/refresh rows');
  assert(present(TARGET_DB, removeID) && present(TARGET_DB, keepID), 'Earlier dump did not restore both IDs');
  target = await startAuth(TARGET_DB);
  const restored = await http(target, `/admin/users/${removeID}`, undefined, adminToken);
  status(restored, 200, 'Positive control: old recovery point contains deleted user');
  assert(restored.json.id === removeID, 'Wrong restored synthetic user');
  const input = { schemaVersion: 1, sourceProjectRef: SOURCE_REF, targetProjectRef: TARGET_REF,
    backup: { projectRef: SOURCE_REF, capturedAtUtc, archiveSha256 }, inventory: inventory(TARGET_DB),
    ledger: { projectRef: SOURCE_REF, completeThroughUtc: '', entries: [{ projectRef: SOURCE_REF,
      caseRef: 'synthetic-verified-deletion', userId: removeID, recordedAtUtc, outcome: 'confirmed_deleted' }] },
    isolation: { signupClosed: true, outboundDeliveryClosed: true, productionConnected: false } };
  input.ledger.completeThroughUtc = input.inventory.observedAtUtc;
  const plan = planAuthReconciliation(input);
  assert.equal(plan.status, 'reviewable_removal_plan');
  assert.equal(plan.removals.length, 1); assert(plan.removals[0].userId === removeID, 'Wrong reconciliation candidate');
  assert.equal(plan.removals[0].identityIds.length, 1);
  // The fixture-only operator selects an already asserted exact candidate.
  // The production planner remains a pure function with no delete executor.
  status(await http(target, `/admin/users/${plan.removals[0].userId}`, undefined, adminToken, 'DELETE'), 200,
    'Reconcile exact restored synthetic account');
  assert(!present(TARGET_DB, removeID) && present(TARGET_DB, keepID), 'Target reconciliation changed wrong user');
  assert.equal(counts(TARGET_DB), '1/1/0/0');
  input.inventory = inventory(TARGET_DB); input.ledger.completeThroughUtc = input.inventory.observedAtUtc;
  assert.equal(planAuthReconciliation(input).status, 'reviewable_no_removal', 'Second reconciliation not idempotent');
  await rejected(target, removeEmail, oldSession); await appCheck(target, oldSession, removeID, 401);
  console.log('PASS earlier dump restored the deleted fixture; reconciliation removed only that exact user and identity');
  console.log('PASS restored target: zero restored sessions, repeated reconciliation needs no removal, deleted login/session/refresh rejected');
  for (const origin of [source, target]) {
    const kept = await login(origin, keepEmail, keepID); await appCheck(origin, kept, keepID, 200);
    status(await http(origin, '/logout?scope=local', {}, kept.access_token), 204, 'Retained-user logout');
  }
  assert(!present(SOURCE_DB, removeID) && present(SOURCE_DB, keepID));
  assert(!present(TARGET_DB, removeID) && present(TARGET_DB, keepID));
  console.log('PASS retained synthetic account: exact ID, fresh login and Federation session work in source and target');
  console.log('PASS disposable Auth recovery rehearsal; real request verification, ledger custody, hosted recovery and public release remain unproved');
} finally {
  dump = undefined;
  let failed = false;
  for (const container of owned) { try { docker(['rm', '-f', container]); } catch { failed = true; } }
  if (network) {
    try { docker(['network', 'disconnect', network, pg]); } catch { failed = true; }
    try { docker(['network', 'rm', network]); } catch { failed = true; }
  }
  if (failed) throw new Error('Disposable recovery child-container/network cleanup failed');
  console.log('PASS disposable recovery Auth containers and internal network removed; CI disposes its Postgres fixture');
}
