import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fixtureConfig, fixtureOrigin, fixtureAuthPath, sinkCode, PG_IMAGE, EMAIL_AUTH_DB} from './federation-email-auth-contract.mjs';

test('fixture refuses hosted database settings, wrong versions and published container ports', () => {
  fixtureConfig({Image:PG_IMAGE, Env:[`POSTGRES_DB=${EMAIL_AUTH_DB}`]});
  assert.throws(() => fixtureConfig({Image:'postgres:latest', Env:[`POSTGRES_DB=${EMAIL_AUTH_DB}`]}));
  assert.throws(() => fixtureConfig({Image:PG_IMAGE, Env:['POSTGRES_DB=postgres']}));
  const valid={Networks:{owned:{IPAddress:'172.18.0.2'}},Ports:{'9999/tcp':null}};
  assert.equal(fixtureOrigin(valid,'owned',9999),'http://172.18.0.2:9999');
  assert.throws(() => fixtureOrigin({...valid,Networks:{owned:{IPAddress:'8.8.8.8'}}},'owned',9999));
  assert.throws(() => fixtureOrigin({...valid,Networks:{owned:{IPAddress:'172.18.0.2'},bridge:{}}},'owned',9999));
  assert.throws(() => fixtureOrigin({...valid,Ports:{'9999/tcp':[{HostIp:'0.0.0.0',HostPort:'9999'}]}},'owned',9999));
});
test('mail parser binds one reserved recipient and one unambiguous eight-digit code', () => {
  const message={To:[{Address:'member@example.invalid'}],Text:'FEDERATION-CODE:01234567',HTML:'<p>FEDERATION-CODE:01234567</p>'};
  assert.equal(sinkCode(message,'member@example.invalid'),'01234567');
  assert.throws(() => sinkCode(message,'someone@example.invalid'));
  assert.throws(() => sinkCode(message,'member@example.com'));
  assert.throws(() => sinkCode({...message,HTML:'FEDERATION-CODE:87654321'},'member@example.invalid'));
  assert.throws(() => sinkCode({...message,Text:'FEDERATION-CODE:012345678',HTML:''},'member@example.invalid'));
  assert.throws(() => sinkCode({...message,To:[...message.To,{Address:'other@example.invalid'}]},'member@example.invalid'));
});
test('Auth runner refuses missing confirmation before any Docker command', () => {
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('./federation-email-signup-auth.mjs',import.meta.url))],
    {encoding:'utf8',timeout:5000,env:{PATH:''}});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Explicit disposable email Auth confirmation/);
  assert.doesNotMatch(result.stderr,/spawnSync docker/);
});
test('composed handler transport accepts only exact synthetic origin and reviewed Auth routes', () => {
  assert.equal(fixtureAuthPath('https://syntheticfixture.supabase.co/auth/v1/otp'),'/otp');
  for(const value of ['https://other.supabase.co/auth/v1/otp',
    'https://syntheticfixture.supabase.co/auth/v1/admin/users',
    'https://syntheticfixture.supabase.co/auth/v1/otp?redirect_to=https://example.com',
    'https://user:password@syntheticfixture.supabase.co/auth/v1/otp',
    'https://syntheticfixture.supabase.co/auth/v1/otp#fragment'])assert.throws(()=>fixtureAuthPath(value));
});
