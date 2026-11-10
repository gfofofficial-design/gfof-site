import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {HOST_STATION} from '../assets/federation/fed-alliance-registry.mjs';
import {previewProjectPair, stationBridgePreview} from '../assets/federation/swap/bridge-preview-projects.mjs';
import {snapshots} from '../assets/federation/swap/bridge-preview-snapshots.mjs';

test('reviewed station link opens the saved route for its exact mint', () => {
  const href = stationBridgePreview(HOST_STATION);
  assert.equal(href, '/bridge-preview.html?project=gfof');
  const pair = previewProjectPair(new URL(href, 'https://example.test').search);
  assert.equal(snapshots[pair].destination.address, HOST_STATION.mint);
  assert.equal(stationBridgePreview({...HOST_STATION, mint: 'wrong'}), null);
  assert.equal(stationBridgePreview({...HOST_STATION, id: 'partner'}), null);
  for (const search of ['', '?project=partner', '?project=gfof&project=partner', '?project=__proto__']) {
    assert.equal(previewProjectPair(search), null);
  }
});

test('both site entries link to a saved demo with network and trading disabled', async () => {
  const html = name => readFile(new URL('../' + name, import.meta.url), 'utf8');
  const [deck, alliance, preview] = await Promise.all(
    ['command-deck.html', 'alliance.html', 'bridge-preview.html'].map(html)
  );
  assert.match(deck, /href="\/bridge-preview\.html"/);
  assert.match(alliance, /href="\/bridge-preview\.html\?project=gfof"/);
  assert.match(preview, /connect-src 'none'/);
  assert.match(preview, /<button type="button" disabled[^>]*>Trading paused/);
  assert.match(preview, /type="module" src="\/assets\/federation\/swap\/bridge-preview-page\.mjs"/);
});
