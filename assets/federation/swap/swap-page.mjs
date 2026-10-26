import {createQuoteController, pairFor} from './quote-core.mjs';

const MESSAGES = Object.freeze({idle: 'No quote requested. Wallet connection and trading are closed.',
  loading: 'Checking an indicative quote with Jupiter. No wallet or transaction is involved.',
  ready: 'Indicative quote received for this amount. Trading remains closed; this is not a guaranteed final amount.',
  expired: 'The quote display expired after 30 seconds. Check again for a current indicative amount.',
  cancelled: 'Quote check cancelled. No trade was created.',
  timeout: 'The quote check timed out. No trade was created. You can try another check.',
  unavailable: 'We could not verify a quote. The provider, route or browser connection may be unavailable. This does not prove GFOF cannot trade elsewhere.',
  rate: 'Please wait before checking again. Quotes are manual; this preview will not retry automatically.'});

export function mountSwapPage(doc, options = {}) {
  const $ = id => doc.getElementById(id);
  if (!$('swap-form')) return null;
  let disposed = false;
  const resultFields = ['swap-input', 'swap-output', 'swap-router', 'swap-fee', 'swap-time'];
  const updateLabels = () => {
    const {input} = pairFor($('swap-direction').value);
    $('swap-amount-label').textContent = input.symbol + ' amount to quote';
    $('swap-amount-help').textContent = 'Enter a positive ' + input.symbol + ' amount with up to ' + input.decimals + ' decimal places.';
    $('swap-amount').placeholder = input.symbol === 'SOL' ? 'For example, 0.01' : 'For example, 1000';
  };
  const controller = createQuoteController({...options, onState(state) {
    if (disposed) return;
    const loading = state.phase === 'loading';
    $('swap-check').disabled = loading;
    $('swap-cancel').hidden = !loading;
    $('swap-result').setAttribute('aria-busy', String(loading));
    $('swap-result').hidden = state.phase !== 'ready';
    resultFields.forEach(id => { $(id).textContent = '—'; });
    $('swap-amount').setAttribute('aria-invalid', String(state.phase === 'invalid'));
    if (state.phase === 'invalid') {
      const {input} = pairFor($('swap-direction').value);
      $('swap-message').textContent = 'Enter a positive ' + input.symbol + ' amount using digits and up to ' + input.decimals + ' decimal places. No commas or exponent notation.';
    } else $('swap-message').textContent = MESSAGES[state.phase] || MESSAGES.unavailable;
    if (state.phase === 'ready') {
      const q = state.quote;
      $('swap-input').textContent = q.input + ' ' + q.inputSymbol;
      $('swap-output').textContent = q.output + ' ' + q.outputSymbol;
      $('swap-router').textContent = ({metis: 'Metis', jupiterz: 'JupiterZ', dflow: 'Dflow', okx: 'OKX'})[q.router];
      $('swap-fee').textContent = q.feeBps === null ? 'Not returned · total costs not verified' : q.feeBps / 100 + '% · total costs not verified';
      $('swap-time').textContent = new Date(q.receivedAt).toLocaleTimeString();
    }
  }});
  const onEdit = () => controller.invalidate();
  const onDirection = () => { controller.invalidate(); $('swap-amount').value = ''; updateLabels(); };
  const onSubmit = event => {
    event.preventDefault();
    void controller.request($('swap-direction').value, $('swap-amount').value);
    if ($('swap-amount').getAttribute('aria-invalid') === 'true') $('swap-amount').focus();
  };
  const onCancel = () => controller.invalidate('cancelled');
  const onClear = () => { controller.invalidate(); $('swap-amount').value = ''; $('swap-amount').focus(); };
  const onVisibility = () => controller.invalidate();
  const bindings = [[$('swap-form'), 'submit', onSubmit], [$('swap-amount'), 'input', onEdit],
    [$('swap-direction'), 'change', onDirection], [$('swap-cancel'), 'click', onCancel], [$('swap-clear'), 'click', onClear],
    [doc, 'visibilitychange', onVisibility]];
  if (doc.defaultView) bindings.push([doc.defaultView, 'pagehide', onVisibility], [doc.defaultView, 'pageshow', onVisibility]);
  bindings.forEach(([node, event, handler]) => node.addEventListener(event, handler));
  updateLabels();
  return Object.freeze({dispose() { if (disposed) return; controller.dispose(); disposed = true;
    bindings.forEach(([node, event, handler]) => node.removeEventListener(event, handler)); $('swap-check').disabled = true; }});
}

if (typeof document !== 'undefined') mountSwapPage(document);
