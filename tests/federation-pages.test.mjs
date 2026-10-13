import test from 'node:test';
import assert from 'node:assert/strict';
import {checkFederationPages} from '../scripts/check-federation-pages.mjs';
const html='<a href="https://galacticfederation.co/command-deck">Deck</a>';
test('checks three fixed public homepages without credentials or provider calls',async()=>{
 const calls=[];const r=await checkFederationPages({now:()=>1000,fetcher:async(url,options)=>{calls.push({url,options});return new Response(html,{headers:{'content-type':'text/html'}});}});
 assert.equal(r.healthy,true);assert.equal(calls.length,3);
 for(const c of calls){assert.equal(c.options.redirect,'error');assert.equal(c.options.credentials,'omit');assert.ok(!c.url.includes('/api/'));assert.equal(c.options.headers,undefined);}
 assert.equal(r.securityVerdict,'not_assessed');assert.equal(r.accountAcceptance,'not_assessed');assert.ok(!JSON.stringify(r).includes('<a'));
});
test('HTTP 200 without the canonical dashboard link is not healthy',async()=>{
 const r=await checkFederationPages({fetcher:async()=>new Response('<a href="https://evil.invalid/command-deck">bad</a>',{headers:{'content-type':'text/html'}})});
 assert.equal(r.healthy,false);assert.ok(r.results.every(x=>x.reason==='dashboard_link_missing'));
});
test('relative dashboard links count only on the canonical Federation origin',async()=>{
 const r=await checkFederationPages({fetcher:async()=>new Response('<a href="/command-deck">Deck</a>',{headers:{'content-type':'text/html'}})});
 assert.equal(r.results[0].healthy,true);assert.equal(r.results[1].healthy,false);assert.equal(r.results[2].healthy,false);
});
test('stalled transport is bounded even if cancellation is ignored',async()=>{
 const r=await checkFederationPages({timeoutMs:10,fetcher:()=>new Promise(()=>{})});
 assert.equal(r.healthy,false);assert.ok(r.results.every(x=>x.reason==='timeout'));
});
test('oversized HTML is withheld and never returned',async()=>{
 const r=await checkFederationPages({fetcher:async()=>new Response('x'.repeat(1048577),{headers:{'content-type':'text/html'}})});
 assert.ok(r.results.every(x=>x.reason==='response_too_large'));assert.ok(JSON.stringify(r).length<2000);
});
test('invalid deadlines are refused before fetch',async()=>{
 let calls=0;await assert.rejects(checkFederationPages({timeoutMs:15001,fetcher:()=>{calls++;}}));assert.equal(calls,0);
});
