import test from 'node:test';
import assert from 'node:assert/strict';
import {createAllianceProfileApi} from '../lib/alliance-profile-api.mjs';
import {journalFixture,event,chain} from '../lib/alliance-avatar-server/deletion-journal.fixture.mjs';
const origin='https://deploy-preview-124--gfof.netlify.app';
const url='https://syntheticfixture.supabase.co',key='sb_publishable_'+'fixture'.repeat(5);
const token='syntheticHeader.syntheticClaims.syntheticSignature';
const cookie='__Host-gf-access='+token;
const id='11111111-1111-4111-8111-111111111111';
const input=()=>({name:'Fixture Explorer',community:'Example crew',bio:'A synthetic profile for private integration tests.',role:'builder',listed:false});
const row=()=>({id,...input(),publication:'private',updatedAt:'2026-10-17T16:00:00Z'});
const user=()=>({id,email:'private@example.invalid',email_confirmed_at:'2026-10-17T15:00:00Z',is_anonymous:false,user_metadata:{admin:true}});
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
function request(path='/me',{method='GET',headers={},body,signal}={}){return new Request(origin+'/api/alliance-members'+path,{method,headers:{Cookie:cookie,'Sec-Fetch-Site':'same-origin',...(method==='GET'?{}:{Origin:origin,'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),...(signal?{signal}:{})});}
function fixture({account=user(),accountStatus=200,profile=row(),profileStatus=200,run,events=[],journal,serving={authorize:()=>true}}={}){
  const calls=[];let writes=0;
  const signed=journalFixture({events});
  const api=createAllianceProfileApi({enabled:true,origin,url,key,journal:journal||signed.client,serving,fetcher:async(endpoint,init)=>{
    calls.push({endpoint,init});
    if(run)return run(endpoint,init);
    if(endpoint.endsWith('/auth/v1/user'))return json(account,accountStatus);
    if(endpoint.endsWith('/alliance_save_profile')||endpoint.endsWith('/alliance_remove_profile'))writes++;
    return json(profile,profileStatus);
  }});
  return {api,calls,signed,get writes(){return writes;}};
}
const body=async response=>JSON.parse(await response.text());

test('missing deletion or startup policy closes legacy text paths before Auth',async()=>{
  let calls=0;const api=createAllianceProfileApi({enabled:true,origin,url,key,fetcher:()=>{calls++;throw Error();}});
  for(const req of [request(),request('/directory'),request('/me',{method:'POST',body:input()})])assert.equal((await api(req)).status,503);assert.equal(calls,0);
});
test('restored own profile cannot leave the composed API when journal records removal',async()=>{
  const f=fixture({events:[event({profileId:id})]});const r=await f.api(request());assert.equal(r.status,503);assert.doesNotMatch(JSON.stringify(await body(r)),/Fixture Explorer|synthetic profile|private@example/);assert.equal(f.writes,0);
});
test('directory response strips removed rows and keeps a browser-valid surviving cursor',async()=>{
  const second='22222222-2222-4222-8222-222222222222',third='33333333-3333-4333-8333-333333333333';
  const raw=()=>({id,display_name:input().name,community:'',bio:input().bio,contribution_role:'builder'});
  const f=fixture({events:[event({profileId:second})],profile:[raw(),{...raw(),id:second},{...raw(),id:third}]});const r=await f.api(request('/directory?limit=2'));assert.equal(r.status,200);const result=await body(r);assert.equal(result.items.length,1);assert.equal(result.items[0].id,id);assert.equal(result.next,id);assert.equal(JSON.stringify(result).includes(second),false);
});
test('removal during one committed save withholds text and reports uncertainty without retry',async()=>{
  let f,writes=0;f=fixture({run:async(endpoint)=>{
    if(endpoint.endsWith('/auth/v1/user'))return json(user());
    writes++;f.signed.history.push(chain([event({profileId:id})])[0]);return json(row());
  }});const r=await f.api(request('/me',{method:'POST',body:input()}));assert.equal(r.status,503);const result=await body(r);assert.equal(result.mutation,'unknown');assert.doesNotMatch(JSON.stringify(result),/Fixture Explorer|synthetic profile/);assert.equal(writes,1);
});
test('failed pre-load journal or freeze does not dispatch a profile mutation',async()=>{
  for(const policy of [{journal:{review:()=>({state:'unavailable'})}},{serving:{authorize:()=>false}}]){const f=fixture(policy);const r=await f.api(request('/me',{method:'POST',body:input()}));assert.equal(r.status,503);assert.equal(f.writes,0);assert.equal((await body(r)).mutation,undefined);}
});
test('default and non-boolean activation cannot perform account or database work',async()=>{
  let calls=0;for(const enabled of [undefined,false,'true']){const api=createAllianceProfileApi({enabled,fetcher:()=>{calls++;throw Error();}});assert.equal((await api(request())).status,404);}assert.equal(calls,0);
});
test('trusted configuration accepts only one exact Federation origin and a publishable key',()=>{
  for(const bad of ['https://other.example',origin+'/',origin+'?secret=x','http://galacticfederation.co','https://galacticfederation.co.evil.example'])assert.throws(()=>createAllianceProfileApi({enabled:true,origin:bad,url,key}));
  for(const bad of ['sb_secret_fixture','legacy.jwt.key'])assert.throws(()=>createAllianceProfileApi({enabled:true,origin,url,key:bad}));
});
test('direct function paths, other origins and methods cannot bypass the route boundary',async()=>{
  const f=fixture();for(const req of [new Request(origin+'/.netlify/functions/alliance-members'),new Request('https://galacticfederation.co/api/alliance-members/me'),request('/me/'),request('/me',{method:'OPTIONS'})])assert.ok([404,405].includes((await f.api(req)).status));assert.equal(f.calls.length,0);
});
test('cross-site reads, missing mutation origin and client bearer overrides fail before Auth',async()=>{
  const f=fixture();for(const req of [request('/me',{headers:{Origin:'https://evil.example'}}),request('/me',{headers:{'Sec-Fetch-Site':'same-site'}}),request('/me',{headers:{Authorization:'Bearer '+token}}),request('/me',{method:'POST',headers:{Origin:''},body:input()})])assert.equal((await f.api(req)).status,403);assert.equal(f.calls.length,0);
});
test('missing, duplicate, malformed and oversized access cookies never use refresh or anonymous access',async()=>{
  const f=fixture();for(const value of ['', '__Host-gf-refresh=fixture',cookie+'; '+cookie,'__Host-gf-access=%ZZ','__Host-gf-access=one.two','__Host-gf-access='+'x'.repeat(24001)])assert.equal((await f.api(request('/me',{headers:{Cookie:value}}))).status,401);assert.equal(f.calls.length,0);
});
test('unconfirmed, anonymous, missing-field and malformed accounts cannot reach profile RPCs',async()=>{
  for(const account of [null,{}, {...user(),id:'browser-actor'},{...user(),email_confirmed_at:null},{...user(),email_confirmed_at:'unknown'},{...user(),is_anonymous:true},{...user(),is_anonymous:undefined}]){const f=fixture({account});assert.equal((await f.api(request())).status,401);assert.equal(f.calls.length,1);}
});
test('upstream authentication refusal is sanitized and blocks all database work',async()=>{
  for(const accountStatus of [401,403]){const f=fixture({accountStatus,account:{secret:'DO-NOT-RETURN'}});const r=await f.api(request());assert.equal(r.status,401);assert.doesNotMatch(JSON.stringify(await body(r)),/DO-NOT|private@example|token/);assert.equal(f.calls.length,1);}
});
test('an Auth outage is unavailable, never an empty profile or an invitation to retry a write',async()=>{
  const f=fixture({accountStatus:500});const r=await f.api(request('/me',{method:'POST',body:input()}));assert.equal(r.status,503);assert.equal((await body(r)).error.code,'account_unavailable');assert.equal(f.writes,0);
});
test('validated account cookie is reused only server-side and private account fields are never returned',async()=>{
  const f=fixture({profile:{...row(),user_id:id,email:'DO-NOT-RETURN',access_token:'DO-NOT-RETURN'}});const r=await f.api(request());assert.equal(r.status,200);assert.deepEqual(await body(r),{profile:row()});assert.equal(f.calls.length,2);for(const c of f.calls){assert.equal(c.init.headers.Authorization,'Bearer '+token);assert.equal(c.init.credentials,'omit');assert.equal(c.init.redirect,'error');assert.equal(c.init.headers.Cookie,undefined);}assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie');assert.equal(r.headers.get('access-control-allow-origin'),null);assert.equal(r.headers.get('set-cookie'),null);
});
test('a missing own profile stays null after authentication, without creating one',async()=>{
  const f=fixture({profile:null});assert.deepEqual(await body(await f.api(request())),{profile:null});assert.equal(f.writes,0);
});
test('a save is self-targeted, strips no invalid actor fields silently and forwards only editable values',async()=>{
  const f=fixture();for(const extra of [{user_id:id},{id},{moderation_state:'visible'},{avatar_url:'https://evil.example/image'},{listed:'true'}])assert.equal((await f.api(request('/me',{method:'POST',body:{...input(),...extra}}))).status,400);assert.equal(f.calls.length,0);
  const r=await f.api(request('/me',{method:'POST',body:input()}));assert.equal(r.status,200);assert.equal(f.writes,1);assert.deepEqual(JSON.parse(f.calls[1].init.body),{p_name:input().name,p_community:input().community,p_bio:input().bio,p_role:'builder',p_listed:false});
});
test('unsupported content, invalid JSON and excessive bytes stop before verification or a write',async()=>{
  const f=fixture();const badJson=new Request(origin+'/api/alliance-members/me',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:'{'});
  for(const req of [badJson,request('/me',{method:'POST',headers:{'Content-Type':'text/plain'},body:input()}),request('/me',{method:'POST',body:{...input(),bio:'x'.repeat(5000)}})])assert.equal((await f.api(req)).status,400);assert.equal(f.calls.length,0);
});
test('legacy profile deletion is closed before Auth/RPC pending journal-first session routing',async()=>{
  const f=fixture({profile:{removed:true}});for(const value of [{},{confirm:'remove_my_profile',user_id:id},{confirm:'remove_everyone'},{confirm:'remove_my_profile'}])assert.equal((await f.api(request('/me',{method:'DELETE',body:value}))).status,503);
  assert.equal(f.calls.length,0);assert.equal(f.writes,0);
});
test('directory filters and cursors are bounded and malformed queries perform no Auth calls',async()=>{
  const f=fixture({profile:[]});for(const path of ['/me?user_id='+id,'/directory?after=bad','/directory?limit=0','/directory?limit=20&limit=1','/directory?account=all'])assert.equal((await f.api(request(path))).status,400);assert.equal(f.calls.length,0);
  assert.deepEqual(await body(await f.api(request('/directory?limit=5'))),{items:[],next:null});assert.equal(new URL(f.calls[1].endpoint).searchParams.get('limit'),'6');
});
test('lost write acknowledgement returns an unknown outcome and never retries or refreshes',async()=>{
  const f=fixture({profileStatus:500,profile:{error:'DO-NOT-RETURN'}});const r=await f.api(request('/me',{method:'POST',body:input()}));assert.equal(r.status,503);const data=await body(r);assert.equal(data.mutation,'unknown');assert.equal(f.writes,1);assert.equal(f.calls.length,2);assert.doesNotMatch(JSON.stringify(data),/DO-NOT|access_token|refresh/);
});
test('cancellation before authentication never calls a provider',async()=>{
  const f=fixture(),controller=new AbortController();controller.abort();assert.equal((await f.api(request('/me',{signal:controller.signal}))).status,408);assert.equal(f.calls.length,0);
});
test('cancellation while Auth returns cannot start a subsequent profile write',async()=>{
  const controller=new AbortController(),calls=[];const f=fixture({run:async(endpoint)=>{calls.push(endpoint);controller.abort();return json(user());}});const r=await f.api(request('/me',{method:'POST',body:input(),signal:controller.signal}));assert.equal(r.status,408);assert.equal(calls.length,1);assert.match(calls[0],/\/auth\/v1\/user$/);
});
test('cancellation during a dispatched write cannot report success or rollback',async()=>{
  const controller=new AbortController(),calls=[];const f=fixture({run:async(endpoint,init)=>{calls.push(endpoint);if(endpoint.endsWith('/auth/v1/user'))return json(user());controller.abort();assert.equal(init.signal.aborted,true);return json(row());}});const r=await f.api(request('/me',{method:'POST',body:input(),signal:controller.signal}));assert.equal(r.status,408);assert.equal((await body(r)).mutation,'unknown');assert.equal(calls.length,2);
});
test('stalled inbound bytes have a fixed deadline and cannot start authentication',async()=>{
  const f=fixture();let cancelled=0;const req={url:origin+'/api/alliance-members/me',method:'POST',headers:new Headers({Origin:origin,Cookie:cookie,'Content-Type':'application/json'}),signal:new AbortController().signal,body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel(){cancelled++;return new Promise(()=>{});}})}};const started=Date.now();assert.equal((await f.api(req)).status,400);assert.ok(Date.now()-started<5000);assert.equal(cancelled,1);assert.equal(f.calls.length,0);
});
test('stalled authentication that ignores abort cannot later start a profile mutation',async()=>{
  const f=fixture({run:()=>new Promise(()=>{})});const started=Date.now();const r=await f.api(request('/me',{method:'POST',body:input()}));assert.equal(r.status,503);assert.ok(Date.now()-started<12000);assert.equal(f.calls.length,1);assert.equal(f.writes,0);
});
test('oversized and invalid upstream account JSON cannot become a verified session',async()=>{
  for(const payload of ['"'+'x'.repeat(65536)+'"','{']){
    const f=fixture({run:async()=>new Response(payload,{headers:{'Content-Type':'application/json'}})});assert.equal((await f.api(request())).status,503);assert.equal(f.calls.length,1);
  }
});
