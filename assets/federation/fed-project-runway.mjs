import {
  parseUsd, planFields, planFileLimit, projectCash, projectionMonths, readPlanFile, writePlanFile
} from './fed-project-runway-core.mjs';

const byId = id => document.getElementById('runway-' + id);
const fields = planFields.map(key => {
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
const sources = {
  entered: {label: 'Your figures', example: false},
  example: {label: 'Fictional example', example: true},
  edited: {label: 'Edited example figures', example: true},
  imported: {label: 'Imported plan file', example: false},
  importedExample: {label: 'Imported plan file marked as example', example: true},
  editedFile: {label: 'Edited imported plan', example: false},
  editedExampleFile: {label: 'Edited imported example plan', example: true}
};
const editedSources = {example: 'edited', imported: 'editedFile', importedExample: 'editedExampleFile'};
const fileInput = byId('file');
const fileStatus = byId('file-status');
const filePreview = byId('file-preview');
const openPlanButton = byId('open-plan');
const downloadStatus = byId('download-status');
let inputSource = 'entered';
let calculatedPlan;
let selectedPlan;
let fileSelection = 0;

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
  calculatedPlan = undefined;
  downloadStatus.textContent = '';
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

  const source = sources[inputSource];
  calculatedPlan = {amounts, example: source.example};
  byId('provenance').textContent = 'Source · ' + source.label;
  byId('scenarios').replaceChildren(...cards);
  status.textContent = '';
  result.hidden = false;
  byId('results-title').focus();
}

function clearFileSelection(message = '') {
  fileSelection += 1;
  fileInput.value = '';
  selectedPlan = undefined;
  openPlanButton.disabled = true;
  filePreview.hidden = true;
  filePreview.textContent = '';
  fileStatus.textContent = message;
}

fileInput.addEventListener('change', async () => {
  const [file] = fileInput.files;
  const selection = ++fileSelection;
  selectedPlan = undefined;
  openPlanButton.disabled = true;
  filePreview.hidden = true;
  filePreview.textContent = '';
  fileStatus.textContent = '';
  if (!file) return;
  if (file.size > planFileLimit) {
    clearFileSelection('Choose a Project Runway JSON file of 4 KB or less.');
    return;
  }
  fileStatus.textContent = 'Checking the selected plan…';
  try {
    const text = await file.text();
    // An earlier read must never replace a newer selection or a cleared form.
    if (selection !== fileSelection) return;
    const plan = readPlanFile(text);
    const {cash, receipts, spend} = plan.amounts;
    filePreview.textContent = usd(cash) + ' available today. Monthly receipts ' + usd(receipts) +
      ' and spending ' + usd(spend) + '.';
    filePreview.hidden = false;
    selectedPlan = plan;
    openPlanButton.disabled = false;
    fileStatus.textContent = plan.example ? 'The file is marked as an example. Ready to open.' : 'Ready to open.';
  } catch (error) {
    if (selection !== fileSelection) return;
    clearFileSelection(error instanceof Error ? error.message : 'The plan could not be read. Choose the file again.');
  }
});

openPlanButton.addEventListener('click', () => {
  if (!selectedPlan) return;
  const {amounts, example} = selectedPlan;
  for (const {key, input} of fields) {
    input.value = amounts[key] === null ? '' : usd(amounts[key]).slice(1);
  }
  inputSource = example ? 'importedExample' : 'imported';
  change.open = amounts.upfront !== null || amounts.planned !== null;
  clearFileSelection('Plan opened in this tab.');
  updateActions();
  calculate();
});

byId('download').addEventListener('click', () => {
  if (!calculatedPlan || result.hidden) return;
  const link = document.createElement('a');
  let url;
  try {
    const text = writePlanFile(calculatedPlan.amounts, calculatedPlan.example);
    url = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
    link.href = url;
    link.download = 'project-runway-plan.json';
    document.body.append(link);
    link.click();
    downloadStatus.textContent = 'Plan file prepared. It contains the amounts shown in this calculation.';
  } catch {
    downloadStatus.textContent = 'The download could not start. Try again in this browser.';
  } finally {
    link.remove();
    if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});

form.addEventListener('submit', event => {
  event.preventDefault();
  calculate();
});

for (const field of fields) {
  field.input.addEventListener('input', () => {
    inputSource = editedSources[inputSource] ?? inputSource;
    calculatedPlan = undefined;
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
  clearFileSelection();
  calculatedPlan = undefined;
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
clearFileSelection();
byId('unavailable').hidden = true;
form.hidden = false;
byId('plan-files').hidden = false;
