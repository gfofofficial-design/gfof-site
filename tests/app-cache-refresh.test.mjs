import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

test('installed app replaces the former shell and bypasses browser cache for navigation', async () => {
  const handlers = new Map();
  const stores = new Map([['gfof-v19.1-2026-10-02', new Map([['/app/', { body: 'former mint' }]])]]);
  const requests = [];
  let online = true;
  const caches = {
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map());
      return { put: async (key, response) => stores.get(name).set(key.url || key, response) };
    },
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    match: async (request) => {
      for (const store of stores.values()) {
        if (store.has(request.url)) return store.get(request.url);
      }
      return undefined;
    },
  };
  const fetch = async (request, options) => {
    requests.push({ url: request.url || request, cache: options?.cache });
    if (!online) throw new Error('offline');
    return { ok: true, status: 200, type: 'basic', body: 'current mint', clone() { return this; } };
  };
  vm.runInNewContext(readFileSync(new URL('../app/sw.js', import.meta.url), 'utf8'), {
    self: { addEventListener: (name, handler) => handlers.set(name, handler), skipWaiting: () => {}, clients: { claim: async () => {} } },
    caches,
    fetch,
    Response: class { constructor(body) { this.body = body; } },
  });

  let pending;
  handlers.get('install')({ waitUntil: (promise) => { pending = promise; } });
  await pending;
  handlers.get('activate')({ waitUntil: (promise) => { pending = promise; } });
  await pending;
  assert.equal(stores.has('gfof-v19.1-2026-10-02'), false);
  assert.equal([...stores.values()].some((store) => store.get('/app/')?.body === 'current mint'), true);

  const request = { url: '/app/', method: 'GET', mode: 'navigate' };
  handlers.get('fetch')({ request, respondWith: (promise) => { pending = promise; } });
  assert.equal((await pending).body, 'current mint');
  assert.equal(requests.at(-1).cache, 'no-store');

  online = false;
  handlers.get('fetch')({ request, respondWith: (promise) => { pending = promise; } });
  assert.equal((await pending).body, 'current mint');
});
