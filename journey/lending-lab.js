import { assumptions, initial, reason, scenarios, snapshot, step } from './lending-lab-model.mjs';

const $ = id => document.getElementById(id);
const money = value => '$' + value.toFixed(2);
let state = initial();
const actions = {
  supply: [{ value: 150, label: 'Supply $150', detail: 'Less available cash' }, { value: 200, label: 'Supply $200', detail: 'A balanced example market' }, { value: 300, label: 'Supply $300', detail: 'More available cash' }],
  draw: [{ value: 40, label: 'Borrow $40', detail: 'Lower exposure' }, { value: 80, label: 'Borrow $80', detail: 'More cash now, more risk later' }, { value: 110, label: 'Borrow $110', detail: 'Test the example borrowing limit' }],
  wait: [{ value: 30, label: 'Wait 30 days', detail: 'One month of interest' }, { value: 90, label: 'Wait 90 days', detail: 'Three months of interest' }],
  repay: [{ value: 0, label: 'Repay $0', detail: 'See the remaining exposure' }, { value: 20, label: 'Repay $20', detail: 'Return some principal' }, { value: 40, label: 'Repay $40', detail: 'Return more principal' }]
};
const stageCopy = {
  supply: ['Seed the fictional market', 'Choose how much USDC a supplier places in market cash. The borrower will then post 2 fictional SOL as collateral. More supplied cash means lower utilization for the same loan.'],
  draw: ['Choose a loan', 'The borrower has 2 fictional SOL worth $200. The sample draw limit is $100. How much market cash will you borrow?'],
  wait: ['Let time pass', 'Borrowing has moved USDC out of market cash. The rate depends on how much of the supplied cash is in use. Choose how long the principal stays outstanding.'],
  repay: ['Respond to the new position', 'Time has added unpaid interest. The collateral price may have changed too. You can return principal to cash; the interest remains owed in this simplified exercise.'],
  done: ['See what your choices changed', 'Compare the cash, debt, and collateral value before trying another run.']
};

function shareText(s, view) {
  return `I tried the Federation Lending Lab (${scenarios[s.scenario].name}): supplied $${s.supplied}, borrowed $${s.borrowed}, waited ${s.days} days, repaid $${s.repaid} principal. Fictional remaining debt: ${money(view.debt)} against ${money(view.collateralValue)} collateral. ${view.withinExampleLimit ? 'Within' : 'Above'} the example 50% borrowing limit. This is a simulation, not live lending: https://galacticfederation.co/journey/lending-lab.html`;
}

function render() {
  const view = snapshot(state);
  $('stage-title').textContent = stageCopy[state.stage][0];
  $('stage-copy').textContent = stageCopy[state.stage][1];
  $('supplied').textContent = money(state.supplied);
  $('cash').textContent = money(view.cash);
  $('principal').textContent = money(view.principal);
  $('interest').textContent = money(view.interest);
  $('collateral').textContent = money(view.collateralValue);
  $('ltv').textContent = (view.debtToCollateral * 100).toFixed(1) + '%';
  $('rate').textContent = (view.rateBps / 100).toFixed(2) + '%';
  $('risk').textContent = view.debt === 0 ? 'No loan debt yet' : view.withinExampleLimit ? 'Within the example 50% limit' : 'Above the example 50% limit';
  $('risk').classList.toggle('alert', !view.withinExampleLimit);
  $('risk-fill').style.width = Math.min(100, view.debtToCollateral / .5 * 100) + '%';
  $('risk-fill').classList.toggle('alert', !view.withinExampleLimit);
  for (const stage of ['supply', 'draw', 'wait', 'repay']) $('step-' + stage).classList.toggle('active', state.stage === stage);
  $('events').replaceChildren();
  const opening = document.createElement('li'); opening.textContent = 'The fictional market is waiting for supply.'; $('events').append(opening);
  for (const event of state.events) { const item = document.createElement('li'); item.textContent = event; $('events').append(item); }
  $('choices').replaceChildren();
  if (state.stage !== 'done') for (const option of actions[state.stage]) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.action = state.stage; button.dataset.value = String(option.value);
    const strong = document.createElement('strong'); strong.textContent = option.label;
    const small = document.createElement('small'); small.textContent = option.detail;
    button.append(strong, small); $('choices').append(button);
  }
  $('result').hidden = state.stage !== 'done';
  if (state.stage === 'done') {
    $('result-title').textContent = view.withinExampleLimit ? 'Exposure is within the example limit.' : 'Exposure is above the example limit.';
    $('result-copy').textContent = `You supplied $${state.supplied}, borrowed $${state.borrowed}, waited ${state.days} days and repaid $${state.repaid} principal. ${money(view.principal)} principal and ${money(view.interest)} unpaid interest remain. Market cash is ${money(view.cash)}. Debt is ${(view.debtToCollateral * 100).toFixed(1)}% of today's ${money(view.collateralValue)} collateral value.`;
    $('result-lesson').textContent = view.withinExampleLimit ? 'A smaller loan or principal repayment leaves more room if collateral falls. Unpaid interest still needs a real collection path before a loan can close.' : 'A price fall can make a previously allowed loan exceed the same example limit. The real liquidation and loss policies are still under design; this exercise does not execute them.';
    $('share-text').value = shareText(state, view);
  }
}

$('choices').addEventListener('click', event => {
  const button = event.target.closest('button[data-action]'); if (!button) return;
  const action = button.dataset.action, value = Number(button.dataset.value), rejected = reason(state, action, value);
  if (rejected) { $('message').textContent = rejected; $('message').focus(); return; }
  state = step(state, action, value); render();
  $('message').textContent = action === 'supply' ? `Supplied $${value} to the fictional market. That amount is now available as market cash.` : action === 'draw' ? `Borrowed $${value}. Market cash fell and principal debt rose by the same amount.` : action === 'wait' ? `${value} days passed. Interest was added to debt; no cash was paid.` : `Principal repayment recorded: $${value}. Interest remains unpaid.`;
  if (state.stage === 'done') { $('result-title').focus(); $('result').scrollIntoView({ block: 'center' }); } else $('stage-title').focus();
});

$('new-run').addEventListener('click', () => { state = initial($('scenario').value); render(); $('message').textContent = 'New fictional market ready. Choose a supply amount.'; $('stage-title').focus(); });
$('replay').addEventListener('click', () => { state = initial($('scenario').value); render(); $('message').textContent = 'New fictional market ready. Try a different supply amount or loan.'; $('stage-title').focus(); });
$('copy-result').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('share-text').value); $('copy-status').textContent = 'Result copied.'; } catch { $('share-text').focus(); $('share-text').select(); $('copy-status').textContent = 'Select and copy the result above.'; } });
render();
$('message').textContent = 'Choose a supply amount to begin.';
