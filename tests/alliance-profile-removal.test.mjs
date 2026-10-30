import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileRemovalApi} from '../lib/alliance-profile-removal-api.mjs';
import {createProfileRemovalClient} from '../assets/federation/fed-alliance-profile-removal-client.mjs';
const origin='https://deploy-preview-124--gfof.netlify.app',id='11111111-1111-4111-8111-111111111111';
const body={operationId:id,version:7,confirm:'remove_my_profile'};
const request=(value=body,extra={})=>new Request(origin+'/api/alliance-members/me/profile',{method:'DELETE',headers:{origin,'content-type':'application/json',cookie:'fixture-only',...extra.headers},body:typeof value==='string'?value:JSON.stringify(value),...Object.fromEntries(Object.entries(extra).filter(([k])=>k!=='headers'))});
const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
test('default closed boundaries never invoke a dependency',async()=>{
 let calls=0;const api=createProfileRemovalApi({service:{handle(){calls++;}}});assert.equal((await api(request())).status,404);
 const client=createProfileRemovalClient({fetcher(){calls++;}});assert.throws(()=>client.confirm({version:7,confirm:'remove_my_profile'}),/not available/);assert.equal(calls,0);
});
test('explicit confirmation and exact body are required before generating an operation or sending',()=>{
 let calls=0;const c=createProfileRemovalClient({enabled:true,origin,newOperationId(){calls++;return id;},fetcher(){calls++;}});
 for(const input of [{version:7},{version:7,confirm:true},{version:7,confirm:'remove_my_profile',actorId:id},{version:-1,confirm:'remove_my_profile'},{version:Number.MAX_SAFE_INTEGER,confirm:'remove_my_profile'}])assert.throws(()=>c.confirm(input));assert.equal(calls,0);c.dispose();
});
test('composed client/API forwards only validated removal input and retains cookie verification at the service',async()=>{
 const seen=[],states=[];const api=createProfileRemovalApi({enabled:true,origin,service:{handle:async(r,input)=>{seen.push({url:r.url,method:r.method,cookie:r.headers.get('cookie'),input});return {state:'committed',version:8};}}});
 const client=createProfileRemovalClient({enabled:true,origin,newOperationId:()=>id,onState:s=>states.push(s),fetcher:async(url,init)=>{assert.equal(init.credentials,'same-origin');assert.equal(init.redirect,'error');return api(new Request(url,{...init,headers:{...init.headers,origin,cookie:'fixture-only'}}));}});
 assert.equal(seen.length,0);assert.deepEqual(await client.confirm({version:7,confirm:'remove_my_profile'}),{state:'committed',version:8});assert.deepEqual(seen,[{url:origin+'/api/alliance-members/me/profile',method:'DELETE',cookie:'fixture-only',input:body}]);assert.equal(states.at(-1).status,'removed');assert.match(states.at(-1).message,/account.*not erased/);assert.equal(client.pendingOperation(),null);await assert.rejects(client.reconcile());assert.equal(seen.length,1);client.dispose();api.close();
});
test('request rejection happens before service for origins, methods, identity injection and oversized bodies',async()=>{
 let calls=0;const api=createProfileRemovalApi({enabled:true,origin,service:{handle(){calls++;}}});
 const bad=[request(body,{headers:{origin:'https://example.invalid'}}),request(body,{headers:{authorization:'Bearer fake'}}),request(body,{headers:{'sec-fetch-site':'cross-site'}}),request(body,{headers:{'content-type':'text/plain'}}),request({...body,actorId:id}),request({...body,confirm:'remove_my_account'}),request({...body,version:1.5}),request('x'.repeat(513)),request('{'),new Request(origin+'/api/alliance-members/me/profile?x=1',{method:'DELETE',headers:{origin}}),new Request(origin+'/api/alliance-members/me',{method:'DELETE',headers:{origin}})];
 for(const r of bad)assert.ok((await api(r)).status>=400);assert.equal(calls,0);api.close();
});
test('unknown outcomes retain exact operation and require a distinct explicit reconciliation call',async()=>{
 const sent=[];let n=0;const c=createProfileRemovalClient({enabled:true,origin,newOperationId:()=>id,fetcher:async(_,init)=>{sent.push(JSON.parse(init.body));if(++n===1)throw Error('lost reply');return json({state:'committed',version:8});}});
 assert.deepEqual(await c.confirm({version:7,confirm:'remove_my_profile'}),{state:'unknown'});await tick();assert.equal(sent.length,1);assert.deepEqual(c.pendingOperation(),{operationId:id,version:7});assert.throws(()=>c.confirm({version:7,confirm:'remove_my_profile'}));assert.deepEqual(await c.reconcile(),{state:'committed',version:8});assert.deepEqual(sent,[body,body]);c.dispose();
});
test('pending and sign-in-required do not forget the original operation or generate a new one',async()=>{
 let ids=0,calls=0;const c=createProfileRemovalClient({enabled:true,origin,newOperationId:()=>{ids++;return id;},fetcher:async()=>{calls++;return calls===1?json({state:'removal_pending'}):new Response('',{status:401});}});
 assert.equal((await c.confirm({version:7,confirm:'remove_my_profile'})).state,'removal_pending');assert.equal((await c.reconcile()).state,'sign_in_required');assert.deepEqual(c.pendingOperation(),{operationId:id,version:7});assert.equal(ids,1);c.dispose();
});
test('wrong version, extra result fields, malformed and oversized responses remain unknown',async()=>{
 for(const value of [{state:'committed',version:9},{state:'committed',version:8,actorId:id},{state:'removed'},'x'.repeat(1025)]){
  const c=createProfileRemovalClient({enabled:true,origin,newOperationId:()=>id,fetcher:async()=>json(value)});assert.equal((await c.confirm({version:7,confirm:'remove_my_profile'})).state,'unknown');assert.ok(c.pendingOperation());c.dispose();
 }
});
test('API does not relay private fields or accept a mismatched committed version',async()=>{
 for(const result of [{state:'committed',version:8,receipt:'private'},{state:'committed',version:9},{state:'unknown',token:'private'}]){
  const api=createProfileRemovalApi({enabled:true,origin,service:{handle:async()=>result}});const r=await api(request());assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(await r.json(),{state:'unknown'});api.close();
 }
});
test('cancellation retains uncertainty, suppresses late success and permits only explicit same-operation reconciliation',async()=>{
 const gate=deferred(),states=[],sent=[];let n=0;
 const c=createProfileRemovalClient({enabled:true,origin,newOperationId:()=>id,onState:s=>states.push(s.status),fetcher:async(_,init)=>{sent.push(JSON.parse(init.body));if(++n===1)await gate.promise;return json({state:'committed',version:8});}});
 const p=c.confirm({version:7,confirm:'remove_my_profile'});await tick();c.cancel();assert.equal((await p).state,'unknown');gate.resolve();await tick();assert.equal(states.includes('removed'),false);assert.ok(c.pendingOperation());assert.equal((await c.reconcile()).state,'committed');assert.deepEqual(sent,[body,body]);c.dispose();
});
test('disposal clears operation and prevents late status or another account reusing the instance',async()=>{
 const gate=deferred(),states=[];const c=createProfileRemovalClient({enabled:true,origin,newOperationId:()=>id,onState:s=>states.push(s.status),fetcher:async()=>{await gate.promise;return json({state:'committed',version:8});}});
 const p=c.confirm({version:7,confirm:'remove_my_profile'});await tick();c.dispose();assert.equal((await p).state,'unknown');gate.resolve();await tick();assert.deepEqual(states,['removing']);assert.equal(c.pendingOperation(),null);await assert.rejects(c.reconcile());
});
test('API timeout after dispatch returns unknown, closes instance and ignores late completion',async()=>{
 const gate=deferred();let calls=0;const api=createProfileRemovalApi({enabled:true,origin,timeoutMs:10,service:{handle:async()=>{calls++;await gate.promise;return {state:'committed',version:8};}}});
 const r=await api(request());assert.deepEqual(await r.json(),{state:'unknown'});assert.equal((await api(request())).status,503);gate.resolve();await tick();assert.equal(calls,1);api.close();
});
test('API timeout during body read prevents any late service dispatch',async()=>{
 let controller,calls=0;const stream=new ReadableStream({start(c){controller=c;}});const api=createProfileRemovalApi({enabled:true,origin,timeoutMs:10,service:{handle(){calls++;}}});
 const r=await api(new Request(origin+'/api/alliance-members/me/profile',{method:'DELETE',headers:{origin,'content-type':'application/json'},body:stream,duplex:'half'}));assert.equal(r.status,408);try{controller.enqueue(new TextEncoder().encode(JSON.stringify(body)));controller.close();}catch{}await tick();assert.equal(calls,0);assert.equal((await api(request())).status,503);api.close();
});
test('API close aborts current dispatch and does not close the caller-owned service',async()=>{
 const gate=deferred();let closed=0;const api=createProfileRemovalApi({enabled:true,origin,service:{handle:async()=>{await gate.promise;return {state:'committed',version:8};},close(){closed++;}}});const p=api(request());await tick();api.close();assert.deepEqual(await (await p).json(),{state:'unknown'});gate.resolve();await tick();assert.equal(closed,0);
});
test('single active request refuses overlap before another service dispatch',async()=>{
 const gate=deferred();let calls=0;const api=createProfileRemovalApi({enabled:true,origin,service:{handle:async()=>{calls++;await gate.promise;return {state:'committed',version:8};}}});const p=api(request());await tick();assert.equal((await api(request())).status,503);gate.resolve();assert.equal((await p).status,200);assert.equal(calls,1);api.close();
});
