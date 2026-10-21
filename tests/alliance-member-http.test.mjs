import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createAllianceMemberHttp} from '../lib/alliance-member-http.mjs';
import {mountAllianceAccountMemberPage} from '../assets/federation/fed-alliance-member-account.mjs';
import {createMemberProfileClient} from '../assets/federation/fed-alliance-member-client.mjs';
import {createProfileRemovalStatusClient} from '../assets/federation/fed-alliance-profile-removal-status-client.mjs';
import {createProfileRemovalClient} from '../assets/federation/fed-alliance-profile-removal-client.mjs';
import {profileDocument} from './alliance-profile-document.fixture.mjs';
import {memberHttpFixture,origin,fields,operation} from './alliance-member-http.fixture.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const body=r=>r.json();

test('default-closed composition has no dependency access or automatically mounted function',async()=>{
  const trap=new Proxy({},{get(){throw Error('No dependency lookup');}});
  const http=createAllianceMemberHttp({ledger:trap,journal:trap,creation:trap,removal:trap,serving:trap});
  assert.equal((await http.handle(null)).status,404);http.close();
  for(const enabled of ['true',1,null])assert.throws(()=>createAllianceMemberHttp({enabled}));
  assert.ok(!readdirSync(new URL('../netlify/functions/',import.meta.url)).some(n=>n.startsWith('alliance-member')));
  const entry=readFileSync(new URL('../assets/federation/fed-alliance-profile-page.mjs',import.meta.url),'utf8');assert.doesNotMatch(entry,/enabled\s*:\s*true/);
});
test('actual account page host → cookie HTTP routes → admitted revisions → anchored removal completes ordinary member cycle',async()=>{
  const f=memberHttpFixture(),d=profileDocument();
  const page=mountAllianceAccountMemberPage(d.doc,{enabled:true,origin,events:new EventTarget(),createChannel:()=>{throw Error('No external channel');},fetcher:f.fetcher});
  const find=text=>{const walk=n=>{if(n.textContent===text)return n;for(const c of n.children){const v=walk(c);if(v)return v;}};return walk(d.get('removal'));};
  try{
    assert.equal(f.calls.length,0);assert.equal(await page.check(),true);assert.equal(f.profile,null);
    await d.get('read').emit('click');
    for(const [k,v]of Object.entries(fields())){const n=d.get(k);if(typeof v==='boolean')n.checked=v;else n.value=v;await n.emit('input');}
    await d.get('form').emit('submit');assert.equal(f.revision,1);assert.equal(f.profile.name,fields().name);
    d.get('name').value='Second ordinary edit';await d.get('name').emit('input');d.get('listed').checked=true;await d.get('listed').emit('change');
    await d.get('form').emit('submit');assert.equal(f.revision,2);assert.equal(f.profile.listed,true);
    d.get('listed').checked=false;await d.get('listed').emit('change');await d.get('form').emit('submit');assert.equal(f.revision,3);assert.equal(f.profile.listed,false);
    await find('Review profile removal').emit('click');const confirmation=d.get('removal').children[3],checkbox=confirmation.children[0].children[0];checkbox.checked=true;await checkbox.emit('change');
    await find('Remove my Alliance profile').emit('click');assert.equal(f.profile,null);assert.equal(f.journal.rows.length,1);assert.equal(f.anchor.sequence,1);
    const phases=f.calls.filter(x=>['prepare-removal','journal-append','finish-removal'].includes(x));assert.deepEqual(phases,['prepare-removal','journal-append','finish-removal']);
    assert.equal(d.get('fields').disabled,true);assert.equal(d.get('name').value,'');assert.match(d.get('removal').textContent,/removed/i);
  }finally{page.dispose();f.close();}
});
test('dashboard acceptance alone cannot authorize a SQL-revoked session',async()=>{
  const f=memberHttpFixture(),d=profileDocument();f.activeSession=false;
  const page=mountAllianceAccountMemberPage(d.doc,{enabled:true,origin,events:new EventTarget(),createChannel:()=>{throw Error();},fetcher:f.fetcher});
  try{assert.equal(await page.check(),true);await d.get('read').emit('click');assert.equal(f.profile,null);assert.ok(f.calls.includes('current-session'));assert.ok(!f.calls.includes('finish-profile'));assert.doesNotMatch(d.get('current-body').textContent,/Synthetic member/);}
  finally{page.dispose();f.close();}
});
test('revocation after a dispatched write withholds the profile and preserves uncertainty',async()=>{
  let f;f=memberHttpFixture({afterFinish:()=>{f.activeSession=false;}});
  try{const response=await f.http.handle(f.request('/me',{method:'POST',body:{operationId:operation(1),revision:0,profile:fields()}}));
    assert.equal(response.status,503);const value=await body(response);assert.equal(value.mutation,'unknown');assert.equal(value.profile,undefined);assert.equal(f.revision,1);assert.equal(f.profile.name,fields().name);
  }finally{f.close();}
});
test('missing, duplicate or refused cookies and forged body actors cannot reach a profile mutation',async()=>{
  const f=memberHttpFixture();try{
    const input={operationId:operation(1),revision:0,profile:fields()};
    assert.equal((await f.http.handle(f.request('/me',{cookie:false}))).status,401);
    assert.equal((await f.http.handle(f.request('/me',{headers:{cookie:'__Host-gf-access='+f.token+'; __Host-gf-access='+f.token}}))).status,401);
    assert.equal((await f.http.handle(f.request('/me',{method:'POST',body:{...input,actorId:'11111111-1111-4111-8111-111111111111'}}))).status,400);
    assert.equal(f.calls.length,0);f.authStatus=401;assert.equal((await f.http.handle(f.request('/me'))).status,401);assert.deepEqual(f.calls,['auth']);
  }finally{f.close();}
});
test('unknown, legacy, image, foreign-origin and cross-site paths never fall back to another route',async()=>{
  const f=memberHttpFixture();try{
    for(const [path,method]of [['/me','DELETE'],['/me/','GET'],['/me/image','PUT'],['/me/profile','POST'],['/me/profile/removal-status','POST'],['/me%2fprofile','DELETE']])assert.equal((await f.http.handle(f.request(path,{method}))).status,404);
    assert.equal((await f.http.handle(new Request('https://other.example/api/alliance-members/me'))).status,404);
    assert.equal((await f.http.handle(f.request('/me',{headers:{origin:'https://other.example','x-forwarded-host':'galacticfederation.co'}}))).status,403);
    assert.equal((await f.http.handle(f.request('/me',{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
    assert.equal((await f.http.handle(f.request('/me',{headers:{authorization:'Bearer fixture'}}))).status,403);
    assert.equal(f.calls.length,0);
  }finally{f.close();}
});
test('one composition serializes requests across profile reads and removal preflight',async()=>{
  const wait=deferred();let first=true;const f=memberHttpFixture({authWork:()=>{if(first){first=false;return wait.promise;}}});
  try{const read=f.http.handle(f.request());await tick();assert.equal((await f.http.handle(f.request('/me/profile/removal-status'))).status,503);assert.deepEqual(f.calls,['auth']);wait.resolve();assert.equal((await read).status,200);assert.equal((await f.http.handle(f.request())).status,200);}
  finally{wait.resolve();f.close();}
});
test('close during uncooperative Auth retires every owned route and late data cannot start SQL',async()=>{
  const wait=deferred();const f=memberHttpFixture({authWork:()=>wait.promise});
  try{const read=f.http.handle(f.request());await tick();f.http.close();assert.notEqual((await read).status,200);assert.equal((await f.http.handle(f.request('/me/profile/removal-status'))).status,503);wait.resolve();await tick();assert.deepEqual(f.calls,['auth']);assert.equal(f.dependencyCloses,0);}
  finally{wait.resolve();f.close();}
});
test('client cancellation retires the whole composition and cannot release late verified identity',async()=>{
  const wait=deferred(),controller=new AbortController(),f=memberHttpFixture({authWork:()=>wait.promise});
  try{const read=f.http.handle(f.request('/me',{signal:controller.signal}));await tick();controller.abort();assert.equal((await read).status,408);wait.resolve();await tick();assert.deepEqual(f.calls,['auth']);assert.equal((await f.http.handle(f.request())).status,503);}
  finally{wait.resolve();f.close();}
});
test('outer deadline stops a stalled inbound mutation body with uncertainty and permanently closes this composition',async()=>{
  const f=memberHttpFixture({timeoutMs:10});let cancelled=false;
  try{
    const request=new Request(origin+'/api/alliance-members/me',{method:'POST',headers:{origin,cookie:'__Host-gf-access='+f.token,'content-type':'application/json'},duplex:'half',body:new ReadableStream({cancel(){cancelled=true;}})});
    const response=await f.http.handle(request);assert.equal(response.status,503);assert.equal((await response.json()).mutation,'unknown');await tick();assert.equal(cancelled,true);assert.equal(f.calls.length,0);assert.equal((await f.http.handle(f.request())).status,503);
  }finally{f.close();}
});
test('lost removal response is reconciled by the same identity-bound request without a second record or deletion',async()=>{
  const f=memberHttpFixture();let n=0,lost=false;
  const client=createMemberProfileClient({enabled:true,profileRevisions:true,origin,newOperationId:()=>operation(++n),fetcher:f.fetcher});
  const reader=createProfileRemovalStatusClient({enabled:true,origin,fetcher:f.fetcher});
  const remover=createProfileRemovalClient({enabled:true,profileBinding:true,origin,newOperationId:()=>operation(99),fetcher:async(endpoint,init)=>{const response=await f.fetcher(endpoint,init);if(!lost){lost=true;throw Error('Synthetic lost reply');}return response;}});
  try{await client.load();await client.save(fields());const current=await reader.read();assert.equal((await remover.confirm({...current,confirm:'remove_my_profile'})).state,'unknown');assert.equal(f.profile,null);assert.equal((await remover.reconcile()).state,'committed');assert.equal(f.journal.rows.length,1);assert.equal(f.anchor.sequence,1);}
  finally{client.dispose();reader.dispose();remover.dispose();f.close();}
});
test('journal/current serving denial withholds reads and all runtime responses carry noncacheable privacy headers',async()=>{
  const f=memberHttpFixture();try{
    f.permitted=false;const response=await f.http.handle(f.request());assert.equal(response.status,503);assert.equal(f.calls.filter(x=>x==='current-session').length,0);
    for(const [name,value]of [['cache-control','private, no-store'],['netlify-cdn-cache-control','no-store'],['vary','Cookie'],['referrer-policy','no-referrer']])assert.equal(response.headers.get(name),value);
    assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('access-control-allow-origin'),null);
  }finally{f.close();}
});
