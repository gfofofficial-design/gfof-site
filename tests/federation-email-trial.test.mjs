import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {createTrialHandler}=createRequire(import.meta.url)('../netlify/functions/federation-email-trial.cjs');
const origin='https://deploy-preview-130--gfof.netlify.app';
const env={FEDERATION_EMAIL_TRIAL_ENABLED:'true',FEDERATION_EMAIL_TRIAL_ORIGIN:origin,FEDERATION_EMAIL_TRIAL_PUBLISHABLE_KEY:'sb_publishable_synthetic',FEDERATION_ACCOUNT_ENABLED:'true',FEDERATION_AUTH_URL:'https://productionfixture.supabase.co',FEDERATION_AUTH_EMAIL_SIGNUP_ENABLED:'true',FEDERATION_AUTH_GOOGLE_ENABLED:'true'};
const event=(action,body)=>({path:'/api/federation-account/'+action,rawUrl:origin+'/api/federation-account/'+action,httpMethod:body?'POST':'GET',headers:{origin,'sec-fetch-site':'same-origin','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
test('trial is closed by default even with inherited production enablement',async()=>{
 let calls=0;const h=createTrialHandler({env:{...env,FEDERATION_EMAIL_TRIAL_ENABLED:undefined},fetchImpl:async()=>{calls++;}});
 assert.equal(JSON.parse((await h(event('config'))).body).enabled,false);
 assert.equal((await h(event('email-start',{email:'owner@example.invalid'}))).statusCode,503);assert.equal(calls,0);
});
test('only exact protected preview origin is accepted',async()=>{
 for(const bad of ['https://galacticfederation.co','https://gfof.netlify.app','https://deploy-preview-130--gfof.netlify.app.evil.invalid',origin+'/other','http://deploy-preview-130--gfof.netlify.app']){
  let calls=0;const h=createTrialHandler({env:{...env,FEDERATION_EMAIL_TRIAL_ORIGIN:bad},fetchImpl:async()=>{calls++;}});
  assert.equal(JSON.parse((await h(event('config'))).body).enabled,false);assert.equal(calls,0);
 }
 const h=createTrialHandler({env});assert.equal((await h({...event('config'),rawUrl:'https://galacticfederation.co/api/federation-account/config'})).statusCode,503);
});
test('request uses isolated project, separate key and create_user false',async()=>{
 const calls=[];const h=createTrialHandler({env,fetchImpl:async(url,opts)=>{calls.push({url,opts});return new Response('{}');}});
 const config=JSON.parse((await h(event('config'))).body);assert.deepEqual(config.providers,[]);assert.equal(config.emailSignupEnabled,false);
 const response=await h(event('email-start',{email:'owner@example.invalid'}));assert.equal(response.statusCode,202);
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://arjycxziiqlkfomieocc.supabase.co/auth/v1/otp');assert.equal(calls[0].opts.headers.apikey,'sb_publishable_synthetic');assert.equal(JSON.parse(calls[0].opts.body).create_user,false);
});
test('foreign origin, OAuth and direct function routes make no provider call',async()=>{
 let calls=0;const h=createTrialHandler({env,fetchImpl:async()=>{calls++;}});
 assert.equal((await h({...event('email-start',{email:'owner@example.invalid'}),headers:{origin:'https://evil.invalid','content-type':'application/json'}})).statusCode,403);
 assert.equal((await h(event('oauth',{provider:'google'}))).statusCode,400);
 assert.equal((await h({...event('email-start',{email:'owner@example.invalid'}),path:'/.netlify/functions/federation-email-trial/email-start'})).statusCode,404);assert.equal(calls,0);
});

test('new-user trial requires its own flag and exact designated recipient',async()=>{
 const calls=[];const h=createTrialHandler({env:{...env,FEDERATION_EMAIL_TRIAL_SIGNUP_ENABLED:'true'},fetchImpl:async(url,opts)=>{calls.push({url,opts});return new Response('{}');}});
 assert.equal((await h(event('email-start',{email:'other@example.invalid'}))).statusCode,403);assert.equal(calls.length,0);
 assert.equal((await h(event('email-start',{email:'gfofofficial+alliance-test-20261022@gmail.com'}))).statusCode,202);
 assert.equal(calls.length,1);assert.equal(JSON.parse(calls[0].opts.body).create_user,true);
});
