import {createWalletPreview} from './wallet-preview.mjs';
import {createQuoteController, pairFor} from './quote-core.mjs';
import {QUOTE_PAIRS,QUOTE_TOKENS} from './token-registry.mjs';

const MESSAGES = Object.freeze({idle: 'No quote requested. Trading is closed; wallet address preview is optional.',
  loading: 'Checking an indicative quote with Jupiter. No wallet or transaction is involved.',
  ready: 'Indicative quote received for this amount. Trading remains closed; this is not a guaranteed final amount.',
  expired: 'The quote display expired after 30 seconds. Check again for a current indicative amount.',
  cancelled: 'Quote check cancelled. No trade was created.',
  timeout: 'The quote check timed out. No trade was created. You can try another check.',
  network: 'Your browser could not reach the quote service. A network, certificate, browser security rule or service issue may be responsible. This page cannot identify which. Do not bypass security warnings; try later on your personal device or ask your IT team.',
  unavailable: 'We could not verify a quote. The provider, route or browser connection may be unavailable. This does not prove GFOF cannot trade elsewhere.',
  rate: 'Please wait before checking again. Quotes are manual; this preview will not retry automatically.'});

export function formatPriceImpact(value) {
  if (value === null) return 'Not returned';
  if (value !== 0 && Math.abs(value) < 0.0001) return value < 0 ? 'Between -0.0001% and 0%' : 'Between 0% and 0.0001%';
  const rounded = Number(value.toFixed(4));
  return (rounded !== value ? '≈ ' : '') + rounded + '%';
}

export function mountSwapPage(doc, options = {}) {
  const $ = id => doc.getElementById(id);
  if (!$('swap-form')) return null;
  // The reviewed registry drives both selectors; no per-token markup edit is needed.
  for(const id of ['swap-from','swap-to']){
    const select=$(id),previous=select.value;select.replaceChildren();
    for(const token of QUOTE_TOKENS){const option=doc.createElement('option');option.value=token.id;option.textContent=token.symbol+' · '+token.name;select.append(option);}
    if(QUOTE_TOKENS.some(t=>t.id===previous))select.value=previous;
  }
  let disposed = false;
  const resultFields = ['swap-input', 'swap-output', 'swap-router', 'swap-fee', 'swap-time', 'swap-impact', 'swap-minimum', 'swap-slippage', 'swap-review-notes'];
  const selection = () => $('swap-from').value + ':' + $('swap-to').value;
  const updateLabels = () => {
    let pair;
    try { pair = pairFor(selection()); } catch { return false; }
    const {input, output} = pair;
    $('quote-title').textContent = input.symbol + ' → ' + output.symbol;
    $('swap-amount-label').textContent = input.symbol + ' amount to quote';
    $('swap-amount-help').textContent = 'Enter a positive ' + input.symbol + ' amount with up to ' + input.decimals + ' decimal places.';
    $('swap-amount').placeholder = input.symbol === 'SOL' ? 'For example, 0.01' : 'For example, 1000';
    for (const option of $('swap-from').options) option.disabled = !QUOTE_PAIRS.some(p => p.input.id === option.value && p.output.id === output.id);
    for (const option of $('swap-to').options) option.disabled = !QUOTE_PAIRS.some(p => p.input.id === input.id && p.output.id === option.value);
    $('swap-reverse').disabled = !QUOTE_PAIRS.some(p => p.input.id === output.id && p.output.id === input.id);
    for (const [side, token] of [['from', input], ['to', output]]) {
      $('swap-' + side + '-name').textContent = token.symbol + ' · ' + token.name;
      $('swap-' + side + '-mint').textContent = token.mint;
      $('swap-' + side + '-explorer').textContent = 'View ' + token.symbol + ' routing mint on Solscan ↗';
      $('swap-' + side + '-explorer').setAttribute('href', 'https://solscan.io/token/' + token.mint);
    }
    $('swap-research').setAttribute('href', 'https://dossiertrack.co/token-structure?mint=' + output.mint);
    $('swap-research-label').textContent = 'Research ' + output.symbol;
    return true;
  };
  const controller = createQuoteController({...options, onState(state) {
    if (disposed) return;
    const loading = state.phase === 'loading';
    $('swap-check').disabled = loading || state.phase === 'invalidPair';
    $('swap-cancel').hidden = !loading;
    $('swap-result').setAttribute('aria-busy', String(loading));
    $('swap-result').hidden = state.phase !== 'ready';
    resultFields.forEach(id => { $(id).textContent = '—'; });
    $('swap-amount').setAttribute('aria-invalid', String(state.phase === 'invalid'));
    for (const id of ['swap-from', 'swap-to']) $(id).setAttribute('aria-invalid', String(state.phase === 'invalidPair'));
    if (state.phase === 'invalid') {
      const {input} = pairFor(selection());
      $('swap-message').textContent = 'Enter a positive ' + input.symbol + ' amount using digits and up to ' + input.decimals + ' decimal places. No commas or exponent notation.';
    } else if (state.phase === 'invalidPair') $('swap-message').textContent = 'Choose two different tokens from the reviewed list. No quote was requested.';
    else $('swap-message').textContent = MESSAGES[state.phase] || MESSAGES.unavailable;
    if (state.phase === 'ready') {
      const q = state.quote;
      $('swap-input').textContent = q.input + ' ' + q.inputSymbol;
      $('swap-output').textContent = q.output + ' ' + q.outputSymbol;
      $('swap-router').textContent = ({metis: 'Metis', jupiterz: 'JupiterZ', dflow: 'Dflow', okx: 'OKX'})[q.router];
      $('swap-fee').textContent = q.feeBps === null ? 'Not returned · total costs not verified' : q.feeBps / 100 + '% · total costs not verified';
      $('swap-impact').textContent = formatPriceImpact(q.priceImpact);
      $('swap-minimum').textContent = q.minimumOutput === null ? 'Not returned' : q.minimumOutput + ' ' + q.outputSymbol + (q.minimumOutput === '0' ? ' · no positive minimum' : '');
      $('swap-slippage').textContent = q.slippageBps === null ? 'Not returned' : q.slippageBps / 100 + '%';
      $('swap-review-notes').textContent = q.reviewNotes.length ? q.reviewNotes.join(' ') + ' Trading remains closed.' : 'Provider details returned. No protection is enforced in a transaction here; trading remains closed.';
      $('swap-time').textContent = new Date(q.receivedAt).toLocaleTimeString();
    }
  }});
  let walletPreview = null;
  if ($('swap-wallet-select') && doc.createElement) {
    const messages = {idle: 'Optional: choose an installed wallet, then connect to display its address.', connecting: 'Check your wallet permission prompt. No signature is requested.', connected: 'Address shared with this page only. This is not proof of ownership or Federation sign-in.', disconnecting: 'Requesting wallet disconnect…', disconnected: 'Wallet confirmed disconnect. Trusted-app permission may remain in your wallet.', changed: 'Wallet or page context changed. Address cleared; disconnect before connecting again.', uncertain: 'Connection state is uncertain. Close any wallet prompt, revoke this site in your wallet if needed, and reload before reconnecting.'};
    try { walletPreview = createWalletPreview({...options.walletOptions, onState(state) {
      controller.invalidate();
      const select = $('swap-wallet-select'), previous = select.value;
      select.replaceChildren();
      const placeholder = doc.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Choose your installed wallet'; select.append(placeholder);
      for (const wallet of state.wallets) { const option = doc.createElement('option'); option.value = String(wallet.index); option.textContent = wallet.name; select.append(option); }
      if ([...select.options].some(option => option.value === previous)) select.value = previous;
      select.disabled = state.busy || state.phase === 'connected';
      $('swap-wallet-connect').disabled = state.busy || !select.value || !state.wallets.length || !['idle', 'disconnected'].includes(state.phase);
      select.onchange = () => { $('swap-wallet-connect').disabled = state.busy || !select.value || !['idle', 'disconnected'].includes(state.phase); };
      $('swap-wallet-disconnect').disabled = state.busy || ['idle', 'disconnected'].includes(state.phase);
      $('swap-wallet-address').textContent = state.address || 'No address displayed';
      $('swap-wallet-message').textContent = !state.wallets.length && state.phase === 'idle' ? 'No compatible installed wallet detected. Quotes still work without a wallet. Mobile wallet handoff is not available in this preview.' : messages[state.phase];
    }}); } catch {
      $('swap-wallet-message').textContent = 'Wallet discovery is unavailable. You can still check quotes without a wallet.';
      $('swap-wallet-connect').disabled = true; $('swap-wallet-disconnect').disabled = true; $('swap-wallet-select').disabled = true;
    }
  }
  const onWalletConnect = () => void walletPreview?.connect(Number($('swap-wallet-select').value));
  const onWalletDisconnect = () => void walletPreview?.disconnect();
  const onEdit = () => controller.invalidate();
  const onPairChange = () => {
    controller.invalidate(); $('swap-amount').value = '';
    if (!updateLabels()) { controller.invalidate('invalidPair'); return; }
    const {input, output} = pairFor(selection());
    $('swap-message').textContent = 'Quote pair changed to ' + input.symbol + ' → ' + output.symbol + '. Amount and previous quote cleared. Enter a new amount to check.';
  };
  const onReverse = () => {
    const from = $('swap-from').value;
    $('swap-from').value = $('swap-to').value; $('swap-to').value = from;
    onPairChange();
  };
  const onSubmit = event => {
    event.preventDefault();
    void controller.request(selection(), $('swap-amount').value);
    if ($('swap-amount').getAttribute('aria-invalid') === 'true') $('swap-amount').focus();
    else if ($('swap-from').getAttribute('aria-invalid') === 'true') $('swap-from').focus();
  };
  const onCancel = () => controller.invalidate('cancelled');
  const onClear = () => { controller.invalidate(); $('swap-amount').value = ''; $('swap-amount').focus(); };
  const onVisibility = () => { controller.invalidate(); walletPreview?.invalidate(); };
  const bindings = [[$('swap-form'), 'submit', onSubmit], [$('swap-amount'), 'input', onEdit],
    [$('swap-from'), 'change', onPairChange], [$('swap-to'), 'change', onPairChange], [$('swap-reverse'), 'click', onReverse],
    [$('swap-cancel'), 'click', onCancel], [$('swap-clear'), 'click', onClear],
    [doc, 'visibilitychange', onVisibility]];
  if (walletPreview) bindings.push([$('swap-wallet-connect'), 'click', onWalletConnect], [$('swap-wallet-disconnect'), 'click', onWalletDisconnect]);
  if (doc.defaultView) bindings.push([doc.defaultView, 'pagehide', onVisibility], [doc.defaultView, 'pageshow', onVisibility]);
  bindings.forEach(([node, event, handler]) => node.addEventListener(event, handler));
  updateLabels();
  return Object.freeze({dispose() { if (disposed) return; walletPreview?.dispose(); controller.dispose(); disposed = true;
    if (walletPreview) { $('swap-wallet-address').textContent = 'No address displayed'; $('swap-wallet-connect').disabled = true; $('swap-wallet-disconnect').disabled = true; $('swap-wallet-select').disabled = true; $('swap-wallet-select').onchange = null; }
    bindings.forEach(([node, event, handler]) => node.removeEventListener(event, handler)); $('swap-check').disabled = true; }});
}

if (typeof document !== 'undefined') mountSwapPage(document);
