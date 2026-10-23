import test from 'node:test';
import assert from 'node:assert/strict';
import {createAllianceCommunityHttp} from '../lib/alliance-community-http.mjs';
const origin='https://deploy-preview-124--gfof.netlify.app',url='https://abcdefghijklmnopqrst.supabase.co',key='sb_publishable_'+ 'f'.repeat(24);
const actor='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222',target='33333333-3333-4333-8333-333333333333',id='44444444-4444-4444-8444-444444444444';
const tokenFor=fields=>'header.'+Buffer.from(JSON.stringify({sub:actor,session_id:session,exp:Math.floor(Date.now()/1000)+300,iss:url+'/auth/v1',role:'authenticated',aud:'authenticated',...fields})).toString('base64url')+'.signature';
const command=()=>({operationId:id,challengeId:id,revision:0,action:'invite',target,kit:'research',scope:'members',days:7,goal:2,note:'A fictional source research brief.',format:1});
const snapshot=()=>({id,from:actor,to:target,kit:'research',scope:'members',days:7,goal:2,note:'A fictional source research brief.',status:'invited',revision:1,winner:null,createdAt:new Date().toISOString(),acceptedAt:null,endsAt:null,proofs:[]});
const tick=()=>new Promise(r=>setImmediate(r));
function fixture({authStatus=200,claims,authWork,serviceWork,timeoutMs}={}){
 const calls=[],token=tokenFor(claims),provider=async(endpoint,init)=>{
  calls.push('auth');assert.equal(endpoint,url+'/auth/v1/user');assert.equal(init.headers.Authorization,'Bearer '+token);assert.equal(init.redirect,'error');await authWork?.();
  return new Response(JSON.stringify({id:actor,email_confirmed_at:'2026-10-21T12:00:00Z',is_anonymous:false}),{status:authStatus});
 };
 const service=Object.fromEntries(['list','read','change','block'].map(kind=>[kind,async(context,input,options)=>{calls.push(kind);assert.deepEqual([context.actorId,context.sessionId],[actor,session]);assert.ok(options.signal instanceof AbortSignal);if(serviceWork)return serviceWork(kind,context,input,options);
  return kind==='list'?{state:'ready',page:{items:[],next:null}}:kind==='read'?{state:'ready',challenge:snapshot()}:kind==='change'?{state:'applied',operationId:id,challenge:snapshot()}:{state:'set',...input};
 }]));
 const api=createAllianceCommunityHttp({enabled:true,origin,url,key,service,fetcher:provider,...(timeoutMs?{timeoutMs}:{})});
 const request=(path='/challenges',{method='GET',body,headers={},signal,cookie=true}={})=>new Request(origin+'/api/alliance-members/community'+path,{method,headers:{origin,'sec-fetch-site':'same-origin',...(cookie?{cookie:'__Host-gf-access='+token}:{}),...(body!==undefined?{'content-type':'application/json'}:{}),...headers},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{}),...(signal?{signal}:{})});
 return {api,calls,token,request};
}
test('disabled community HTTP performs no dependency lookup',async()=>{
 const trap=new Proxy({},{get(){throw Error('lookup');}}),api=createAllianceCommunityHttp({service:trap});assert.equal((await api.handle(null)).status,404);api.close();
});
test('cookie-bound community reads, private pages, commands and visibility validate exact replies',async()=>{
 const f=fixture();try{
  for(const [path,options]of [['/challenges?limit=2',{}],['/challenge?id='+id,{}],['/change',{method:'POST',body:command()}],['/visibility',{method:'POST',body:{target,hidden:true}}]]){
   const r=await f.api.handle(f.request(path,options));assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(r.headers.get('vary'),'Cookie');assert.equal(r.headers.get('referrer-policy'),'no-referrer');
  }
  assert.deepEqual(f.calls,['auth','list','auth','read','auth','change','auth','block']);
 }finally{f.api.close();}
});
for(const [name,path,options,status]of [
 ['cross site','/challenges',{headers:{origin:'https://evil.example'}},403],['bearer supplied','/challenges',{headers:{authorization:'Bearer supplied'}},403],
 ['unknown route','/admin',{},404],['duplicate cursor','/challenges?limit=1&limit=2',{},400],['invalid limit','/challenges?limit=20',{},400],['caller actor','/challenges?actor='+actor,{},400],
 ['missing id','/challenge',{},400],['extra fields','/change',{method:'POST',body:{...command(),actor}},400],['oversize body','/change',{method:'POST',body:' '.repeat(4097)},400],
 ['missing cookie','/challenges',{cookie:false},401],['duplicate cookie','/challenges',{headers:{cookie:'__Host-gf-access=a.b.c; __Host-gf-access=d.e.f'}},401],
 ['mutation lacks origin','/visibility',{method:'POST',body:{target,hidden:true},headers:{origin:''}},403],
])test(name+' refuses before Auth or service',async()=>{const f=fixture();try{assert.equal((await f.api.handle(f.request(path,options))).status,status);assert.deepEqual(f.calls,[]);}finally{f.api.close();}});
for(const claims of [{sub:target},{iss:'https://evil.example/auth/v1'},{role:'service_role'},{aud:'other'},{exp:1},{session_id:'invalid'}])test('Auth acceptance cannot override wrong token binding '+JSON.stringify(claims),async()=>{
 const f=fixture({claims});try{assert.equal((await f.api.handle(f.request())).status,401);assert.deepEqual(f.calls,['auth']);}finally{f.api.close();}
});
test('Auth refusal prevents service work',async()=>{const f=fixture({authStatus:401});try{assert.equal((await f.api.handle(f.request())).status,401);assert.deepEqual(f.calls,['auth']);}finally{f.api.close();}});
test('unknown mutation result remains explicit and malformed success retires the instance',async()=>{
 const f=fixture({serviceWork:()=>({state:'unknown'})});try{const r=await f.api.handle(f.request('/change',{method:'POST',body:command()}));assert.equal(r.status,200);assert.deepEqual(await r.json(),{state:'unknown'});}finally{f.api.close();}
 const bad=fixture({serviceWork:()=>({state:'applied',operationId:target,challenge:snapshot()})});try{assert.deepEqual(await (await bad.api.handle(bad.request('/change',{method:'POST',body:command()}))).json(),{state:'unknown'});assert.equal((await bad.api.handle(bad.request())).status,503);}finally{bad.api.close();}
});
test('cancelled uncooperative Auth cannot dispatch a late mutation or reuse the instance',async()=>{
 let resume;const wait=new Promise(r=>resume=r),f=fixture({authWork:()=>wait}),c=new AbortController();
 try{const pending=f.api.handle(f.request('/change',{method:'POST',body:command(),signal:c.signal}));while(!f.calls.length)await tick();c.abort();assert.equal((await pending).status,408);resume();await tick();assert.deepEqual(f.calls,['auth']);assert.equal((await f.api.handle(f.request())).status,503);}finally{resume();f.api.close();}
});
test('cancelled dispatched mutation stays unknown and cannot admit concurrent or late follow-up',async()=>{
 let resume;const wait=new Promise(r=>resume=r),f=fixture({serviceWork:async()=>{await wait;return {state:'applied',operationId:id,challenge:snapshot()};}}),c=new AbortController();
 try{const pending=f.api.handle(f.request('/change',{method:'POST',body:command(),signal:c.signal}));while(!f.calls.includes('change'))await tick();assert.equal((await f.api.handle(f.request())).status,503);c.abort();const r=await pending;assert.equal(r.status,408);assert.deepEqual(await r.json(),{state:'unknown'});resume();await tick();assert.equal((await f.api.handle(f.request())).status,503);assert.deepEqual(f.calls,['auth','change']);}finally{resume();f.api.close();}
});
