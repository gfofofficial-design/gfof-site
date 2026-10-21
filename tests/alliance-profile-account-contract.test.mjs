// Same-repository account contract. All transport and credentials are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mountAllianceAccountMemberPage} from '../assets/federation/fed-alliance-member-account.mjs';
import {profileDocument,origin} from './alliance-profile-document.fixture.mjs';
const {createHandler}=createRequire(import.meta.url)('../netlify/functions/federation-account.cjs');
test('real account handler acceptance and refusal control the editor without external transport',async()=>{
let accepted=true,providerFixtureCalls=0;
const handler=createHandler({env:{FEDERATION_ACCOUNT_ENABLED:'true',FEDERATION_ACCOUNT_ORIGIN:origin,
 FEDERATION_AUTH_URL:'https://fixture-project.supabase.co',FEDERATION_AUTH_PUBLISHABLE_KEY:'sb_publishable_fixture_only_no_access',
 CONTEXT:'deploy-preview',DEPLOY_PRIME_URL:origin},fetchImpl:async endpoint=>{
 assert.equal(endpoint,'https://fixture-project.supabase.co/auth/v1/user');providerFixtureCalls++;
 return new Response(JSON.stringify(accepted?{id:'11111111-1111-4111-8111-111111111111',email:'fixture@example.invalid',email_confirmed_at:'2026-10-21T12:00:00Z',is_anonymous:false}:{error:'synthetic unauthorized'}),{status:accepted?200:401,headers:{'content-type':'application/json'}});
}});
const f=profileDocument();
const host=mountAllianceAccountMemberPage(f.doc,{enabled:true,origin,events:new EventTarget(),createChannel:()=>{throw Error('No external channel');},fetcher:async(url,init)=>{
 assert.equal(url,origin+'/api/federation-account/session');assert.equal(init.method,'GET');
 const answer=await handler({path:'/api/federation-account/session',httpMethod:'GET',rawUrl:url,headers:{cookie:'__Host-gf-access=fixture-access-only'}});
 return new Response(answer.body,{status:answer.statusCode,headers:answer.headers});
}});
assert.equal(await host.check(),true);assert.equal(f.get('fields').disabled,false);
f.get('name').value='Private synthetic draft';accepted=false;
assert.equal(await host.check(),false);assert.equal(f.get('name').value,'');assert.equal(f.get('fields').disabled,true);
host.dispose();assert.equal(providerFixtureCalls,2);
});
