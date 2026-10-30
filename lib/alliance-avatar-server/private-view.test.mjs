import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAlliancePrivateView} from './private-view.mjs';
import {createAllianceAvatarStorage} from '../alliance-avatar-storage.mjs';
import {journalFixture,event,profileId,objectId,other} from './deletion-journal.fixture.mjs';
const actorId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',sessionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',operationId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWMQjG34DwADXwHuQa7szAAAAABJRU5ErkJggg==','base64');
const input=()=>({actorId,sessionId,profileId,operationId,expiresAt:Date.now()+60000}),tick=()=>new Promise(r=>setImmediate(r));
const receipt=()=>({profileId,objectId,key:`v1/${profileId}/${objectId}.png`,providerId:other,bytes:png.length,width:1,height:1,mime:'image/png',sha256:createHash('sha256').update(png).digest('hex')});
const proof=()=>({state:'committed',profileId,objectId,key:receipt().key,writeSettled:true,verified:true,receipt:receipt(),descriptor:{bytes:png.length,width:1,height:1,mime:'image/png',sha256:receipt().sha256},deletionReceipt:null});
function fixture(overrides={},options={}){
  const signed=journalFixture({events:options.events||[]}),calls=[];
  const defaults={mineSession:()=>({version:1,objectId,pending:[]}),authorizeSession:()=>({actorId,sessionId,profileId}),operationReceiptSession:proof,review:args=>signed.client.review(args),authorize:()=>true,
    fetcher:()=>new Response(png,{headers:{'Content-Type':'image/png'}})};
  const methods=Object.fromEntries(Object.entries(defaults).map(([name,fn])=>[name,(...args)=>{calls.push(name);return (overrides[name]||fn)(...args);} ]));
  const gateway=createAllianceAvatarStorage({enabled:true,origin:'https://abcdefghijklmnopqrst.supabase.co',apiKey:'sb_publishable_synthetic_fixture_only_12345',bearerToken:'syntheticHeader.syntheticClaims.syntheticSignature',fetcher:methods.fetcher});
  const viewer=createAlliancePrivateView({enabled:true,ledger:methods,journal:methods,serving:methods,storage:gateway,...options});
  return {viewer,calls,methods,gateway,signed,close(){viewer.close();signed.client.close();}};
}
test('private viewing defaults closed and requires all authority dependencies',async()=>{
  for(const enabled of [undefined,false,'true']){const f=fixture({}, {enabled});assert.deepEqual(await f.viewer.read(input()),{state:'unavailable'});assert.deepEqual(f.calls,[]);f.close();}
  for(const options of [{ledger:{}},{storage:{}},{journal:{}},{serving:{}},{timeoutMs:0},{timeoutMs:30001}])assert.throws(()=>fixture({},options));
});
test('browser-style paths/subjects and expired/malformed contexts start no work',async()=>{
  const f=fixture();for(const value of [{...input(),path:receipt().key},{...input(),actorId:'bad'},{...input(),expiresAt:1},{...input(),profileId:null}])assert.deepEqual(await f.viewer.read(value),{state:'unavailable'});assert.deepEqual(f.calls,[]);f.close();
});
test('closed startup/restore permit refuses before any SQL, journal or provider read',async()=>{
  const f=fixture({authorize:()=>false});assert.deepEqual(await f.viewer.read(input()),{state:'unavailable'});assert.deepEqual(f.calls,['authorize']);f.close();
});
test('real gateway and signed reader return only verified PNG with private headers',async()=>{
  const f=fixture(),value=await f.viewer.read(input());assert.equal(value.state,'readable');assert.deepEqual(Buffer.from(await value.response.arrayBuffer()),png);
  assert.equal(value.response.headers.get('cache-control'),'private, no-store');assert.equal(value.response.headers.get('netlify-cdn-cache-control'),'no-store');assert.equal(value.response.headers.get('vary'),'Cookie');assert.equal(value.response.headers.get('x-robots-tag'),'noindex, nofollow');assert.equal(value.response.headers.get('set-cookie'),null);
  assert.equal(f.calls.filter(x=>x==='review').length,2);assert.equal(f.calls.filter(x=>x==='fetcher').length,1);assert.equal(f.calls.filter(x=>x==='authorizeSession').length,2);assert.equal(f.calls.filter(x=>x==='mineSession').length,3);f.close();
});
test('profile and image deletion evidence refuse before a provider request',async()=>{
  for(const events of [[event()],[event({kind:'image_remove_requested',objectId})]]){const f=fixture({}, {events});assert.deepEqual(await f.viewer.read(input()),{state:'unavailable'});assert.equal(f.calls.includes('fetcher'),false);f.close();}
});
test('missing/failed/busy journal evidence cannot authorize from absence alone',async()=>{
  for(const state of ['unavailable','busy','verified']){const f=fixture({review:()=>({state})});assert.deepEqual(await f.viewer.read(input()),{state:'unavailable'});assert.equal(f.calls.includes('fetcher'),false);f.close();}
});
test('foreign profile/object, stale or unverified operation receipts cannot select an image',async()=>{
  for(const change of [{profileId:other},{objectId:other},{state:'stale'},{verified:false},{writeSettled:false},{deletionReceipt:{state:'deleted'}},{receipt:{...receipt(),key:'https://evil.example/image'}},{descriptor:{...proof().descriptor,width:2}}]){const f=fixture({operationReceiptSession:()=>({...proof(),...change})});assert.deepEqual(await f.viewer.read(input()),{state:'unavailable'});assert.equal(f.calls.includes('review'),false);assert.equal(f.calls.includes('fetcher'),false);f.close();}
});
test('no active head or malformed current state cannot reach a provider',async()=>{
  for(const head of [{version:0,objectId:null,pending:[]},{version:1,objectId:other,pending:[]},{version:1,objectId,pending:[],secret:true}]){const f=fixture({mineSession:()=>head});assert.deepEqual(await f.viewer.read(input()),{state:'unavailable'});assert.equal(f.calls.includes('fetcher'),false);f.close();}
});
test('current SQL authority must match exact live account, session and profile',async()=>{
  for(const field of ['actorId','sessionId','profileId']){const f=fixture({authorizeSession:()=>({actorId,sessionId,profileId,[field]:other})});assert.deepEqual(await f.viewer.read(input()),{state:'unavailable'});assert.equal(f.calls.includes('fetcher'),false);f.close();}
});
test('logout or head replacement during download discards the image response',async()=>{
  for(const kind of ['logout','head']){let downloaded=false;const f=fixture({fetcher:()=>{downloaded=true;return new Response(png,{headers:{'Content-Type':'image/png'}});},authorizeSession:()=>{if(downloaded&&kind==='logout')throw Error('private');return {actorId,sessionId,profileId};},mineSession:()=>({version:downloaded&&kind==='head'?2:1,objectId,pending:[]})});assert.deepEqual(await f.viewer.read(input()),{state:'unavailable'});assert.equal(f.calls.filter(x=>x==='fetcher').length,1);f.close();}
});
test('journal closure during download prevents returning already downloaded bytes',async()=>{
  let f;f=fixture({fetcher:()=>{f.signed.client.close();return new Response(png,{headers:{'Content-Type':'image/png'}});}});assert.deepEqual(await f.viewer.read(input()),{state:'unavailable'});assert.equal(f.calls.filter(x=>x==='fetcher').length,1);f.close();
});
test('freeze during download cannot be overridden by a valid image and empty journal',async()=>{
  let frozen=false;const f=fixture({fetcher:()=>{frozen=true;return new Response(png,{headers:{'Content-Type':'image/png'}});},authorize:()=>!frozen});assert.deepEqual(await f.viewer.read(input()),{state:'unavailable'});f.close();
});
test('wrong provider bytes are rejected without a second download',async()=>{
  const f=fixture({fetcher:()=>new Response(Buffer.alloc(png.length),{headers:{'Content-Type':'image/png'}})});assert.deepEqual(await f.viewer.read(input()),{state:'unavailable'});assert.equal(f.calls.filter(x=>x==='fetcher').length,1);f.close();
});
test('caller context mutation while dependency waits cannot replace the identity',async()=>{
  let finish;const gate=new Promise(r=>finish=r),f=fixture({authorize:async()=>{await gate;return true;}}),data=input(),pending=f.viewer.read(data);data.profileId=other;data.sessionId=other;finish();const value=await pending;assert.equal(value.state,'readable');await value.response.body.cancel();f.close();
});
test('deadline/abort/close cannot follow a late SQL read with journal or provider work',async()=>{
  for(const kind of ['deadline','abort','close']){let finish;const gate=new Promise(r=>finish=r),f=fixture({mineSession:async()=>{await gate;return {version:1,objectId,pending:[]};}},{timeoutMs:kind==='deadline'?20:30000}),c=new AbortController(),pending=f.viewer.read(input(),{signal:c.signal});await tick();if(kind==='abort')c.abort();if(kind==='close')f.viewer.close();assert.deepEqual(await pending,{state:'unavailable'});finish();await tick();assert.deepEqual(f.calls,['authorize','mineSession']);f.close();}
});
test('pre-cancellation does no work and third concurrent request is not queued',async()=>{
  let finish;const gate=new Promise(r=>finish=r),f=fixture({authorize:async()=>{await gate;return false;}});assert.deepEqual(await f.viewer.read(input(),{signal:AbortSignal.abort()}),{state:'unavailable'});assert.deepEqual(f.calls,[]);const a=f.viewer.read(input()),b=f.viewer.read(input());assert.deepEqual(await f.viewer.read(input()),{state:'unavailable'});finish();await Promise.all([a,b]);assert.deepEqual(f.calls,['authorize','authorize']);f.close();
});
test('late noncooperative journal view is closed after cancellation without a download',async()=>{
  let finish,closed=0;const gate=new Promise(r=>finish=r),f=fixture({review:async()=>{await gate;return {state:'verified_evidence',check:()=>({state:'not_listed'}),close:()=>closed++};}}),c=new AbortController(),pending=f.viewer.read(input(),{signal:c.signal});await tick();c.abort();assert.deepEqual(await pending,{state:'unavailable'});finish();await tick();assert.equal(closed,1);assert.equal(f.calls.includes('fetcher'),false);f.close();
});
test('gateway skipping or ignoring failed authorization cannot produce readable output',async()=>{
  for(const mode of ['skip','ignore']){let f;const storage={async read(record,{authorize}){if(mode==='ignore'){await authorize(record);await authorize(record);}return {state:'readable',response:new Response(png,{headers:{'Content-Type':'image/png','Set-Cookie':'private=bad'}})};}};
    f=fixture({authorizeSession:()=>{throw Error('private');}},{storage});assert.deepEqual(await f.viewer.read(input()),{state:'unavailable'});f.close();}
});
test('dependency diagnostics never appear in the private result',async()=>{
  const f=fixture({operationReceiptSession:()=>{throw Error('PRIVATE URL PASSWORD');}});assert.deepEqual(await f.viewer.read(input()),{state:'unavailable'});f.close();
});

test('verified gateway output cannot forward arbitrary response headers or cookies',async()=>{
  const storage={async read(record,{authorize}){assert.equal(await authorize(record),true);assert.equal(await authorize(record),true);return {state:'readable',response:new Response(png,{headers:{'Content-Type':'image/png','Set-Cookie':'provider=private','Location':'https://evil.example','X-Provider-Secret':'private'}})};}};
  const f=fixture({}, {storage}),value=await f.viewer.read(input());assert.equal(value.state,'readable');for(const name of ['set-cookie','location','x-provider-secret'])assert.equal(value.response.headers.get(name),null);await value.response.body.cancel();f.close();
});

test('oversized, short and false-length gateway bodies are refused even after valid policy checks',async()=>{
  for(const mode of ['oversized','short','length']){const storage={async read(record,{authorize}){assert.equal(await authorize(record),true);assert.equal(await authorize(record),true);return {state:'readable',response:new Response(mode==='oversized'?Buffer.concat([png,Buffer.from('x')]):mode==='short'?png.subarray(1):png,{headers:{'Content-Type':'image/png',...(mode==='length'?{'Content-Length':'9999999'}:{})}})};}};
    const f=fixture({}, {storage});assert.deepEqual(await f.viewer.read(input()),{state:'unavailable'});f.close();}
});

test('late gateway response is cancelled after abort rather than returning its image stream',async()=>{
  let finish,cancelled=false;const gate=new Promise(r=>finish=r),storage={async read(){await gate;return {state:'readable',response:new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'Content-Type':'image/png'}})};}},f=fixture({}, {storage}),c=new AbortController(),pending=f.viewer.read(input(),{signal:c.signal});await tick();c.abort();assert.deepEqual(await pending,{state:'unavailable'});finish();await tick();assert.equal(cancelled,true);f.close();
});

test('expired journal view during final serving check cannot release buffered bytes',async()=>{
  let permits=0,f;f=fixture({authorize:()=>{if(++permits===4)f.signed.client.close();return true;}});assert.deepEqual(await f.viewer.read(input()),{state:'unavailable'});assert.equal(f.calls.filter(x=>x==='fetcher').length,1);f.close();
});
