import wallet from '../lib/federation-wallet-handler.cjs';
import {readJsonBounded} from '../lib/read-json-bounded.cjs';

function response(result) {
  return new Response(result.body, {status: result.statusCode, headers: result.headers});
}

export default async function federationWallet(request) {
  const event = {rawUrl: request.url, httpMethod: request.method,
    headers: Object.fromEntries(request.headers), isBase64Encoded: false, body: null};
  // Reuse the existing route/origin/method gate before reading any request body.
  // A null body can never reach a provider in the existing handler.
  const preflight = await wallet.handler(event);
  if (preflight.statusCode !== 400 || request.method !== 'POST' ||
      !/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || ''))
    return response(preflight);
  try {
    const data = await readJsonBounded(request.url, {}, {
      timeoutMs: 2000, maxBytes: 256,
      // This reads the inbound stream only; it is not a network fetch.
      fetcher: async () => ({ok: true, body: request.body}),
    });
    event.body = JSON.stringify(data);
  } catch {
    return response(preflight);
  }
  return response(await wallet.handler(event));
}

export const config = {
  path: '/api/federation-wallet',
  rateLimit: {action: 'rate_limit', aggregateBy: ['ip', 'domain'],
    windowSize: 60, windowLimit: 6},
};
