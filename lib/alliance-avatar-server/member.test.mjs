import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAllianceAvatarMemberService} from './member.mjs';
import {createAllianceAvatarStorage} from '../alliance-avatar-storage.mjs';
import {journalFixture} from './deletion-journal.fixture.mjs';
const origin='https://deploy-preview-124--gfof.netlify.app',url='https://abcdefghijklmnopqrst.supabase.co',key='sb_publishable_synthetic_fixture_only_12345';
const actor='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222',profile='33333333-3333-4333-8333-333333333333',operation='44444444-4444-4444-8444-444444444444',object='55555555-5555-4555-8555-555555555555';
const png=()=>Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWMQjG34DwADXwHuQa7szAAAAABJRU5ErkJggg==','base64');
const jwt=(change={})=>'syntheticHeader.'+Buffer.from(JSON.stringify({sub:actor,session_id:session,iss:url+'/auth/v1',role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+120,...change})).toString('base64url')+'.syntheticSignature';
const account=()=>({id:actor,is_anonymous:false,email_confirmed_at:'2026-10-17T12:00:00Z',email:'private@example.invalid',user_metadata:{admin:true}});
const input=()=>({operationId:operation,version:0,bytes:png(),mime:'image/png'});
const request=({method='PUT',path='/api/alliance-members/me/image',token=jwt(),headers={},signal}={})=>new Request(origin+path,{method,headers:{Cookie:'__Host-gf-access='+token,...(method==='GET'?{}:{Origin:origin}),'Sec-Fetch-Site':'same-origin',...headers},...(signal?{signal}:{})});
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(overrides={},options={}){
  const calls=[],keyPath=`v1/${profile}/${object}.png`;
  const defaults={authorizeSession:()=>({actorId:actor,sessionId:session,profileId:profile}),reserveSession:()=>({dispatch:true,state:'reserved',objectId:object}),claimUploadSession:()=>({dispatch:true,objectId:object,key:keyPath}),commitUploadSession:()=>({state:'committed',version:1}),cancelReservedSession:()=>({state:'cancelled'}),operationReceiptSession:()=>({state:'uploading'}),removeImageSession:()=>({state:'committed',version:2}),settleUnpublished:()=>null,
    process:()=>({bytes:png(),mime:'image/png',width:1,height:1}),upload:()=>({state:'stored',writeSettled:true,verified:true,receipt:{profileId:profile,objectId:object,key:keyPath,providerId:operation,bytes:png().length,width:1,height:1,mime:'image/png',sha256:createHash('sha256').update(png()).digest('hex')}}),fetcher:()=>json(account())};
  const methods=Object.fromEntries(Object.entries(defaults).map(([name,fn])=>[name,(...args)=>{calls.push({name,args});return (overrides[name]||fn)(...args);} ]));
  const service=createAllianceAvatarMemberService({enabled:true,origin,url,key,ledger:methods,processor:methods,storage:methods,fetcher:methods.fetcher,...options});return {service,calls};
}
const names=f=>f.calls.map(c=>c.name);
test('disabled facade performs no Auth, SQL, codec or Storage work',async()=>{
  for(const enabled of [undefined,false,'true']){const f=fixture({}, {enabled});assert.deepEqual(await f.service.handle(request(),input()),{state:'unavailable'});assert.equal(f.calls.length,0);}
});
test('trusted configuration pins origin, project, publishable key and session-aware dependencies',()=>{
  for(const options of [{origin:'http://galacticfederation.co'},{origin:origin+'/'},{url:url+'.evil.example'},{key:'sb_secret_synthetic'},{ledger:{}},{authTimeoutMs:8001}])assert.throws(()=>fixture({},options));
});
test('cross-origin, direct-function, unsupported methods and extra query targets stop before Auth',async()=>{
  const f=fixture();for(const req of [request({path:'/.netlify/functions/image'}),request({path:'/api/alliance-members/me/image?actor='+actor}),request({method:'POST'}),new Request('https://galacticfederation.co/api/alliance-members/me/image',{method:'PUT'})])assert.deepEqual(await f.service.handle(req,input()),{state:'invalid'});assert.equal(f.calls.length,0);
});
test('mutation origin and fetch metadata protect cookie use; bearer overrides cannot choose identity',async()=>{
  const f=fixture();for(const headers of [{Origin:''},{Origin:'https://evil.example'},{'Sec-Fetch-Site':'same-site'},{Authorization:'Bearer synthetic'}])assert.deepEqual(await f.service.handle(request({headers}),input()),{state:'forbidden'});assert.equal(f.calls.length,0);
});
test('forged account/session/profile fields and malformed upload input never reach Auth',async()=>{
  const f=fixture();for(const change of [{actorId:actor},{sessionId:session},{profileId:profile},{version:-1},{mime:'image/svg+xml'},{bytes:new Uint8Array(4)}])assert.deepEqual(await f.service.handle(request(),{...input(),...change}),{state:'invalid'});assert.equal(f.calls.length,0);
});
test('missing, duplicate, malformed, oversized and refresh-only cookies are refused',async()=>{
  const f=fixture();for(const Cookie of ['', '__Host-gf-refresh=synthetic','__Host-gf-access=%ZZ','__Host-gf-access='+jwt()+'; __Host-gf-access='+jwt(),'__Host-gf-access='+'x'.repeat(25000)])assert.deepEqual(await f.service.handle(request({headers:{Cookie}}),input()),{state:'sign_in_required'});assert.equal(f.calls.length,0);
});
test('verified exact cookie derives account/session and parameterizes each protected step',async()=>{
  const f=fixture(),token=jwt();assert.deepEqual(await f.service.handle(request({token}),input()),{state:'committed',version:1});assert.deepEqual(names(f),['fetcher','authorizeSession','reserveSession','process','claimUploadSession','upload','commitUploadSession']);
  const [endpoint,init]=f.calls[0].args;assert.equal(endpoint,url+'/auth/v1/user');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.equal(init.headers.Authorization,'Bearer '+token);assert.equal(init.headers.Cookie,undefined);
  for(const c of f.calls.filter(c=>/Session$/.test(c.name)))assert.deepEqual(c.args.slice(0,2),[actor,session]);
});
test('unconfirmed, anonymous, mismatched or malformed Auth account stops before SQL',async()=>{
  for(const value of [null,{}, {...account(),id:profile},{...account(),is_anonymous:true},{...account(),is_anonymous:undefined},{...account(),email_confirmed_at:null}]){const f=fixture({fetcher:()=>json(value)});assert.deepEqual(await f.service.handle(request(),input()),{state:'sign_in_required'});assert.deepEqual(names(f),['fetcher']);}
});
test('JWT claims are considered only after Auth and must match project, account, session and expiry',async()=>{
  for(const change of [{sub:profile},{iss:'https://other.example/auth/v1'},{session_id:'bad'},{role:'service_role'},{aud:'elsewhere'},{exp:1}]){const f=fixture();assert.deepEqual(await f.service.handle(request({token:jwt(change)}),input()),{state:'sign_in_required'});assert.deepEqual(names(f),['fetcher']);}
});
test('Auth rejection versus outage stays distinct without exposing provider data',async()=>{
  for(const status of [401,403,500]){const f=fixture({fetcher:()=>json({secret:'PRIVATE'},status)});assert.deepEqual(await f.service.handle(request(),input()),{state:status===500?'account_unavailable':'sign_in_required'});assert.deepEqual(names(f),['fetcher']);}
});
test('expired/deleted/foreign session and missing/held profile denial cannot reserve work',async()=>{
  const f=fixture({authorizeSession:()=>{throw Object.assign(Error('PRIVATE SQL'),{outcome:'rejected'});}});assert.deepEqual(await f.service.handle(request(),input()),{state:'sign_in_required'});assert.deepEqual(names(f),['fetcher','authorizeSession']);
});
test('malformed or mismatched SQL context cannot start processing',async()=>{
  for(const context of [{actorId:profile,sessionId:session,profileId:profile},{actorId:actor,sessionId:profile,profileId:profile},{actorId:actor,sessionId:session,profileId:'bad'},{actorId:actor,sessionId:session,profileId:profile,private:'SECRET'}]){const f=fixture({authorizeSession:()=>context});assert.deepEqual(await f.service.handle(request(),input()),{state:'account_unavailable'});assert.equal(f.calls.length,2);}
});
test('session revoked at publication preserves delivery evidence without publication retry',async()=>{
  const f=fixture({commitUploadSession:()=>{throw Object.assign(Error('PRIVATE'),{outcome:'rejected'});}});assert.deepEqual(await f.service.handle(request(),input()),{state:'cleanup_pending'});assert.equal(names(f).at(-1),'settleUnpublished');assert.equal(names(f).filter(n=>n==='upload').length,1);
});
test('status and explicit image removal remain self-targeted without physical deletion',async()=>{
  const f=fixture();assert.deepEqual(await f.service.handle(request({method:'GET'}),{operationId:operation}),{state:'uploading'});assert.deepEqual(names(f),['fetcher','authorizeSession','operationReceiptSession']);
  const g=fixture();assert.deepEqual(await g.service.handle(request({method:'DELETE'}),{operationId:operation,version:1,confirm:'remove_my_image'}),{state:'committed',version:2});assert.deepEqual(names(g),['fetcher','authorizeSession','removeImageSession']);
  assert.deepEqual(await g.service.handle(request({method:'DELETE'}),{operationId:operation,version:1,confirm:'remove_everyone'}),{state:'invalid'});
});
test('input snapshot survives mutation while Auth waits',async()=>{
  const gate=deferred(),f=fixture({fetcher:()=>gate.promise}),data=input(),pending=f.service.handle(request(),data);data.bytes.fill(0);data.operationId=profile;gate.resolve(json(account()));assert.deepEqual(await pending,{state:'committed',version:1});assert.deepEqual(f.calls.find(c=>c.name==='process').args[0],new Uint8Array(png()));assert.equal(f.calls.find(c=>c.name==='reserveSession').args[2],operation);
});
test('cancelled Auth or context cannot initiate SQL mutation',async()=>{
  for(const name of ['fetcher','authorizeSession']){const c=new AbortController(),f=fixture({[name]:()=>{c.abort();return name==='fetcher'?json(account()):{actorId:actor,sessionId:session,profileId:profile};}});assert.deepEqual(await f.service.handle(request({signal:c.signal}),input()),{state:'request_ended'});assert.equal(names(f).includes('reserveSession'),false);}
});
test('non-cooperative Auth deadline refuses late completion without a follow-up query',async()=>{
  const gate=deferred(),f=fixture({fetcher:()=>gate.promise},{authTimeoutMs:20});assert.deepEqual(await f.service.handle(request(),input()),{state:'account_unavailable'});gate.resolve(json(account()));await tick();assert.deepEqual(names(f),['fetcher']);
});
test('oversized or invalid Auth bytes cannot become a member context',async()=>{
  for(const response of [()=>new Response('"'+'x'.repeat(65536)+'"'),()=>new Response('{'),()=>new Response('{}',{headers:{'Content-Length':'99999999'}})]){const f=fixture({fetcher:response});assert.deepEqual(await f.service.handle(request(),input()),{state:'account_unavailable'});assert.deepEqual(names(f),['fetcher']);}
});
test('global facade capacity is bounded across requests and close aborts pending Auth',async()=>{
  const gate=deferred(),f=fixture({fetcher:()=>gate.promise});const a=f.service.handle(request(),input()),b=f.service.handle(request(),input());assert.deepEqual(await f.service.handle(request(),input()),{state:'busy'});f.service.close();gate.resolve(json(account()));assert.deepEqual(await a,{state:'request_ended'});assert.deepEqual(await b,{state:'request_ended'});assert.deepEqual(await f.service.handle(request(),input()),{state:'unavailable'});assert.equal(names(f).includes('authorizeSession'),false);
});
test('unexpected dependency state or error text cannot escape the facade',async()=>{
  const f=fixture({authorizeSession:()=>{throw {state:'PRIVATE SECRET',message:'PRIVATE URL'};}});assert.deepEqual(await f.service.handle(request(),input()),{state:'account_unavailable'});
});

test('private content path defaults closed before Auth even when member mutations are enabled',async()=>{
  const f=fixture();assert.deepEqual(await f.service.handle(request({method:'GET',path:'/api/alliance-members/me/image/content'}),{operationId:operation}),{state:'unavailable'});assert.deepEqual(names(f),[]);f.service.close();
});

test('private viewing requires pinned gateway, live SQL state, journal and serving gate',()=>{
  assert.throws(()=>fixture({}, {viewEnabled:true}));
});

test('actual member private-view path derives its subject from verified cookie and returns no public URL',async()=>{
  const r={profileId:profile,objectId:object,key:`v1/${profile}/${object}.png`,providerId:operation,bytes:png().length,width:1,height:1,mime:'image/png',sha256:createHash('sha256').update(png()).digest('hex')};let downloads=0;
  const storage=createAllianceAvatarStorage({enabled:true,origin:url,apiKey:key,bearerToken:'syntheticHeader.syntheticClaims.syntheticSignature',fetcher:async()=>{downloads++;return new Response(png(),{headers:{'Content-Type':'image/png'}});}});
  const live=journalFixture({events:[]}),calls=[];
  const ledger={authorizeSession:async(a,s)=>{calls.push([a,s]);return {actorId:actor,sessionId:session,profileId:profile};},mineSession:async()=>({version:1,objectId:object,pending:[]}),operationReceiptSession:async()=>({state:'committed',profileId:profile,objectId:object,key:r.key,writeSettled:true,verified:true,receipt:r,descriptor:{bytes:r.bytes,width:1,height:1,mime:'image/png',sha256:r.sha256},deletionReceipt:null})};
  for(const name of ['reserveSession','claimUploadSession','commitUploadSession','cancelReservedSession','removeImageSession','settleUnpublished'])ledger[name]=()=>{throw Error('No mutation allowed');};
  const service=createAllianceAvatarMemberService({enabled:true,viewEnabled:true,origin,url,key,ledger,processor:{process(){}},storage,journal:live.client,serving:{authorize:async()=>true},fetcher:async()=>json(account())});
  const req=request({method:'GET',path:'/api/alliance-members/me/image/content'}),value=await service.handle(req,{operationId:operation});assert.equal(value.state,'readable');assert.deepEqual(Buffer.from(await value.response.arrayBuffer()),png());assert.equal(downloads,1);assert.equal(value.response.headers.get('cache-control'),'private, no-store');assert.equal(value.response.headers.get('location'),null);assert.deepEqual(calls,[[actor,session],[actor,session],[actor,session]]);
  assert.deepEqual(await service.handle(req,{operationId:operation,profileId:object}),{state:'invalid'});assert.equal(downloads,1);service.close();live.client.close();
});
