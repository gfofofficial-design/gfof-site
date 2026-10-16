import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
import {checkFederationTools} from '../scripts/check-federation-tools.mjs';
import {buildToolPageBrief} from '../lib/tool-page-brief-core.mjs';
const at=Date.parse('2026-10-16T18:00:00.000Z');
const titles=new Map([
 ['https://galacticfederation.co/command-deck','Command Deck · Galactic Federation'],
 ['https://galacticfederation.co/alliance','Federation Alliance · Communities, Connected'],
 ['https://galacticfederation.co/journey/','First Contact · Galactic Federation'],
 ['https://galacticfederation.co/staking','GFOF Staking Preparation · Galactic Federation of Finance'],
 ['https://galacticfederation.co/building',"What We're Building — Galactic Federation"],
 ['https://galacticfederation.co/treasury','Transparency Report — $GFOF Galactic Federation of Finance'],
 ['https://dossiertrack.co/token-structure','Token Structure Lens — Dossier Solana Beta']
]);
const good=url=>new Response('<!doctype html><title>'+titles.get(url)+'</title><main>Public fixture</main>',{headers:{'content-type':'text/html; charset=utf-8'}});
async function sample(){return checkFederationTools({fetcher:async url=>good(url),now:()=>at});}
test('only seven canonical HTML pages are read, with no credentials, redirects or API calls',async()=>{
 const calls=[];let active=0,peak=0;
 const check=await checkFederationTools({now:()=>at,fetcher:async(url,options)=>{
  calls.push({url,options});peak=Math.max(peak,++active);await setImmediate();active--;return good(url);
 }});
 assert.deepEqual(calls.map(x=>x.url),[...titles.keys()]);assert.equal(peak,2);assert.equal(check.healthy,true);
 for(const {url,options} of calls){assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.equal(options.headers,undefined);assert.ok(!url.includes('/api/')&&!url.includes('/account')&&!url.includes('?'));}
 assert.equal(check.securityVerdict,'not_assessed');assert.equal(check.accountAcceptance,'not_assessed');
 assert.equal(buildToolPageBrief(check,{now:at}).status,'checked_tool_pages_ok');assert.ok(!JSON.stringify(check).includes('Public fixture'));
});
test('a 200 generic homepage or error page cannot count as delivery of the intended tool',async()=>{
 const check=await checkFederationTools({fetcher:async()=>new Response('<title>Page not found</title>',{headers:{'content-type':'text/html'}}),now:()=>at});
 assert.equal(check.healthy,false);assert.ok(check.results.every(r=>r.status===200&&!r.titleMatches&&r.reason==='page_identity_missing'));
 const brief=buildToolPageBrief(check,{now:at});assert.equal(brief.status,'attention_needed');assert.equal(brief.repairs.length,7);assert.ok(brief.repairs.every(r=>r.priority==='P1'));
});
test('ordinary title whitespace and apostrophe entities do not create a false page-identity alarm',async()=>{
 const check=await checkFederationTools({now:()=>at,fetcher:async url=>new Response('<TITLE>\n '+titles.get(url).replace("We're","We&#39;re")+' \n</TITLE>',{headers:{'content-type':'text/html'}})});
 assert.equal(check.healthy,true);
});
test('status, MIME and missing bodies remain distinct without returning diagnostic content',async()=>{
 let i=0,canceled=0;
 const check=await checkFederationTools({now:()=>at,fetcher:async url=>{
  const n=i++;
  if(n===0)return new Response(new ReadableStream({cancel(){canceled++;}}),{status:503});
  if(n===1)return new Response('private upstream diagnostic',{headers:{'content-type':'application/json'}});
  if(n===2)return new Response(null,{headers:{'content-type':'text/html'}});
  return good(url);
 }});
 assert.equal(check.results[0].reason,'unexpected_status');assert.equal(check.results[1].reason,'unexpected_content_type');assert.equal(check.results[2].reason,'missing_body');assert.equal(canceled,1);
 assert.ok(!JSON.stringify(check).includes('private upstream diagnostic'));
});
test('stalled transport is bounded without retry even when abort is ignored',async()=>{
 const calls=new Map();const check=await checkFederationTools({timeoutMs:5,now:()=>at,fetcher:url=>{calls.set(url,(calls.get(url)||0)+1);return new Promise(()=>{});}});
 assert.equal(calls.size,7);assert.ok([...calls.values()].every(n=>n===1));assert.ok(check.results.every(r=>r.reason==='timeout'&&r.status===null));
});
test('a stalled streamed body is bounded and canceled without awaiting cancellation',async()=>{
 let canceled=0;
 const check=await checkFederationTools({timeoutMs:5,now:()=>at,fetcher:async()=>new Response(new ReadableStream({pull(){return new Promise(()=>{});},cancel(){canceled++;return new Promise(()=>{});}}),{headers:{'content-type':'text/html'}})});
 assert.equal(canceled,7);assert.ok(check.results.every(r=>r.reason==='timeout'&&r.status===200));
});
test('late transport completion is canceled and cannot rewrite a finished timeout result',async()=>{
 const resolve=[];let canceled=0;
 const check=await checkFederationTools({timeoutMs:5,now:()=>at,fetcher:()=>new Promise(r=>resolve.push(r))});
 const before=JSON.stringify(check);
 for(const complete of resolve)complete(new Response(new ReadableStream({cancel(){canceled++;}}),{headers:{'content-type':'text/html'}}));
 await setImmediate();assert.equal(canceled,7);assert.equal(JSON.stringify(check),before);
});
test('the body cap withholds oversized HTML and malformed UTF-8 cannot pass by title',async()=>{
 let i=0;
 const check=await checkFederationTools({now:()=>at,fetcher:async url=>new Response(i++===0?'x'.repeat(1048577):Buffer.concat([Buffer.from('<title>'+titles.get(url)+'</title>'),Buffer.from([255])]),{headers:{'content-type':'text/html'}})});
 assert.equal(check.results[0].reason,'response_too_large');assert.ok(check.results.slice(1).every(r=>r.reason==='unexpected_encoding'));assert.ok(JSON.stringify(check).length<3500);
});
test('bad deadlines and clocks are refused before any network attempt',async()=>{
 let calls=0;const fetcher=()=>{calls++;throw Error('must not call');};
 for(const options of [{timeoutMs:0},{timeoutMs:15001},{timeoutMs:1.5},{now:()=>-1},{now:()=>NaN},{now:()=>Number.MAX_SAFE_INTEGER},{now:null}])await assert.rejects(checkFederationTools({fetcher,...options}));
 assert.equal(calls,0);
});
test('duplicate, external, inconsistent and unsupported supplied evidence is rejected',async()=>{
 const clean=await sample();
 for(const mutate of [s=>s.results[0].url='https://unapproved.invalid/',s=>s.results[1]=s.results[0],s=>s.results[0].site='dossier',s=>s.results[0].reason='raw private diagnostic',s=>s.results[0].status=503,s=>s.results[0].titleMatches=false,s=>s.healthy=false,s=>s.securityVerdict='safe',s=>s.results.pop(),s=>s.checkedAt='2026-10-16T18:00:01.000Z']){
  const s=structuredClone(clean);mutate(s);assert.throws(()=>buildToolPageBrief(s,{now:at}),/Invalid tool-page evidence/);
 }
});
test('stale evidence preserves its date but cannot produce a current delivery verdict',async()=>{
 const brief=buildToolPageBrief(await sample(),{now:at+900001});assert.equal(brief.status,'stale_check');assert.deepEqual(brief.repairs,[]);assert.equal(brief.checkedAt,new Date(at).toISOString());
});
test('availability precedes size review, and raw supplied fields never enter the brief',async()=>{
 const check=await sample();check.healthy=false;check.raw='private fixture';
 check.results[0]={...check.results[0],titleMatches:false,healthy:false,reason:'response_too_large',body:'private fixture'};
 check.results[1]={...check.results[1],titleMatches:false,healthy:false,status:503,reason:'unexpected_status',diagnostic:'private fixture'};
 const brief=buildToolPageBrief(check,{now:at});assert.deepEqual(brief.repairs.map(r=>r.priority),['P1','P2']);assert.ok(!JSON.stringify(brief).includes('private fixture'));
 assert.ok(brief.limitations.some(x=>x.includes('not full-file integrity')));
});
