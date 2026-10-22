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

test('staking answer uses the reviewed six-month 8 percent total-term proposal', async () => {
 const {body}=await ask('What are the staking targets for six months?');
 assert.equal(body.source,'reviewed_brief');assert.match(body.reply,/8% for six months/);
 assert.match(body.reply,/not APY or funded offers/);assert.doesNotMatch(body.reply,/6%/);
});
test('dashboard answer points to the released route and keeps public accounts closed',async()=>{
 const {body}=await ask('Where is the Command Deck dashboard?');
 assert.equal(body.source,'reviewed_brief');assert.match(body.reply,/\/command-deck/);
 assert.match(body.reply,/unreleased build/);assert.doesNotMatch(body.reply,/deploy-preview/);
});
test('Lens answer describes the live free guide and keeps model selection disabled',async()=>{
 const {body}=await ask('How does the Dossier Lens report guide work?');
 assert.equal(body.source,'reviewed_brief');assert.match(body.reply,/https:\/\/dossiertrack.co\/token-structure-preview.html/);
 assert.match(body.reply,/without an AI model/);assert.match(body.reply,/prepared but disabled/);
 assert.match(body.reply,/not proof of token safety/);assert.match(body.reply,/paid tiers remain closed/);
});
test('lock answer separates dated current-mint schedule from historical mint',async()=>{
 const {body}=await ask('What is locked in Streamflow?');
 assert.equal(body.source,'reviewed_brief');assert.match(body.reply,/three current-mint/);
 assert.match(body.reply,/100M/);assert.match(body.reply,/not a current balance guarantee/);
 assert.match(body.reply,/separate historical lock record/);
});
