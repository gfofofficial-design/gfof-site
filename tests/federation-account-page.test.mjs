import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../assets/federation/fed-account.js',import.meta.url),'utf8');

async function render({search='',hasSessionCookie=false}={}){
  const elements=Object.fromEntries(['account-message','google','apple','logout','identity','member-email'].map(id=>[id,{id,textContent:'',hidden:id==='logout'||id==='identity',disabled:false,addEventListener(){}}]));
  const requests=[];
  const replaced=[];
  const fetch=async url=>{
    requests.push(url);
    const data=url.endsWith('/config')?{enabled:true,providers:['google'],hasSessionCookie}:{signedIn:true,user:{email:'member@example.invalid'}};
    return {status:200,ok:true,json:async()=>data};
  };
  runInNewContext(source,{document:{getElementById:id=>elements[id]},fetch,location:{search},history:{replaceState:(...args)=>replaced.push(args)},URL,URLSearchParams});
  await new Promise(resolve=>setImmediate(resolve));
  return {elements,requests,replaced};
}

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
