import test from 'node:test';
import assert from 'node:assert/strict';
import {createAllianceAccountBridge} from '../assets/federation/fed-alliance-account-bridge.mjs';
const origin='https://galacticfederation.co',user={id:'11111111-1111-4111-8111-111111111111',email:'fixture@example.invalid'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const session=()=>json({signedIn:true,user});
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(options={}){
 const calls=[],attaches=[],locks=[],document=new EventTarget(),window=new EventTarget();let detached=0,channel;
 const memberPage={attach(n){attaches.push(n);return true;},detach(){detached++;}};
 const bridge=createAllianceAccountBridge({enabled:true,origin,memberPage,document,window,
  locks:{async request(name,init,work){locks.push({name,init});return work();}},
  channelFactory(name){channel={name,close(){this.closed=true;}};return channel;},
  fetcher:async(url,init)=>{calls.push({url,init});return options.response?options.response(url,init):session();},...options});
 return {bridge,calls,attaches,locks,document,window,get detached(){return detached;},get channel(){return channel;}};
}
test('default disabled bridge performs no I/O or attachment',async()=>{
 let reads=0,attaches=0;const b=createAllianceAccountBridge({memberPage:{attach(){attaches++;},detach(){}},fetcher(){reads++;}});
 assert.equal(await b.verify(),false);assert.equal(reads,0);assert.equal(attaches,0);b.dispose();
});
test('explicit session check uses fixed origin, shared cookie lock and no actor/token input',async()=>{
 const f=fixture();assert.equal(f.calls.length,0);assert.equal(await f.bridge.verify(),true);
 assert.deepEqual(f.attaches,[1]);assert.equal(f.locks[0].name,'gf-account-session');assert.equal(f.locks[0].init.mode,'exclusive');
 const {url,init}=f.calls[0];assert.equal(url,origin+'/api/federation-account/session');assert.equal(init.method,'GET');assert.equal(init.credentials,'same-origin');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.equal(init.body,undefined);assert.deepEqual(init.headers,{Accept:'application/json'});
 assert.deepEqual(f.bridge.getState(),{status:'attached'});assert.ok(!JSON.stringify(f.bridge.getState()).includes(user.id));f.bridge.dispose();
});
test('each explicit check closes prior page before opening a new generation',async()=>{
 const f=fixture();await f.bridge.verify();const before=f.detached;await f.bridge.verify();assert.ok(f.detached>before);assert.deepEqual(f.attaches,[1,2]);f.bridge.dispose();
});
test('unauthorized, provider failure and malformed user never attach',async()=>{
 for(const response of [()=>json({},401),()=>json({},503),()=>json({signedIn:false,user}),()=>json({signedIn:true,user:{id:'from-local-storage'}}),()=>json({signedIn:true,user:{id:7}}),()=>new Response('not json'),()=>new Response('{',{headers:{'content-type':'application/json'}})]){
  const f=fixture({response});assert.equal(await f.bridge.verify(),false);assert.deepEqual(f.attaches,[]);f.bridge.dispose();
 }
});
test('unsigned channel hints only close, never verify or attach',async()=>{
 const f=fixture();assert.equal(f.channel.name,'gf-account-status');f.channel.onmessage({data:{type:'signed-in',user}});assert.equal(f.calls.length,0);assert.equal(f.attaches.length,0);
 await f.bridge.verify();f.channel.onmessage({data:{type:'signed-out'}});assert.equal(f.bridge.getState().status,'closed');assert.equal(f.calls.length,1);f.bridge.dispose();assert.equal(f.channel.closed,true);
});
test('page hiding closes immediately and late session response cannot reattach',async()=>{
 let release;const pending=new Promise(r=>release=r);const f=fixture({response:()=>pending});const checking=f.bridge.verify();await tick();
 f.document.dispatchEvent(new Event('visibilitychange'));release(session());assert.equal(await checking,false);assert.deepEqual(f.attaches,[]);assert.equal(f.bridge.getState().status,'closed');f.bridge.dispose();
});
test('pagehide and dispose clear state and remove lifecycle listeners',async()=>{
 const f=fixture();await f.bridge.verify();f.window.dispatchEvent(new Event('pagehide'));assert.equal(f.bridge.getState().status,'closed');f.bridge.dispose();const n=f.detached;
 f.window.dispatchEvent(new Event('pagehide'));f.document.dispatchEvent(new Event('visibilitychange'));assert.equal(f.detached,n);assert.equal(await f.bridge.verify(),false);
});
test('oversized and invalid UTF-8 responses fail closed',async()=>{
 for(const response of [()=>json({signedIn:true,user,padding:'x'.repeat(4096)}),()=>new Response(new Uint8Array([0xff]),{headers:{'content-type':'application/json'}})]){
  const f=fixture({response});assert.equal(await f.bridge.verify(),false);assert.deepEqual(f.attaches,[]);f.bridge.dispose();
 }
});
test('noncooperative transport stays single-flight after deadline until settled',async()=>{
 let release;const pending=new Promise(r=>release=r);const f=fixture({timeoutMs:10,response:()=>pending});const check=f.bridge.verify();await tick();
 assert.equal(await f.bridge.verify(),false);assert.equal(await check,false);assert.equal(f.bridge.getState().status,'unavailable');assert.equal(await f.bridge.verify(),false);assert.equal(f.calls.length,1);
 release(session());await tick();assert.deepEqual(f.attaches,[]);f.bridge.dispose();
});
test('deadline also bounds a response body that ignores cancellation',async()=>{
 const f=fixture({timeoutMs:10,response:()=>new Response(new ReadableStream({start(){}}),{headers:{'content-type':'application/json'}})});
 assert.equal(await f.bridge.verify(),false);assert.deepEqual(f.attaches,[]);f.bridge.dispose();
});
test('missing shared lock, foreign origin and invalid budget refuse enabled setup',()=>{
 for(const override of [{locks:null},{origin:'https://foreign.invalid'},{origin:origin+'/'},{timeoutMs:0},{timeoutMs:12001}])assert.throws(()=>fixture(override),/configuration/);
});
test('failed member attachment is unavailable without retry or extra session call',async()=>{
 let detached=0;const f=fixture({memberPage:{attach(){return false;},detach(){detached++;}}});assert.equal(await f.bridge.verify(),false);assert.equal(f.bridge.getState().status,'unavailable');assert.equal(f.calls.length,1);f.bridge.dispose();assert.ok(detached>=2);
});
