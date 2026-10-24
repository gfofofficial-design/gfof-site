import test from 'node:test';
import assert from 'node:assert/strict';
import {createFiniteMemberEntry as create,reviewFiniteMemberEntry as review,finiteMemberEntrySource as source} from './member-finite-entry.mjs';
import {syntheticFiniteMemberEntry as fixture} from './member-finite-entry.fixture.mjs';
const start=Date.parse('2026-10-24T12:00:00.000Z'),end=start+600000;
const inaccessible=new Proxy({},{get(){throw Error('request inspected before admission');},ownKeys(){throw Error('request enumerated');}});
function local({wall=start,mono=100,handler=async()=>({statusCode:200}),open}={}){
 const state={wall,mono,opens:0,closes:0,calls:0};
 const configuration=fixture();
 const entry=create({configuration,now:()=>state.wall,monotonic:()=>state.mono,openRuntime:async options=>{
  state.opens++;state.options=options;if(open)return open(options,state);
  return {handler:async(e,c)=>{state.calls++;return handler(e,c);},close:async()=>{state.closes++;}};
 }});return {entry,state,configuration};
}
test('trusted entry validates external policy digest and both exact private-binding references before construction',()=>{
 const c=fixture();assert.notEqual(review(c),c);assert.equal(source(c),source(c));
 for(const change of [c=>c.expectedPolicySha256='0'.repeat(64),c=>c.connectionSecrets.control.versionId='9'.repeat(32),c=>c.connectionSecrets.journal.secretArn=c.connectionSecrets.control.secretArn,c=>c.connectionSecrets.control.password='forbidden',c=>c.policy.identity.Statement.pop(),c=>c.enabled=true,c=>c.connectionSecrets.control.ca='bad CA']){
  const x=fixture();change(x);assert.throws(()=>create({configuration:x}),/^Error: alliance_member_finite_entry_unavailable$/);
 }
});
test('before-start calls inspect neither event nor context and can later enter the approved window',async()=>{
 const f=local({wall:start-1});try{
  assert.equal((await f.entry.handler(inaccessible,inaccessible)).statusCode,503);assert.equal(f.state.opens,0);
  f.state.wall=start;assert.equal((await f.entry.handler({},{})).statusCode,200);assert.equal(f.state.opens,1);
 }finally{await f.entry.close();}
});
test('boundary is exclusive and expired cold entries never construct capabilities',async()=>{
 for(const wall of [end,end+1]){const f=local({wall});assert.equal((await f.entry.handler(inaccessible,inaccessible)).statusCode,503);await f.entry.close();assert.equal(f.state.opens,0);}
});
test('admission reserves a complete handler budget and opens only pinned runtime options once',async()=>{
 const f=local({wall:end-6499});try{
  assert.equal((await f.entry.handler(inaccessible,inaccessible)).statusCode,503);assert.equal(f.state.opens,0);
 }finally{await f.entry.close();}
 const g=local();try{
  g.configuration.connectionSecrets.control.versionId='9'.repeat(32);
  assert.equal((await g.entry.handler({},{})).statusCode,200);assert.equal((await g.entry.handler({},{})).statusCode,200);assert.equal(g.state.opens,1);
  assert.deepEqual(Object.keys(g.state.options).sort(),['connectionSecrets','enabled','expectedTrust','installation','trustRecordBytes']);
  assert.equal(g.state.options.connectionSecrets.control.versionId,'1'.repeat(32));
 }finally{await g.entry.close();await g.entry.close();}assert.equal(g.state.closes,1);
});
test('busy request is refused before inspection without creating a second runtime',async()=>{
 let release;const f=local({handler:()=>new Promise(r=>release=r)});
 const pending=f.entry.handler({},{});while(!release)await new Promise(r=>setImmediate(r));
 assert.equal((await f.entry.handler(inaccessible,inaccessible)).statusCode,503);assert.equal(f.state.opens,1);
 release({statusCode:200});assert.equal((await pending).statusCode,200);await f.entry.close();
});
test('late response is withheld and expiry closes clients before another request',async()=>{
 const f=local({handler:async()=>{f.state.wall=end;return {statusCode:200,body:'must be withheld'};}});
 assert.equal((await f.entry.handler({},{})).statusCode,503);await f.entry.close();assert.equal(f.state.closes,1);
 f.state.wall=start;assert.equal((await f.entry.handler(inaccessible,inaccessible)).statusCode,503);assert.equal(f.state.calls,1);
});
test('monotonic deadline prevents frozen wall time from extending an admitted trial',async()=>{
 const f=local();assert.equal((await f.entry.handler({},{})).statusCode,200);
 f.state.mono+=600000;assert.equal((await f.entry.handler(inaccessible,inaccessible)).statusCode,503);await f.entry.close();assert.equal(f.state.calls,1);
});
test('backward or invalid clocks retire the entry with no reopening',async()=>{
 for(const change of [s=>s.wall--,s=>s.mono--,s=>s.wall=NaN,s=>s.mono=Infinity]){
  const f=local();assert.equal((await f.entry.handler({},{})).statusCode,200);change(f.state);
  assert.equal((await f.entry.handler(inaccessible,inaccessible)).statusCode,503);await f.entry.close();assert.equal(f.state.closes,1);
 }
});
test('close during construction retires the late client without dispatch',async()=>{
 let release;const f=local({open:()=>new Promise(r=>release=r)});
 const pending=f.entry.handler({},{});while(!release)await new Promise(r=>setImmediate(r));
 const closed=f.entry.close();release({handler(){throw Error('late dispatch');},close(){f.state.closes++;}});
 assert.equal((await pending).statusCode,503);await closed;assert.equal(f.state.closes,1);
});
test('construction or dispatch failure yields only unavailable and cannot retry initialization',async()=>{
 for(const options of [{open:async()=>{throw Error('synthetic private diagnostic');}},{handler:async()=>{throw Error('synthetic private diagnostic');}}]){
  const f=local(options);const r=await f.entry.handler({},{});assert.equal(r.body,'{"state":"unavailable"}');await f.entry.close();
  assert.equal((await f.entry.handler(inaccessible,inaccessible)).statusCode,503);assert.equal(f.state.opens,1);
 }
});
test('generated boot module has only fixed reviewed public configuration and handler export',()=>{
 const text=source(fixture());assert.match(text,/export const handler=/);assert.equal(/process\.env|event\.enabled|openRuntime:|password/.test(text),false);
 assert.match(text,/trustRecordBytes=Buffer.from/);assert.match(text,/createFiniteMemberEntry\(\{configuration\}\)/);
});
