const productionOrigin = 'https://galacticfederation.co';
const release = Object.freeze({enabled: true, appId: 'cmw561qcd00gb0hjy44exxg8s'});

export function bindWalletRoute({
  page, location, secureContext, config,
  loadWallet = () => import('./sdk/browser.js'),
}) {
  if (config?.enabled !== true || secureContext !== true || location?.origin !== productionOrigin ||
      !['/wallet', '/wallet.html'].includes(location.pathname) || typeof config.appId !== 'string' ||
      !/^[a-z0-9]{20,40}$/.test(config.appId)) return false;

  const controls = page.getElementById('wallet-controls');
  const consent = page.getElementById('wallet-consent');
  const open = page.getElementById('wallet-open');
  const status = page.getElementById('wallet-status');
  const service = page.getElementById('wallet-service');
  if (!controls || !consent || !open || !status || !service) return false;

  const appId = config.appId;
  let opened = false;
  open.addEventListener('click', async () => {
    if (opened) return;
    if (!consent.checked) {
      status.textContent = 'Select the connection checkbox to continue.';
      consent.focus();
      return;
    }

    opened = true;
    open.setAttribute('aria-disabled', 'true');
    status.textContent = 'Opening Privy.';
    try {
      const {mountWalletService} = await loadWallet();
      mountWalletService(service, appId, {allowCreation: true});
      service.hidden = false;
      status.textContent = 'Privy opened. Continue in the wallet controls.';
      service.focus();
    } catch {
      status.textContent = 'The wallet service could not open. Reload this page to try again.';
    }
  });
  status.textContent = 'Choose whether to open Privy.';
  controls.disabled = false;
  controls.hidden = false;
  return true;
}

if (typeof window !== 'undefined') {
  bindWalletRoute({page: document, location: window.location, secureContext: window.isSecureContext, config: release});
}
