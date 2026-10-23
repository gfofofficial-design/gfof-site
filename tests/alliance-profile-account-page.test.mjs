import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountAllianceAccountMemberPage} from '../assets/federation/fed-alliance-member-account.mjs';
import {profileDocument,profileHtml,origin} from './alliance-profile-document.fixture.mjs';
const account={signedIn:true,user:{id:'11111111-1111-4111-8111-111111111111',email:'fixture@example.invalid'}};
const profile={id:'33333333-3333-4333-8333-333333333333',name:'Fixture member',community:'Example crew',bio:'A synthetic member profile for account lifecycle acceptance.',role:'builder',listed:false,publication:'private',updatedAt:'2026-10-21T12:00:00Z'};
const json=(v,status=200,headers={})=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'private, no-store',...headers}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(fetcher,options={}){
 const f=profileDocument(),calls=[],events=new EventTarget(),channel=new EventTarget();let channelClosed=false;
 channel.close=()=>{channelClosed=true;};
 const host=mountAllianceAccountMemberPage(f.doc,{enabled:true,origin,events,createChannel:()=>channel,...options,fetcher:async(url,init)=>{calls.push({url,init});return fetcher(url,init);}});
 return {...f,calls,events,channel,host,channelClosed:()=>channelClosed};
}
const regular=url=>url.endsWith('/session')?json(account):json({profile,revision:1});

test('normal entry stays closed with no request, listener-created channel or browser flag bypass',async()=>{
 let channels=0;const f=fixture(()=>{throw Error('No I/O');},{enabled:false,createChannel:()=>{channels++;throw Error('No channel');}});
 assert.equal(await f.host.check(),false);assert.equal(f.calls.length,0);assert.equal(channels,0);assert.equal(f.get('account-check').disabled,true);assert.equal(f.get('fields').disabled,true);
 const entry=readFileSync(new URL('../assets/federation/fed-alliance-profile-page.mjs',import.meta.url),'utf8');
 assert.match(entry,/mountAllianceAccountMemberPage\(document\)/);assert.doesNotMatch(entry,/enabled\s*:\s*true|location\.search|localStorage/);assert.match(profileHtml,/connect-src 'none'/);f.host.dispose();
});
test('explicit check uses the real same-origin session contract before opening the real profile controller',async()=>{
 const locks={request:async(name,options,work)=>{assert.equal(name,'gf-account-session');assert.equal(options.mode,'exclusive');assert.ok(options.signal);return work();}};
 const f=fixture(regular,{locks});assert.equal(f.calls.length,0);assert.equal(await f.host.check(),true);assert.equal(f.calls.length,1);assert.equal(f.get('fields').disabled,false);
 const call=f.calls[0];assert.equal(call.url,origin+'/api/federation-account/session');assert.equal(call.init.method,'GET');assert.equal(call.init.credentials,'same-origin');assert.equal(call.init.redirect,'error');assert.equal(call.init.cache,'no-store');assert.equal(call.init.body,undefined);assert.equal(call.init.headers.Authorization,undefined);
 await f.get('read').emit('click');assert.equal(f.get('name').value,'Fixture member');assert.equal(f.calls.length,2);assert.doesNotMatch(f.get('account-status').textContent,/fixture@example|11111111/);f.host.dispose();
});
test('signed-out, malformed, cacheable and oversized account replies never open the editor',async t=>{
 const cases=[()=>json({},401),()=>json({},503),()=>json({signedIn:false,user:account.user}),()=>json({signedIn:true,user:{id:'not-an-id'}}),()=>json(account,200,{'cache-control':'public, max-age=20'}),()=>new Response('not json',{headers:{'content-type':'application/json','cache-control':'no-store'}}),()=>json({...account,padding:'x'.repeat(33000)})];
 for(const [i,response]of cases.entries())await t.test('refusal '+i,async()=>{const f=fixture(response);assert.equal(await f.host.check(),false);assert.equal(f.calls.length,1);assert.equal(f.get('fields').disabled,true);await tick();assert.equal(f.calls.length,1);f.host.dispose();});
});
test('sign-out hints clear recorded content and drafts; forged signed-in messages cannot attach',async()=>{
 const f=fixture(regular);f.channel.dispatchEvent(new MessageEvent('message',{data:{type:'signed-in',user:account.user}}));assert.equal(f.calls.length,0);assert.equal(f.get('fields').disabled,true);
 await f.host.check();await f.get('read').emit('click');f.get('name').value='Private unsent draft';
 f.channel.dispatchEvent(new MessageEvent('message',{data:{type:'signed-out',remoteRevoked:false}}));assert.equal(f.get('name').value,'');assert.equal(f.get('current-body').textContent,'');assert.equal(f.get('fields').disabled,true);assert.equal(f.calls.length,2);f.host.dispose();assert.equal(f.channelClosed(),true);
});
test('late account verification cannot reopen a page closed by sign-out',async()=>{
 const gate=deferred();const f=fixture(()=>gate.promise);const checking=f.host.check();await tick();f.channel.dispatchEvent(new MessageEvent('message',{data:{type:'signed-out',remoteRevoked:true}}));assert.equal(await checking,false);gate.resolve(json(account));await tick();assert.equal(f.get('fields').disabled,true);assert.equal(f.calls.length,1);f.host.dispose();
});
test('a normal tab switch hides the draft, then preserves it only after checking the same account',async()=>{
 const f=fixture(regular);await f.host.check();f.get('name').value='Private draft';f.doc.visibilityState='hidden';f.doc.emit('visibilitychange');assert.equal(f.get('member-surface').hidden,true);assert.equal(f.get('name').value,'Private draft');assert.equal(await f.host.check(),false);
 f.doc.visibilityState='visible';f.doc.emit('visibilitychange');await tick();assert.equal(f.calls.length,2);assert.equal(f.get('name').value,'Private draft');assert.equal(f.get('member-surface').hidden,false);
 f.events.dispatchEvent(new Event('pageshow'));assert.equal(f.get('name').value,'');assert.equal(f.get('fields').disabled,true);assert.equal(f.calls.length,2);f.host.dispose();
});
test('a changed or unconfirmed account never reveals the earlier draft or automatically opens another editor',async t=>{
 for(const response of [()=>json({...account,user:{id:'22222222-2222-4222-8222-222222222222'}}),()=>json({},401),()=>json({},503)])await t.test('foreground identity refusal',async()=>{
  let n=0;const gate=deferred();const f=fixture(()=>++n===1?json(account):gate.promise);await f.host.check();f.get('name').value='Earlier private draft';f.doc.visibilityState='hidden';f.doc.emit('visibilitychange');f.doc.visibilityState='visible';f.doc.emit('visibilitychange');await tick();assert.equal(f.get('member-surface').hidden,true);
  gate.resolve(response());await tick();assert.equal(f.get('name').value,'');assert.equal(f.get('fields').disabled,true);assert.equal(f.get('member-surface').hidden,true);assert.equal(f.calls.length,2);f.host.dispose();
 });
});
test('same-account foreground verification preserves an unknown removal and never repeats its mutation',async()=>{
 let writes=0;const f=fixture((url,init)=>url.endsWith('/session')?json(account):init.method==='GET'?json({state:'ready',profileId:profile.id,version:7}):++writes===1?Promise.reject(Error('Lost reply')):json({state:'committed',version:8}));
 const find=text=>{const walk=n=>{if(n.textContent===text)return n;for(const c of n.children){const found=walk(c);if(found)return found;}};return walk(f.get('removal'));};
 await f.host.check();await find('Review profile removal').emit('click');const box=f.get('removal').children[3].children[0].children[0];box.checked=true;await box.emit('change');await find('Remove my Alliance profile').emit('click');assert.equal(writes,1);
 f.doc.visibilityState='hidden';f.doc.emit('visibilitychange');f.doc.visibilityState='visible';f.doc.emit('visibilitychange');await tick();assert.equal(writes,1);assert.equal(f.get('fields').disabled,true);assert.ok(find('Check the same removal request'));
 await find('Check the same removal request').emit('click');const mutations=f.calls.filter(c=>c.init.method==='DELETE');assert.equal(mutations.length,2);assert.equal(mutations[0].init.body,mutations[1].init.body);f.host.dispose();
});
test('same-account return restores an abandoned field focus but never steals a new focus',async()=>{
 const f=fixture(regular);await f.host.check();f.get('name').focus();f.doc.visibilityState='hidden';f.doc.emit('visibilitychange');f.doc.activeElement=f.doc.body;f.doc.visibilityState='visible';f.doc.emit('visibilitychange');await tick();assert.equal(f.doc.activeElement,f.get('name'));
 f.doc.visibilityState='hidden';f.doc.emit('visibilitychange');f.get('account-check').focus();f.doc.visibilityState='visible';f.doc.emit('visibilitychange');await tick();assert.equal(f.doc.activeElement,f.get('account-check'));f.host.dispose();
});
test('deadline returns safely but an uncooperative request keeps the overlap latch occupied',async()=>{
 const gate=deferred();let n=0;const f=fixture(()=>++n===1?gate.promise:json(account),{timeoutMs:10});
 assert.equal(await f.host.check(),false);assert.equal(await f.host.check(),false);assert.equal(f.calls.length,1);assert.equal(f.get('account-check').disabled,true);
 gate.resolve(json(account));await tick();assert.equal(f.get('fields').disabled,true);assert.equal(f.get('account-check').disabled,false);assert.equal(await f.host.check(),true);f.host.dispose();
});
test('an expired queued browser lock cannot dispatch a late request',async()=>{
 const gate=deferred();const locks={request:async(_name,_options,work)=>{await gate.promise;return work();}};
 const f=fixture(regular,{locks,timeoutMs:10});assert.equal(await f.host.check(),false);assert.equal(f.calls.length,0);gate.resolve();await tick();assert.equal(f.calls.length,0);assert.equal(f.get('fields').disabled,true);f.host.dispose();
});
test('deadline cancels a stalled body and does not accept partial session data',async()=>{
 let cancelled=false;const f=fixture(()=>new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json','cache-control':'no-store'}}),{timeoutMs:10});
 assert.equal(await f.host.check(),false);await tick();assert.equal(cancelled,true);assert.equal(f.get('fields').disabled,true);assert.equal(f.calls.length,1);f.host.dispose();
});
test('dispose during a real member read clears old content and ignores the late response',async()=>{
 const gate=deferred();const f=fixture(url=>url.endsWith('/session')?json(account):gate.promise);await f.host.check();const reading=f.get('read').emit('click');await tick();f.host.dispose();gate.resolve(json({profile,revision:1}));await reading;await tick();assert.equal(f.get('name').value,'');assert.equal(f.get('current-body').textContent,'');assert.equal(f.get('account-check').disabled,true);assert.equal(await f.host.check(),false);
});
test('member session refusal closes editor without a cookie refresh or automatic account recheck',async()=>{
 const f=fixture(url=>url.endsWith('/session')?json(account):json({},401));await f.host.check();await f.get('read').emit('click');assert.equal(f.get('fields').disabled,true);assert.equal(f.calls.length,2);await tick();assert.equal(f.calls.length,2);f.host.dispose();
});
test('exact origin and maximum deadline are explicit configuration boundaries',()=>{
 for(const options of [{origin:'https://other.example'},{origin:origin+'/path'},{timeoutMs:12001},{timeoutMs:0},{origin:'https://galacticfederation.co'}])assert.throws(()=>fixture(regular,options),/member_account_configuration/);
});
