import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileRemovalVersionView} from '../lib/alliance-avatar-server/profile-removal-version.mjs';
import {createProfileRemovalStatusApi} from '../lib/alliance-profile-removal-status-api.mjs';
import {createProfileRemovalStatusClient} from '../assets/federation/fed-alliance-profile-removal-status-client.mjs';
const actorId='11111111-1111-4111-8111-111111111111',sessionId='22222222-2222-4222-8222-222222222222',profileId='33333333-3333-4333-8333-333333333333';
const context=()=>({actorId,sessionId,expiresAt:Date.now()+60000}),origin='https://deploy-preview-124--gfof.netlify.app',path='/api/alliance-members/me/profile/removal-status';
const request=(headers={},url=origin+path)=>new Request(url,{headers:{'sec-fetch-site':'same-origin',...headers}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};},tick=()=>new Promise(r=>setImmediate(r));
function fixture({heads,authorization,blocked=false,timeoutMs=8000,review}={}){let reads=0,closed=0;const calls=[];const view=createProfileRemovalVersionView({enabled:true,timeoutMs,ledger:{authorizeSession:async(a,s)=>{calls.push('authorize');assert.deepEqual([a,s],[actorId,sessionId]);return authorization??{actorId,sessionId,profileId};},mineSession:async(a,s)=>{calls.push('mine');assert.deepEqual([a,s],[actorId,sessionId]);return typeof heads==='function'?heads(++reads):{version:0,objectId:null,pending:[]};}},journal:{review:review??(async()=>({state:'verified_evidence',checkProfile:({profileId:p})=>{assert.equal(p,profileId);return blocked?{state:'blocked',scope:'profile'}:{state:'not_listed'};},close(){closed++;}}))},serving:{authorize:async()=>{calls.push('permit');return true;}}});return {view,calls,get closed(){return closed;}};}
test('read guard defaults closed and rejects invalid trusted contexts without I/O',async()=>{
 assert.deepEqual(await createProfileRemovalVersionView().read(context()),{state:'unavailable'});const f=fixture();for(const c of [{...context(),actorId:'bad'},{...context(),expiresAt:1},{...context(),profileId}])assert.deepEqual(await f.view.read(c),{state:'unavailable'});assert.equal(f.calls.length,0);f.view.close();
});
test('version zero without an image is valid and only the version leaves the read boundary',async()=>{const f=fixture();assert.deepEqual(await f.view.read(context()),{state:'ready',version:0});assert.equal(f.calls.filter(c=>c==='authorize').length,2);assert.equal(f.calls.filter(c=>c==='mine').length,2);assert.equal(f.closed,2);f.view.close();});
test('changed head, malformed state and pending work refuse rather than choose a newer version',async()=>{
 for(const heads of [n=>({version:n,objectId:null,pending:[]}),()=>({version:7,objectId:null,pending:[{}]}),()=>({version:7,objectId:null,pending:[],private:'hidden'}),()=>({version:-1,objectId:null,pending:[]}),()=>({version:7,objectId:'bad',pending:[]})]){const f=fixture({heads});assert.deepEqual(await f.view.read(context()),{state:'unavailable'});f.view.close();}
});
test('foreign session or journal denial prevents version disclosure',async()=>{
 for(const options of [{authorization:{actorId:profileId,sessionId,profileId}},{blocked:true},{review:async()=>({state:'unavailable',close(){}})}]){const f=fixture(options);assert.deepEqual(await f.view.read(context()),{state:'unavailable'});assert.equal(f.calls.includes('mine'),false);f.view.close();}
});
test('noncooperative late journal review is closed after deadline and cannot start a SQL head read',async()=>{
 const gate=deferred();let closed=0;const f=fixture({timeoutMs:10,review:()=>gate.promise});assert.deepEqual(await f.view.read(context()),{state:'unavailable'});gate.resolve({state:'verified_evidence',checkProfile:()=>({state:'not_listed'}),close(){closed++;}});await tick();assert.equal(closed,1);assert.equal(f.calls.includes('mine'),false);f.view.close();
});
test('status API rejects identity selection and cross-site access before member authentication',async()=>{
 let calls=0;const api=createProfileRemovalStatusApi({enabled:true,origin,service:{handle:async()=>{calls++;return {state:'ready',version:7};}}});
 for(const r of [request({},origin+path+'?actor='+actorId),request({'sec-fetch-site':'cross-site'}),request({authorization:'Bearer fake'}),new Request(origin+path),new Request(origin+path,{method:'DELETE',headers:{origin}})])assert.ok((await api(r)).status>=400);assert.equal(calls,0);
 const r=await api(request());assert.deepEqual(await r.json(),{state:'ready',version:7});assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie');api.close();
});
test('status API withholds malformed or private service output',async()=>{
 for(const value of [{state:'ready',version:7,profileId},{state:'ready',version:-1},{state:'ready',version:7.5},null]){const api=createProfileRemovalStatusApi({enabled:true,origin,service:{handle:async()=>value}});const r=await api(request());assert.equal(r.status,503);assert.deepEqual(await r.json(),{state:'unavailable'});api.close();}
});
test('status client/API compose one explicit GET with no body, actor, operation or startup request',async()=>{
 let calls=0;const api=createProfileRemovalStatusApi({enabled:true,origin,service:{handle:async(r,input)=>{calls++;assert.deepEqual(input,{});assert.equal(r.headers.get('cookie'),'fixture-only');return {state:'ready',version:7};}}});
 const client=createProfileRemovalStatusClient({enabled:true,origin,fetcher:(url,init)=>{assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.credentials,'same-origin');return api(new Request(url,{...init,headers:{...init.headers,'sec-fetch-site':'same-origin',cookie:'fixture-only'}}));}});assert.equal(calls,0);assert.deepEqual(await client.read(),{version:7});assert.equal(calls,1);client.dispose();api.close();
});
test('malformed, oversized and stale responses never supply a confirmation version',async()=>{
 for(const value of [{state:'ready',version:7,profileId},{state:'ready',version:-1},'x'.repeat(1025)]){const client=createProfileRemovalStatusClient({enabled:true,origin,fetcher:async()=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}})});await assert.rejects(client.read());client.dispose();}
});
test('status read cancellation and disposal suppress noncooperative late success',async()=>{
 const gate=deferred(),c=new AbortController();let calls=0;const client=createProfileRemovalStatusClient({enabled:true,origin,fetcher:async()=>{calls++;await gate.promise;return new Response('{"state":"ready","version":7}',{headers:{'content-type':'application/json'}});}});const p=client.read({signal:c.signal});c.abort();await assert.rejects(p);client.dispose();gate.resolve();await tick();await assert.rejects(client.read());assert.equal(calls,1);
});
