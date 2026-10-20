// Pure fixture guards. No network, SQL, environment or credentials on import.
import assert from 'node:assert/strict';
export const EMAIL_AUTH_DB = 'federation_email_auth_test';
export const PG_IMAGE = 'postgres:17.11-bookworm';
export const AUTH_IMAGE = 'supabase/gotrue:v2.197.0';
export const MAIL_IMAGE = 'axllent/mailpit:v1.31.4';
export const TEMPLATE_IMAGE = 'busybox:1.37.0';
export const CODE_TEMPLATE = '<html><body><p>Disposable test code.</p><p>FEDERATION-CODE:{{ .Token }}</p></body></html>';
export function fixtureAuthPath(value) {
  const url=new URL(value);
  assert.equal(url.origin,'https://syntheticfixture.supabase.co','Unexpected synthetic Auth origin');
  assert.ok(!url.username&&!url.password&&!url.hash,'Unexpected synthetic Auth URL fields');
  const suffix=url.pathname+url.search;
  assert.ok(['/auth/v1/otp','/auth/v1/verify','/auth/v1/user',
    '/auth/v1/token?grant_type=refresh_token','/auth/v1/logout?scope=local'].includes(suffix),
    'Unexpected application Auth route');
  return suffix.slice('/auth/v1'.length);
}
export function fixtureConfig(config) {
  assert.equal(config?.Image, PG_IMAGE, 'Wrong disposable PostgreSQL image');
  assert.ok(config.Env?.includes(`POSTGRES_DB=${EMAIL_AUTH_DB}`), 'Wrong disposable database');
}
export function fixtureOrigin(info, network, port) {
  assert.deepEqual(Object.keys(info.Networks || {}), [network], 'Unexpected container network');
  assert.ok(Object.values(info.Ports || {}).every(value => value === null), 'Published ports refused');
  const ip = info.Networks[network].IPAddress;
  assert.match(ip, /^(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/, 'Expected private fixture IPv4');
  assert.ok(ip.split('.').every(octet => Number(octet) <= 255), 'Invalid fixture address');
  assert.ok([8025, 8080, 9999].includes(port), 'Unexpected fixture port');
  return `http://${ip}:${port}`;
}
export function sinkCode(message, email) {
  assert.match(email, /^[a-z0-9-]+@example\.invalid$/, 'Only reserved fixture recipients');
  assert.ok(Array.isArray(message?.To) && message.To.length === 1 && message.To[0].Address === email,
    'Unexpected sink recipient');
  const body = `${message.Text || ''}\n${message.HTML || ''}`;
  assert.ok(body.length < 131072, 'Oversized sink message');
  const values = [...body.matchAll(/FEDERATION-CODE:([0-9]{8})(?![0-9])/g)].map(match => match[1]);
  assert.ok(values.length > 0 && new Set(values).size === 1, 'Missing or ambiguous eight-digit sink code');
  return values[0];
}
