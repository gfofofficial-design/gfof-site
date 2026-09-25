import {test} from "node:test";
import assert from "node:assert/strict";
import holderBalance, {config} from "../netlify/functions/holder-balance.mts";

const address = "Fv6J7pxzz3bmEDC7BjkXchNme64SaLRY5ztQVowF3z8d";
const url = "https://galacticfederation.co/api/holder-balance";
const request = (body, origin = "https://galacticfederation.co") => new Request(url, {
  method: "POST", headers: {"Content-Type": "application/json", Origin: origin},
  body: JSON.stringify(body)
});

test("balance endpoint only accepts a same-origin address request", async () => {
  assert.equal(config.path, "/api/holder-balance");
  assert.equal((await holderBalance(new Request(url))).status, 405);
  assert.equal((await holderBalance(request({address}, "https://elsewhere.example"))).status, 403);
  assert.equal((await holderBalance(request({address: "not-a-wallet"}))).status, 400);
});

test("balance endpoint fixes the RPC method and mint and does not cache", async () => {
  const originalFetch = globalThis.fetch;
  let outbound;
  globalThis.fetch = async (_url, options) => {
    outbound = {url: _url, body: JSON.parse(options.body), headers: options.headers};
    return new Response(JSON.stringify({jsonrpc: "2.0", id: 1, result: {context: {slot: 123}, value: []}}), {
      status: 200, headers: {"Content-Type": "application/json"}
    });
  };
  try {
    const result = await holderBalance(request({address}));
    assert.equal(result.status, 200);
    assert.equal(result.headers.get("Cache-Control"), "no-store");
    assert.equal(outbound.url, "https://api.mainnet-beta.solana.com");
    assert.equal(outbound.body.method, "getTokenAccountsByOwner");
    assert.equal(outbound.body.params[0], address);
    assert.deepEqual(outbound.body.params[1], {mint: "2oQmHWoTZRmRLregHKjBSGJy3ueX3iRNzimy2iZCmoon"});
    assert.equal(outbound.headers.Origin, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("upstream failure yields unavailable, not a zero balance", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({error: {code: 403}}), {status: 403});
  try {
    const result = await holderBalance(request({address}));
    assert.equal(result.status, 503);
    assert.match((await result.json()).error, /unavailable/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
