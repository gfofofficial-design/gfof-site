const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/federation/fed-deck-locks.js'), 'utf8');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../record/current-mint-locks-three-20261008.json')));
const addresses = [
  'AiRhuw9iFyXiZYv2hqanBK12dckebF4vNMoAzj9Nj9nY', 'F1iUer7wVsdv7uQ4if77Jy1ZAfTVDjSy4Pd7ZiXsVfS1',
  'BW6ZUUT5NXxSGMKNAzoMYbqrXy5Dm1ev1ekEgYSXJWX8', '9NeQZao9SNt7FztKbNMCwCmEYZTYkWnidZmW4chuupQq',
  'EPdpg7AYEzcwudN7TRdEkCGHQeHRrFhoK2yiYxDdGLnv', 'DkzEr7nsuhL4Ser6AyZQ71u2mBdGj86mXmHDAzpS1Pop',
  'Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV',
];

function payload() {
  return {
    mint: addresses[6], commitment: 'finalized', slot: fixture.result.context.slot,
    observedAt: new Date().toISOString(),
    accounts: fixture.result.value.map((account, index) => ({ address: addresses[index], account: structuredClone(account) })),
  };
}

function setup(fetch, timers = { setTimeout, clearTimeout }) {
  const nodes = new Map();
  let focused;
  function node(tagName) {
    return {
      tagName, attributes: {}, children: [], events: {}, hidden: false, parentElement: { open: false },
      classList: { toggle() {} },
      get textContent() {
        return this.children.map(child => typeof child === 'string' ? child : child.textContent).join('');
      },
      set textContent(value) { this.replaceChildren(value); },
      setAttribute(key, value) { this.attributes[key] = value; },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      addEventListener(key, callback) { this.events[key] = callback; },
      focus() { focused = this; },
    };
  }
  function get(id) {
    if (!nodes.has(id)) nodes.set(id, node());
    return nodes.get(id);
  }
  const states = Array.from({ length: 3 }, () => node('span'));
  const markers = Array.from({ length: 3 }, () => node('span'));
  const document = {
    getElementById: get, createElement: node, createElementNS: (_, tag) => node(tag),
    querySelectorAll: selector => selector === '[data-lock-source-state]' ? states : markers,
  };
  vm.runInNewContext(source, {
    document, fetch, AbortController, atob: value => Buffer.from(value, 'base64').toString('binary'),
    Date, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
  });
  return { get, states, focused: () => focused, refresh: () => get('deck-lock-refresh').events.click() };
}

async function settled() {
  for (let index = 0; index < 20; index++) await new Promise(resolve => setImmediate(resolve));
}

test('the shared read separates scheduled principal, observed escrow and supported amount', async () => {
  let calls = 0;
  const body = payload();
  const app = setup(async (url, options) => {
    calls++;
    assert.equal(url, '/api/treasury-locks');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.body, undefined);
    return { ok: true, json: async () => body };
  });
  await settled();
  assert.equal(calls, 1);
  assert.equal(app.get('deck-lock-total').textContent, '100,000,000 GFOF');
  assert.match(app.get('deck-lock-percent').textContent, /10\.00%/);
  const cards = app.get('deck-lock-cards').children;
  assert.equal(cards.length, 3);
  assert.equal(cards[0].children[2].textContent, '30,000,000 GFOF');
  assert.equal(cards[2].children[2].textContent, '40,000,000 GFOF');
  assert.equal(cards[0].children.find(child => child.tagName === 'meter').value, 0.3);
  assert.match(cards[1].textContent, /Aug 18, 2027/);
  assert.match(cards[0].textContent, /Observed escrow balance30,150,000 GFOF/);
  assert.match(cards[0].textContent, /150,000 GFOF in this escrow is outside/);
  const details = cards[2].children.find(child => child.tagName === 'details');
  assert.equal(details.children.at(-1).href, 'https://app.streamflow.finance/contract/solana/mainnet/' + addresses[4]);
  assert.equal(app.get('deck-lock-timeline').children.length, 1);
  assert.deepEqual(app.states.map(state => state.textContent), ['Recorded', 'Recorded', 'Recorded']);
  assert.match(app.get('deck-lock-verification').textContent, /Finalized slot [\d,]+ · Last verified/);
  assert.equal(app.get('deck-lock-verification').children.at(-1).attributes.datetime, body.observedAt);
});

test('verified zero escrow stays visible with the verified slot and principal', async () => {
  const body = payload();
  for (const index of [1, 3, 5]) body.accounts[index].account.data.parsed.info.tokenAmount.amount = '0';
  const app = setup(async () => ({ ok: true, json: async () => body }));
  await settled();
  assert.equal(app.get('deck-lock-total').textContent, '0 GFOF');
  assert.match(app.get('deck-lock-cards').children[0].textContent, /Scheduled principal30,000,000 GFOF/);
  assert.deepEqual(app.states.map(state => state.textContent), ['Recorded', 'Recorded', 'Recorded']);
});

test('canceled schedules and recorded withdrawals reduce the supported amount', async () => {
  const body = payload();
  const first = Buffer.from(body.accounts[0].account.data[0], 'base64');
  first.writeBigUInt64LE(1000000000000n, 17);
  body.accounts[0].account.data[0] = first.toString('base64');
  const second = Buffer.from(body.accounts[2].account.data[0], 'base64');
  second.writeBigUInt64LE(1n, 25);
  body.accounts[2].account.data[0] = second.toString('base64');
  const app = setup(async () => ({ ok: true, json: async () => body }));
  await settled();
  assert.equal(app.get('deck-lock-total').textContent, '69,000,000 GFOF');
  assert.match(app.get('deck-lock-cards').children[0].textContent, /Recorded withdrawals1,000,000 GFOF/);
  assert.match(app.get('deck-lock-cards').children[1].textContent, /Canceled0 GFOF/);
});

test('failed refresh clears the old total, timeline and evidence timestamp', async () => {
  let fail = false;
  const app = setup(async () => ({ ok: !fail, json: async () => payload() }));
  await settled();
  fail = true;
  await app.refresh();
  assert.equal(app.get('deck-lock-total').textContent, 'Unavailable');
  assert.equal(app.get('deck-lock-cards').children.length, 0);
  assert.equal(app.get('deck-lock-timeline').children.length, 0);
  assert.equal(app.get('deck-lock-verification').textContent, 'No current verification available.');
  assert.deepEqual(app.states.map(state => state.textContent), ['Unavailable', 'Unavailable', 'Unavailable']);
  assert.equal(app.get('deck-lock-refresh').attributes['aria-disabled'], 'false');
});

const invalidReads = {
  stale: body => { body.observedAt = '2020-01-01'; },
  wrongMint: body => { body.mint = 'wrong'; },
  wrongEscrow: body => { body.accounts[1].account.data.parsed.info.mint = 'wrong'; },
  wrongVersion: body => {
    const raw = Buffer.from(body.accounts[0].account.data[0], 'base64');
    raw[8] = 3;
    body.accounts[0].account.data[0] = raw.toString('base64');
  },
  duplicate: body => { body.accounts[1].address = body.accounts[0].address; },
  missing: body => { body.accounts.pop(); },
  supply: body => { body.accounts[6].account.data.parsed.info.supply = '999'; },
};
for (const [scenario, invalidate] of Object.entries(invalidReads)) {
  test(scenario + ' read cannot create a current lock claim', async () => {
    const body = payload();
    invalidate(body);
    const app = setup(async () => ({ ok: true, json: async () => body }));
    await settled();
    assert.equal(app.get('deck-lock-total').textContent, 'Unavailable');
    assert.equal(app.get('deck-lock-cards').children.length, 0);
    assert.deepEqual(app.states.map(state => state.textContent), ['Unavailable', 'Unavailable', 'Unavailable']);
  });
}

test('pending read ignores repeated refresh while the button can retain keyboard focus', async () => {
  let resolve;
  let calls = 0;
  const app = setup(() => {
    calls++;
    return new Promise(done => { resolve = done; });
  });
  const button = app.get('deck-lock-refresh');
  button.focus();
  await app.refresh();
  assert.equal(calls, 1);
  assert.equal(button.attributes['aria-disabled'], 'true');
  assert.equal(app.get('deck-lock-results').attributes['aria-busy'], 'true');
  resolve({ ok: true, json: async () => payload() });
  await settled();
  assert.equal(app.focused(), button);
  assert.equal(button.attributes['aria-disabled'], 'false');
  assert.equal(app.get('deck-lock-results').attributes['aria-busy'], 'false');
});

test('lock deadlines clear old evidence and allow retry even if a fetch ignores abort', { timeout: 2000 }, async () => {
  for (const phase of ['headers', 'body']) {
    let calls = 0;
    let expire;
    let late;
    const app = setup(async () => {
      calls++;
      if (calls !== 2) return { ok: true, json: async () => payload() };
      const delayed = new Promise(resolve => { late = resolve; });
      return phase === 'headers' ? delayed : { ok: true, json: () => delayed };
    }, {
      setTimeout(callback, ms) { assert.equal(ms, 12000); expire = callback; return 1; },
      clearTimeout() {},
    });
    await settled();
    assert.equal(app.get('deck-lock-total').textContent, '100,000,000 GFOF');
    const pendingRead = app.refresh();
    await settled();
    expire();
    await pendingRead;
    assert.equal(app.get('deck-lock-refresh').attributes['aria-disabled'], 'false');
    assert.equal(app.get('deck-lock-total').textContent, 'Unavailable');
    assert.equal(app.get('deck-lock-cards').children.length, 0);
    assert.equal(app.get('deck-lock-timeline').children.length, 0);
    assert.deepEqual(app.states.map(state => state.textContent), ['Unavailable', 'Unavailable', 'Unavailable']);
    await app.refresh();
    assert.equal(app.get('deck-lock-total').textContent, '100,000,000 GFOF');
    late(phase === 'headers' ? { ok: true, json: async () => ({}) } : {});
    await settled();
    assert.equal(app.get('deck-lock-total').textContent, '100,000,000 GFOF');
    assert.equal(calls, 3);
  }
});
