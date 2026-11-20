import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request as httpRequest} from 'node:http';
import {randomUUID} from 'node:crypto';
import {createPersistentAllianceNodeHttp} from '../lib/alliance-member-node-http.mjs';
import {allianceMemberBackendHostname as hostname} from '../lib/alliance-member-closed-https.mjs';

const origin='https://galacticfederation.co';
const installation=()=>({format:1,instanceArn:'arn:aws:lightsail:us-east-2:759712674603:Instance/e6ee7e8c-38f8-4902-8ef8-69c3a022ebd3',releaseSha256:'a'.repeat(64),processId:randomUUID(),environment:'production'});
async function fixture(t,options={}){
 const bridge=createPersistentAllianceNodeHttp({enabled:true,origin,installation:installation(),...options});
 const server=createServer({maxHeaderSize:32768},(q,s)=>{void bridge.handle(q,s);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await bridge.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});});
 return {bridge,port:server.address().port};
}
function call(port,{path='/api/alliance-members/me',method='GET',headers={},body,unfinished=false}={}){
 return new Promise((resolve,reject)=>{
  const q=httpRequest({hostname:'127.0.0.1',port,path,method,headers:{Host:hostname,Origin:origin,'Sec-Fetch-Site':'same-origin',...headers}},r=>{
   const chunks=[];r.on('data',c=>chunks.push(c));r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,text:Buffer.concat(chunks).toString()}));r.on('error',reject);
  });q.on('error',reject);if(body!==undefined)q.write(body);if(!unfinished)q.end();
 });
}
test('default off makes no application call and opens no listener',async t=>{
 let called=0;const f=await fixture(t,{enabled:false,applicationHost:{handle(){called++;},close(){called++;}}});
 const r=await call(f.port);assert.equal(r.status,503);assert.equal(called,0);
});
test('actual Node request preserves cookies and uses only trusted process/origin context',async t=>{
 const id=installation(),expected={...id};let seen;
 const f=await fixture(t,{installation:id,applicationHost:{handle:async(q,c)=>{seen={url:q.url,cookie:q.headers.get('cookie'),forwarded:q.headers.has('x-forwarded-host'),context:c};return Response.json({state:'ready'},{headers:{'Set-Cookie':'not-forwarded=1','Access-Control-Allow-Origin':'*'}});},close:async()=>{}}});
 id.processId=randomUUID();
 const r=await call(f.port,{headers:{Cookie:'__Host-gf-access=fictional-token','X-Forwarded-Host':'wrong.invalid','X-NF-Sign':'untrusted'}});
 assert.equal(r.status,200);assert.equal(seen.url,origin+'/api/alliance-members/me');assert.equal(seen.cookie,'__Host-gf-access=fictional-token');assert.equal(seen.forwarded,false);assert.deepEqual(seen.context,{server:expected});assert.ok(Object.isFrozen(seen.context.server));
 assert.match(r.headers['cache-control'],/no-store/);assert.equal(r.headers['set-cookie'],undefined);assert.equal(r.headers['access-control-allow-origin'],undefined);
});
test('bounded JSON reaches the existing application without transport mutation',async t=>{
 let seen;const f=await fixture(t,{applicationHost:{handle:async q=>{seen=await q.json();return Response.json({state:'ready'});},close:async()=>{}}});
 const r=await call(f.port,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Fictional member'})});
 assert.equal(r.status,200);assert.deepEqual(seen,{name:'Fictional member'});
});
test('wrong host, management path, duplicate origin, bearer auth and oversized body spend no application call',async t=>{
 let calls=0;const f=await fixture(t,{maxBodyBytes:8,applicationHost:{handle:async()=>{calls++;return Response.json({});},close:async()=>{}}});
 assert.equal((await call(f.port,{headers:{Host:'wrong.invalid'}})).status,421);
 assert.equal((await call(f.port,{path:'/maintenance/prepare',method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,404);
 assert.equal((await call(f.port,{headers:{Origin:[origin,'https://wrong.invalid']}})).status,400);
 assert.equal((await call(f.port,{headers:{Authorization:'Bearer fictional'}})).status,403);
 assert.equal((await call(f.port,{method:'POST',headers:{'Content-Type':'application/json','Transfer-Encoding':'chunked'},body:'0123456789'})).status,413);
 assert.equal(calls,0);
});
test('slow request body ends before dispatch without retiring an unused application',async t=>{
 let calls=0,closed=0;const f=await fixture(t,{timeoutMs:70,applicationHost:{handle:async()=>{calls++;return Response.json({});},close:async()=>{closed++;}}});
 const r=await call(f.port,{method:'POST',headers:{'Content-Type':'application/json','Transfer-Encoding':'chunked'},body:'{',unfinished:true});
 assert.equal(r.status,408);assert.equal(calls,0);assert.equal(closed,0);
});
test('timed-out dispatched write reports unknown, aborts and cannot replay during late completion',async t=>{
 let settle,calls=0,closed=0,signal;const pending=new Promise(resolve=>{settle=resolve;});
 const f=await fixture(t,{timeoutMs:70,applicationHost:{handle:async q=>{calls++;signal=q.signal;return pending;},close:async()=>{closed++;}}});
 const r=await call(f.port,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 assert.equal(r.status,503);assert.equal(JSON.parse(r.text).mutation,'unknown');assert.equal(signal.aborted,true);assert.equal(closed,1);
 assert.equal((await call(f.port)).status,503);assert.equal(calls,1);
 settle(Response.json({state:'late_should_not_escape'}));await new Promise(setImmediate);
 assert.equal((await call(f.port)).status,503);assert.equal(closed,1);
});
test('oversized application response is discarded and raw error/private content is not returned',async t=>{
 let closed=0;const f=await fixture(t,{maxResponseBytes:16,applicationHost:{handle:async()=>Response.json({privateExample:'must not escape this test boundary'}),close:async()=>{closed++;}}});
 const r=await call(f.port);assert.equal(r.status,503);assert.equal(closed,1);assert.doesNotMatch(r.text,/privateExample|must not escape/);
});
test('proxy/client disconnect aborts dispatched work and closes that process generation',async t=>{
 let started,aborted,settle,closed=0;
 const begun=new Promise(r=>{started=r;}),ended=new Promise(r=>{aborted=r;}),pending=new Promise(r=>{settle=r;});
 const f=await fixture(t,{applicationHost:{handle:q=>{q.signal.addEventListener('abort',aborted,{once:true});started();return pending;},close:async()=>{closed++;}}});
 const q=httpRequest({hostname:'127.0.0.1',port:f.port,path:'/api/alliance-members/me',headers:{Host:hostname,Origin:origin,'Sec-Fetch-Site':'same-origin'}},()=>{});q.on('error',()=>{});q.end();
 await begun;q.destroy();await ended;assert.equal(closed,1);settle(Response.json({state:'late'}));await new Promise(setImmediate);
 assert.equal((await call(f.port)).status,503);
});
