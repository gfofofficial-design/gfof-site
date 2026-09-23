import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initial, rateBps, reason, snapshot, step } from '../journey/lending-lab-model.mjs';

test('draw and principal repayment conserve supplied cash plus principal', () => {
  let state = step(initial(), 'supply', 200);
  assert.equal(snapshot(state).cash, 200);
  state = step(state, 'draw', 80);
  assert.equal(state.cash, 120);
  assert.equal(state.principal, 80);
  assert.equal(state.cash + state.principal, state.supplied);
  assert.equal(rateBps(state), 920);
  state = step(state, 'wait', 30);
  const accrued = 80 * .092 * 30 / 365;
  assert.ok(Math.abs(state.interest - accrued) < 1e-12);
  assert.equal(state.cash, 120, 'accrual cannot create paid cash');
  state = step(state, 'repay', 20);
  assert.equal(state.cash, 140);
  assert.equal(state.principal, 60);
  assert.equal(state.interest, accrued, 'principal repayment cannot silently forgive interest');
  assert.equal(state.cash + state.principal, state.supplied);
  assert.equal(step(state, 'repay', 20), state, 'completed run cannot replay');
});

test('a price fall creates visible risk and a principal payment can reduce it', () => {
  let state = step(step(initial('slide'), 'supply', 200), 'draw', 80);
  state = step(state, 'wait', 30);
  assert.equal(state.price, 70);
  assert.equal(snapshot(state).withinExampleLimit, false);
  const after = step(state, 'repay', 20);
  assert.equal(snapshot(after).withinExampleLimit, true);
  assert.equal(snapshot(after).collateralValue, 140);
  assert.ok(snapshot(after).debt > after.principal);
});

test('interest depends on elapsed time and outstanding principal, not collateral price', () => {
  const start = step(step(initial('slide'), 'supply', 200), 'draw', 40);
  const month = step(start, 'wait', 30);
  const quarter = step(start, 'wait', 90);
  assert.ok(Math.abs(quarter.interest - month.interest * 3) < 1e-12);
  const steady = step(step(step(initial('steady'), 'supply', 200), 'draw', 40), 'wait', 30);
  assert.equal(steady.interest, month.interest);
  assert.notEqual(snapshot(steady).debtToCollateral, snapshot(month).debtToCollateral);
});

test('invalid actions leave the fictional ledger unchanged', () => {
  const start = initial();
  assert.equal(step(start, 'draw', 110), start);
  assert.equal(step(start, 'wait', 30), start);
  assert.equal(initial('__proto__').scenario, 'steady');
  assert.equal(step(start, 'supply', 149), start);
  const supplied = step(start, 'supply', 200);
  assert.match(reason(supplied, 'draw', 110), /50%/);
  assert.equal(step(supplied, 'draw', 110), supplied);
  const drawn = step(supplied, 'draw', 40);
  assert.equal(step(drawn, 'draw', 80), drawn);
  assert.equal(step(drawn, 'wait', -1), drawn);
  const waited = step(drawn, 'wait', 30);
  assert.equal(step(waited, 'repay', 50), waited);
});

test('the same loan costs more interest when less cash was supplied', () => {
  const lowSupply = step(step(initial(), 'supply', 150), 'draw', 80);
  const highSupply = step(step(initial(), 'supply', 300), 'draw', 80);
  assert.equal(rateBps(lowSupply), 1160);
  assert.equal(rateBps(highSupply), 680);
  assert.ok(step(lowSupply, 'wait', 30).interest > step(highSupply, 'wait', 30).interest);
  assert.equal(lowSupply.cash + lowSupply.principal, lowSupply.supplied);
  assert.equal(highSupply.cash + highSupply.principal, highSupply.supplied);
});
