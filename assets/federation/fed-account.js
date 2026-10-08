'use strict';
(()=>{
 const message=document.getElementById('account-message');
 const buttons=['google','apple'].map(p=>document.getElementById(p));
 const logout=document.getElementById('logout');
 let busy=false, generation=0, signedOut=false, providers=[], channel=null;
 const sensitiveFragment=/(?:^#|&)(?:access_token|refresh_token|token_hash|provider_token|provider_refresh_token|error_code)=/i.test(location.hash||'');
 if(sensitiveFragment){
  // This page uses a server-side PKCE callback; it must not consume an implicit token.
  history.replaceState(null,'','/account');
  message.textContent='This account preview cannot finish that sign-in or recovery link. For your security, its temporary details were removed from the address bar. Contact the Federation for help; do not share the original link.';
  return;
 }
 const search=new URLSearchParams(location.search);
 const failedSignin=search.get('signin')==='failed';
 // Dashboard URLs never establish a session or consume provider return values.
 const authQuery=['code','state','access_token','refresh_token','token_hash','provider_token','provider_refresh_token','error','error_code','error_description'].some(key=>search.has(key));
 if(authQuery)history.replaceState(null,'','/account');
 const passport=globalThis.FederationPassport;
 if(passport){const saved=passport.read();if(saved.available){document.getElementById('passport-summary').textContent=saved.enabled?`This device remembers ${saved.done.length} of ${passport.missions.length} mission badges. Sign-in does not sync them.`:'No Explorer Passport is remembered on this device. Every mission is still open.';}}
 const locks=globalThis.navigator?.locks;
 const coordinated=typeof locks?.request==='function';
 const current=turn=>turn===generation&&!signedOut;
 function buttonState(){buttons.forEach(b=>{b.disabled=busy||!providers.includes(b.id);});}
 function hideIdentity(){document.getElementById('identity').hidden=true;document.getElementById('member-email').textContent='';logout.hidden=true;buttons.forEach(b=>{b.hidden=false;});buttonState();}
 function signedOutMessage(revoked){return revoked?'Signed out.':'Signed out of this browser. Remote session revocation could not be confirmed.';}
 // Keep all account-page operations that can update cookies in one same-origin
 // browser lock. A waiting tab reads the current cookies only after acquiring it.
 async function withSessionLock(work){
  if(!coordinated)return work();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{return await locks.request('gf-account-session',{mode:'exclusive',signal:controller.signal},work);}
  finally{clearTimeout(timer);}
 }
 async function api(action,body){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
   const r=await fetch('/api/federation-account/'+action,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
   if(r.status===429)throw Object.assign(Error('Too many account requests. Please wait a minute and try again.'),{status:429});
   let data;try{data=await r.json();}catch{throw Object.assign(Error('Account service is temporarily unavailable.'),{status:r.status});}
   if(!r.ok)throw Object.assign(Error(data.error||'Account service unavailable.'),{status:r.status});
   return data;
  }finally{clearTimeout(timer);}
 }
 function signedIn(user){buttons.forEach(b=>{b.hidden=true;});logout.hidden=false;document.getElementById('identity').hidden=false;document.getElementById('member-email').textContent=user.email||'Signed-in member';message.textContent='You are signed in. Staking and lending remain in preparation.';}
 async function start(){
  if(busy||signedOut)return;
  const turn=++generation;hideIdentity();
  try{await withSessionLock(async()=>{
   if(!current(turn))return;
   const cfg=await api('config');
   if(!current(turn)){
    // A logout during initial config must still leave the available sign-in
    // options usable. Config never establishes identity or triggers refresh.
    if(signedOut&&!providers.length){providers=cfg.enabled&&Array.isArray(cfg.providers)?cfg.providers:[];buttonState();}
    return;
   }
   providers=cfg.enabled&&Array.isArray(cfg.providers)?cfg.providers:[];buttonState();
   if(!cfg.enabled){message.textContent='Accounts are being prepared. Google and Apple sign-in are not open yet.';return;}
   message.textContent=failedSignin?'Sign-in did not complete. Try again.':providers.length?'Choose an available sign-in option.':'Provider setup is in progress. Sign-in is not open yet.';
   if(cfg.hasSessionCookie===false)return;
   try{
    let session;
    try{session=await api('session');}catch(e){
     if(e.status!==401)throw e;
     if(!current(turn))return;
     // Without cross-tab exclusion, reauthentication is safer than racing a
     // shared rotating refresh token. Valid existing access still works.
     if(!coordinated){message.textContent='Your session has expired. Sign in again.';return;}
     await api('refresh',{});if(!current(turn))return;
     session=await api('session');
    }
    if(current(turn))signedIn(session.user);
   }catch(e){if(current(turn))message.textContent=e.status===401?'Your session has expired. Sign in again.':'Sign-in is temporarily unavailable. You can still browse the Federation.';}
  });}catch{if(current(turn))message.textContent='Account status is unavailable. You can still browse the Federation.';}
 }
 function connectChannel(){
  if(channel||typeof globalThis.BroadcastChannel!=='function')return;
  try{
   channel=new BroadcastChannel('gf-account-status');
   channel.onmessage=event=>{
    if(event.data?.type!=='signed-out'||typeof event.data.remoteRevoked!=='boolean')return;
    generation++;signedOut=true;hideIdentity();message.textContent=signedOutMessage(event.data.remoteRevoked);
   };
  }catch{channel=null;}
 }
 connectChannel();
 buttons.forEach(b=>b.addEventListener('click',async()=>{
  if(busy||!providers.includes(b.id))return;
  busy=true;signedOut=false;const turn=++generation;hideIdentity();message.textContent='Opening your sign-in provider…';
  try{await withSessionLock(async()=>{
   if(!current(turn))return;
   const r=await api('oauth',{provider:b.id});if(!current(turn))return;
   const u=new URL(r.url);if(u.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.co$/.test(u.hostname)||u.pathname!=='/auth/v1/authorize')throw Error('Invalid sign-in destination.');
   location.assign(u.href);
  });}catch(e){if(current(turn))message.textContent=e.message;}
  finally{busy=false;buttonState();}
 }));
 logout.addEventListener('click',async()=>{
  if(busy)return;
  busy=true;generation++;signedOut=true;hideIdentity();logout.hidden=false;logout.disabled=true;message.textContent='Signing out…';
  try{
   const r=await withSessionLock(()=>api('logout',{}));
   if(r.signedOut!==true)throw Error('logout');
   hideIdentity();message.textContent=signedOutMessage(r.remoteRevoked===true);
   // A status hint only: no tokens, email, address or sign-in proof cross tabs.
   try{channel?.postMessage({type:'signed-out',remoteRevoked:r.remoteRevoked===true});}catch{}
  }catch{logout.hidden=false;message.textContent='Sign-out could not be completed. Try again.';}
  finally{busy=false;logout.disabled=false;buttonState();}
 });
 document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState==='visible')start();});
 globalThis.addEventListener?.('pagehide',()=>{try{channel?.close();}catch{}channel=null;generation++;hideIdentity();});
 globalThis.addEventListener?.('pageshow',event=>{connectChannel();if(event.persisted)start();});
 if(failedSignin){message.textContent='Sign-in did not complete. Try again.';history.replaceState(null,'','/account');}
 start();
})();
