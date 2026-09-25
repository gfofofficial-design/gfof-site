const RPC = "https://api.mainnet-beta.solana.com";
const MINT = "2oQmHWoTZRmRLregHKjBSGJy3ueX3iRNzimy2iZCmoon";
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export default async function holderBalance(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({error: "Method not allowed"}, 405);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({error: "Origin not allowed"}, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({error: "JSON required"}, 415);
  }

  let address: string;
  try {
    const input = await request.text();
    if (input.length > 256) return json({error: "Request too large"}, 413);
    address = JSON.parse(input).address;
  } catch {
    return json({error: "Invalid request"}, 400);
  }
  if (typeof address !== "string" || !ADDRESS.test(address)) {
    return json({error: "Invalid wallet address"}, 400);
  }

  try {
    const upstream = await fetch(RPC, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner",
        params: [address, {mint: MINT}, {commitment: "confirmed", encoding: "jsonParsed"}]
      }),
      signal: AbortSignal.timeout(12000)
    });
    if (!upstream.ok) return json({error: "Mainnet lookup unavailable"}, 503);
    const payload = await upstream.json();
    if (payload?.error || !Array.isArray(payload?.result?.value)) {
      return json({error: "Mainnet lookup unavailable"}, 503);
    }
    return json(payload);
  } catch {
    return json({error: "Mainnet lookup unavailable"}, 503);
  }
}

export const config = {path: "/api/holder-balance"};
