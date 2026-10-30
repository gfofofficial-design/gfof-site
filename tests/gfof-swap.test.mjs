import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GFOF, SOL, TRADING_ENABLED, parseAmount, formatUnits, makeQuoteRequest, projectQuote, createQuoteController} from '../assets/federation/swap/quote-core.mjs';
import {USDC, QUOTE_TOKENS, QUOTE_PAIRS} from '../assets/federation/swap/token-registry.mjs';

const request = () => makeQuoteRequest('buy', '0.01');
const response = (change = {}) => ({inputMint: SOL.mint, outputMint: GFOF.mint, inAmount: '10000000',
  outAmount: '47504969523', transaction: null, taker: null, swapMode: 'ExactIn', router: 'okx', feeBps: 10, ...change});
const json = data => new Response(JSON.stringify(data), {headers: {'content-type': 'application/json'}});
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(fetchImpl = async () => json(response())) {
  let time = 100000, elapsed = 100000, id = 0; const timers = new Map(), states = [], calls = [];
  const controller = createQuoteController({fetchImpl: (...args) => { calls.push(args); return fetchImpl(...args); },
    onState: state => states.push(state), now: () => time, monotonic: () => elapsed,
    setTimer: (fn, ms) => { timers.set(++id, {fn, at: time + ms, ms}); return id; }, clearTimer: id => timers.delete(id)});
  return {controller, states, calls, timers, state: () => states.at(-1),
    advance(ms) { time += ms; elapsed += ms; },
    moveWall(ms) { time += ms; },
    elapse(ms) { elapsed += ms; },
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

test('V2 price impact is already in percentage points; minimum output keeps full precision', () => {
  const q = projectQuote(response({priceImpact: -0.15, priceImpactPct: '-0.0015', otherAmountThreshold: '47000000001', slippageBps: 75}), request(), 0);
  assert.equal(q.priceImpact, -0.15); assert.equal(q.minimumOutput, '47,000.000001'); assert.equal(q.slippageBps, 75);
  assert.deepEqual(q.reviewNotes, []); assert.ok(Object.isFrozen(q.reviewNotes));
});

test('missing details stay unknown and zero details are not treated as missing', () => {
  const missing = projectQuote(response({priceImpactPct: '0.1'}), request(), 0);
  assert.equal(missing.priceImpact, null); assert.equal(missing.minimumOutput, null); assert.equal(missing.slippageBps, null);
  assert.equal(missing.reviewNotes.length, 3);
  const zero = projectQuote(response({priceImpact: 0, otherAmountThreshold: '0', slippageBps: 0, feeBps: 0}), request(), 0);
  assert.equal(zero.priceImpact, 0); assert.equal(zero.slippageBps, 0); assert.equal(zero.feeBps, 0);
  assert.deepEqual(zero.reviewNotes, ['No positive minimum output was reported.']);
});

test('malformed or impossible review details cannot become a usable quote projection', () => {
  for (const change of [{priceImpact: '0.1'}, {priceImpact: NaN}, {priceImpact: Infinity}, {priceImpact: 101}, {priceImpact: -101},
    {otherAmountThreshold: '47504969524'}, {otherAmountThreshold: '-1'}, {otherAmountThreshold: '00'},
    {slippageBps: '75'}, {slippageBps: 0.5}, {slippageBps: -1}, {slippageBps: 10001}]) {
    assert.throws(() => projectQuote(response(change), request(), 0), {code: 'unavailable'});
  }
});

test('browser transport failure has a distinct safe state without inventing the cause', async () => {
  const states = [];
  const controller = createQuoteController({fetchImpl: async () => { throw new TypeError('private network detail'); }, onState: state => states.push(state)});
  await controller.request('buy', '0.01');
  assert.equal(states.at(-1).phase, 'network');
  assert.equal(JSON.stringify(states).includes('private network detail'), false);
  controller.dispose();
});

test('the reviewed starting list contains only fixed mainnet SOL, GFOF and native USDC', () => {
  assert.deepEqual(QUOTE_TOKENS.map(t => t.id), ['SOL', 'GFOF', 'USDC']);
  assert.equal(USDC.mint, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  assert.equal(USDC.decimals, 6);
  assert.equal(new Set(QUOTE_TOKENS.map(t => t.mint)).size, 3);
  for (const value of [...QUOTE_TOKENS, ...QUOTE_PAIRS, QUOTE_TOKENS, QUOTE_PAIRS]) assert.ok(Object.isFrozen(value));
  assert.equal(QUOTE_PAIRS.length, 6); assert.equal(TRADING_ENABLED, false);
});

test('all six reviewed pairs bind exact mints and integer amounts without wallet or fee parameters', () => {
  for (const pair of QUOTE_PAIRS) {
    const r = makeQuoteRequest(pair.id, '1.234567'), u = new URL(r.url);
    assert.deepEqual([...u.searchParams.keys()], ['inputMint', 'outputMint', 'amount']);
    assert.equal(u.searchParams.get('inputMint'), pair.input.mint);
    assert.equal(u.searchParams.get('outputMint'), pair.output.mint);
    assert.equal(r.atomic, pair.input.decimals === 9 ? '1234567000' : '1234567');
    const q = projectQuote(response({inputMint: pair.input.mint, outputMint: pair.output.mint,
      inAmount: r.atomic, outAmount: pair.output.decimals === 9 ? '123456789' : '1234567'}), r, 0);
    assert.equal(q.output, pair.output.decimals === 9 ? '0.123456789' : '1.234567');
    assert.equal(q.inputSymbol, pair.input.symbol); assert.equal(q.outputSymbol, pair.output.symbol);
  }
});

test('unlisted tokens, same-token pairs and pair injection never reach a provider', async () => {
  const f = fixture();
  for (const pair of ['SOL:SOL', 'USDC:USDC', 'GFOF:GFOF', 'SOL:BTC', 'ETH:USDC', 'SOL:USDC&payer=x',
    'SOL:' + USDC.mint, '__proto__', 'constructor', {input: SOL, output: USDC}, null]) {
    await f.controller.request(pair, '1');
    assert.equal(f.state().phase, 'invalidPair'); assert.equal(f.calls.length, 0);
  }
  f.controller.dispose();
});

test('USDC precision and mismatched response mints fail closed', () => {
  assert.throws(() => makeQuoteRequest('USDC:SOL', '0.0000001'), {code: 'amount'});
  const r = makeQuoteRequest('SOL:USDC', '0.01');
  for (const data of [response(), response({outputMint: 'USDC', symbol: 'USDC'}), response({outputMint: USDC.mint, transaction: 'not-permitted'})]) {
    assert.throws(() => projectQuote(data, r, 0), {code: 'unavailable'});
  }
});


test('a frozen or backward device clock cannot admit a late provider reply', async () => {
  for (const mode of ['frozen', 'backward']) {
    let resolve;const f=fixture(()=>new Promise(r=>{resolve=r;}));
    const pending=f.controller.request('buy','0.01');
    f.elapse(8001);if(mode==='backward')f.moveWall(-60000);
    resolve(json(response()));await pending;
    assert.notEqual(f.state().phase,'ready');assert.equal(f.calls.length,1);assert.equal(f.timers.size,0);f.controller.dispose();
  }
});
