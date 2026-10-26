import test from 'node:test';
import assert from 'node:assert/strict';
import {createFiniteAlliancePreviewHost} from '../lib/alliance-member-finite-host.mjs';
const ORIGIN='https://deploy-preview-156--gfof.netlify.app',BASE=Date.parse('2026-10-26T12:00:00.000Z');
const installation={siteId:'11111111-2222-4333-8444-555555555555',deployId:'1234567890abcdef12345678',context:'deploy-preview'};
const context=()=>({site:{id:installation.siteId},deploy:{id:installation.deployId,context:installation.context}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};}
function fixture(t,{open,handle}={}){
 t.mock.timers.enable({apis:['setTimeout']});let wall=BASE,mono=0;const calls=[];
 const application={prepare:async()=>{calls.push('prepare');return {state:'prepared',access:'closed'};},handle:handle??(async()=>{calls.push('handle');return Response.json({state:'ready'});}),close(){calls.push('application-close');}};
 const bundle={application,close(){calls.push('bundle-close');application.close();}};
 const host=createFiniteAlliancePreviewHost({enabled:true,origin:ORIGIN,expectedInstallation:installation,window:{notBeforeUtc:new Date(BASE).toISOString(),notAfterUtc:new Date(BASE+120000).toISOString()},openApplication:open??(async()=>{calls.push('open');return bundle;}),now:()=>wall,monotonic:()=>mono});
 t.after(async()=>{await host.close();t.mock.timers.reset();});
 return {host,bundle,calls,advance(ms,{freezeWall=false,deliverTimers=true}={}){if(!freezeWall)wall+=ms;mono+=ms;if(deliverTimers)t.mock.timers.tick(ms);},backwards(){wall--;},request:(path='/me',method='GET')=>new Request(ORIGIN+'/api/alliance-members'+path,{method})};
}
test('disabled preview host does not inspect configuration, checkpoint, request or capabilities',async()=>{
 const poison=new Proxy({},{get(){throw Error('private lookup');}});
 const host=createFiniteAlliancePreviewHost({enabled:false,get openApplication(){throw Error('private');},get window(){throw Error('private');}});
 assert.deepEqual(await host.prepare(poison,poison),{state:'quarantine',access:'closed'});assert.equal((await host.handle(poison,poison)).status,404);await host.close();
});
test('explicit closed preparation permits the existing application only at the pinned preview',async t=>{
 const f=fixture(t);assert.equal((await f.host.handle(f.request(),context())).status,503);assert.deepEqual(f.calls,[]);
 assert.deepEqual(await f.host.prepare({format:'synthetic'},context()),{state:'prepared',access:'closed'});
 assert.deepEqual(await (await f.host.handle(f.request(),context())).json(),{state:'ready'});
 assert.deepEqual(await f.host.prepare({},context()),{state:'quarantine',access:'closed'});assert.deepEqual(f.calls,['open','prepare','handle']);
 assert.equal((await f.host.handle(f.request(),{site:{id:installation.siteId},deploy:{id:'0'.repeat(24),context:'deploy-preview'}})).status,503);
 assert.ok(f.calls.includes('bundle-close'));
});
test('production identity and too-short windows are refused before private construction',async t=>{
 assert.throws(()=>createFiniteAlliancePreviewHost({enabled:true,origin:'https://galacticfederation.co',expectedInstallation:{...installation,context:'production'},window:{notBeforeUtc:new Date(BASE).toISOString(),notAfterUtc:new Date(BASE+120000).toISOString()},openApplication(){throw Error('private');}}));
 assert.throws(()=>createFiniteAlliancePreviewHost({enabled:true,origin:ORIGIN,expectedInstallation:installation,window:{notBeforeUtc:new Date(BASE).toISOString(),notAfterUtc:new Date(BASE+40000).toISOString()},openApplication(){throw Error('private');}}));
 const f=fixture(t);assert.deepEqual(await f.host.prepare({}, {...context(),deploy:{...context().deploy,context:'production'}}),{state:'quarantine',access:'closed'});assert.deepEqual(f.calls,[]);
});
test('expiry closes the capability bundle and late private responses cannot escape',async t=>{
 const gate=deferred();let lateResponse,dispatches=0;
 const f=fixture(t,{handle:()=>{dispatches++;return gate.promise;}});await f.host.prepare({},context());
 const pending=f.host.handle(f.request(),context());await tick();assert.equal(dispatches,1);
 f.advance(40000);const ended=await pending;assert.equal(ended.status,503);assert.equal((await ended.json()).error.code,'profile_unavailable');assert.ok(f.calls.includes('bundle-close'));
 lateResponse=Response.json({private:'fictional report'});gate.resolve(lateResponse);await tick();assert.equal(lateResponse.bodyUsed,true);
 assert.equal((await f.host.handle(f.request(),context())).status,503);assert.equal(dispatches,1);
});
test('interrupted writes retain the existing unknown contract and cannot be retried through the host',async t=>{
 const gate=deferred(),f=fixture(t,{handle:()=>gate.promise});await f.host.prepare({},context());
 const pending=f.host.handle(f.request('/report-review/review','POST'),context());await tick();f.advance(40000);
 assert.deepEqual(await (await pending).json(),{state:'unknown'});gate.resolve(Response.json({state:'ready'}));await tick();assert.equal((await f.host.handle(f.request(),context())).status,503);
});
test('late construction is retired without preparing the application',async t=>{
 const gate=deferred(),f=fixture(t,{open:()=>gate.promise});const pending=f.host.prepare({},context());await tick();f.advance(25000);
 assert.deepEqual(await pending,{state:'quarantine',access:'closed'});gate.resolve(f.bundle);await tick();assert.ok(f.calls.includes('bundle-close'));assert.ok(!f.calls.includes('prepare'));
});
test('a frozen wall clock cannot replenish the complete-request reserve',async t=>{
 const f=fixture(t);await f.host.prepare({},context());f.advance(80000,{freezeWall:true});
 assert.equal((await f.host.handle(f.request(),context())).status,503);assert.ok(!f.calls.includes('handle'));
 f.advance(40000,{freezeWall:true});assert.ok(f.calls.includes('bundle-close'));
});
test('a backward wall clock permanently closes the host before dispatch',async t=>{
 const f=fixture(t);await f.host.prepare({},context());f.backwards();
 assert.equal((await f.host.handle(f.request(),context())).status,503);assert.ok(f.calls.includes('bundle-close'));assert.ok(!f.calls.includes('handle'));
});
test('a delayed deadline timer cannot release an overdue response',async t=>{
 const gate=deferred(),f=fixture(t,{handle:()=>gate.promise});await f.host.prepare({},context());
 const pending=f.host.handle(f.request('/report-review/review','POST'),context());await tick();
 f.advance(41000,{deliverTimers:false});const response=Response.json({state:'ready',private:'fictional report'});gate.resolve(response);
 const result=await pending;assert.equal(result.status,503);assert.deepEqual(await result.json(),{state:'unknown'});
 assert.equal(response.bodyUsed,true);assert.ok(f.calls.includes('bundle-close'));
});
