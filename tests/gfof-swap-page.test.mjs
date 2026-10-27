import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountSwapPage, formatPriceImpact} from '../assets/federation/swap/swap-page.mjs';
import {GFOF, SOL} from '../assets/federation/swap/quote-core.mjs';

const html = readFileSync(new URL('../swap.html', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); };
const good = (change = {}) => new Response(JSON.stringify({inputMint: SOL.mint, outputMint: GFOF.mint, inAmount: '10000000', outAmount: '47504969523', swapMode: 'ExactIn', router: 'okx', feeBps: 10, transaction: null, ...change}), {headers: {'content-type': 'application/json'}});
function fixture(fetchImpl = async () => good(), walletOptions) {
  const nodes = new Map(), calls = []; let doc;
  class Element {
    constructor() { this.events = new Map(); this.attributes = {}; this.value = ''; this.textContent = ''; }
    replaceChildren() { this.options = []; this.value = ''; }
    append(option) { this.options.push(option); if (this.options.length === 1) this.value = option.value; }
    setAttribute(k, v) { this.attributes[k] = String(v); } getAttribute(k) { return this.attributes[k] ?? null; }
    addEventListener(k, f) { this.events.set(k, f); } removeEventListener(k) { this.events.delete(k); }
    emit(k) { this.events.get(k)?.({preventDefault() {}}); } focus() { doc.activeElement = this; }
  }
  for (const match of html.matchAll(/<\w+\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    assert.equal(nodes.has(match[1]), false); const n = new Element();
    n.hidden = /\shidden(?:\s|>)/.test(match[0]); n.disabled = /\sdisabled(?:\s|>)/.test(match[0]); nodes.set(match[1], n);
  }
  doc = new Element(); doc.getElementById = id => nodes.get(id); doc.defaultView = new Element();
  nodes.get('swap-direction').value = 'buy';
  if (walletOptions) doc.createElement = () => new Element();
  const api = mountSwapPage(doc, {walletOptions, fetchImpl: (...args) => { calls.push(args); return fetchImpl(...args); }});
  return {doc, api, calls, get: id => nodes.get(id)};
}

test('page initialization enables quote checks only and requests nothing', () => {
  const f = fixture(); assert.equal(f.calls.length, 0); assert.equal(f.get('swap-check').disabled, false);
  assert.equal(f.get('swap-trade').disabled, true); assert.equal(f.get('swap-result').hidden, true);
  assert.match(f.get('swap-message').textContent, /Trading is closed/); f.api.dispose();
});

test('invalid input is explained and focused before any provider request', () => {
  const f = fixture(); f.get('swap-amount').value = '1e6'; f.get('swap-form').emit('submit');
  assert.equal(f.calls.length, 0); assert.equal(f.doc.activeElement, f.get('swap-amount'));
  assert.equal(f.get('swap-amount').getAttribute('aria-invalid'), 'true'); f.api.dispose();
});

test('a valid quote renders exact units without opening trading; an edit clears every result', async () => {
  const f = fixture(); f.get('swap-amount').value = '0.01'; f.get('swap-form').emit('submit'); await flush();
  assert.equal(f.get('swap-output').textContent, '47,504.969523 GFOF'); assert.equal(f.get('swap-result').hidden, false);
  assert.equal(f.get('swap-trade').disabled, true); assert.match(f.get('swap-fee').textContent, /total costs not verified/);
  f.get('swap-amount').emit('input'); assert.equal(f.get('swap-result').hidden, true);
  for (const id of ['swap-input', 'swap-output', 'swap-router', 'swap-fee', 'swap-time']) assert.equal(f.get(id).textContent, '—');
  assert.equal(f.calls.length, 1); f.api.dispose();
});

test('direction change clears the old amount and explains the correct unit precision', () => {
  const f = fixture(); f.get('swap-amount').value = '0.01'; f.get('swap-direction').value = 'sell'; f.get('swap-direction').emit('change');
  assert.equal(f.get('swap-amount').value, ''); assert.equal(f.get('swap-amount-label').textContent, 'GFOF amount to quote');
  assert.match(f.get('swap-amount-help').textContent, /6 decimal places/); assert.equal(f.calls.length, 0); f.api.dispose();
});

test('visibility and navigation events clear a quote without making another request', async () => {
  for (const event of ['visibilitychange', 'pagehide', 'pageshow']) {
    const f = fixture(); f.get('swap-amount').value = '0.01'; f.get('swap-form').emit('submit'); await flush();
    (event === 'visibilitychange' ? f.doc : f.doc.defaultView).emit(event);
    assert.equal(f.get('swap-result').hidden, true); assert.equal(f.get('swap-output').textContent, '—');
    assert.equal(f.calls.length, 1); f.api.dispose();
  }
});

test('cancel and clear remain usable during a stalled quote check', async () => {
  const f = fixture(() => new Promise(() => {})); f.get('swap-amount').value = '0.01'; f.get('swap-form').emit('submit');
  assert.equal(f.get('swap-cancel').hidden, false); f.get('swap-cancel').emit('click'); await flush();
  assert.equal(f.get('swap-check').disabled, false); assert.match(f.get('swap-message').textContent, /cancelled/);
  f.get('swap-clear').emit('click'); assert.equal(f.get('swap-amount').value, '');
  assert.equal(f.doc.activeElement, f.get('swap-amount')); assert.equal(f.calls.length, 1); f.api.dispose();
});

test('disposal removes handlers and cannot leave an enabled quote button', () => {
  const f = fixture(); f.api.dispose(); f.get('swap-amount').value = '0.01'; f.get('swap-form').emit('submit');
  assert.equal(f.calls.length, 0); assert.equal(f.get('swap-check').disabled, true);
  assert.equal(f.doc.events.size, 0); assert.equal(f.doc.defaultView.events.size, 0);
});

test('the preview has strict CSP, disabled trading and no wallet/plugin execution entry', () => {
  assert.match(html, /connect-src https:\/\/api\.jup\.ag;/);
  assert.match(html, /form-action 'none'/); assert.match(html, /script-src 'self'/);
  assert.match(html, /id="swap-trade" disabled/);
  assert.doesNotMatch(html, /<script[^>]*src="https:|unsafe-inline|iframe|window\.solana/i);
  for (const file of ['quote-core.mjs', 'swap-page.mjs']) {
    const source = readFileSync(new URL('../assets/federation/swap/' + file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /innerHTML|localStorage|sessionStorage|document\.cookie|signTransaction|signAllTransactions|sendTransaction|\/execute|Jupiter\.init|window\.solana/);
  }
});

test('the hosted swap policy permits only its quote origin and keeps mint links consistent', () => {
  const config = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
  const blocks = config.split('[[headers]]');
  const swap = blocks.filter(block => /for = "\/swap\*"/.test(block));
  assert.equal(swap.length, 1);
  assert.match(swap[0], /connect-src https:\/\/api\.jup\.ag;/);
  assert.match(swap[0], /frame-ancestors 'none'/);
  assert.match(swap[0], /Cache-Control = "private, no-store"/);
  assert.doesNotMatch(swap[0], /unsafe-inline|plugin\.jup\.ag/);
  assert.match(config, /from = "\/swap"\s+to = "\/swap\.html"\s+status = 200/);
  const globalPolicy = blocks.find(block => /for = "\/\*"/.test(block));
  assert.doesNotMatch(globalPolicy, /api\.jup\.ag/);
  for (const origin of ['https://solscan.io/token/', 'https://tebfun.xyz/token/']) assert.ok(html.includes('href="' + origin + GFOF.mint + '"'));
  assert.ok(html.includes('<code>' + GFOF.mint + '</code>'));
});

test('reported protections are labelled, cleared with edits and never enable trading', async () => {
  const f = fixture(async () => good({priceImpact: -0.15, otherAmountThreshold: '47000000001', slippageBps: 75}));
  f.get('swap-amount').value = '0.01'; f.get('swap-form').emit('submit'); await flush();
  assert.equal(f.get('swap-impact').textContent, '-0.15%');
  assert.equal(f.get('swap-minimum').textContent, '47,000.000001 GFOF');
  assert.equal(f.get('swap-slippage').textContent, '0.75%');
  assert.match(f.get('swap-review-notes').textContent, /No protection is enforced/);
  assert.equal(f.get('swap-trade').disabled, true);
  f.get('swap-amount').emit('input');
  for (const id of ['swap-impact', 'swap-minimum', 'swap-slippage', 'swap-review-notes']) assert.equal(f.get(id).textContent, '—');
  f.api.dispose();
});

test('missing protection data is explained without inventing a minimum or slippage', async () => {
  const f = fixture(); f.get('swap-amount').value = '0.01'; f.get('swap-form').emit('submit'); await flush();
  for (const id of ['swap-impact', 'swap-minimum', 'swap-slippage']) assert.equal(f.get(id).textContent, 'Not returned');
  assert.match(f.get('swap-review-notes').textContent, /Minimum output was not returned/);
  assert.equal(f.get('swap-trade').disabled, true); f.api.dispose();
});

 test('optional wallet connection clears quotes but never requests one or includes an address', async () => {
  const address = '11111111111111111111111111111111'; let connections = 0, change;
  const wallet = {name: '<fake wallet>', chains: ['solana:mainnet'], features: {
    'standard:connect': {version: '1.0.0', connect: async () => { connections++; return {accounts: [{address, publicKey: new Uint8Array(32), chains: ['solana:mainnet']}]}; }},
    'standard:disconnect': {version: '1.0.0', disconnect: async () => {}},
    'standard:events': {version: '1.0.0', on: (_event, fn) => {change = fn; return () => {};}}
  }};
  const f = fixture(async () => good(), {registry: {get: () => [wallet], on: () => () => {}}});
  assert.equal(connections, 0); assert.equal(f.calls.length, 0); assert.equal(f.get('swap-wallet-connect').disabled, true); assert.equal(f.get('swap-wallet-select').options[1].textContent, '<fake wallet>');
  f.get('swap-amount').value = '0.01'; f.get('swap-form').emit('submit'); await flush();
  f.get('swap-wallet-select').value = '1'; f.get('swap-wallet-select').onchange();
  f.get('swap-wallet-connect').emit('click'); await flush();
  assert.equal(connections, 1); assert.equal(f.calls.length, 1); assert.equal(f.get('swap-result').hidden, true);
  assert.equal(f.get('swap-wallet-address').textContent, address); assert.equal(f.get('swap-trade').disabled, true);
  assert.deepEqual([...new URL(f.calls[0][0]).searchParams.keys()].sort(), ['amount', 'inputMint', 'outputMint']);
  change(); assert.equal(f.get('swap-wallet-address').textContent, 'No address displayed'); assert.equal(f.calls.length, 1);
  f.api.dispose();
});

test('broken optional wallet discovery cannot block manual quotes', async () => {
  const f=fixture(async()=>good(),{registry:{get:()=>[],on:()=>{throw Error('extension failure');}}});
  assert.match(f.get('swap-wallet-message').textContent,/discovery is unavailable/);
  assert.equal(f.get('swap-wallet-connect').disabled,true);
  f.get('swap-amount').value='0.01';f.get('swap-form').emit('submit');await flush();
  assert.equal(f.calls.length,1);assert.equal(f.get('swap-result').hidden,false);assert.equal(f.get('swap-trade').disabled,true);f.api.dispose();
});

test('network failures explain uncertainty without asking users to weaken browser security', async () => {
  const f = fixture(async () => { throw new TypeError('certificate detail'); });
  f.get('swap-amount').value = '0.01'; f.get('swap-form').emit('submit'); await flush();
  assert.match(f.get('swap-message').textContent, /could not reach the quote service/);
  assert.match(f.get('swap-message').textContent, /cannot identify which/);
  assert.match(f.get('swap-message').textContent, /Do not bypass security warnings/);
  assert.equal(f.get('swap-message').textContent.includes('certificate detail'), false);
  assert.equal(f.get('swap-trade').disabled, true); assert.equal(f.calls.length, 1); f.api.dispose();
});

test('price impact is readable without losing sign or presenting tiny values as zero', () => {
  assert.equal(formatPriceImpact(-1.359343895885477), '≈ -1.3593%');
  assert.equal(formatPriceImpact(1.2399722312336638), '≈ 1.24%');
  assert.equal(formatPriceImpact(-0.000001), 'Between -0.0001% and 0%');
  assert.equal(formatPriceImpact(0.000001), 'Between 0% and 0.0001%');
  assert.equal(formatPriceImpact(0), '0%');
  assert.equal(formatPriceImpact(null), 'Not returned');
});
