import {parseUsd, projectCash, projectionMonths} from './fed-project-runway-core.mjs';

const byId = id => document.getElementById('runway-' + id);
const fields = ['cash', 'receipts', 'spend', 'upfront', 'planned'].map(key => {
  const input = byId(key);
  return {key, input, error: byId(key + '-error'), hint: input.getAttribute('aria-describedby')};
});

const form = byId('form');
const change = byId('change');
const status = byId('status');
const result = byId('results');
const exampleButton = byId('example');
const clearButton = byId('clear');
const initialStatus = status.textContent;
const example = {cash: '24,000', receipts: '6,000', spend: '10,000', upfront: '4,000', planned: '12,000'};
const currency = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});
const duration = new Intl.NumberFormat('en-US', {maximumFractionDigits: 1});
let inputSource = 'entered';

function usd(cents) {
  return currency.format(cents / 100).replace(/\.00$/, '');
}

function funding(cents) {
  return cents < 0 ? 'Short by ' + usd(-cents) : usd(cents);
}

function showFieldError(field, message = '') {
  const {input, error, hint} = field;
  error.textContent = message;
  error.hidden = message === '';
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
  const describedBy = [hint, message && error.id].filter(Boolean).join(' ');
  if (describedBy) input.setAttribute('aria-describedby', describedBy);
  else input.removeAttribute('aria-describedby');
}

function cashHeadline({openingCash, monthlyNet, runwayTenths}) {
  if (openingCash < 0) {
    return ['Immediate funding gap', 'The one-time cost exceeds the available cash today.'];
  }
  if (openingCash === 0) {
    return ['No cash cushion', 'There is no starting cash. The timing of bills and receipts matters.'];
  }
  if (monthlyNet >= 0) {
    return ['No depletion in this model', 'Monthly receipts cover the spending entered here.'];
  }
  if (runwayTenths === 0) {
    return ['Less than 0.1 month', 'Estimated from the monthly cash shortfall.'];
  }
  return [
    duration.format(runwayTenths / 10) + (runwayTenths === 10 ? ' month' : ' months'),
    'Estimated from the monthly cash shortfall.'
  ];
}

function renderScenario(title, scenario) {
  const card = byId('scenario').content.firstElementChild.cloneNode(true);
  const [headline, meaning] = cashHeadline(scenario);
  const {openingCash, monthlyNet, months} = scenario;
  const values = {
    title, duration: headline, meaning,
    net: (monthlyNet > 0 ? '+' : '') + usd(monthlyNet)
  };
  const balances = {opening: openingCash};
  if (openingCash <= 0) card.dataset.state = 'gap';
  for (const [index, month] of projectionMonths.entries()) {
    balances['month-' + month] = months[index];
  }
  for (const node of card.querySelectorAll('[data-value]')) {
    const key = node.dataset.value;
    node.textContent = values[key] ?? funding(balances[key]);
    if (balances[key] < 0) node.dataset.state = 'gap';
  }
  return card;
}

function updateActions() {
  const empty = fields.every(({input}) => input.value === '');
  clearButton.hidden = empty;
  exampleButton.hidden = !empty;
}

function calculate() {
  const amounts = {};
  let firstInvalid;
  for (const field of fields) {
    const cents = parseUsd(field.input.value);
    const missing = cents === null && field.input.required;
    const invalid = Number.isNaN(cents);
    const message = missing ? 'Enter an amount, or 0 if it is zero.' :
      invalid ? 'Enter a dollar amount from 0 to $999,999,999.99 with up to two decimal places.' : '';
    showFieldError(field, message);
    if (message) firstInvalid ??= field.input;
    amounts[field.key] = cents;
  }

  if (firstInvalid) {
    result.hidden = true;
    status.textContent = 'Check the highlighted amounts and calculate again.';
    if (change.contains(firstInvalid)) change.open = true;
    firstInvalid.focus();
    return;
  }

  const {cash, receipts, spend, upfront, planned} = amounts;
  const cards = [renderScenario('Current plan', projectCash({cash, receipts, spend}))];
  if (upfront !== null || planned !== null) {
    cards.push(renderScenario('Planned change', projectCash({
      cash, receipts, spend: planned ?? spend, upfront: upfront ?? 0
    })));
  }

  byId('provenance').textContent = {
    entered: 'Source · Your figures', example: 'Source · Fictional example',
    edited: 'Source · Edited example figures'
  }[inputSource];
  byId('scenarios').replaceChildren(...cards);
  status.textContent = '';
  result.hidden = false;
  byId('results-title').focus();
}

form.addEventListener('submit', event => {
  event.preventDefault();
  calculate();
});

for (const field of fields) {
  field.input.addEventListener('input', () => {
    if (inputSource === 'example') inputSource = 'edited';
    showFieldError(field);
    if (!result.hidden) {
      result.hidden = true;
      status.textContent = 'Amounts changed. Calculate again to update the estimate.';
    }
    updateActions();
  });
}

exampleButton.addEventListener('click', () => {
  for (const {key, input} of fields) input.value = example[key];
  inputSource = 'example';
  change.open = true;
  updateActions();
  calculate();
});

clearButton.addEventListener('click', () => {
  form.reset();
  for (const field of fields) showFieldError(field);
  change.open = false;
  inputSource = 'entered';
  result.hidden = true;
  byId('scenarios').replaceChildren();
  status.textContent = initialStatus;
  updateActions();
  fields[0].input.focus();
});

form.reset();
byId('unavailable').hidden = true;
form.hidden = false;
