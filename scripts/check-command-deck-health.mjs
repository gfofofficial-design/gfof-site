import { pathToFileURL } from 'node:url';
import { readJsonBounded } from '../netlify/lib/read-json-bounded.cjs';

const ORIGINS = Object.freeze({
  preview: 'https://deploy-preview-104--gfof.netlify.app',
  production: 'https://galacticfederation.co',
});
const MINT = 'Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV';
const SOL = 'So11111111111111111111111111111111111111112';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const STREAMFLOW = 'strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m';
const LOCKS = [
  ['AiRhuw9iFyXiZYv2hqanBK12dckebF4vNMoAzj9Nj9nY', 'F1iUer7wVsdv7uQ4if77Jy1ZAfTVDjSy4Pd7ZiXsVfS1'],
  ['BW6ZUUT5NXxSGMKNAzoMYbqrXy5Dm1ev1ekEgYSXJWX8', '9NeQZao9SNt7FztKbNMCwCmEYZTYkWnidZmW4chuupQq'],
  ['EPdpg7AYEzcwudN7TRdEkCGHQeHRrFhoK2yiYxDdGLnv', 'DkzEr7nsuhL4Ser6AyZQ71u2mBdGj86mXmHDAzpS1Pop'],
];
const ACCOUNT_KEYS = [...LOCKS.flat(), MINT];
const U64_MAX = 18446744073709551615n;
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function publicKey(value) {
  if (typeof value !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return null;
  let n = 0n;
  for (const c of value) n = n * 58n + BigInt(alphabet.indexOf(c));
  const bytes = [];
  while (n) { bytes.unshift(Number(n & 255n)); n >>= 8n; }
  for (const c of value) { if (c !== '1') break; bytes.unshift(0); }
  return bytes.length === 32 ? Buffer.from(bytes) : null;
}
function fresh(value, now) {
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(time) && value === new Date(time).toISOString() &&
    now - time <= 120000 && time - now <= 30000;
}
function safeInteger(value, max = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value >= 0 && value <= max;
}
function quantity(value, decimals = 255) {
  return typeof value === 'string' && value.length <= 300 &&
    /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) &&
    (!value.includes('.') || value.split('.')[1].length <= decimals);
}
function walletState(data, now) {
  if (!data || data.address !== MINT || data.network !== 'solana-mainnet' ||
      data.commitment !== 'confirmed' || !fresh(data.observedAt, now) ||
      !Array.isArray(data.slots) || data.slots.length !== 3 ||
      !data.slots.every(s => safeInteger(s)) || !quantity(data.sol, 9) ||
      !safeInteger(data.tokenAccounts, 10000) || !Array.isArray(data.tokens) ||
      data.tokens.length > 1000 || data.tokens.length > data.tokenAccounts)
    return 'invalid_wallet_response';
  const tokenIds = new Set();
  for (const token of data.tokens) {
    if (!token || !publicKey(token.mint) || tokenIds.has(token.mint) || !quantity(token.quantity))
      return 'invalid_wallet_response';
    tokenIds.add(token.mint);
  }
  const pricing = data.pricing;
  if (!pricing || pricing.source !== 'Jupiter Price V3' ||
      !['available', 'unavailable'].includes(pricing.status) ||
      !safeInteger(pricing.requested, 50) || pricing.requested < 1 ||
      !safeInteger(pricing.unrequested) || !pricing.prices ||
      typeof pricing.prices !== 'object' || Array.isArray(pricing.prices) ||
      typeof data.pricesAvailable !== 'boolean' ||
      data.pricesAvailable !== (Object.keys(pricing.prices).length > 0))
    return 'invalid_wallet_response';
  for (const [mint, price] of Object.entries(pricing.prices)) {
    if ((mint !== SOL && !tokenIds.has(mint)) || !price ||
        !Number.isFinite(price.usdPrice) || price.usdPrice <= 0 || !safeInteger(price.blockId) ||
        data.slots[0] - price.blockId < -150 || data.slots[0] - price.blockId > 9000)
      return 'invalid_wallet_response';
  }
  if (pricing.status !== 'available' || !pricing.prices[SOL]) return 'pricing_unavailable';
  return 'ok';
}
function lockState(data, now) {
  if (!data || data.mint !== MINT || data.commitment !== 'finalized' ||
      !safeInteger(data.slot) || !fresh(data.observedAt, now) ||
      !Array.isArray(data.accounts) || data.accounts.length !== ACCOUNT_KEYS.length)
    return 'invalid_lock_response';
  const accounts = new Map();
  for (const entry of data.accounts) {
    if (!entry || !ACCOUNT_KEYS.includes(entry.address) || accounts.has(entry.address) ||
        !entry.account) return 'invalid_lock_response';
    accounts.set(entry.address, entry.account);
  }
  const mint = accounts.get(MINT), info = mint?.data?.parsed?.info;
  if (mint?.owner !== TOKEN_PROGRAM || mint.data.parsed.type !== 'mint' ||
      info?.decimals !== 6 || info.supply !== '1000000000000000' ||
      info.mintAuthority !== null || info.freezeAuthority !== null) return 'invalid_lock_response';
  for (const [metadata, escrow] of LOCKS) {
    const contract = accounts.get(metadata), token = accounts.get(escrow);
    const balance = token?.data?.parsed?.info;
    if (contract?.owner !== STREAMFLOW || !Array.isArray(contract.data) ||
        contract.data.length !== 2 || contract.data[1] !== 'base64' ||
        typeof contract.data[0] !== 'string' || token?.owner !== TOKEN_PROGRAM ||
        token.data.parsed.type !== 'account' || balance?.mint !== MINT ||
        balance.tokenAmount?.decimals !== 6 || typeof balance.tokenAmount.amount !== 'string' ||
        !/^\d{1,20}$/.test(balance.tokenAmount.amount) ||
        BigInt(balance.tokenAmount.amount) > U64_MAX) return 'invalid_lock_response';
    const bytes = Buffer.from(contract.data[0], 'base64');
    if (bytes.length !== 1104 || bytes.toString('base64') !== contract.data[0] ||
        bytes[8] !== 4 || !bytes.subarray(177, 209).equals(publicKey(MINT)) ||
        !bytes.subarray(209, 241).equals(publicKey(escrow))) return 'invalid_lock_response';
    const principal = bytes.readBigUInt64LE(417), withdrawn = bytes.readBigUInt64LE(17);
    const cliff = bytes.readBigUInt64LE(441);
    if (!principal || withdrawn > principal || bytes.readBigUInt64LE(409) !== cliff ||
        bytes.readBigUInt64LE(33) !== cliff || bytes.readBigUInt64LE(449) !== principal ||
        cliff < 1577836800n || cliff > 4102444800n) return 'invalid_lock_response';
  }
  return 'ok';
}

// Manual, finite checks only. No arbitrary destination, personal wallet or credentials.
export async function checkCommandDeckHealth({
  environment, fetcher = fetch, timeoutMs = 15000, now = Date.now,
} = {}) {
  if (!Object.hasOwn(ORIGINS, environment) || !Number.isInteger(timeoutMs) ||
      timeoutMs < 1 || timeoutMs > 20000 || typeof now !== 'function')
    throw new Error('Invalid service check configuration.');
  const origin = ORIGINS[environment], startedAt = now();
  if (!safeInteger(startedAt)) throw new Error('Invalid service check clock.');
  const targets = [
    { id: 'wallet_and_pricing', path: '/api/federation-wallet', maxBytes: 262144,
      options: { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: MINT }) }, validate: walletState },
    { id: 'treasury_locks', path: '/api/treasury-locks', maxBytes: 32768,
      options: { method: 'GET', headers: { Origin: origin } }, validate: lockState },
  ];
  const results = await Promise.all(targets.map(async target => {
    const start = performance.now(), url = origin + target.path;
    let status = null, reason = 'unavailable';
    try {
      const data = await readJsonBounded(url, { ...target.options, credentials: 'omit', cache: 'no-store' }, {
        timeoutMs, maxBytes: target.maxBytes,
        fetcher: async (requestUrl, options) => {
          const response = await fetcher(requestUrl, options);
          options.signal.throwIfAborted();
          status = response.status;
          if (status !== 200) { reason = 'unexpected_status'; throw new Error('Service unavailable.'); }
          if (!/^application\/json(?:;|$)/i.test(response.headers.get('content-type') || '')) {
            reason = 'unexpected_content_type'; throw new Error('Service unavailable.');
          }
          reason = 'invalid_response';
          return response;
        },
      });
      reason = target.validate(data, now());
    } catch (error) {
      if (error?.name === 'AbortError') reason = 'timeout';
    }
    return { id: target.id, url, healthy: reason === 'ok', status, reason,
      durationMs: Math.round(performance.now() - start) };
  }));
  return { checkedAt: new Date(startedAt).toISOString(), environment,
    scope: 'manual_public_command_deck_services_only',
    healthy: results.every(r => r.healthy), results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argument = process.argv[2];
  if (process.argv.length !== 3 || !['--preview', '--production'].includes(argument)) {
    process.stderr.write('Usage: node scripts/check-command-deck-health.mjs --preview|--production\n');
    process.exitCode = 2;
  } else {
    const result = await checkCommandDeckHealth({ environment: argument.slice(2) });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = result.healthy ? 0 : 1;
  }
}
