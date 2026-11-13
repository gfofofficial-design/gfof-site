import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountProductionAlliancePage} from '../assets/federation/fed-alliance-production-page.mjs';
import {profileDocument,profileHtml} from './alliance-profile-document.fixture.mjs';

const origin='https://galacticfederation.co';
const json=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'private, no-store'}});
const account={signedIn:true,user:{id:'11111111-1111-4111-8111-111111111111'}};
const workspaceHtml=readFileSync(new URL('../member-workspace.html',import.meta.url),'utf8');
function fixture(target,reply){
 const f=profileDocument(workspaceHtml);f.doc.location={origin:target,search:'?enabled=true',hash:'#member=on'};
 const calls=[],channel=new EventTarget();channel.close=()=>{};
 const events=new EventTarget();
 const page=mountProductionAlliancePage(f.doc,{events,createChannel:()=>channel,fetcher:async(url,init)=>{calls.push({url,init});return reply(url,init);}});
 return {...f,page,calls,channel,events};
}

test('production page starts without a request; only the explicit session check can open controls',async()=>{
 const f=fixture(origin,()=>json(account));
 try{
  f.events.dispatchEvent(new Event('pageshow'));
  assert.equal(f.calls.length,0);assert.equal(f.get('fields').disabled,true);assert.equal(f.get('member-surface').hidden,true);
  assert.equal(f.get('account-status').textContent,'');
  assert.equal(f.get('account-check').hidden,false);
  f.get('account-check').focus();
  await f.get('account-check').emit('click');assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,origin+'/api/federation-account/session');
  assert.equal(f.calls[0].init.credentials,'same-origin');assert.equal(f.calls[0].init.redirect,'error');assert.equal(f.get('fields').disabled,false);
  assert.equal(f.get('service-title').textContent,'Member workspace');
  assert.equal(f.doc.activeElement,f.get('read'));
  assert.equal(f.get('account-check').hidden,true);
  assert.equal(f.get('account-link').hidden,false);
  assert.equal(f.get('account-link').textContent,'Manage account or sign out');
  await f.get('account-check').emit('click');assert.equal(f.calls.length,1);
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
  await f.page.check();f.get('name').focus();f.get('name').value='Private unsaved draft';
  f.channel.dispatchEvent(new MessageEvent('message',{data:{type:'signed-out',remoteRevoked:true}}));
  assert.equal(f.get('name').value,'');assert.equal(f.get('fields').disabled,true);
  assert.equal(f.get('member-surface').hidden,true);assert.equal(f.doc.activeElement,f.get('account-link'));
  assert.equal(f.get('account-link').textContent,'Sign in to Federation');
  f.channel.dispatchEvent(new MessageEvent('message',{data:{type:'signed-in',user:account.user}}));
  assert.equal(f.calls.length,1);assert.equal(f.get('fields').disabled,true);
 }finally{f.page.dispose();}
});

test('a member request requiring sign-in closes the whole workspace and returns focus to the sign-in link',async()=>{
 const f=fixture(origin,url=>url.endsWith('/session')?json(account):json({},401));
 try{
  await f.page.check();f.get('name').value='Private unsaved draft';
  f.get('read').focus();await f.get('read').emit('click');
  assert.equal(f.calls.length,2);
  assert.equal(f.get('member-surface').hidden,true);
  assert.equal(f.get('service-title').textContent,'Member service closed');
  assert.match(f.get('account-status').textContent,/Sign in again/);
  assert.equal(f.get('name').value,'');
  assert.equal(f.doc.activeElement,f.get('account-link'));
 }finally{f.page.dispose();}
});

test('workspace keeps the existing profile control IDs and the old preview remains closed',()=>{
 const html=workspaceHtml;
 const ids=s=>[...s.matchAll(/\bid="([^"]+)"/g)].map(v=>v[1]);
 assert.equal(new Set(ids(html)).size,ids(html).length);
 for(const id of ids(profileHtml))assert.ok(ids(html).includes(id),id);
 assert.match(html,/connect-src 'self'/);assert.match(html,/aria-live="polite"/);assert.match(html,/Public registration remains closed/);
 assert.match(html,/<div id="ap-member-surface" hidden>/);
 assert.match(html,/<button id="ap-account-check"[^>]+hidden disabled>/);
 assert.match(profileHtml,/connect-src 'none'/);
 const old=readFileSync(new URL('../assets/federation/fed-alliance-profile-page.mjs',import.meta.url),'utf8');assert.match(old,/mountAllianceAccountMemberPage\(document\)/);
 const config=readFileSync(new URL('../netlify.toml',import.meta.url),'utf8');assert.match(config,/from = "https:\/\/galacticfederation\.co\/api\/alliance-members\/\*"/);
 assert.doesNotMatch(config,/from = "\/api\/alliance-members/);
});


test('sign-in, dashboard and Alliance entry points lead to the connected workspace',()=>{
 const account=readFileSync(new URL('../account.html',import.meta.url),'utf8');
 const destinations=account.match(/<nav class="account-destinations"[^>]*>(.*?)<\/nav>/s)?.[1];
 assert.ok(destinations);assert.match(destinations,/^<a href="\/member-workspace\.html#workspace-setup">/);
 assert.match(destinations,/href="\/member-workspace\.html"/);
 assert.doesNotMatch(destinations,/alliance-profile/);
 for(const file of ['command-deck.html','alliance.html']) {
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.match(html,/href="\/member-workspace\.html"/);
 }
 assert.match(account,/Competition enrollment remains closed/);
});
