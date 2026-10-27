// Quote-only foundation. There is deliberately no wallet, signing or submission path.
export const GFOF = Object.freeze({symbol: 'GFOF', mint: 'Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV', decimals: 6});
export const SOL = Object.freeze({symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112', decimals: 9});
export const TRADING_ENABLED = false;
export const QUOTE_MAX_AGE_MS = 30000;
const ENDPOINT = 'https://api.jup.ag/swap/v2/order';
const MAX_UNITS = 18446744073709551615n;
const ROUTERS = new Set(['metis', 'jupiterz', 'dflow', 'okx']);
const failure = code => Object.assign(new Error(code), {code});

export function pairFor(direction) {
  if (direction === 'buy') return Object.freeze({input: SOL, output: GFOF});
  if (direction === 'sell') return Object.freeze({input: GFOF, output: SOL});
  throw failure('amount');
}

export function parseAmount(value, decimals) {
  if (typeof value !== 'string' || value.length > 40 || ![6, 9].includes(decimals)) throw failure('amount');
  const text = value.trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) throw failure('amount');
  const [whole = '', fraction = ''] = text.split('.');
  if (fraction.length > decimals) throw failure('amount');
  const units = BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0'));
  if (units < 1n || units > MAX_UNITS) throw failure('amount');
  return units.toString();
}

function units(value, allowZero = false) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,19})$/.test(value)) throw failure('unavailable');
  const n = BigInt(value);
  if (n > MAX_UNITS || n < (allowZero ? 0n : 1n)) throw failure('unavailable');
  return value;
}

export function formatUnits(value, decimals) {
  if (![6, 9].includes(decimals)) throw failure('unavailable');
  const raw = units(value, true).padStart(decimals + 1, '0');
  const whole = raw.slice(0, -decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = raw.slice(-decimals).replace(/0+$/, '');
  return whole + (fraction ? '.' + fraction : '');
}

export function makeQuoteRequest(direction, amount) {
  const pair = pairFor(direction), atomic = parseAmount(amount, pair.input.decimals);
  const url = new URL(ENDPOINT);
  // No taker, receiver, payer, referral, wallet or arbitrary query parameters.
  url.search = new URLSearchParams({inputMint: pair.input.mint, outputMint: pair.output.mint, amount: atomic}).toString();
  return Object.freeze({direction, pair, atomic, url: url.href});
}

export function projectQuote(data, request, receivedAt) {
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      data.transaction !== null || (data.taker !== undefined && data.taker !== null && data.taker !== '') ||
      data.error || data.errorCode !== undefined && data.errorCode !== null ||
      data.inputMint !== request.pair.input.mint || data.outputMint !== request.pair.output.mint ||
      data.inAmount !== request.atomic || data.swapMode !== 'ExactIn' || !ROUTERS.has(data.router) ||
      !Number.isSafeInteger(receivedAt) || receivedAt < 0) throw failure('unavailable');
  const output = units(data.outAmount);
  let feeBps = null;
  if (data.feeBps !== undefined && data.feeBps !== null) {
    if (!Number.isInteger(data.feeBps) || data.feeBps < 0 || data.feeBps > 10000) throw failure('unavailable');
    feeBps = data.feeBps;
  }
  let priceImpact = null, minimum = null, slippageBps = null;
  if (data.priceImpact !== undefined && data.priceImpact !== null) {
    // V2 uses percentage points; the deprecated priceImpactPct uses a ratio.
    if (typeof data.priceImpact !== 'number' || !Number.isFinite(data.priceImpact) || Math.abs(data.priceImpact) > 100) throw failure('unavailable');
    priceImpact = data.priceImpact;
  }
  if (data.otherAmountThreshold !== undefined && data.otherAmountThreshold !== null) {
    minimum = units(data.otherAmountThreshold, true);
    if (BigInt(minimum) > BigInt(output)) throw failure('unavailable');
  }
  if (data.slippageBps !== undefined && data.slippageBps !== null) {
    if (!Number.isInteger(data.slippageBps) || data.slippageBps < 0 || data.slippageBps > 10000) throw failure('unavailable');
    slippageBps = data.slippageBps;
  }
  const reviewNotes = [];
  if (priceImpact === null) reviewNotes.push('Price impact was not returned.');
  if (minimum === null) reviewNotes.push('Minimum output was not returned.');
  else if (minimum === '0') reviewNotes.push('No positive minimum output was reported.');
  if (slippageBps === null) reviewNotes.push('Slippage was not returned.');
  if (feeBps === null) reviewNotes.push('Provider fee rate was not returned.');
  // Deliberately discard transactions, request IDs, raw routes, addresses and provider messages.
  return Object.freeze({direction: request.direction, inputSymbol: request.pair.input.symbol,
    outputSymbol: request.pair.output.symbol, input: formatUnits(request.atomic, request.pair.input.decimals),
    output: formatUnits(output, request.pair.output.decimals), router: data.router, feeBps, priceImpact,
    minimumOutput: minimum === null ? null : formatUnits(minimum, request.pair.output.decimals),
    slippageBps, reviewNotes: Object.freeze(reviewNotes),
    receivedAt, expiresAt: receivedAt + QUOTE_MAX_AGE_MS});
}

async function fetchQuote(request, {fetchImpl, signal, setTimer, clearTimer}) {
  if (signal.aborted) throw failure('cancelled');
  const controller = new AbortController();
  let reader, timer, abort;
  const stopReader = () => { try { Promise.resolve(reader?.cancel()).catch(() => {}); } catch {} };
  const interrupted = new Promise((_, reject) => {
    abort = () => { controller.abort(); stopReader(); reject(failure('cancelled')); };
    signal.addEventListener('abort', abort, {once: true});
    timer = setTimer(() => { controller.abort(); stopReader(); reject(failure('timeout')); }, 8000);
  });
  const work = (async () => {
    let response;
    try { response = await fetchImpl(request.url, {method: 'GET', credentials: 'omit', cache: 'no-store',
      redirect: 'error', referrerPolicy: 'no-referrer', headers: {Accept: 'application/json'}, signal: controller.signal}); }
    catch (error) {
      if (controller.signal.aborted) throw failure('cancelled');
      // Fetch does not expose certificate, CORS, CSP or filtering details to page code.
      if (error instanceof TypeError) throw failure('network');
      throw error;
    }
    reader = response.body?.getReader();
    if (controller.signal.aborted) { stopReader(); throw failure('cancelled'); }
    if (response.status === 429) throw failure('rate');
    if (!response.ok) throw failure('unavailable');
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) throw failure('unavailable');
    const length = response.headers.get('content-length');
    if (length && (!/^\d+$/.test(length) || Number(length) > 100000)) throw failure('unavailable');
    if (!reader) throw failure('unavailable');
    const chunks = []; let bytes = 0;
    while (true) {
      const part = await reader.read();
      if (controller.signal.aborted) throw failure('cancelled');
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 100000) throw failure('unavailable');
      chunks.push(part.value);
    }
    const body = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(body));
  })();
  try { return await Promise.race([work, interrupted]); }
  finally { clearTimer(timer); signal.removeEventListener('abort', abort); controller.abort(); stopReader(); }
}

export function createQuoteController({fetchImpl = globalThis.fetch, onState, now = Date.now,
  setTimer = setTimeout, clearTimer = clearTimeout} = {}) {
  if (typeof fetchImpl !== 'function' || typeof onState !== 'function') throw failure('configuration');
  let active, expiry, version = 0, nextAllowed = 0, disposed = false;
  const emit = state => { if (!disposed) onState(Object.freeze(state)); };
  function invalidate(phase = 'idle') {
    version++; active?.abort(); active = undefined; clearTimer(expiry); expiry = undefined;
    emit({phase});
  }
  emit({phase: 'idle'});
  return Object.freeze({
    invalidate,
    async request(direction, amount) {
      if (disposed) return;
      if (active) return;
      let request;
      try { request = makeQuoteRequest(direction, amount); }
      catch { invalidate('invalid'); return; }
      if (now() < nextAllowed) { invalidate(); emit({phase: 'rate', retryAt: nextAllowed}); return; }
      invalidate(); const current = version;
      const startedAt = now(); nextAllowed = startedAt + 5000;
      active = new AbortController();
      const signal = active.signal;
      emit({phase: 'loading'});
      try {
        const data = await fetchQuote(request, {fetchImpl, signal, setTimer, clearTimer});
        if (disposed || current !== version) return;
        if (now() - startedAt >= 8000) throw failure('timeout');
        const quote = projectQuote(data, request, now());
        expiry = setTimer(() => { if (current === version) invalidate('expired'); }, QUOTE_MAX_AGE_MS);
        emit({phase: 'ready', quote});
      } catch (error) {
        if (disposed || current !== version) return;
        const phase = ['rate', 'timeout', 'cancelled', 'network'].includes(error?.code) ? error.code : 'unavailable';
        if (phase === 'rate') nextAllowed = now() + 30000;
        emit({phase, ...(phase === 'rate' ? {retryAt: nextAllowed} : {})});
      } finally { if (current === version) active = undefined; }
    },
    dispose() { if (disposed) return; invalidate(); disposed = true; }
  });
}
