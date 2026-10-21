import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPublicAvailability } from '../scripts/check-public-availability.mjs';

const titles = new Map([
  ['https://galacticfederation.co/', 'Galactic Federation'],
  ['https://dossiertrack.co/', 'Dossier'],
  ['https://fcc.galacticfederation.co/', 'Federation Capital Command'],
]);
const html = text => new Response(text, { headers: { 'content-type': 'text/html; charset=utf-8' } });

test('checks only three fixed public pages and accepts each expected title', async () => {
  const seen = [];
  const result = await checkPublicAvailability({ fetcher: async (url, options) => {
    seen.push(url);assert.ok(titles.has(url));assert.equal(new URL(url).search, '');
    assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
    assert.equal(options.headers,undefined);assert.equal(options.body,undefined);
    return html('<html><title>'+titles.get(url)+'</title></html>');
  } });
  assert.equal(seen.length,3);assert.equal(result.available,true);
  assert.ok(result.results.every(r => r.reason==='ok'));
});

test('HTTP 200 with the wrong page title is a failed check',async()=>{
  const result=await checkPublicAvailability({fetcher:async()=>html('<title>Maintenance</title>')});
  assert.equal(result.available,false);assert.ok(result.results.every(r=>r.reason==='unexpected_title'));
});

test('non-HTML and missing or oversized titles fail without reporting body content',async()=>{
  for(const [response,reason] of [[()=>new Response('private body'), 'unexpected_content_type'],
    [()=>html('<h1>No title</h1>'),'missing_title'],[()=>html('x'.repeat(65537)),'content_limit']]){
    const result=await checkPublicAvailability({fetcher:async()=>response()});
    assert.ok(result.results.every(r=>r.reason===reason));
    assert.ok(!JSON.stringify(result).includes('private body'));
  }
});

test('HTTP failures and thrown provider details become generic public-check results',async()=>{
  for(const fail of [false,true]){
    const result=await checkPublicAvailability({fetcher:async()=>{if(fail)throw Error('secret upstream text');return new Response('private error',{status:503});}});
    assert.equal(result.available,false);assert.ok(result.results.every(r=>r.reason===(fail?'unavailable':'unexpected_status')));
    assert.ok(!JSON.stringify(result).includes('private error'));assert.ok(!JSON.stringify(result).includes('secret upstream text'));
  }
});

test('stalled headers or body release the checker even when transport ignores abort',{timeout:1000},async()=>{
  for(const phase of ['headers','body']){
    const signals=[];
    const result=await checkPublicAvailability({timeoutMs:10,fetcher:async(_url,options)=>{
      signals.push(options.signal);
      if(phase==='headers')return new Promise(()=>{});
      return {status:200,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return {read(){return new Promise(()=>{});}};}}};
    }});
    assert.equal(result.available,false);assert.ok(result.results.every(r=>r.reason==='timeout'));
    assert.ok(signals.every(s=>s.aborted));
  }
});

test('large response chunks still accept an expected title inside the bounded prefix',async()=>{
  const result=await checkPublicAvailability({fetcher:async url=>html('<title>'+titles.get(url)+'</title>'+'x'.repeat(100000))});
  assert.equal(result.available,true);
});
