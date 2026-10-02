import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, formatTokens, obligation, parseTokens } from '../scripts/staking-budget.mjs';

test('three independently capped terms yield their summed full-cap liability', () => {
  const caps = ['10000000', '6000000', '4000000'].map(parseTokens);
  const result = calculate(caps, parseTokens('940000'));
  assert.equal(formatTokens(result.totalCap), '20,000,000');
  assert.deepEqual(result.rows.map(row => formatTokens(row.reward)), ['100,000', '360,000', '480,000']);
  assert.equal(result.shortfall, 0n);
  assert.equal(calculate(caps, parseTokens('939999.999999')).shortfall, 1n);
});

test('a fractional base-unit reward rounds up and excess input precision is rejected', () => {
  assert.equal(obligation(parseTokens('0.000001'), 1n), 1n);
  assert.equal(formatTokens(1n), '0.000001');
  assert.throws(() => parseTokens('1.0000001'));
  assert.throws(() => parseTokens('-1'));
});
