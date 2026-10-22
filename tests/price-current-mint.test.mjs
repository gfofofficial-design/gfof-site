import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { handler } = require('../netlify/functions/price.js');
const currentMint = 'Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV';
const formerMint = '2oQmHWoTZRmRLregHKjBSGJy3ueX3iRNzimy2iZCmoon';

test('price lookup rejects an old-mint pair instead of showing it as current GFOF', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(url, new RegExp(currentMint));
    return { ok: true, json: async () => ({ pairs: [{ chainId: 'solana', baseToken: { address: formerMint }, quoteToken: { address: 'USDC' }, priceUsd: '0.01' }] }) };
  };
  try {
    const result = await handler();
    assert.equal(result.statusCode, 503);
    assert.deepEqual(JSON.parse(result.body), { mint: currentMint, error: 'current mint market data unavailable' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('price lookup accepts only a priced Solana pair containing the current mint', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ pairs: [
    { chainId: 'ethereum', baseToken: { address: currentMint }, priceUsd: '1' },
    { chainId: 'solana', baseToken: { address: currentMint }, quoteToken: { address: 'USDC' }, priceUsd: '0.02', pairAddress: 'current-pair', dexId: 'tebfun' }
  ] }) });
  try {
    const result = await handler();
    assert.equal(result.statusCode, 200);
    assert.deepEqual(JSON.parse(result.body), { price: '0.02', mc: 0, vol24h: 0, priceChange: 0, buys24h: 0, sells24h: 0, mint: currentMint, pairAddress: 'current-pair', dexId: 'tebfun' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
