import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../assets/federation/fed-account.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const response=(data,status=200)=>({status,ok:status>=200&&status<300,json:async()=>data});
const member={signedIn:true,user:{email:'member@example.invalid'}};

function browser({locks=true,channels=true,timers}={}){
  let queue=Promise.resolve();
  const messages=[];
  const peers=new Set();
  const lockManager={request(name,options,callback){
    assert.equal(name,'gf-account-session');
    assert.equal(options.mode,'exclusive');
    const pending=queue.then(()=>{if(options.signal.aborted)throw options.signal.reason;return callback();});
    queue=pending.catch(()=>{});
    return pending;
  }};
  class Channel {
    constructor(name){this.name=name;peers.add(this);}
    postMessage(data){messages.push(data);for(const peer of peers)if(peer!==this&&peer.name===this.name)queueMicrotask(()=>peer.onmessage?.({data}));}
    close(){peers.delete(this);}
  }
  function tab(fetch){
    const requests=[];
    const handlers={};
    const pageHandlers={};
    const documentHandlers={};
    const elements=Object.fromEntries(['account-message','google','apple','logout','identity','member-email','passport-summary'].map(id=>[id,{id,textContent:'',hidden:id==='logout'||id==='identity',disabled:false,addEventListener(name,fn){handlers[id+':'+name]=fn;}}]));
    const document={visibilityState:'visible',getElementById:id=>elements[id],addEventListener(name,fn){documentHandlers[name]=fn;}};
    const assigned=[];
    runInNewContext(source,{
      document,navigator:locks?{locks:lockManager}:{},
      ...(channels?{BroadcastChannel:Channel}:{}),
      fetch:async(url,options)=>{requests.push(url.split('/').at(-1));return fetch(url.split('/').at(-1),options);},
      location:{search:'',hash:'',assign:url=>assigned.push(url)},history:{replaceState(){}},
      URL,URLSearchParams,AbortController,setTimeout:timers?.setTimeout||setTimeout,clearTimeout:timers?.clearTimeout||clearTimeout,
      addEventListener(name,fn){pageHandlers[name]=fn;},
    });
    return {elements,requests,assigned,click:id=>handlers[id+':click'](),visible:()=>documentHandlers.visibilitychange?.(),pageshow:()=>pageHandlers.pageshow?.({persisted:true})};
  }
  return {tab,messages,broadcast:data=>{for(const peer of peers)peer.onmessage?.({data});}};
}

test('two tabs refresh shared expired cookies once and re-read after acquiring the lock',async()=>{
  const b=browser();const gate=deferred();let valid=false,refreshes=0;
  const fetch=async action=>{
    if(action==='config')return response({enabled:true,providers:['google'],hasSessionCookie:true});
    if(action==='session')return valid?response(member):response({error:'Sign in again.'},401);
    if(action==='refresh'){refreshes++;await gate.promise;valid=true;return response({ok:true});}
    throw Error('unexpected action');
  };
  const a=b.tab(fetch),c=b.tab(fetch);await tick();
  gate.resolve();await tick();await tick();
  assert.equal(refreshes,1);
  assert.equal(a.elements['member-email'].textContent,member.user.email);
  assert.equal(c.elements['member-email'].textContent,member.user.email);
});

test('logout in another tab suppresses a late verified-user display and broadcasts no identity',async()=>{
  const b=browser();const gate=deferred();let valid=true,slow=false;
  const fetch=async action=>{
    if(action==='config')return response({enabled:true,providers:['google'],hasSessionCookie:valid});
    if(action==='session'){if(slow)await gate.promise;return response(member);}
    if(action==='logout'){valid=false;return response({signedOut:true,remoteRevoked:true});}
    throw Error('unexpected action');
  };
  const a=b.tab(fetch),c=b.tab(fetch);await tick();await tick();
  slow=true;a.visible();await tick();
  const done=c.click('logout');gate.resolve();await done;await tick();
  assert.equal(a.elements.identity.hidden,true);
  assert.equal(a.elements['member-email'].textContent,'');
  assert.equal(c.elements.identity.hidden,true);
  assert.match(a.elements['account-message'].textContent,/Signed out/);
  assert.deepEqual(JSON.parse(JSON.stringify(b.messages)),[{type:'signed-out',remoteRevoked:true}]);
});

test('successful logout does not immediately inspect or refresh a leftover session',async()=>{
  const b=browser();
  const t=b.tab(async action=>action==='config'?response({enabled:true,providers:['google'],hasSessionCookie:true}):action==='logout'?response({signedOut:true,remoteRevoked:false}):response(member));
  await tick();const before=t.requests.length;await t.click('logout');
  assert.deepEqual(t.requests.slice(before),['logout']);
  assert.equal(t.elements.identity.hidden,true);
  assert.match(t.elements['account-message'].textContent,/could not be confirmed/);
  assert.equal(t.elements.google.disabled,false);
});

test('without cross-tab locks, expired cookies require sign-in rather than an uncoordinated refresh',async()=>{
  const b=browser({locks:false});
  const t=b.tab(async action=>action==='config'?response({enabled:true,providers:['google'],hasSessionCookie:true}):action==='session'?response({error:'Sign in again.'},401):response({ok:true}));
  await tick();
  assert.deepEqual(t.requests,['config','session']);
  assert.equal(t.elements.identity.hidden,true);
  assert.match(t.elements['account-message'].textContent,/Sign in again/);
  assert.equal(t.elements.google.disabled,false);
});

test('visible-tab and restored-page checks clear stale identity when cookies are gone without a channel',async()=>{
  const b=browser({channels:false});let valid=true;
  const t=b.tab(async action=>action==='config'?response({enabled:true,providers:['google'],hasSessionCookie:valid}):response(member));
  await tick();assert.equal(t.elements.identity.hidden,false);
  valid=false;t.visible();await tick();
  assert.equal(t.elements.identity.hidden,true);
  assert.equal(t.elements['member-email'].textContent,'');
  valid=true;t.pageshow();await tick();assert.equal(t.elements.identity.hidden,false);
});

test('a late provider error cannot overwrite logout in another tab',async()=>{
  const b=browser();const gate=deferred();let fail=false;
  const fetch=async action=>{
    if(action==='config')return response({enabled:true,providers:['google'],hasSessionCookie:true});
    if(action==='session'){if(fail){await gate.promise;return response({error:'temporary'},502);}return response(member);}
    if(action==='logout')return response({signedOut:true,remoteRevoked:true});
    throw Error('unexpected action');
  };
  const a=b.tab(fetch),c=b.tab(fetch);await tick();await tick();
  fail=true;a.visible();await tick();const done=c.click('logout');gate.resolve();await done;await tick();
  assert.equal(a.elements.identity.hidden,true);
  assert.match(a.elements['account-message'].textContent,/Signed out/);
});

test('provider failures release the tab lock so another tab can sign out',async()=>{
  const b=browser();let failed=true;
  const fetch=async action=>action==='config'?response({enabled:true,providers:['google'],hasSessionCookie:true}):action==='logout'?response({signedOut:true,remoteRevoked:true}):failed?response({error:'temporary'},502):response(member);
  const a=b.tab(fetch);await tick();assert.equal(a.elements.identity.hidden,true);
  failed=false;const c=b.tab(fetch);await tick();await c.click('logout');await tick();
  assert.equal(c.elements.identity.hidden,true);
  assert.match(a.elements['account-message'].textContent,/Signed out/);
});

test('channel messages cannot establish identity and unsupported messages are ignored',async()=>{
  const b=browser();const t=b.tab(async()=>response({enabled:true,providers:['google'],hasSessionCookie:false}));
  await tick();assert.equal(t.elements.identity.hidden,true);
  b.broadcast({type:'signed-in',user:{email:'untrusted@example.invalid'},access_token:'synthetic-token'});
  b.broadcast({type:'signed-out',remoteRevoked:'untrusted'});
  assert.equal(t.elements.identity.hidden,true);
  assert.equal(t.elements['member-email'].textContent,'');
  assert.match(t.elements['account-message'].textContent,/Choose an available/);
  assert.equal(b.messages.length,0);
  assert.equal(t.requests.length,1);
});

test('a pending response cannot restore identity after a logout notification',async()=>{
  const b=browser();const gate=deferred();
  const t=b.tab(async action=>{if(action==='config')return response({enabled:true,providers:['google'],hasSessionCookie:true});await gate.promise;return response(member);});
  await tick();assert.deepEqual(t.requests,['config','session']);
  b.broadcast({type:'signed-out',remoteRevoked:true});gate.resolve();await tick();
  assert.equal(t.elements.identity.hidden,true);
  assert.equal(t.elements['member-email'].textContent,'');
  assert.match(t.elements['account-message'].textContent,/Signed out/);
});

test('a pending OAuth response cannot navigate after a logout notification',async()=>{
  const b=browser();const gate=deferred();
  const t=b.tab(async action=>{if(action==='config')return response({enabled:true,providers:['google'],hasSessionCookie:false});await gate.promise;return response({url:'https://syntheticfixture.supabase.co/auth/v1/authorize'});});
  await tick();const done=t.click('google');await tick();
  b.broadcast({type:'signed-out',remoteRevoked:true});gate.resolve();await done;
  assert.deepEqual(t.assigned,[]);
  assert.equal(t.elements.identity.hidden,true);
  assert.match(t.elements['account-message'].textContent,/Signed out/);
});

test('request deadlines abort pending body reads and release the browser lock',async()=>{
  const callbacks=new Map();let id=0;
  const timers={setTimeout(fn,ms){const key=++id;callbacks.set(key,{fn,ms});return key;},clearTimeout(key){callbacks.delete(key);}};
  const b=browser({timers});let slow=true;
  const t=b.tab(async(action,options)=>{
    if(action==='config')return response({enabled:true,providers:['google'],hasSessionCookie:true});
    if(slow)return {status:200,ok:true,json:()=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}))};
    return response(member);
  });
  await tick();const timer=[...callbacks.values()].find(x=>x.ms===12000);assert.ok(timer);timer.fn();await tick();
  assert.equal(t.elements.identity.hidden,true);
  assert.match(t.elements['account-message'].textContent,/temporarily unavailable/);
  assert.equal(callbacks.size,0);
  slow=false;t.visible();await tick();assert.equal(t.elements.identity.hidden,false);
  assert.equal(callbacks.size,0);
});

test('an expired lock waiter does no provider work and a later visible check can retry',async()=>{
  const callbacks=new Map();let id=0;
  const timers={setTimeout(fn,ms){const key=++id;callbacks.set(key,{fn,ms});return key;},clearTimeout(key){callbacks.delete(key);}};
  const b=browser({timers});const gate=deferred();let hold=true;
  const fetch=async action=>{if(action==='config')return response({enabled:true,providers:['google'],hasSessionCookie:true});if(hold)await gate.promise;return response(member);};
  const a=b.tab(fetch);await tick();const c=b.tab(fetch);await tick();
  const waits=[...callbacks.values()].filter(x=>x.ms===20000);assert.equal(waits.length,2);waits[1].fn();
  hold=false;gate.resolve();await tick();await tick();
  assert.deepEqual(c.requests,[]);
  assert.equal(c.elements.identity.hidden,true);
  assert.match(c.elements['account-message'].textContent,/unavailable/);
  c.visible();await tick();assert.equal(c.elements.identity.hidden,false);
  assert.equal(a.elements.identity.hidden,false);
  assert.equal(callbacks.size,0);
});

test('logout during initial configuration preserves available sign-in options without reading identity',async()=>{
  const b=browser();const gate=deferred();
  const t=b.tab(async()=>{await gate.promise;return response({enabled:true,providers:['google'],hasSessionCookie:true});});
  await tick();b.broadcast({type:'signed-out',remoteRevoked:true});gate.resolve();await tick();
  assert.deepEqual(t.requests,['config']);
  assert.equal(t.elements.identity.hidden,true);
  assert.equal(t.elements.google.disabled,false);
  assert.equal(t.elements.apple.disabled,true);
  assert.match(t.elements['account-message'].textContent,/Signed out/);
});
