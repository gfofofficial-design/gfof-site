import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getEventListeners} from 'node:events';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../assets/federation/fed-account.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const response=(data,status=200)=>({status,ok:status>=200&&status<300,json:async()=>data});
const member={signedIn:true,user:{email:'member@example.invalid'}};
const origin='https://account-preview.example.invalid';
function oauthUrl(){const url=new URL('https://syntheticfixture.supabase.co/auth/v1/authorize');url.search=new URLSearchParams({provider:'google',redirect_to:origin+'/api/federation-account/callback?state='+'s'.repeat(32),code_challenge:'c'.repeat(43),code_challenge_method:'s256'}).toString();return url.href;}

function browser({hasSessionCookie=true,routes={}}={}){
 const requests=[],assigned=[],messages=[],elements={},handlers={},documentHandlers={};
 for(const id of ['account-message','google','apple','logout','identity','member-email','passport-summary'])elements[id]={id,textContent:'',hidden:['logout','identity'].includes(id),disabled:false,addEventListener(name,fn){handlers[id+':'+name]=fn;}};
 let clock=0,nextTimer=0,queue=Promise.resolve();
 const timers=new Map();
 const setTimer=(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,at:clock+ms});return id;};
 const locks={request(_name,{signal},work){const pending=queue.then(()=>{signal.throwIfAborted();return work();});queue=pending.catch(()=>{});return pending;}};
 class Channel{postMessage(data){messages.push(data);}close(){}}
 runInNewContext(source,{
  document:{visibilityState:'visible',getElementById:id=>elements[id],addEventListener(name,fn){documentHandlers[name]=fn;}},
  location:{origin,search:'',hash:'',assign:url=>assigned.push(url)},history:{replaceState(){}},
  URL,URLSearchParams,AbortController,navigator:{locks},BroadcastChannel:Channel,
  setTimeout:setTimer,clearTimeout:id=>timers.delete(id),
  fetch(url,options){
   const action=url.split('/').at(-1),request={action,options};requests.push(request);
   const defaults=action==='config'?{enabled:true,providers:['google'],hasSessionCookie}:action==='oauth'?{url:oauthUrl()}:action==='logout'?{signedOut:true,remoteRevoked:true}:action==='refresh'?{ok:true}:member;
   return routes[action]?routes[action](request):Promise.resolve(response(defaults));
  },
 });
 return {elements,requests,assigned,messages,timers,click:id=>handlers[id+':click'](),visible:()=>documentHandlers.visibilitychange(),
  async advance(ms){const end=clock+ms;for(;;){const due=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;clock=due[1].at;timers.delete(due[0]);due[1].fn();await tick();}clock=end;await tick();},
  clean(){assert.equal(timers.size,0,'no deadline remains after the operation');for(const request of requests)assert.equal(getEventListeners(request.options.signal,'abort').length,0,'API abort listener removed');},
 };
}

for(const [action,deadline] of [['config',12000],['session',12000],['oauth',12000],['refresh',20000],['logout',30000]]){
 for(const stage of ['fetch','body']){
  test(`${action} releases a stalled ${stage} at its deadline and ignores a late result`,async()=>{
   const transport=deferred(),body=deferred();let bodyReads=0,sessionReads=0;
   const delayed={status:200,ok:true,json(){bodyReads++;return body.promise;}};
   const routes={[action]:()=>stage==='fetch'?transport.promise:Promise.resolve(delayed)};
   if(action==='refresh')routes.session=()=>Promise.resolve(++sessionReads===1?response({error:'Sign in again.'},401):response(member));
   const b=browser({hasSessionCookie:action!=='oauth',routes});await tick();
   const click=action==='oauth'?b.click('google'):action==='logout'?b.click('logout'):undefined;
   await tick();const request=b.requests.find(r=>r.action===action);assert.ok(request);
   assert.equal(request.options.credentials,'same-origin');assert.equal(request.options.cache,'no-store');
   await b.advance(deadline-1);assert.equal(request.options.signal.aborted,false);
   await b.advance(1);await click;
   assert.equal(request.options.signal.aborted,true);
   assert.equal(b.elements.identity.hidden,true);
   const message=b.elements['account-message'].textContent;
   assert.match(message,action==='config'?/status is unavailable/:action==='oauth'?/took too long/:action==='logout'?/Sign-out could not be completed/:/temporarily unavailable/);
   b.clean();const requestCount=b.requests.length;
   const data=action==='oauth'?{url:oauthUrl()}:action==='logout'?{signedOut:true,remoteRevoked:true}:action==='refresh'?{ok:true}:action==='config'?{enabled:true,providers:['google'],hasSessionCookie:true}:member;
   if(stage==='fetch')transport.resolve(delayed);else body.resolve(data);
   await tick();await b.advance(60000);
   assert.equal(b.elements.identity.hidden,true);assert.equal(b.elements['account-message'].textContent,message);
   assert.equal(b.requests.length,requestCount,'no automatic retry or follow-up after timeout');
   assert.equal(b.assigned.length,0);assert.equal(b.messages.length,0);
   assert.equal(bodyReads,stage==='body'?1:0,'a response arriving after abort is not read');b.clean();
  });
 }
}

test('refresh can complete after the former 12-second cutoff without a second exchange',async()=>{
 const refresh=deferred();let sessionReads=0;
 const b=browser({routes:{session:()=>Promise.resolve(++sessionReads===1?response({error:'Sign in again.'},401):response(member)),refresh:()=>refresh.promise}});
 await tick();const request=b.requests.find(r=>r.action==='refresh');assert.ok(request);
 await b.advance(12001);assert.equal(request.options.signal.aborted,false);assert.equal(b.elements.identity.hidden,true);
 await b.advance(3998);refresh.resolve(response({ok:true}));await tick();
 assert.equal(b.elements.identity.hidden,false);assert.equal(b.elements['member-email'].textContent,member.user.email);
 assert.equal(b.requests.filter(r=>r.action==='refresh').length,1);b.clean();
});

test('logout can complete its existing three-read path after 23 seconds',async()=>{
 const logout=deferred();const b=browser({routes:{logout:()=>logout.promise}});await tick();
 const done=b.click('logout');await tick();const request=b.requests.find(r=>r.action==='logout');
 await b.advance(23000);assert.equal(request.options.signal.aborted,false);assert.equal(b.elements['account-message'].textContent,'Signing out…');
 logout.resolve(response({signedOut:true,remoteRevoked:true}));await done;
 assert.equal(b.elements['account-message'].textContent,'Signed out.');assert.equal(b.elements.identity.hidden,true);
 assert.deepEqual(JSON.parse(JSON.stringify(b.messages)),[{type:'signed-out',remoteRevoked:true}]);
 assert.equal(b.requests.filter(r=>r.action==='logout').length,1);b.clean();
});

test('a timed-out OAuth call releases the lock for a later manual sign-in',async()=>{
 const old=deferred();let calls=0;
 const b=browser({hasSessionCookie:false,routes:{oauth:()=>++calls===1?old.promise:Promise.resolve(response({url:oauthUrl()}))}});await tick();
 const first=b.click('google');await tick();await b.advance(12000);await first;
 assert.equal(b.elements.google.disabled,false);b.clean();
 await b.click('google');assert.deepEqual(b.assigned,[oauthUrl()]);assert.equal(calls,2);
 old.resolve(response({url:'https://untrusted.example.invalid/'}));await tick();
 assert.deepEqual(b.assigned,[oauthUrl()]);assert.equal(b.elements.google.disabled,true);b.clean();
});

test('a late body rejection after timeout cannot replace the error or keep the lock held',async()=>{
 const body=deferred();let calls=0;
 const b=browser({hasSessionCookie:false,routes:{oauth:()=>++calls===1?Promise.resolve({status:200,ok:true,json:()=>body.promise}):Promise.resolve(response({url:oauthUrl()}))}});await tick();
 const first=b.click('google');await tick();await b.advance(12000);await first;
 const message=b.elements['account-message'].textContent;body.reject(Error('synthetic late body failure'));await tick();
 assert.equal(b.elements['account-message'].textContent,message);b.clean();
 await b.click('google');assert.deepEqual(b.assigned,[oauthUrl()]);b.clean();
});

for(const status of [429,502])test(`HTTP ${status} keeps its existing message and clears request timers`,async()=>{
 const b=browser({hasSessionCookie:false,routes:{oauth:()=>Promise.resolve(response({error:'Account service unavailable.'},status))}});await tick();
 await b.click('google');assert.match(b.elements['account-message'].textContent,status===429?/Too many account requests/:/Account service unavailable/);
 assert.equal(b.elements.google.disabled,false);assert.equal(b.assigned.length,0);b.clean();
});
