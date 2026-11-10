import {snapshots} from './bridge-preview-snapshots.mjs';
import {previewProjectPair} from './bridge-preview-projects.mjs';
const byId = id => document.getElementById(id);
const pair = byId('pair');
const routes = byId('routes');
const status = byId('status');
function amount(value, decimals) {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isInteger(decimals)) return 'Unavailable';
  const raw = value.padStart(decimals + 1, '0');
  if (decimals === 0) return raw;
  const fraction = raw.slice(-decimals).replace(/0+$/, '');
  return raw.slice(0, -decimals) + (fraction ? '.' + fraction : '');
}
function updateIdentity(id, token) {
  const address = document.createElement('code');
  address.textContent = token.chain === 'Solana' && token.symbol === 'SOL' ? 'Native SOL' : token.address;
  byId(id).replaceChildren(token.symbol + ' on ' + token.chain, address);
}
function updateSelection() {
  const snapshot = snapshots[pair.value];
  byId('input').textContent = 'Input ' + amount(snapshot.inputBaseUnits, snapshot.source.decimals) + ' ' + snapshot.source.symbol;
  updateIdentity('source-token', snapshot.source);
  updateIdentity('destination-token', snapshot.destination);
  routes.replaceChildren();
  status.textContent = 'Compare saved routes for this pair.';
}
function addDetail(list, label, value) {
  const term = document.createElement('dt');
  const detail = document.createElement('dd');
  term.textContent = label;
  detail.textContent = value;
  list.append(term, detail);
}
const names = {polymerStandard:'Polymer',near:'NEAR Intents',relaydepository:'Relay',lifiIntents:'LI.FI Intents',mayan:'Mayan',layerswap:'LayerSwap',mayanFastMCTP:'Mayan Fast MCTP',mayanMCTP:'Mayan MCTP',dflow:'DFlow',okx:'OKX',titan:'Titan',fly:'Fly'};
const toolName = tool => Object.hasOwn(names, tool) ? names[tool] : tool;
function showRoutes() {
  const snapshot = snapshots[pair.value];
  const token = snapshot.destination;
  const cards = snapshot.routes.map(route => {
    const card = document.createElement('li');
    card.className = 'route';
    const heading = document.createElement('h3');
    const tools = [...new Set(route.steps.flatMap(step => step.includedTools.filter(tool => tool !== 'feeCollection').concat(step.tool)))];
    heading.textContent = tools.map(toolName).join(' + ');
    const list = document.createElement('dl');
    addDetail(list, 'Estimated receive', amount(route.estimatedOutputBaseUnits, token.decimals) + ' ' + token.symbol);
    addDetail(list, 'Quoted minimum', amount(route.minimumOutputBaseUnits, token.decimals) + ' ' + token.symbol);
    const durations = route.steps.map(step => step.estimatedDurationSeconds);
    addDetail(list, 'Estimated time', durations.every(Number.isFinite) ? durations.reduce((sum, seconds) => sum + seconds, 0) + ' seconds' : 'Unavailable');
    addDetail(list, 'Estimated gas', route.estimatedGasUsd == null ? 'Unavailable' : '$' + route.estimatedGasUsd + ' USD');
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Fee breakdown';
    const fees = document.createElement('ul');
    fees.className = 'fees';
    for (const step of route.steps) {
      for (const fee of step.fees ?? []) {
        const item = document.createElement('li');
        const inclusion = fee.included === true ? ' (included in route)' : fee.included === false ? ' (separate cost)' : '';
        item.textContent = fee.name + ' · ' + amount(fee.amount, fee.tokenDecimals) + ' ' + (fee.token ?? '') + inclusion;
        fees.append(item);
      }
    }
    if (!fees.children.length) {
      const item = document.createElement('li');
      item.textContent = 'Fee details unavailable.';
      fees.append(item);
    }
    details.append(summary, fees);
    card.append(heading, list, details);
    return card;
  });
  routes.replaceChildren(...cards);
  status.textContent = cards.length === 1 ? '1 saved route shown.' : cards.length + ' saved routes shown.';
}
pair.addEventListener('change', updateSelection);
byId('compare').addEventListener('click', showRoutes);
byId('project').addEventListener('click', () => {
  pair.value = 'cross';
  updateSelection();
  pair.focus();
  status.textContent = 'GFOF selected. Compare saved routes for this pair.';
});
const projectPair = previewProjectPair(location.search);
if (projectPair && Object.hasOwn(snapshots, projectPair)) pair.value = projectPair;
updateSelection();
