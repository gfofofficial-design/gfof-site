import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../netlify/functions/chat.js', import.meta.url), 'utf8')
  .replace('export default async function (request, context)', 'async function chat(request, context)')
  .replace('export const config =', 'const config =');

async function ask(upstream) {
  const timers = new Map();
  let id = 0;
  const sandbox = {
    Request, Response, TextEncoder, AbortController,
    Netlify: { env: { get: () => 'test-only-placeholder' } },
    console: { error() {} },
    setTimeout(callback, delay) {
      const token = ++id;
      if (delay === 900) queueMicrotask(callback);
      else timers.set(token, callback);
      return token;
    },
    clearTimeout(token) { timers.delete(token); },
    fetch: (_url, options) => upstream(options.signal, timers),
  };
  const chat = runInNewContext(source + '\nchat;', sandbox);
  const response = await chat(new Request('https://galacticfederation.co/api/chat', {
    method: 'POST',
    headers: { origin: 'https://galacticfederation.co', 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Explain the canonical token address.' }] }),
  }), { requestId: 'offline-timeout-test' });
  assert.equal(timers.size, 0, 'completed requests must release their deadline timer');
  return response.json();
}

test('the deadline remains active while a successful reply body is being read', async () => {
  let calls = 0;
  const body = await ask(async (signal, timers) => {
    ++calls;
    return { ok: true, status: 200, json() {
      assert.equal(timers.size, 1, 'headers must not clear the body-read deadline');
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const error = new Error('aborted body'); error.name = 'AbortError'; reject(error);
        }, { once: true });
        [...timers.values()][0]();
      });
    } };
  });
  assert.equal(body.code, 'E_TIMEOUT');
  assert.equal(calls, 1, 'body timeout must not trigger another paid request');
  assert.doesNotMatch(JSON.stringify(body), /test-only-placeholder|aborted body/);
});

test('a completed AI body releases its timer and keeps its reply source', async () => {
  const body = await ask(async () => ({ ok: true, status: 200,
    json: async () => ({ content: [{ type: 'text', text: 'Reviewed answer.' }] }) }));
  assert.deepEqual(body, { reply: 'Reviewed answer.', code: 'OK', source: 'ai' });
});

test('malformed JSON keeps its distinct diagnostic and releases the timer', async () => {
  const body = await ask(async () => ({ ok: true, status: 200,
    json: async () => { throw new SyntaxError('private upstream response'); } }));
  assert.equal(body.code, 'E_BAD_UPSTREAM_JSON');
  assert.doesNotMatch(JSON.stringify(body), /private upstream/);
});

test('one transient retry cancels the unused body and bounds the next reply', async () => {
  let calls = 0;
  let canceled = false;
  const body = await ask(async () => {
    if (++calls === 1) return { ok: false, status: 529,
      body: { async cancel() { canceled = true; } },
      json() { throw new Error('error body must not be parsed'); } };
    assert.equal(canceled, true);
    return { ok: true, status: 200,
      json: async () => ({ content: [{ type: 'text', text: 'Retry answer.' }] }) };
  });
  assert.equal(calls, 2);
  assert.equal(body.code, 'OK');
  assert.equal(body.reply, 'Retry answer.');
});
