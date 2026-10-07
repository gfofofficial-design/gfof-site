import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../assets/federation/fed-account.js',import.meta.url),'utf8');

async function render({search='',hash='',hasSessionCookie=false,passport}={}){
  const elements=Object.fromEntries(['account-message','google','apple','logout','identity','member-email','passport-summary'].map(id=>[id,{id,textContent:'',hidden:id==='logout'||id==='identity',disabled:false,addEventListener(){}}]));
  const requests=[];
  const replaced=[];
  const fetch=async url=>{
    requests.push(url);
    const data=url.endsWith('/config')?{enabled:true,providers:['google'],hasSessionCookie}:{signedIn:true,user:{email:'member@example.invalid'}};
    return {status:200,ok:true,json:async()=>data};
  };
  runInNewContext(source,{document:{getElementById:id=>elements[id]},fetch,location:{search,hash},history:{replaceState:(...args)=>replaced.push(args)},URL,URLSearchParams,FederationPassport:passport});
  await new Promise(resolve=>setImmediate(resolve));
  return {elements,requests,replaced};
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

test('opted-in local passport is shown without writing or attaching it to sign-in',async()=>{
  let writes=0;
  const passport={missions:Array(11),read:()=>({enabled:true,available:true,done:['repair-the-shuttle','the-signal']}),sync:()=>{writes++;}};
  const {elements,requests}=await render({passport});
  assert.equal(elements['passport-summary'].textContent,'This device remembers 2 of 11 mission badges. Sign-in does not sync them.');
  assert.deepEqual(requests,['/api/federation-account/config']);
  assert.equal(writes,0);
});


test('provider return query is scrubbed without exchanging browser codes',async()=>{
  const {elements,requests,replaced}=await render({search:'?code=synthetic-code&state=synthetic-state',hasSessionCookie:true});
  assert.deepEqual(replaced,[[null,'','/account']]);
  assert.deepEqual(requests,['/api/federation-account/config','/api/federation-account/session']);
  assert.equal(elements['member-email'].textContent,'member@example.invalid');
});

test('provider return query does not create a signed-in session without cookies',async()=>{
  const {elements,requests,replaced}=await render({search:'?code=synthetic-code&state=synthetic-state'});
  assert.deepEqual(replaced,[[null,'','/account']]);
  assert.deepEqual(requests,['/api/federation-account/config']);
  assert.equal(elements.identity.hidden,true);
});
