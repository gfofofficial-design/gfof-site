import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkCommandDeckHealth } from '../scripts/check-command-deck-health.mjs';

const MINT = 'Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV';
const SOL = 'So11111111111111111111111111111111111111112';
const origin = 'https://deploy-preview-104--gfof.netlify.app';
const now = Date.parse('2026-10-09T11:30:00.000Z');
const fixture = JSON.parse(readFileSync(new URL('../record/current-mint-locks-three-20261008.json', import.meta.url)));
const keys = [
  'AiRhuw9iFyXiZYv2hqanBK12dckebF4vNMoAzj9Nj9nY', 'F1iUer7wVsdv7uQ4if77Jy1ZAfTVDjSy4Pd7ZiXsVfS1',
  'BW6ZUUT5NXxSGMKNAzoMYbqrXy5Dm1ev1ekEgYSXJWX8', '9NeQZao9SNt7FztKbNMCwCmEYZTYkWnidZmW4chuupQq',
  'EPdpg7AYEzcwudN7TRdEkCGHQeHRrFhoK2yiYxDdGLnv', 'DkzEr7nsuhL4Ser6AyZQ71u2mBdGj86mXmHDAzpS1Pop', MINT,
];
function locks() {
  return { mint: MINT, commitment: 'finalized', slot: fixture.result.context.slot,
    observedAt: new Date(now).toISOString(),
    accounts: fixture.result.value.map((account, i) => ({ address: keys[i], account: structuredClone(account) })) };
}
function wallet() {
  return { address: MINT, network: 'solana-mainnet', commitment: 'confirmed',
    observedAt: new Date(now).toISOString(), slots: [454550404, 454550404, 454550404],
    sol: '0', tokenAccounts: 0, tokens: [], pricesAvailable: true,
    pricing: { source: 'Jupiter Price V3', status: 'available', requested: 1,
      unrequested: 0, prices: { [SOL]: { usdPrice: 1, blockId: 454550404 } } } };
}
async function run(change = () => {}, options = {}) {
  const calls = [];
  const result = await checkCommandDeckHealth({ environment: 'preview', now: () => now,
    fetcher: async (url, request) => {
      calls.push({ url, request });
      const body = url.endsWith('/api/federation-wallet') ? wallet() : locks();
      change(body, url);
      return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    }, ...options });
  return { result, calls };
}
test('one finite check uses fixed public data, bounded requests and no credentials', async () => {
  const { result, calls } = await run();
  assert.equal(result.healthy, true);
  assert.equal(calls.length, 2);
  const lookup = calls.find(c => c.url.endsWith('/api/federation-wallet'));
  assert.equal(lookup.url, origin + '/api/federation-wallet');
  assert.equal(lookup.request.method, 'POST');
  assert.deepEqual(JSON.parse(lookup.request.body), { address: MINT });
  for (const c of calls) {
    assert.equal(c.request.headers.Origin, origin);
    assert.equal(c.request.credentials, 'omit');
    assert.equal(c.request.redirect, 'error');
    assert.equal(c.request.cache, 'no-store');
    assert.equal(c.request.headers.Authorization, undefined);
    assert.equal(c.request.headers.Cookie, undefined);
  }
  assert.equal(JSON.stringify(result).includes('accounts'), false);
  assert.equal(JSON.stringify(result).includes('usdPrice'), false);
});
test('arbitrary destinations, missing environment and unbounded deadlines never fetch', async () => {
  let calls = 0;
  for (const options of [{}, { environment: 'https://other.example' }, { environment: '__proto__' },
    { environment: 'preview', timeoutMs: 0 }, { environment: 'preview', timeoutMs: 20001 }]) {
    await assert.rejects(checkCommandDeckHealth({ fetcher: () => { calls++; }, ...options }));
  }
  assert.equal(calls, 0);
});
test('production is a distinct explicit fixed origin', async () => {
  const { result, calls } = await run(() => {}, { environment: 'production' });
  assert.equal(result.environment, 'production');
  assert.ok(calls.every(c => c.url.startsWith('https://galacticfederation.co/api/') &&
    c.request.headers.Origin === 'https://galacticfederation.co'));
});
test('a working balance read with unavailable prices is degraded, not fully healthy', async () => {
  const { result } = await run((body, url) => {
    if (url.endsWith('federation-wallet')) {
      body.pricing.status = 'unavailable'; body.pricing.prices = {}; body.pricesAvailable = false;
    }
  });
  assert.equal(result.healthy, false);
  assert.equal(result.results[0].reason, 'pricing_unavailable');
  assert.equal(result.results[1].healthy, true);
});
for (const [name, mutate] of [
  ['stale observation', b => { b.observedAt = new Date(now - 120001).toISOString(); }],
  ['future observation', b => { b.observedAt = new Date(now + 30001).toISOString(); }],
  ['wrong address', b => { b.address = SOL; }],
  ['wrong network', b => { b.network = 'solana-devnet'; }],
  ['negative SOL', b => { b.sol = '-1'; }],
  ['exponent quantity', b => { b.tokens = [{ mint: MINT, quantity: '1e9' }]; b.tokenAccounts = 1; }],
  ['duplicate token', b => { b.tokens = [{ mint: MINT, quantity: '1' }, { mint: MINT, quantity: '2' }]; b.tokenAccounts = 2; }],
  ['stale price slot', b => { b.pricing.prices[SOL].blockId -= 9001; }],
]) test('wallet rejects ' + name, async () => {
  const { result } = await run((b, url) => { if (url.endsWith('federation-wallet')) mutate(b); });
  assert.equal(result.results[0].reason, 'invalid_wallet_response');
});
for (const [name, mutate] of [
  ['duplicate account', b => { b.accounts[1] = structuredClone(b.accounts[0]); }],
  ['wrong escrow mint', b => { b.accounts[1].account.data.parsed.info.mint = SOL; }],
  ['numeric escrow amount', b => { b.accounts[1].account.data.parsed.info.tokenAmount.amount = 30150000000000; }],
  ['unsupported metadata', b => {
    const bytes = Buffer.from(b.accounts[0].account.data[0], 'base64'); bytes[8] = 5;
    b.accounts[0].account.data[0] = bytes.toString('base64');
  }],
  ['wrong contract mint', b => {
    const bytes = Buffer.from(b.accounts[0].account.data[0], 'base64'); bytes[177] ^= 1;
    b.accounts[0].account.data[0] = bytes.toString('base64');
  }],
  ['changed cliff schedule', b => {
    const bytes = Buffer.from(b.accounts[0].account.data[0], 'base64'); bytes[33] ^= 1;
    b.accounts[0].account.data[0] = bytes.toString('base64');
  }],
  ['restored mint authority', b => { b.accounts[6].account.data.parsed.info.mintAuthority = SOL; }],
  ['stale lock observation', b => { b.observedAt = new Date(now - 120001).toISOString(); }],
]) test('locks reject ' + name, async () => {
  const { result } = await run((b, url) => { if (url.endsWith('treasury-locks')) mutate(b); });
  assert.equal(result.results[1].reason, 'invalid_lock_response');
});
for (const [name, make, reason] of [
  ['503 error', () => new Response('private upstream details', { status: 503 }), 'unexpected_status'],
  ['202 response', () => new Response('{}', { status: 202 }), 'unexpected_status'],
  ['HTML fallback', () => new Response('<title>Command Deck</title>', { headers: { 'Content-Type': 'text/html' } }), 'unexpected_content_type'],
  ['malformed JSON', () => new Response('{private details', { headers: { 'Content-Type': 'application/json' } }), 'invalid_response'],
  ['oversized response', () => new Response(JSON.stringify({ private: 'x'.repeat(262145) }), { headers: { 'Content-Type': 'application/json' } }), 'invalid_response'],
]) test('transport rejects ' + name + ' without copying error content', async () => {
  const { result } = await run(() => {}, { fetcher: async () => make() });
  assert.equal(result.healthy, false);
  assert.ok(result.results.every(r => r.reason === reason));
  assert.equal(JSON.stringify(result).includes('private'), false);
});
for (const phase of ['headers', 'body']) test('ignored-abort stalled ' + phase + ' still meets the deadline', { timeout: 1000 }, async () => {
  let cancelled = 0;
  const start = performance.now();
  const { result } = await run(() => {}, { timeoutMs: 20, fetcher: async () =>
    phase === 'headers' ? new Promise(() => {}) : {
      status: 200, ok: true, headers: new Headers({ 'Content-Type': 'application/json' }),
      body: { getReader: () => ({ read: () => new Promise(() => {}),
        cancel() { cancelled++; return new Promise(() => {}); } }) },
    } });
  assert.ok(performance.now() - start < 500);
  assert.ok(result.results.every(r => r.reason === 'timeout'));
  assert.equal(cancelled, phase === 'body' ? 2 : 0);
});
test('thrown upstream details stay out of the report', async () => {
  const { result } = await run(() => {}, { fetcher: async () => {
    throw new Error('private token and account details');
  } });
  assert.ok(result.results.every(r => r.reason === 'unavailable'));
  assert.equal(JSON.stringify(result).includes('private'), false);
});
