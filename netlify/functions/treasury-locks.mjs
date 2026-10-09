import {readJsonBounded} from '../lib/read-json-bounded.cjs';
const RPC = "https://api.mainnet-beta.solana.com";
const MINT = "Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV";
const KEYS = [
  "AiRhuw9iFyXiZYv2hqanBK12dckebF4vNMoAzj9Nj9nY",
  "F1iUer7wVsdv7uQ4if77Jy1ZAfTVDjSy4Pd7ZiXsVfS1",
  "BW6ZUUT5NXxSGMKNAzoMYbqrXy5Dm1ev1ekEgYSXJWX8",
  "9NeQZao9SNt7FztKbNMCwCmEYZTYkWnidZmW4chuupQq",
  "EPdpg7AYEzcwudN7TRdEkCGHQeHRrFhoK2yiYxDdGLnv",
  "DkzEr7nsuhL4Ser6AyZQ71u2mBdGj86mXmHDAzpS1Pop",
  MINT
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": status === 200 ? "public, max-age=0, s-maxage=30, must-revalidate" : "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'"
  }});
}

// A fixed public-account read. Request input never becomes an RPC method,
// account, upstream URL or credential. No wallet/session data is read.
export default async function treasuryLocks(request) {
  if (request.method !== "GET") return json({error: "Method not allowed"}, 405);
  const url = new URL(request.url);
  if (url.search) return json({error: "Query parameters not supported"}, 400);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return json({error: "Origin not allowed"}, 403);
  try {
    const payload = await readJsonBounded(RPC, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({jsonrpc: "2.0", id: 1, method: "getMultipleAccounts",
        params: [KEYS, {encoding: "jsonParsed", commitment: "finalized"}]})
    }, {timeoutMs: 8000, maxBytes: 20000});
    const result = payload?.result;
    if (payload.error || !Number.isSafeInteger(result?.context?.slot) ||
        !Array.isArray(result?.value) || result.value.length !== KEYS.length ||
        result.value.some(account => !account)) throw new Error("incomplete read");
    const mint = result.value[6];
    const info = mint.data?.parsed?.info;
    if (mint.owner !== "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" ||
        mint.data.parsed.type !== "mint" || info?.decimals !== 6 ||
        info?.supply !== "1000000000000000") throw new Error("mint supply changed");
    return json({mint: MINT, commitment: "finalized", slot: result.context.slot,
      observedAt: new Date().toISOString(),
      accounts: KEYS.map((address, index) => ({address, account: result.value[index]}))});
  } catch {
    return json({error: "Current lock read unavailable"}, 503);
  }
}

export const config = {
  path: "/api/treasury-locks",
  rateLimit: {action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 30}
};
