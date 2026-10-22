import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import handler, {config} from "../netlify/functions/treasury-locks.mjs";

const fixture = JSON.parse(fs.readFileSync(new URL("../record/current-mint-locks-three-20261008.json", import.meta.url)));
const html = fs.readFileSync(new URL("../treasury.html", import.meta.url), "utf8");
const copy = () => structuredClone(fixture);
const request = (path = "", init = {}) => new Request("https://example.com/api/treasury-locks" + path, init);
const originalFetch = globalThis.fetch;
test.afterEach(() => {globalThis.fetch = originalFetch;});

test("joint read uses only fixed accounts and safe headers", async () => {
 let upstream;
 globalThis.fetch = async (url, options) => {
   assert.equal(url, "https://api.mainnet-beta.solana.com");upstream = JSON.parse(options.body);
   return new Response(JSON.stringify(fixture));
 };
 const response = await handler(request());const body = await response.json();
 assert.equal(response.status, 200);assert.equal(body.slot, fixture.result.context.slot);
 assert.equal(body.accounts.length, 7);assert.equal(upstream.method, "getMultipleAccounts");
 assert.equal(upstream.params[0].length, 7);assert.equal(upstream.params[1].commitment, "finalized");
 assert.equal(body.accounts[4].address, "EPdpg7AYEzcwudN7TRdEkCGHQeHRrFhoK2yiYxDdGLnv");
 assert.match(response.headers.get("cache-control"), /s-maxage=30/);
 assert.equal(response.headers.get("access-control-allow-origin"), null);
 assert.equal(response.headers.get("x-content-type-options"), "nosniff");
 assert.equal(config.rateLimit.windowLimit, 30);
});
test("method, origin and query cannot widen the read", async () => {
 globalThis.fetch = () => {throw Error("must not contact upstream")};
 assert.equal((await handler(request("", {method:"POST",body:"{}"}))).status,405);
 assert.equal((await handler(request("?address=other"))).status,400);
 assert.equal((await handler(request("",{headers:{origin:"https://other.example"}}))).status,403);
});
for(const scenario of ["http", "timeout", "rpcError", "missing", "wrongSupply", "wrongDecimals", "oversized"]) {
 test("upstream " + scenario + " returns unavailable without stale success", async () => {
  globalThis.fetch = async () => {
   let data=copy();
   if(scenario==="timeout")throw Error("secret upstream message");
   if(scenario==="http")return new Response("secret",{status:429});
   if(scenario==="rpcError")data={error:{message:"secret"}};
   if(scenario==="missing")data.result.value[0]=null;
   if(scenario==="wrongSupply")data.result.value[6].data.parsed.info.supply="1";
   if(scenario==="wrongDecimals")data.result.value[6].data.parsed.info.decimals=9;
   return new Response(scenario==="oversized"?"x".repeat(20001):JSON.stringify(data));
  };
  const response=await handler(request());assert.equal(response.status,503);
  assert.equal(response.headers.get("cache-control"),"no-store");
  assert.deepEqual(await response.json(),{error:"Current lock read unavailable"});
 });
}

function element(){return {textContent:"",innerHTML:"",style:{},classList:{add(){},remove(){}},appendChild(){},querySelectorAll(){return []}};}
async function pageRead(scenario, timers = {setTimeout,clearTimeout}) {
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
 let reads=0;
 const body={mint:"Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV",commitment:"finalized",slot:fixture.result.context.slot,observedAt:new Date().toISOString(),accounts:fixture.result.value.map((account,index)=>({address:[
 "AiRhuw9iFyXiZYv2hqanBK12dckebF4vNMoAzj9Nj9nY","F1iUer7wVsdv7uQ4if77Jy1ZAfTVDjSy4Pd7ZiXsVfS1",
 "BW6ZUUT5NXxSGMKNAzoMYbqrXy5Dm1ev1ekEgYSXJWX8","9NeQZao9SNt7FztKbNMCwCmEYZTYkWnidZmW4chuupQq",
 "EPdpg7AYEzcwudN7TRdEkCGHQeHRrFhoK2yiYxDdGLnv","DkzEr7nsuhL4Ser6AyZQ71u2mBdGj86mXmHDAzpS1Pop",
 "Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV"][index],account:structuredClone(account)}))};
 if(scenario==="stale")body.observedAt="2020-01-01T00:00:00Z";
 if(scenario==="wrongEscrowMint")body.accounts[1].account.data.parsed.info.mint="wrong";
 const ctx={document:{getElementById:get,createElement:element},console:{log(){},warn(){}},atob:x=>Buffer.from(x,"base64").toString("binary"),Uint8Array,AbortController,setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout,setInterval(){},localStorage:{setItem(){},removeItem(){}},Date,Intl,
 fetch:async(url,options)=>{reads++;assert.equal(url,"/api/treasury-locks");assert.equal(options.body,undefined);
  if(scenario==="stalled-headers")return new Promise(resolve=>{timers.late=resolve;});
  if(scenario==="stalled-body")return {ok:true,json:()=>new Promise(resolve=>{timers.late=resolve;})};
  return {ok:scenario!=="offline",json:async()=>body}}};
 vm.createContext(ctx);
 const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1];
 vm.runInContext(script,ctx);
 if(timers.expire){await new Promise(r=>setImmediate(r));timers.expire();}
 for(let i=0;i<50&&ctx.isRefreshing;i++)await new Promise(r=>setImmediate(r));
 assert.equal(ctx.isRefreshing,false);assert.equal(reads,1);
 return {get,ctx,body};
}
test("page shares one finalized read, counts principal and picks Chicago next unlock", async()=>{
 const {get,ctx}=await pageRead("good");
 assert.equal(get("sum-locked").textContent,"100.0M $GFOF");assert.equal(get("sum-pct").textContent,"10.00%");
 assert.equal(get("next-source").textContent,"LOCK 2");assert.equal(get("next-date").textContent,"Aug 18, 2027");
 assert.match(get("last-read").textContent,/SLOT 454550404/);
 ctx.refreshAll();for(let i=0;i<50&&ctx.isRefreshing;i++)await new Promise(r=>setImmediate(r));
});
for(const scenario of ["offline","stale","wrongEscrowMint"])test("page " + scenario + " does not claim full verified total",async()=>{
 const {get}=await pageRead(scenario);
 assert.notEqual(get("sum-locked").textContent,"100.0M $GFOF");
 assert.equal(get("status-word").textContent,"read incomplete");
});

test("lock server deadlines cover ignored-abort headers and streamed bodies",{timeout:1000},async()=>{
 const oldSetTimeout=globalThis.setTimeout,oldClearTimeout=globalThis.clearTimeout;
 try{
  for(const phase of ["headers","body"]){
   let expire,cancelled=0;
   globalThis.setTimeout=(callback,ms)=>{assert.equal(ms,8000);expire=callback;return 1;};
   globalThis.clearTimeout=()=>{};
   globalThis.fetch=async()=>phase==="headers"?new Promise(()=>{}):{ok:true,body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel(){cancelled++;return new Promise(()=>{});}})}};
   const pending=handler(request());await new Promise(r=>setImmediate(r));expire();
   const response=await pending;assert.equal(response.status,503);assert.equal(response.headers.get("cache-control"),"no-store");
   assert.deepEqual(await response.json(),{error:"Current lock read unavailable"});
   assert.equal(cancelled,phase==="body"?1:0);
  }
 }finally{globalThis.setTimeout=oldSetTimeout;globalThis.clearTimeout=oldClearTimeout;}
});
test("treasury deadlines release refresh and prevent late reads replacing retry evidence",{timeout:1000},async()=>{
 for(const phase of ["headers","body"]){
  const timers={setTimeout(callback,ms){assert.equal(ms,12000);timers.expire=callback;return 1;},clearTimeout(){}};
  const {get,ctx,body}=await pageRead("stalled-"+phase,timers);
  assert.equal(ctx.isRefreshing,false);assert.equal(get("status-word").textContent,"read incomplete");
  assert.notEqual(get("sum-locked").textContent,"100.0M $GFOF");
  ctx.fetch=async()=>({ok:true,json:async()=>body});ctx.refreshAll();
  for(let i=0;i<50&&ctx.isRefreshing;i++)await new Promise(r=>setImmediate(r));
  assert.equal(get("sum-locked").textContent,"100.0M $GFOF");const retrySlot=ctx.lockReadSlot;
  const lateBody={...body,slot:99};
  timers.late(phase==="headers"?{ok:true,json:async()=>lateBody}:lateBody);
  await new Promise(r=>setImmediate(r));
  assert.equal(ctx.lockReadSlot,retrySlot);assert.equal(get("sum-locked").textContent,"100.0M $GFOF");
 }
});
