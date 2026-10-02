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
  // Two separately rounded positions can cost more than one rounded aggregate.
  assert.equal(obligation(parseTokens('0.000002'), 1n), 1n);
  assert.equal(obligation(parseTokens('0.000001'), 1n) * 2n, 2n);
  assert.equal(formatTokens(1n), '0.000001');
  assert.throws(() => parseTokens('1.0000001'));
  assert.throws(() => parseTokens('-1'));
});

test('explicit full-year repeated-cap sensitivity is separate from the default cohort', () => {
  const caps = ['1250000', '1250000', '2500000'].map(parseTokens);
  const single = calculate(caps);
  const repeated = calculate(caps, parseTokens('600000'), [12n, 2n, 1n]);
  assert.equal(formatTokens(single.totalReward), '387,500');
  assert.deepEqual(repeated.rows.map(row => formatTokens(row.reward)), ['150,000', '150,000', '300,000']);
  assert.equal(formatTokens(repeated.totalReward), '600,000');
  assert.equal(repeated.shortfall, 0n);
  assert.equal(calculate(caps, parseTokens('599999.999999'), [12n, 2n, 1n]).shortfall, 1n);
  assert.throws(() => calculate(caps, undefined, [0n, 1n, 1n]));
});
