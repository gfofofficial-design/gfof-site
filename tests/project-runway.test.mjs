import assert from 'node:assert/strict';
import test from 'node:test';
import {
  monthlySpendingLimit, parseUsd, planFileLimit, projectCash, readPlanFile, writePlanFile
} from '../assets/federation/fed-project-runway-core.mjs';

test('manual USD input distinguishes an unknown amount, zero, and exact cents', () => {
  for (const [input, expected] of [
    ['', null], ['  ', null], ['0', 0], ['$0.00', 0], ['.01', 1], ['0.3', 30],
    [' $9,001.07 ', 900107], ['5000.', 500000], ['999,999,999.99', 99999999999]
  ]) {
    assert.equal(parseUsd(input), expected, input);
  }
});

test('malformed, ambiguous, unsupported and out-of-range currency stays invalid', () => {
  for (const input of [
    '-', '-3', '+1', '1e3', '1,25', '1.000,00', '1 000', '.', '1.001',
    '0.001', '1_000', '€1', 'Infinity', '1,000,000,000.00', '1000000000'
  ]) {
    assert.ok(Number.isNaN(parseUsd(input)), input);
  }
});

test('the current plan and the example change use identical monthly receipt assumptions', () => {
  const current = {cash: 2400000, receipts: 600000, spend: 1000000};
  assert.deepEqual(projectCash(current), {
    openingCash: 2400000, monthlyNet: -400000, runwayTenths: 60,
    months: [2000000, 1200000, 0]
  });
  assert.deepEqual(projectCash({...current, spend: 1200000, upfront: 400000}), {
    openingCash: 2000000, monthlyNet: -600000, runwayTenths: 33,
    months: [1400000, 200000, -1600000]
  });
});

test('zero, funded months and immediate gaps never yield a fictional time to depletion', () => {
  assert.deepEqual(projectCash({cash: 1000, receipts: 100, spend: 100}), {
    openingCash: 1000, monthlyNet: 0, runwayTenths: null, months: [1000, 1000, 1000]
  });
  assert.deepEqual(projectCash({cash: 0, receipts: 100, spend: 0}), {
    openingCash: 0, monthlyNet: 100, runwayTenths: null, months: [100, 300, 600]
  });
  assert.deepEqual(projectCash({cash: 1000, receipts: 2500, spend: 1000, upfront: 2500}), {
    openingCash: -1500, monthlyNet: 1500, runwayTenths: null, months: [0, 3000, 7500]
  });
});

test('display rounding stays conservative and month-end balances keep cents', () => {
  assert.equal(projectCash({cash: 39, receipts: 0, spend: 20}).runwayTenths, 19);
  assert.deepEqual(projectCash({cash: 1, receipts: 0, spend: 20}), {
    openingCash: 1, monthlyNet: -20, runwayTenths: 0, months: [-19, -59, -119]
  });
  assert.deepEqual(projectCash({cash: 99999999999, receipts: 99999999999, spend: 0}).months, [
    199999999998, 399999999996, 699999999993
  ]);
});

test('monthly spending limits split cash across the selected horizon and round down to cents', () => {
  const current = {cash: 2_400_000, receipts: 600_000};
  assert.deepEqual([3, 6, 12].map(months => monthlySpendingLimit(current, months)), [1_400_000, 1_000_000, 800_000]);
  assert.equal(monthlySpendingLimit({...current, upfront: 400_000}, 6), 933_333);
  assert.equal(monthlySpendingLimit({cash: 4, receipts: 1, upfront: 1}, 6), 1);
  assert.equal(monthlySpendingLimit({cash: 99_999_999_999, receipts: 99_999_999_999}, 3), 133_333_333_332);
});

test('a spending limit leaves month-end cash nonnegative and another cent would exceed it', () => {
  const plan = {cash: 103, receipts: 53, upfront: 5};
  for (const months of [3, 6, 12]) {
    const spending = monthlySpendingLimit(plan, months);
    const lastBalance = plan.cash - plan.upfront + (plan.receipts - spending) * months;
    assert.ok(lastBalance >= 0 && lastBalance < months);
  }
});

test('an upfront gap has no spending limit and exactly funded costs leave receipts as the limit', () => {
  assert.equal(monthlySpendingLimit({cash: 11_000, receipts: 20_000, upfront: 11_001}, 6), null);
  assert.equal(monthlySpendingLimit({cash: 11_000, receipts: 20_000, upfront: 11_000}, 3), 20_000);
  assert.equal(monthlySpendingLimit({cash: 0, receipts: 0}, 12), 0);
  for (const months of [0, -3, 1.5, NaN, Infinity, '6']) {
    assert.throws(() => monthlySpendingLimit({cash: 100, receipts: 100}, months), RangeError);
  }
});

const planAmounts = {cash: 99_999_999_999, receipts: 1, spend: 33, upfront: null, planned: 0};

test('downloaded plan inputs round trip without rounding or losing blank fields and example provenance', () => {
  for (const example of [false, true]) {
    const text = writePlanFile(planAmounts, example);
    assert.deepEqual(JSON.parse(text), {
      tool: 'project-runway', version: 1, currency: 'USD', example, amounts: planAmounts
    });
    assert.deepEqual(readPlanFile('\uFEFF' + text), {amounts: planAmounts, example});
  }
});

test('plan files reject unsupported tools, versions, currencies, example markers and saved results', () => {
  const plan = JSON.parse(writePlanFile(planAmounts, false));
  for (const overrides of [
    {tool: 'other-tool'}, {version: 2}, {currency: 'EUR'}, {example: 'false'}, {results: {runway: 100}}
  ]) assert.throws(() => readPlanFile(JSON.stringify({...plan, ...overrides})), /compatible Project Runway/);
  for (const text of ['null', '[]', '{}', '{"amounts":']) assert.throws(() => readPlanFile(text));
});

test('both file directions reject malformed, missing or oversized cent amounts', () => {
  const plan = JSON.parse(writePlanFile(planAmounts, true));
  for (const delta of [{cash: -1}, {cash: null}, {cash: '999'}, {cash: 100_000_000_000}, {receipts: 0.01}, {upfront: true}, {extra: 0}]) {
    const amounts = {...planAmounts, ...delta};
    assert.throws(() => readPlanFile(JSON.stringify({...plan, amounts})), /compatible Project Runway/);
    assert.throws(() => writePlanFile(amounts, true), /Calculate a valid plan/);
  }
  const {planned, ...partialAmounts} = planAmounts;
  assert.throws(() => writePlanFile(partialAmounts, true), /Calculate a valid plan/);
  assert.throws(() => writePlanFile(planAmounts, 'example'), /Calculate a valid plan/);
});

test('file intake rejects oversized text before parsing', () => {
  const plan = writePlanFile(planAmounts, false);
  assert.throws(() => readPlanFile(plan + ' '.repeat(planFileLimit)), /4 KB or less/);
  assert.throws(() => readPlanFile('é'.repeat(planFileLimit / 2 + 1)), /4 KB or less/);
});
