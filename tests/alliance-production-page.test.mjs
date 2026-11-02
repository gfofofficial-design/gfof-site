import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountProductionAlliancePage} from '../assets/federation/fed-alliance-production-page.mjs';
import {profileDocument,profileHtml} from './alliance-profile-document.fixture.mjs';

const origin='https://galacticfederation.co';
const json=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'private, no-store'}});
const account={signedIn:true,user:{id:'11111111-1111-4111-8111-111111111111'}};
function fixture(target,reply){
 const f=profileDocument();f.doc.location={origin:target,search:'?enabled=true',hash:'#member=on'};
 const calls=[],channel=new EventTarget();channel.close=()=>{};
 const page=mountProductionAlliancePage(f.doc,{events:new EventTarget(),createChannel:()=>channel,fetcher:async(url,init)=>{calls.push({url,init});return reply(url,init);}});
 return {...f,page,calls,channel};
}

test('production page starts without a request; only the explicit session check can open controls',async()=>{
 const f=fixture(origin,()=>json(account));
 try{
  assert.equal(f.calls.length,0);assert.equal(f.get('fields').disabled,true);assert.equal(f.get('member-surface').hidden,true);
  assert.equal(await f.page.check(),true);assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,origin+'/api/federation-account/session');
  assert.equal(f.calls[0].init.credentials,'same-origin');assert.equal(f.calls[0].init.redirect,'error');assert.equal(f.get('fields').disabled,false);
  assert.equal(f.get('service-title').textContent,'Member workspace');
 }finally{f.page.dispose();}
});

test('signed-out or uncertain sessions cannot open the production editor or trigger a member read',async()=>{
 for(const status of [401,503]){
  const f=fixture(origin,()=>json({},status));
  try{assert.equal(await f.page.check(),false);assert.equal(f.calls.length,1);assert.equal(f.get('fields').disabled,true);assert.equal(f.get('member-surface').hidden,true);}
  finally{f.page.dispose();}
 }
});

test('preview, alternate and local hosts stay closed despite URL flags or injected enable options',async()=>{
 for(const target of ['https://deploy-preview-999--gfof.netlify.app','https://gfof.netlify.app','https://galacticfederation.co.evil.invalid','http://127.0.0.1:8080']){
  const f=profileDocument();f.doc.location={origin:target,search:'?enabled=true'};let requests=0;
  const page=mountProductionAlliancePage(f.doc,{enabled:true,collaborationEnabled:true,reportReviewEnabled:true,fetcher:async()=>{requests++;throw Error('No provider');}});
  try{assert.equal(await page.check(),false);assert.equal(requests,0);assert.equal(f.get('account-check').disabled,true);assert.equal(f.get('fields').disabled,true);}
  finally{page.dispose();}
 }
});

test('sign-out clears the enabled member surfaces and forged sign-in messages cannot reopen them',async()=>{
 const f=fixture(origin,()=>json(account));
 try{
  await f.page.check();f.get('name').value='Private unsaved draft';
  f.channel.dispatchEvent(new MessageEvent('message',{data:{type:'signed-out',remoteRevoked:true}}));
  assert.equal(f.get('name').value,'');assert.equal(f.get('fields').disabled,true);
  f.channel.dispatchEvent(new MessageEvent('message',{data:{type:'signed-in',user:account.user}}));
  assert.equal(f.calls.length,1);assert.equal(f.get('fields').disabled,true);
 }finally{f.page.dispose();}
});

test('new workspace keeps existing accessible control IDs and the old preview remains closed',()=>{
 const html=readFileSync(new URL('../member-workspace.html',import.meta.url),'utf8');
 const ids=s=>[...s.matchAll(/\bid="([^"]+)"/g)].map(v=>v[1]).sort();assert.deepEqual(ids(html),ids(profileHtml));
 assert.match(html,/connect-src 'self'/);assert.match(html,/aria-live="polite"/);assert.match(html,/Public registration remains closed/);
 assert.match(profileHtml,/connect-src 'none'/);
 const old=readFileSync(new URL('../assets/federation/fed-alliance-profile-page.mjs',import.meta.url),'utf8');assert.match(old,/mountAllianceAccountMemberPage\(document\)/);
 const config=readFileSync(new URL('../netlify.toml',import.meta.url),'utf8');assert.match(config,/from = "https:\/\/galacticfederation\.co\/api\/alliance-members\/\*"/);
 assert.doesNotMatch(config,/from = "\/api\/alliance-members/);
});


test('sign-in, dashboard and Alliance entry points lead to the connected workspace',()=>{
 const account=readFileSync(new URL('../account.html',import.meta.url),'utf8');
 const destinations=account.match(/<nav class="account-destinations"[^>]*>(.*?)<\/nav>/s)?.[1];
 assert.ok(destinations);assert.match(destinations,/href="\/member-workspace\.html"/);
 assert.doesNotMatch(destinations,/alliance-profile/);
 for(const file of ['command-deck.html','alliance.html']) {
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.match(html,/href="\/member-workspace\.html"/);
 }
 assert.match(account,/Competition enrollment remains closed/);
});
