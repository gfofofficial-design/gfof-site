import test from 'node:test';
import assert from 'node:assert/strict';
import {bindWalletRoute} from '../assets/federation/fed-wallet/wallet.mjs';

function fixture() {
  let click, change;
  const consent = {
    checked: false,
    focus() { this.focused = true; },
    addEventListener(_type, callback) { change = callback; },
  };
  const controls = {hidden: true, disabled: true};
  const open = {
    addEventListener(_type, callback) { click = callback; },
    setAttribute(name, value) { this[name] = value; },
  };
  const status = {textContent: 'Wallet access is closed for review.'};
  const service = {hidden: true, focus() { this.focused = true; }};
  const elements = {'wallet-controls': controls, 'wallet-consent': consent, 'wallet-open': open,
    'wallet-status': status, 'wallet-service': service};
  return {page: {getElementById: id => elements[id]}, consent, controls, status, service, open, click: () => click(),
    changeConsent(checked) { consent.checked = checked; change?.(); }};
}

const location = {origin: 'https://galacticfederation.co', pathname: '/wallet.html'};
const config = {enabled: true, appId: 'publicreviewfixture12345'};

test('closed, insecure, wrong-origin and wrong-path visits leave the wallet disabled', () => {
  for (const change of [
    {config: {enabled: false, appId: null}},
    {config: {...config, appId: 'invalid'}},
    {secureContext: false},
    {location: {...location, origin: 'https://preview.example.test'}},
    {location: {...location, pathname: '/swap'}},
  ]) {
    const ui = fixture();
    assert.equal(bindWalletRoute({page: ui.page, location, config, secureContext: true,
      loadWallet: () => assert.fail('Provider loaded from a closed route'), ...change}), false);
    assert.equal(ui.controls.disabled, true);
    assert.equal(ui.controls.hidden, true);
    assert.equal(ui.status.textContent, 'Wallet access is closed for review.');
  }
});

test('explicit consent mounts beta wallet access once and focuses the wallet controls', async () => {
  const ui = fixture();
  const mounts = [];
  let imports = 0;
  assert.equal(bindWalletRoute({page: ui.page, location, config, secureContext: true, loadWallet: async () => {
    imports++;
    return {mountWalletService: (...args) => mounts.push(args)};
  }}), true);
  assert.equal(imports, 0);
  await ui.click();
  assert.equal(imports, 0);
  assert.equal(ui.consent.focused, true);
  ui.consent.checked = true;
  await Promise.all([ui.click(), ui.click()]);
  assert.equal(imports, 1);
  assert.deepEqual(mounts, [[ui.service, config.appId, {allowCreation: true}]]);
  assert.equal(ui.service.hidden, false);
  assert.equal(ui.service.focused, true);
});

test('an SDK failure stays closed and does not retry a partial start', async () => {
  const ui = fixture();
  let imports = 0;
  bindWalletRoute({page: ui.page, location, config, secureContext: true, loadWallet: async () => {
    imports++;
    throw Error('PRIVATE_CANARY');
  }});
  ui.consent.checked = true;
  await ui.click();
  await ui.click();
  assert.equal(imports, 1);
  assert.equal(ui.service.hidden, true);
  assert.match(ui.status.textContent, /Reload this page/);
  assert.doesNotMatch(ui.status.textContent, /PRIVATE_CANARY/);
});

test('withdrawing consent during SDK load cancels that opening even if consent is restored', async () => {
  const ui = fixture();
  let finishLoading;
  let mounts = 0;
  let imports = 0;
  const sdk = new Promise(resolve => { finishLoading = resolve; });
  bindWalletRoute({page: ui.page, location, config, secureContext: true, loadWallet: () => {
    imports++;
    return sdk;
  }});
  ui.changeConsent(true);
  const first = ui.click();
  ui.changeConsent(false);
  ui.changeConsent(true);
  finishLoading({mountWalletService() { mounts++; }});
  await first;

  assert.equal(imports, 1);
  assert.equal(mounts, 0);
  assert.equal(ui.service.hidden, true);
  assert.equal(ui.service.focused, undefined);
  assert.equal(ui.open['aria-disabled'], 'false');
  assert.match(ui.status.textContent, /cancelled/i);

  await ui.click();
  assert.equal(imports, 2);
  assert.equal(mounts, 1);
  assert.equal(ui.service.hidden, false);
});
