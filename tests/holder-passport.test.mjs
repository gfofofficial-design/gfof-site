import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {GFOF_MINT, parseHolderBalance, formatTokenAmount} from "../journey/holder-passport-model.mjs";

const owner = "Fv6J7pxzz3bmEDC7BjkXchNme64SaLRY5ztQVowF3z8d";
const tokenProgram = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
function account(amount, patch = {}) {
  return {account:{owner:tokenProgram,data:{parsed:{info:{owner,mint:GFOF_MINT,state:"initialized",tokenAmount:{amount,decimals:6},...patch}}}}};
}
function response(value) {return {result:{context:{slot:123456},value}};}

test("sums all verified token accounts without floating-point loss", () => {
  const balance = parseHolderBalance(response([account("9007199254740993"),account("7")]),owner);
  assert.equal(balance.raw,9007199254741000n);
  assert.equal(balance.holder,true);
  assert.equal(balance.accountCount,2);
  assert.equal(formatTokenAmount(balance.raw,balance.decimals),"9,007,199,254.741");
});

test("empty and zero accounts do not earn a holder marker", () => {
  assert.equal(parseHolderBalance(response([]),owner).holder,false);
  assert.equal(parseHolderBalance(response([account("0")]),owner).holder,false);
  assert.equal(formatTokenAmount(0n,6),"0");
});

test("wrong owner, wrong mint, malformed amount and RPC failure fail closed", () => {
  for (const item of [account("1",{owner:"SomeoneElse"}),account("1",{mint:"OtherMint"}),account("1.5")]) {
    assert.throws(() => parseHolderBalance(response([item]),owner));
  }
  assert.throws(() => parseHolderBalance({error:{message:"rate limited"}},owner));
  assert.throws(() => parseHolderBalance({result:{value:[]}},owner));
});

test("optional page makes no token reward or custody promise and leaves open steps", () => {
  const html=readFileSync(new URL("../journey/holder-passport.html",import.meta.url),"utf8");
  assert.match(html,/read-only/i);
  assert.match(html,/Every tester step remains open|The path is open to everyone/i);
  assert.match(html,/not a financial-product beta signup/i);
  assert.match(html,/No wallet|without one/i);
  const script=readFileSync(new URL("../journey/holder-passport.js",import.meta.url),"utf8");
  assert.ok(!/signTransaction|sendTransaction|signMessage/.test(script));
});
