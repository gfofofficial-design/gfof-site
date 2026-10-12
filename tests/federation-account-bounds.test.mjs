import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {createHandler}=createRequire(import.meta.url)('../netlify/functions/federation-account.cjs');
const origin='https://galacticfederation.co';
const env={FEDERATION_ACCOUNT_ENABLED:'true',FEDERATION_ACCOUNT_ORIGIN:origin,FEDERATION_AUTH_URL:'https://syntheticfixture.supabase.co',FEDERATION_AUTH_PUBLISHABLE_KEY:'sb_publishable_syntheticfixture',FEDERATION_AUTH_GOOGLE_ENABLED:'true'};
const user={id:'synthetic-user',email:'member@example.invalid',email_confirmed_at:'2026-10-06T00:00:00Z',is_anonymous:false};
const event=(action,method='GET',cookie='__Host-gf-access=synthetic; __Host-gf-refresh=synthetic-refresh')=>({rawUrl:origin+'/api/federation-account/'+action,path:'/api/federation-account/'+action,httpMethod:method,headers:{origin,'sec-fetch-site':'same-origin',cookie}});
const generic=r=>{assert.equal(r.statusCode,502);assert.deepEqual(JSON.parse(r.body),{error:'Account service is temporarily unavailable.'});assert.deepEqual(r.multiValueHeaders['Set-Cookie'],[]);};
test('oversized provider user data is unavailable and cannot discard refresh or expose payload',async()=>{
 const h=createHandler({env,fetchImpl:async()=>new Response(JSON.stringify({...user,user_metadata:{private:'synthetic-marker-'+ 'x'.repeat(70000)}}))});
 const result=await h(event('session'));generic(result);assert.ok(!result.body.includes('synthetic-marker'));
});
test('malformed provider JSON is a service failure while malformed client JSON remains a bad request',async()=>{
 let calls=0;const h=createHandler({env,fetchImpl:async()=>{calls++;return new Response('invalid upstream JSON');}});
 generic(await h(event('session')));
 const result=await h({...event('oauth','POST'),body:'invalid client JSON'});assert.equal(result.statusCode,400);assert.equal(calls,1);
});
test('oversized callback user data cannot establish access or refresh cookies',async()=>{
 const h=createHandler({env,fetchImpl:async url=>new Response(JSON.stringify(url.includes('/token?')?{access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600}:{...user,padding:'x'.repeat(70000)}))});
 const start=await h({...event('oauth','POST',''),body:'{"provider":"google"}'});
 const redirect=new URL(new URL(JSON.parse(start.body).url).searchParams.get('redirect_to'));
 const result=await h({...event('callback','GET',start.multiValueHeaders['Set-Cookie'][0].split(';')[0]),queryStringParameters:{state:redirect.searchParams.get('state'),code:'synthetic-code'}});
 assert.equal(result.statusCode,303);assert.equal(result.headers.Location,origin+'/account?signin=failed');assert.equal(result.multiValueHeaders['Set-Cookie'].length,1);assert.ok(result.multiValueHeaders['Set-Cookie'][0].startsWith('__Host-gf-flow='));
});
test('oversized streamed bytes reject without waiting for stuck cancellation', {timeout:2000},async()=>{
 let cancellation=0;
 const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(65537));},cancel(){cancellation++;return new Promise(()=>{});}});
 const h=createHandler({env,fetchImpl:async()=>new Response(body)});generic(await h(event('session')));assert.equal(cancellation,1);
});
test('ignored header cancellation still returns a bounded account service failure', {timeout:10000},async()=>{
 let signal;const h=createHandler({env,fetchImpl:async(_,o)=>{signal=o.signal;return new Promise(()=>{});}});
 generic(await h(event('session')));assert.equal(signal.aborted,true);
});
test('stuck body and stuck cancellation still return a bounded refresh failure', {timeout:10000},async()=>{
 let cancellation=0;const body={getReader(){return {read(){return new Promise(()=>{});},cancel(){cancellation++;return new Promise(()=>{});}};}};
 const h=createHandler({env,fetchImpl:async()=>({ok:true,status:200,body,json:()=>new Promise(()=>{})})});
 generic(await h(event('refresh','POST')));assert.equal(cancellation,1);
});
