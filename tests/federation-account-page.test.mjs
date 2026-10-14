import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../assets/federation/fed-account.js',import.meta.url),'utf8');

const origin='https://account-preview.example.invalid';
function oauthUrl(){const u=new URL('https://syntheticfixture.supabase.co/auth/v1/authorize');u.search=new URLSearchParams({provider:'google',redirect_to:origin+'/api/federation-account/callback?state='+'s'.repeat(32),code_challenge:'c'.repeat(43),code_challenge_method:'s256'}).toString();return u.href;}

async function render({search='',hash='',hasSessionCookie=false,expiredSession=false,unavailableSession=false,passport,destination=oauthUrl()}={}){
  const elements=Object.fromEntries(['account-message','google','apple','logout','identity','member-email','passport-summary'].map(id=>[id,{id,textContent:'',hidden:id==='logout'||id==='identity',disabled:false,addEventListener(name,fn){handlers[id+':'+name]=fn;}}]));
  const requests=[];const handlers={};const assigned=[];
  const replaced=[];
  let sessionAttempts=0;
  const fetch=async url=>{
    requests.push(url);
    if(url.endsWith('/oauth'))return {status:200,ok:true,json:async()=>({url:destination})};
    if(url.endsWith('/session')&&unavailableSession)return {status:502,ok:false,json:async()=>({error:'Account service is temporarily unavailable.'})};
    if(url.endsWith('/session')&&expiredSession&&sessionAttempts++===0)return {status:401,ok:false,json:async()=>({error:'Sign in again.'})};
    const data=url.endsWith('/config')?{enabled:true,providers:['google'],hasSessionCookie}:{signedIn:true,user:{email:'member@example.invalid'}};
    return {status:200,ok:true,json:async()=>data};
  };
  runInNewContext(source,{document:{getElementById:id=>elements[id]},fetch,location:{origin,search,hash,assign:url=>assigned.push(url)},history:{replaceState:(...args)=>replaced.push(args)},URL,URLSearchParams,FederationPassport:passport,AbortController,setTimeout,clearTimeout,navigator:{locks:{request:async(name,options,work)=>work()}}});
  await new Promise(resolve=>setImmediate(resolve));
  return {elements,requests,replaced,assigned,click:id=>handlers[id+':click']()};
}

test('unexpected auth fragment is scrubbed before any account request',async()=>{
  const {elements,requests,replaced}=await render({hash:'#access_token=synthetic-sensitive-value&refresh_token=synthetic-refresh&type=recovery'});
  assert.deepEqual(requests,[]);
  assert.deepEqual(replaced,[[null,'','/account']]);
  assert.match(elements['account-message'].textContent,/cannot finish that sign-in or recovery link/);
  assert.ok(!elements['account-message'].textContent.includes('synthetic-sensitive-value'));
});

test('failed sign-in stays visible after config resolves and signed-out page makes one request',async()=>{
  const {elements,requests,replaced}=await render({search:'?signin=failed'});
  assert.equal(elements['account-message'].textContent,'Sign-in did not complete. Try again.');
  assert.deepEqual(requests,['/api/federation-account/config']);
  assert.deepEqual(replaced,[[null,'','/account']]);
});

test('a cookie-present browser still checks the session',async()=>{
  const {elements,requests}=await render({hasSessionCookie:true});
  assert.deepEqual(requests,['/api/federation-account/config','/api/federation-account/session']);
  assert.equal(elements['member-email'].textContent,'member@example.invalid');
});

test('an expired access session refreshes before showing the member',async()=>{
  const {elements,requests}=await render({hasSessionCookie:true,expiredSession:true});
  assert.deepEqual(requests,['/api/federation-account/config','/api/federation-account/session','/api/federation-account/refresh','/api/federation-account/session']);
  assert.equal(elements['member-email'].textContent,'member@example.invalid');
});

test('provider outage leaves the page usable without claiming signed-in status',async()=>{
  const {elements,requests}=await render({hasSessionCookie:true,unavailableSession:true});
  assert.deepEqual(requests,['/api/federation-account/config','/api/federation-account/session']);
  assert.equal(elements.identity.hidden,true);
  assert.match(elements['account-message'].textContent,/temporarily unavailable/);
});

test('opted-in local passport is shown without writing or attaching it to sign-in',async()=>{
  let writes=0;
  const passport={missions:Array(11),read:()=>({enabled:true,available:true,done:['repair-the-shuttle','the-signal']}),sync:()=>{writes++;}};
  const {elements,requests}=await render({passport});
  assert.equal(elements['passport-summary'].textContent,'This device remembers 2 of 11 mission badges. Sign-in does not sync them.');
  assert.deepEqual(requests,['/api/federation-account/config']);
  assert.equal(writes,0);
});

test('provider return query is removed without browser code exchange',async()=>{const {elements,requests,replaced}=await render({search:'?code=synthetic-code&state=synthetic-state',hasSessionCookie:true});assert.deepEqual(replaced,[[null,'','/account']]);assert.deepEqual(requests,['/api/federation-account/config','/api/federation-account/session']);assert.equal(elements['member-email'].textContent,'member@example.invalid');});
test('provider return query cannot sign in a cookie-free browser',async()=>{const {elements,requests,replaced}=await render({search:'?code=synthetic-code&state=synthetic-state'});assert.deepEqual(replaced,[[null,'','/account']]);assert.deepEqual(requests,['/api/federation-account/config']);assert.equal(elements.identity.hidden,true);});

test('reviewed OAuth destination opens only the fixed PKCE callback flow',async()=>{
 const t=await render();await t.click('google');assert.deepEqual(t.assigned,[oauthUrl()]);
});
test('browser refuses altered provider/callback/PKCE/URL components and duplicate parameters',async()=>{
 const changes=[
  u=>{u.username='misleading';},u=>{u.password='synthetic';},u=>{u.port='444';},u=>{u.hash='#unexpected';},
  u=>u.searchParams.set('provider','apple'),
  u=>u.searchParams.set('redirect_to','https://other.example.invalid/api/federation-account/callback?state='+'s'.repeat(32)),
  u=>u.searchParams.set('redirect_to',origin+'/wrong-path?state='+'s'.repeat(32)),
  u=>u.searchParams.set('redirect_to',origin+'/api/federation-account/callback?state=short'),
  u=>u.searchParams.set('code_challenge_method','plain'),
  u=>u.searchParams.set('code_challenge','short'),
  u=>u.searchParams.append('provider','google'),
  u=>u.searchParams.append('extra','unexpected'),
  u=>{u.protocol='http:';},
 ];
 for(const change of changes){
  const u=new URL(oauthUrl());change(u);const t=await render({destination:u.href});await t.click('google');
  assert.deepEqual(t.assigned,[]);assert.equal(t.elements['account-message'].textContent,'Invalid sign-in destination.');
  assert.equal(t.elements.google.disabled,false);
 }
});
