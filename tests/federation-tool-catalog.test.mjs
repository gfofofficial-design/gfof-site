import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FEDERATION_TOOLS, renderToolSlot} from '../scripts/_shared/federation-tools.mjs';
import {syncToolPages} from '../scripts/sync-federation-tools.mjs';
import {TRADING_ENABLED} from '../assets/federation/swap/quote-core.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const filenames = ['command-deck.html', 'alliance.html'];
async function fixture(run) {
  const dir = await mkdtemp(join(tmpdir(), 'federation-tool-copy-'));
  try {
    for (const path of filenames) await writeFile(join(dir, path), await readFile(join(root, path)));
    await run(dir);
  } finally { await rm(dir, {recursive:true, force:true}); }
}

test('the checked-in dashboard and Alliance agree with the reviewed tool catalog', async () => {
  assert.deepEqual(await syncToolPages(root), {checked:filenames, updated:[]});
  assert.equal(TRADING_ENABLED, false);
  assert.equal(FEDERATION_TOOLS.swap.state, 'quote-only');
  assert.match(FEDERATION_TOOLS.swap.status, /trading closed/);
  assert.match(FEDERATION_TOOLS.alliance.status, /joining closed/);
  assert.equal(FEDERATION_TOOLS.account.state, 'existing-accounts');
  assert.match(FEDERATION_TOOLS.account.description, /Public registration.*not open/);
});

test('checking drift refuses without changing either page; explicit refresh preserves unrelated text', async () => {
  await fixture(async dir => {
    const path = join(dir, filenames[0]), other = join(dir, filenames[1]);
    const before = await readFile(path, 'utf8'), otherBefore = await readFile(other, 'utf8');
    const edited = '<!-- preserve unrelated author copy -->\n' + before.replace('Quote preview · trading closed', 'Trading open');
    await writeFile(path, edited);
    await assert.rejects(syncToolPages(dir), /copy drift: command-deck.html/);
    assert.equal(await readFile(path, 'utf8'), edited);
    assert.equal(await readFile(other, 'utf8'), otherBefore);
    assert.deepEqual((await syncToolPages(dir, {write:true})).updated, [filenames[0]]);
    assert.equal(await readFile(path, 'utf8'), '<!-- preserve unrelated author copy -->\n' + before);
  });
});

test('a missing or duplicate marker refuses before an earlier page can be rewritten', async () => {
  for (const damage of ['missing', 'duplicate']) await fixture(async dir => {
    const first = join(dir, filenames[0]), second = join(dir, filenames[1]);
    const firstEdited = (await readFile(first, 'utf8')).replace('Quote preview · trading closed', 'Trading open');
    let secondEdited = await readFile(second, 'utf8');
    secondEdited = damage === 'missing'
      ? secondEdited.replace('<!-- /federation-tools:alliance -->', '')
      : secondEdited + '\n<!-- federation-tools:alliance -->';
    await writeFile(first, firstEdited); await writeFile(second, secondEdited);
    await assert.rejects(syncToolPages(dir, {write:true}), /Review Federation tool markers/);
    assert.equal(await readFile(first, 'utf8'), firstEdited);
    assert.equal(await readFile(second, 'utf8'), secondEdited);
  });
});

test('the wallet action stays in the current dashboard and every other tool has its reviewed destination', () => {
  const deck = renderToolSlot('deck'), alliance = renderToolSlot('alliance');
  assert.match(deck, /href="#wallet"/);
  assert.doesNotMatch(deck, /href="\/command-deck"/);
  for (const key of ['alliance', 'swap', 'lens']) assert.ok(deck.includes(FEDERATION_TOOLS[key].href));
  for (const key of ['wallet', 'swap', 'lens', 'treasury']) assert.ok(alliance.includes(FEDERATION_TOOLS[key].href));
  assert.match(renderToolSlot('alliance-account'), /href="\/account".*Existing approved accounts only/);
  assert.throws(() => renderToolSlot('unknown'), /Unknown Federation tool slot/);
});

test('catalog entries are immutable public metadata with fixed destinations', () => {
  assert.ok(Object.isFrozen(FEDERATION_TOOLS));
  for (const entry of Object.values(FEDERATION_TOOLS)) {
    assert.ok(Object.isFrozen(entry));
    const url = new URL(entry.href, 'https://galacticfederation.co');
    assert.ok(['https://galacticfederation.co','https://dossiertrack.co'].includes(url.origin));
    assert.equal(url.username, ''); assert.equal(url.password, ''); assert.equal(url.search, '');
  }
});
