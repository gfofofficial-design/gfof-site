import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemberProfileClient} from '../assets/federation/fed-alliance-member-client.mjs';
import {createAllianceProfileApi} from '../lib/alliance-profile-api.mjs';
const origin='https://deploy-preview-124--gfof.netlify.app';
const id='11111111-1111-4111-8111-111111111111';
const input=()=>({name:'Fixture Explorer',community:'Example crew',bio:'A synthetic profile for member transport tests.',role:'researcher',listed:false});
const profile=()=>({id,...input(),publication:'private',updatedAt:'2026-10-17T16:00:00Z'});
const json=(data,status=200)=>new Response(JSON.stringify(data&&typeof data==='object'&&Object.hasOwn(data,'profile')?{writeState:'available',...data}:data),{status,headers:{'Content-Type':'application/json'}});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function fixture({fetcher=async()=>json({profile:profile()}),...options}={}){const states=[],calls=[];const client=createMemberProfileClient({enabled:true,origin,fetcher:async(...args)=>{calls.push(args);return fetcher(...args);},onState:s=>states.push(s),...options});return {client,states,calls};}
test('client stays closed by default, starts no request on construction and exposes no token option',async()=>{
  let calls=0;const client=createMemberProfileClient({fetcher:()=>{calls++;}});await assert.rejects(client.load(),{code:'closed'});assert.equal(calls,0);assert.equal(fixture().calls.length,0);assert.throws(()=>createMemberProfileClient({enabled:true,origin:'https://elsewhere.example'}));
});
test('transport uses same-origin cookies, no cache, no redirects and no bearer or actor headers',async()=>{
  const f=fixture();assert.deepEqual(await f.client.load(),{profile:profile(),writeState:'available'});const [url,init]=f.calls[0];assert.equal(url,origin+'/api/alliance-members/me');assert.equal(init.credentials,'same-origin');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');for(const h of ['Authorization','Cookie','Origin','user_id'])assert.equal(init.headers[h],undefined);assert.deepEqual(f.states.map(x=>x.status),['checking','ready']);
});
test('empty profile and unlisted saved profile remain distinct and sanitized',async()=>{
  const empty=fixture({fetcher:async()=>json({profile:null})});assert.deepEqual(await empty.client.load(),{profile:null,writeState:'available'});assert.equal(empty.states.at(-1).status,'empty');
  const f=fixture({fetcher:async()=>json({profile:{...profile(),user_id:'DO-NOT-RETURN',email:'DO-NOT-RETURN'}})});assert.deepEqual(await f.client.save(input()),{profile:profile(),writeState:'available'});assert.equal(f.states.at(-1).status,'saved');assert.doesNotMatch(JSON.stringify(f.states),/DO-NOT-RETURN/);assert.deepEqual(JSON.parse(f.calls[0][1].body),input());
});
test('input cannot supply owner, moderation, avatar or administrator fields',()=>{
  const f=fixture();for(const extra of [{user_id:id},{moderation_state:'visible'},{avatar:'blob:anything'},{role:'admin'}])assert.throws(()=>f.client.save({...input(),...extra}));assert.equal(f.calls.length,0);
});
test('legacy client removal stays closed with a clear not-started status and no request',async()=>{
  const f=fixture({fetcher:async()=>json({removed:true,private_data:'ignored'})});await assert.rejects(f.client.remove(),{code:'removal_unavailable'});assert.equal(f.calls.length,0);assert.equal(f.states.at(-1).status,'removal_unavailable');assert.match(f.states.at(-1).message,/No removal was started/);
});
test('directory pages cannot expose private fields, duplicate rows or invented continuation cursors',async()=>{
  const publicRow={id,name:input().name,community:'',bio:input().bio,role:'builder'};
  const f=fixture({fetcher:async()=>json({items:[{...publicRow,email:'DO-NOT-RETURN'}],next:id})});assert.deepEqual(await f.client.directory({limit:1}),{items:[publicRow],next:id});assert.match(f.calls[0][0],/\/directory\?limit=1$/);
  const bad=fixture({fetcher:async()=>json({items:[publicRow,publicRow],next:null})});await assert.rejects(bad.client.directory(),{code:'unavailable'});
  const cursor=fixture({fetcher:async()=>json({items:[publicRow],next:'22222222-2222-4222-8222-222222222222'})});await assert.rejects(cursor.client.directory({limit:1}),{code:'unavailable'});
});
test('a second operation is never queued while one is pending',async()=>{
  const pending=deferred(),f=fixture({fetcher:()=>pending.promise});const load=f.client.load();await assert.rejects(f.client.save(input()),{code:'busy'});assert.equal(f.calls.length,1);pending.resolve(json({profile:profile()}));await load;
});
test('cancelled reads cannot restore a late profile even when transport ignores abort',async()=>{
  const pending=deferred(),f=fixture({fetcher:()=>pending.promise});const load=f.client.load();f.client.cancel();await assert.rejects(load,{code:'cancelled'});pending.resolve(json({profile:profile()}));await new Promise(r=>setImmediate(r));assert.deepEqual(f.states.map(x=>x.status),['checking','cancelled']);
});
test('cancellation from a status listener stops dispatch before transport begins',async()=>{
  let calls=0,client;client=createMemberProfileClient({enabled:true,origin,onState:s=>{if(s.status==='checking')client.cancel();},fetcher:()=>{calls++;return json({profile:profile(),writeState:'available'});}});await assert.rejects(client.load(),{code:'cancelled'});assert.equal(calls,0);
});
test('a timed-out fetch that ignores abort has a bounded wait and no retry',async()=>{
  const f=fixture({fetcher:()=>new Promise(()=>{}),timeoutMs:5});await assert.rejects(f.client.load(),{code:'cancelled'});assert.equal(f.calls.length,1);
});
test('a timed-out stream that ignores cancellation cannot block completion',async()=>{
  let cancelled=0;const f=fixture({timeoutMs:5,fetcher:async()=>({ok:true,status:200,headers:new Headers({'Content-Type':'application/json'}),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel(){cancelled++;return new Promise(()=>{});}})}})});await assert.rejects(f.client.load(),{code:'cancelled'});assert.equal(cancelled,1);
});
test('uncertain write locks further changes, and a later read does not prove rollback or unlock retry',async()=>{
  let count=0;const f=fixture({fetcher:async()=>++count===1?json({secret:'DO-NOT-RETURN'},502):json({profile:profile()})});await assert.rejects(f.client.save(input()),{code:'unknown'});await assert.rejects(f.client.remove(),{code:'unknown'});assert.equal(f.calls.length,1);await f.client.load();assert.equal(f.states.at(-1).status,'review_required');await assert.rejects(f.client.save(input()),{code:'unknown'});assert.equal(f.calls.length,2);assert.doesNotMatch(JSON.stringify(f.states),/DO-NOT-RETURN/);
});
test('cancelling an in-flight write leaves uncertainty and ignores a late success',async()=>{
  const pending=deferred(),f=fixture({fetcher:()=>pending.promise});const save=f.client.save(input());f.client.cancel();await assert.rejects(save,{code:'unknown'});pending.resolve(json({profile:profile()}));await new Promise(r=>setImmediate(r));assert.deepEqual(f.states.map(s=>s.status),['saving','unknown']);await assert.rejects(f.client.remove(),{code:'unknown'});
});
test('malformed, oversized and inconsistent profile responses never become a successful save',async()=>{
  for(const data of [{profile:null},{profile:{...profile(),publication:'listed'}},'x'.repeat(32769)]){const f=fixture({fetcher:async()=>json(data)});await assert.rejects(f.client.save(input()),{code:'unknown'});assert.ok(!f.states.some(s=>s.status==='saved'));assert.equal(f.calls.length,1);}
});
test('expired account requests sign-in but never starts OAuth or refresh automatically',async()=>{
  const f=fixture({fetcher:async()=>json({error:'private upstream message'},401)});await assert.rejects(f.client.load(),{code:'sign_in_required'});assert.equal(f.calls.length,1);assert.doesNotMatch(JSON.stringify(f.states),/private upstream|access_token/);
});
test('disposed client aborts pending work and cannot repopulate page state',async()=>{
  const pending=deferred(),f=fixture({fetcher:()=>pending.promise});const load=f.client.load();f.client.dispose();await assert.rejects(load,{code:'cancelled'});const count=f.states.length;pending.resolve(json({profile:profile()}));await new Promise(r=>setImmediate(r));assert.equal(f.states.length,count);await assert.rejects(f.client.load(),{code:'closed'});
});
test('filtered short directory pages preserve visible continuation without accepting an empty cursor page',async()=>{
  const {publication,updatedAt,listed,...item}=profile();const f=fixture({fetcher:async()=>json({items:[item],next:id})});
  assert.deepEqual(await f.client.directory({limit:2}),{items:[item],next:id});assert.equal(f.states.at(-1).status,'listed');
  const empty=fixture({fetcher:async()=>json({items:[],next:id})});await assert.rejects(empty.client.directory({limit:2}),{code:'unavailable'});
});
test('composed browser-to-cookie-Auth-to-profile flow uses no browser account IDs or service key',async()=>{
  const {journalFixture}=await import('../lib/alliance-avatar-server/deletion-journal.fixture.mjs');const signed=journalFixture({events:[]});
  const token='syntheticHeader.'+Buffer.from(JSON.stringify({sub:id,session_id:'22222222-2222-4222-8222-222222222222',iss:'https://syntheticfixture.supabase.co/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+120})).toString('base64url')+'.syntheticSignature',upstream=[];let stored=null;
  const api=createAllianceProfileApi({enabled:true,ledger:{profileWriteStatusSession:async()=>stored?{profileId:id,sequence:1,pending:true,inputSha256:'a'.repeat(64),resultSha256:'b'.repeat(64)}:null,authorizeAccountSession:async(actorId,sessionId)=>({actorId,sessionId})},origin,url:'https://syntheticfixture.supabase.co',key:'sb_publishable_'+'fixture'.repeat(5),journal:signed.client,serving:{authorize:()=>true},creation:{profile:async(context,value)=>{assert.equal(context.actorId,id);stored={...profile(),...value};return stored;}},fetcher:async(endpoint,init)=>{
    upstream.push({endpoint,init});if(endpoint.endsWith('/auth/v1/user'))return json({id,email_confirmed_at:'2026-10-17T16:00:00Z',is_anonymous:false});
    if(endpoint.endsWith('/alliance_save_profile')){const data=JSON.parse(init.body);stored={...profile(),name:data.p_name};return json(stored);}
    if(endpoint.endsWith('/alliance_remove_profile')){stored=null;return json({removed:true});}
    return json(stored);
  }});
  const f=fixture({fetcher:(endpoint,init)=>api(new Request(endpoint,{...init,headers:{...init.headers,Cookie:'__Host-gf-access='+token,'Sec-Fetch-Site':'same-origin',...(init.method==='GET'?{}:{Origin:origin})}}))});
  assert.deepEqual(await f.client.load(),{profile:null,writeState:'available'});await f.client.save(input());assert.deepEqual(await f.client.load(),{profile:profile(),writeState:'review_required'});await assert.rejects(f.client.remove(),{code:'removal_unavailable'});assert.deepEqual(await f.client.load(),{profile:profile(),writeState:'review_required'});assert.equal(upstream.length,7);assert.ok(upstream.every(c=>c.init.headers.Authorization==='Bearer '+token));assert.ok(!f.states.some(s=>s.status==='removed'));assert.doesNotMatch(JSON.stringify(f.states),new RegExp(token));
});

test('composed token expiry after saving keeps browser writes paused through a later successful read',async t=>{
 const {journalFixture}=await import('../lib/alliance-avatar-server/deletion-journal.fixture.mjs');let clock=Math.floor(Date.now()/1000)*1000;const expires=clock+5000;t.mock.method(Date,'now',()=>clock);
 const url='https://syntheticfixture.supabase.co',makeCookie=exp=>'__Host-gf-access=syntheticHeader.'+Buffer.from(JSON.stringify({sub:id,session_id:'22222222-2222-4222-8222-222222222222',iss:url+'/auth/v1',role:'authenticated',aud:'authenticated',exp})).toString('base64url')+'.syntheticSignature';
 let cookie=makeCookie(expires/1000),stored=null,writes=0;const signed=journalFixture({events:[]}),upstream=[];
 const api=createAllianceProfileApi({enabled:true,ledger:{profileWriteStatusSession:async()=>null,authorizeAccountSession:async(actorId,sessionId)=>({actorId,sessionId})},origin,url,key:'sb_publishable_'+'fixture'.repeat(5),journal:signed.client,serving:{authorize:()=>true},creation:{profile:async()=>{writes++;stored=profile();clock=expires;return stored;}},fetcher:async endpoint=>{upstream.push(endpoint);return json(endpoint.endsWith('/auth/v1/user')?{id,email_confirmed_at:'2026-10-17T16:00:00Z',is_anonymous:false}:stored);}});
 const f=fixture({fetcher:(endpoint,init)=>api(new Request(endpoint,{...init,headers:{...init.headers,Cookie:cookie,'Sec-Fetch-Site':'same-origin',...(init.method==='GET'?{}:{Origin:origin})}}))});
 try{
  await assert.rejects(f.client.save(input()),{code:'unknown'});assert.equal(writes,1);assert.equal(f.states.at(-1).status,'unknown');const dispatched=f.calls.length;
  await assert.rejects(f.client.save(input()),{code:'unknown'});assert.equal(f.calls.length,dispatched);
  cookie=makeCookie(clock/1000+60);assert.deepEqual(await f.client.load(),{profile:profile(),writeState:'available'});assert.equal(f.states.at(-1).status,'review_required');const afterRead=f.calls.length;
  await assert.rejects(f.client.save(input()),{code:'unknown'});assert.equal(f.calls.length,afterRead);assert.equal(writes,1);assert.equal(upstream.length,3);
 }finally{f.client.dispose();signed.client.close();}
});

test('a fresh client reads a durable hold and refuses saves locally until an explicit available read',async()=>{
 let held=true;const f=fixture({fetcher:async()=>json({profile:profile(),writeState:held?'review_required':'available'})});
 await f.client.load();assert.equal(f.states.at(-1).status,'review_pending');await assert.rejects(f.client.save(input()),{code:'review_pending'});assert.equal(f.calls.length,1);
 held=false;assert.equal((await f.client.load()).writeState,'available');await f.client.save(input());assert.equal(f.calls.length,3);assert.equal(f.states.at(-1).status,'saved');
});
test('a confirmed save can report a review hold without becoming an uncertain save',async()=>{
 const f=fixture({fetcher:async()=>json({profile:profile(),writeState:'review_required'})});assert.equal((await f.client.save(input())).profile.id,id);assert.equal(f.states.at(-1).status,'review_pending');await assert.rejects(f.client.save(input()),{code:'review_pending'});assert.equal(f.calls.length,1);
});
test('only an explicit no-mutation refusal becomes a known hold; unknown outcomes never do',async()=>{
 const f=fixture({fetcher:async()=>json({error:{code:'profile_changes_paused',message:'PRIVATE'}},503)});await assert.rejects(f.client.save(input()),{code:'review_pending'});await assert.rejects(f.client.save(input()),{code:'review_pending'});assert.equal(f.calls.length,1);assert.doesNotMatch(JSON.stringify(f.states),/PRIVATE/);
 const uncertain=fixture({fetcher:async()=>json({error:{code:'profile_changes_paused'},mutation:'unknown'},503)});await assert.rejects(uncertain.client.save(input()),{code:'unknown'});
});
test('missing or invalid recovery metadata cannot confirm a profile read or save',async()=>{
 for(const writeState of [undefined,null,'available-later',true])for(const write of [false,true]){
  const f=fixture({fetcher:async()=>new Response(JSON.stringify({profile:profile(),...(writeState===undefined?{}:{writeState})}),{headers:{'Content-Type':'application/json'}})});
  await assert.rejects(write?f.client.save(input()):f.client.load(),{code:write?'unknown':'unavailable'});
 }
});
