import test from 'node:test';
import assert from 'node:assert/strict';
import chat from '../netlify/functions/chat.js';

const origin = 'https://deploy-preview-84--gfof.netlify.app';

async function ask(content, requestOrigin = origin) {
  const request = new Request(`${origin}/api/chat`, {
    method: 'POST',
    headers: { origin: requestOrigin, 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'command', messages: [{ role: 'user', content }] })
  });
  const response = await chat(request, { requestId: 'voss-test' });
  return { status: response.status, body: await response.json() };
}

test('broad status answer is short and separates usable paths from private lending', async () => {
  const { status, body } = await ask('What can a visitor use today, and what is still being built?');
  assert.equal(status, 200);
  assert.equal(body.code, 'OK');
  assert.equal(body.source, 'reviewed_brief');
  assert.ok(body.reply.split(/\s+/).length <= 100);
  assert.match(body.reply, /\/journey\//);
  assert.match(body.reply, /dossiertrack\.co\/token-structure/);
  assert.match(body.reply, /private synthetic-token prototype/);
  assert.doesNotMatch(body.reply, /live reserve (status|progress)/i);
});

test('treasury answer distinguishes owner disclosures from on-chain balances', async () => {
  const { body } = await ask('Are the purposes of wallets verified on chain?');
  assert.equal(body.source, 'reviewed_brief');
  assert.match(body.reply, /owner-supplied disclosures/);
  assert.match(body.reply, /lock balances.*read from Solana/);
});

test('reserve answer does not promise a live migration progress gauge', async () => {
  const { body } = await ask('Is live migration reserve progress available now?');
  assert.equal(body.source, 'reviewed_brief');
  assert.match(body.reply, /old mint.*quote-reserve/i);
  assert.match(body.reply, /old quote-reserve gauge does not describe current-token progress/i);
  assert.match(body.reply, /\/migration/);
});

test('Journey and lending answer separates the simulation from the private program', async () => {
  const { body } = await ask('How does the Journey relate to the real lending build?');
  assert.equal(body.source, 'reviewed_brief');
  assert.match(body.reply, /fictional educational/);
  assert.match(body.reply, /does not move real money/);
  assert.match(body.reply, /\/building#lending-progress/);
});

test('reviewed answers still reject off-origin requests', async () => {
  const { status, body } = await ask('What is live?', 'https://example.com');
  assert.equal(status, 403);
  assert.equal(body.code, 'E_ORIGIN');
});
