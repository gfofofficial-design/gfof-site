import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GFOF, SOL, TRADING_ENABLED, parseAmount, formatUnits, makeQuoteRequest, projectQuote, createQuoteController} from '../assets/federation/swap/quote-core.mjs';

const request = () => makeQuoteRequest('buy', '0.01');
const response = (change = {}) => ({inputMint: SOL.mint, outputMint: GFOF.mint, inAmount: '10000000',
  outAmount: '47504969523', transaction: null, taker: null, swapMode: 'ExactIn', router: 'okx', feeBps: 10, ...change});
const json = data => new Response(JSON.stringify(data), {headers: {'content-type': 'application/json'}});
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(fetchImpl = async () => json(response())) {
  let time = 100000, id = 0; const timers = new Map(), states = [], calls = [];
  const controller = createQuoteController({fetchImpl: (...args) => { calls.push(args); return fetchImpl(...args); },
    onState: state => states.push(state), now: () => time,
    setTimer: (fn, ms) => { timers.set(++id, {fn, at: time + ms, ms}); return id; }, clearTimer: id => timers.delete(id)});
  return {controller, states, calls, timers, state: () => states.at(-1),
    advance(ms) { time += ms; },
    fire(ms) { const entry = [...timers].find(([, t]) => t.ms === ms); assert.ok(entry, 'expected timer'); timers.delete(entry[0]); entry[1].fn(); }};
}

test('the fixed GFOF mint and six decimal places match retained finalized mint evidence', () => {
  const evidence = JSON.parse(readFileSync(new URL('../record/current-mint-locks-three-20261008.json', import.meta.url)));
  const mint = evidence.result.value.at(-1).data.parsed.info;
  assert.equal(GFOF.decimals, mint.decimals);
  assert.equal(GFOF.mint, 'Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV');
  assert.equal(TRADING_ENABLED, false);
  assert.ok(Object.isFrozen(GFOF));
});

test('amount conversion uses integer arithmetic through the full u64 range', () => {
  assert.equal(parseAmount('.01', 9), '10000000');
  assert.equal(parseAmount(' 0001.2300 ', 6), '1230000');
  assert.equal(parseAmount('18446744073.709551615', 9), '18446744073709551615');
  assert.equal(formatUnits('18446744073709551615', 9), '18,446,744,073.709551615');
  assert.equal(formatUnits('1', 6), '0.000001');
});

test('invalid, zero, excessive-precision and overflow amounts never become requests', () => {
  for (const value of ['', '.', '0', '0.000000000', '-1', '1e6', '1,000', 'NaN', 'Infinity', '1&payer=x', '1.0000000001', '18446744073.709551616', '9'.repeat(41), 1, null]) {
    assert.throws(() => parseAmount(value, 9), {code: 'amount'});
  }
  assert.throws(() => parseAmount('0.0000001', 6));
  assert.throws(() => parseAmount('1', 18));
});

test('both directions use only fixed mints, integer amount and the quote-only endpoint', () => {
  for (const direction of ['buy', 'sell']) {
    const r = makeQuoteRequest(direction, '1'), url = new URL(r.url);
    assert.equal(url.origin + url.pathname, 'https://api.jup.ag/swap/v2/order');
    assert.deepEqual([...url.searchParams.keys()], ['inputMint', 'outputMint', 'amount']);
    assert.equal(url.searchParams.get('inputMint'), direction === 'buy' ? SOL.mint : GFOF.mint);
    assert.equal(url.searchParams.get('outputMint'), direction === 'buy' ? GFOF.mint : SOL.mint);
  }
  assert.throws(() => makeQuoteRequest('__proto__', '1'));
});

test('quote projection is bound to the exact request and discards provider extras', () => {
  const q = projectQuote(response({requestId: 'not-for-display', routePlan: [{secret: 'not-for-display'}], errorMessage: '<img src=x>', maker: 'not-for-display'}), request(), 100000);
  assert.equal(q.output, '47,504.969523'); assert.equal(q.feeBps, 10); assert.equal(q.expiresAt, 130000);
  assert.doesNotMatch(JSON.stringify(q), /not-for-display|img src|transaction|requestId/);
  assert.ok(Object.isFrozen(q));
  assert.equal(projectQuote(response({feeBps: undefined}), request(), 0).feeBps, null);
});

test('transactions, changed pairs, mismatched amounts, errors and malformed outputs are refused', () => {
  for (const change of [{transaction: 'unsigned-but-forbidden'}, {transaction: ''}, {taker: 'unexpected-wallet'},
    {inputMint: GFOF.mint}, {outputMint: SOL.mint}, {inAmount: '1'}, {outAmount: '0'}, {outAmount: '01'},
    {outAmount: 123}, {outAmount: '18446744073709551616'}, {outAmount: '-1'}, {swapMode: 'ExactOut'},
    {router: '<svg>'}, {errorCode: 1}, {error: 'No routes'}, {feeBps: -1}, {feeBps: 0.5}, {feeBps: 10001}, {feeBps: '10'}]) {
    assert.throws(() => projectQuote(response(change), request(), 0), {code: 'unavailable'});
  }
});

test('mounting a controller makes no request; an explicit check is a credential-free GET', async () => {
  const f = fixture(); assert.equal(f.calls.length, 0); assert.equal(f.state().phase, 'idle');
  await f.controller.request('buy', '0.01');
  assert.equal(f.calls.length, 1); assert.equal(f.state().phase, 'ready');
  const [, options] = f.calls[0]; assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'omit');
  assert.equal(options.redirect, 'error'); assert.equal(options.referrerPolicy, 'no-referrer');
  assert.equal(options.body, undefined); assert.deepEqual(options.headers, {Accept: 'application/json'});
  f.controller.dispose();
});

test('requests are manual, locally spaced and an expiry removes rather than refreshes a quote', async () => {
  const f = fixture(); await f.controller.request('buy', '0.01'); f.fire(30000);
  assert.equal(f.state().phase, 'expired'); assert.equal(f.calls.length, 1);
  await f.controller.request('buy', '0.01'); assert.equal(f.state().phase, 'rate'); assert.equal(f.calls.length, 1);
  f.advance(5000); await f.controller.request('buy', '0.01'); assert.equal(f.calls.length, 2);
  f.controller.dispose();
});

test('edits and cancellation settle an ignored-abort request and suppress its late reply', async () => {
  for (const phase of ['idle', 'cancelled']) {
    let resolve; const f = fixture(() => new Promise(r => { resolve = r; }));
    const pending = f.controller.request('buy', '0.01'); assert.equal(f.state().phase, 'loading');
    f.controller.invalidate(phase); await pending; assert.equal(f.state().phase, phase);
    resolve(json(response())); await tick(); assert.equal(f.state().phase, phase); assert.equal(f.timers.size, 0);
  }
});

test('duplicate clicks cannot make a second request while one is active', async () => {
  const f = fixture(() => new Promise(() => {}));
  const pending = f.controller.request('buy', '0.01'); await f.controller.request('sell', '1000');
  assert.equal(f.calls.length, 1); f.controller.invalidate(); await pending;
});

test('header and body stalls settle at the deadline even if transport/cancellation ignores it', async () => {
  for (const phase of ['headers', 'body']) {
    let cancelled = 0;
    const f = fixture(() => phase === 'headers' ? new Promise(() => {}) : Promise.resolve({ok: true, status: 200,
      headers: new Headers({'content-type': 'application/json'}), body: {getReader: () => ({read: () => new Promise(() => {}), cancel() { cancelled++; return new Promise(() => {}); }})}}));
    const pending = f.controller.request('buy', '0.01'); await tick(); f.advance(8000); f.fire(8000); await pending;
    assert.equal(f.state().phase, 'timeout'); assert.equal(f.calls.length, 1);
    if (phase === 'body') assert.ok(cancelled >= 1);
    f.controller.dispose();
  }
});

test('a reply delivered after the time budget cannot win ahead of a delayed timer', async () => {
  let resolve; const f = fixture(() => new Promise(r => { resolve = r; }));
  const pending = f.controller.request('buy', '0.01'); f.advance(8001); resolve(json(response())); await pending;
  assert.equal(f.state().phase, 'timeout'); f.controller.dispose();
});

test('old completions cannot overwrite a newer opposite-direction quote', async () => {
  let resolve; let calls = 0;
  const f = fixture(() => ++calls === 1 ? new Promise(r => { resolve = r; }) : Promise.resolve(json(response({inputMint: GFOF.mint, outputMint: SOL.mint, inAmount: '1000000000', outAmount: '204625', router: 'dflow'}))));
  const old = f.controller.request('buy', '0.01'); f.controller.invalidate(); await old; f.advance(5000);
  await f.controller.request('sell', '1000'); assert.equal(f.state().quote.output, '0.000204625');
  resolve(json(response())); await tick(); assert.equal(f.state().quote.direction, 'sell'); f.controller.dispose();
});

test('rate limits back off without retries; failure messages never copy the upstream body', async () => {
  const f = fixture(async () => new Response('PRIVATE_UPSTREAM_TEXT', {status: 429}));
  await f.controller.request('buy', '0.01'); assert.equal(f.state().phase, 'rate');
  f.advance(10000); await f.controller.request('buy', '0.01'); assert.equal(f.calls.length, 1);
  assert.doesNotMatch(JSON.stringify(f.states), /PRIVATE_UPSTREAM_TEXT/); assert.equal(f.timers.size, 0); f.controller.dispose();
});

test('HTTP failures, HTML, malformed JSON and oversized streamed replies fail closed', async () => {
  for (const build of [() => new Response('private', {status: 503}), () => new Response('<h1>not JSON</h1>', {headers: {'content-type': 'text/html'}}),
    () => new Response('{broken', {headers: {'content-type': 'application/json'}}),
    () => new Response('x'.repeat(100001), {headers: {'content-type': 'application/json'}}),
    () => new Response('{}', {headers: {'content-type': 'application/json', 'content-length': '100001'}})]) {
    const f = fixture(async () => build()); await f.controller.request('buy', '0.01');
    assert.equal(f.state().phase, 'unavailable'); assert.equal(f.calls.length, 1); assert.equal(f.timers.size, 0); f.controller.dispose();
  }
});

test('disposal prevents new checks and clears any outstanding quote freshness timer', async () => {
  const f = fixture(); await f.controller.request('buy', '0.01'); f.controller.dispose();
  const count = f.states.length; await f.controller.request('sell', '1000');
  assert.equal(f.states.length, count); assert.equal(f.calls.length, 1); assert.equal(f.timers.size, 0);
});
