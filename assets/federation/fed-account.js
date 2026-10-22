'use strict';
(()=>{
 const message=document.getElementById('account-message');
 const buttons=['google','apple'].map(p=>document.getElementById(p));
 const logout=document.getElementById('logout');
 const emailForm=document.getElementById('email-form'),codeForm=document.getElementById('email-code-form');
 const emailInput=document.getElementById('email-address'),codeInput=document.getElementById('email-code');
 const emailSend=document.getElementById('email-send'),emailVerify=document.getElementById('email-verify');
 const passwordForm=document.getElementById('password-form'),passwordEmail=document.getElementById('password-email'),passwordInput=document.getElementById('account-password'),passwordSubmit=document.getElementById('password-signin');
 let passwordEnabled=false,passwordNeedsReload=false;
 let emailEnabled=false,emailChallenge=null,emailNeedsReload=false;
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
 function buttonState(){if(passwordSubmit)passwordSubmit.disabled=busy||!passwordEnabled;buttons.forEach(b=>{b.disabled=busy||emailNeedsReload||!providers.includes(b.id);});if(emailSend)emailSend.disabled=busy||!emailEnabled;if(emailVerify)emailVerify.disabled=busy||!emailEnabled||!emailChallenge;}
 function hideIdentity(checking=false){if(passwordInput)passwordInput.value='';if(passwordForm)passwordForm.hidden=checking||!passwordEnabled;document.getElementById('identity').hidden=true;document.getElementById('member-email').textContent='';logout.hidden=true;buttons.forEach(b=>{b.hidden=checking;});if(emailForm)emailForm.hidden=checking||!emailEnabled;if(codeForm)codeForm.hidden=checking||!emailEnabled||!emailChallenge;buttonState();}
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
  // The server can perform two 8-second provider reads for refresh and three
  // for logout. Leave room for those existing paths without adding any retry.
  const timeoutMs=action==='logout'?30000:['refresh','email-verify','password-signin'].includes(action)?20000:12000;
  let onAbort;
  const interrupted=new Promise((_,reject)=>{
   onAbort=()=>reject(Error('Account request took too long. Please try again later.'));
   controller.signal.addEventListener('abort',onAbort,{once:true});
  });
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   return await Promise.race([(async()=>{
   const r=await fetch('/api/federation-account/'+action,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
   controller.signal.throwIfAborted();
   if(r.status===429)throw Object.assign(Error('Too many account requests. Please wait a minute and try again.'),{status:429});
   let data;try{data=await r.json();}catch{throw Object.assign(Error('Account service is temporarily unavailable.'),{status:r.status});}
   if(!r.ok)throw Object.assign(Error(data.error||'Account service unavailable.'),{status:r.status});
   return data;
   })(),interrupted]);
  }finally{clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);}
 }
 function signedIn(user){if(passwordInput)passwordInput.value='';if(passwordForm)passwordForm.hidden=true;emailChallenge=null;if(codeInput)codeInput.value='';if(emailForm)emailForm.hidden=true;if(codeForm)codeForm.hidden=true;buttons.forEach(b=>{b.hidden=true;});logout.hidden=false;document.getElementById('identity').hidden=false;document.getElementById('member-email').textContent=user.email||'Signed-in member';message.textContent='You are signed in. Staking and lending remain in preparation.';}
 async function start(){
  if(busy||signedOut)return;
  const turn=++generation;hideIdentity(true);message.textContent='Checking your account status…';
  try{await withSessionLock(async()=>{
   if(!current(turn))return;
   const cfg=await api('config');
   if(!current(turn)){
    // A logout during initial config must still leave the available sign-in
    // options usable. Config never establishes identity or triggers refresh.
    if(signedOut&&!providers.length){providers=cfg.enabled&&Array.isArray(cfg.providers)?cfg.providers:[];buttonState();}
    return;
   }
   providers=cfg.enabled&&Array.isArray(cfg.providers)?cfg.providers:[];emailEnabled=!emailNeedsReload&&cfg.enabled===true&&cfg.emailEnabled===true;passwordEnabled=!passwordNeedsReload&&cfg.enabled===true&&cfg.passwordEnabled===true;hideIdentity();
   if(!cfg.enabled){message.textContent='Accounts are being prepared. Google and Apple sign-in are not open yet.';return;}
   message.textContent=emailNeedsReload?'Reload this page before starting another sign-in.':failedSignin?'Sign-in did not complete. Try again.':emailEnabled?'Enter your email to request a one-time sign-in code.':providers.length?'Choose an available sign-in option.':'Provider setup is in progress. Sign-in is not open yet.';
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
 function oauthDestination(raw,provider){
  const invalid=()=>{throw Error('Invalid sign-in destination.');};
  if(typeof raw!=='string'||raw.length>8192)invalid();
  let u,callback;try{u=new URL(raw);callback=new URL(u.searchParams.get('redirect_to'));}catch{invalid();}
  if(u.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.co$/.test(u.hostname)||u.pathname!=='/auth/v1/authorize'||
   u.username||u.password||u.port||u.hash)invalid();
  const keys=['code_challenge','code_challenge_method','provider','redirect_to'];
  if([...u.searchParams.keys()].sort().join(',')!==keys.join(',')||
   keys.some(key=>u.searchParams.getAll(key).length!==1)||u.searchParams.get('provider')!==provider||
   u.searchParams.get('code_challenge_method')!=='s256'||!/^[-A-Za-z0-9_]{43}$/.test(u.searchParams.get('code_challenge')||''))invalid();
  if(callback.protocol!=='https:'||callback.origin!==location.origin||callback.pathname!=='/api/federation-account/callback'||
   callback.username||callback.password||callback.hash||[...callback.searchParams.keys()].join(',')!=='state'||
   !/^[-A-Za-z0-9_]{32}$/.test(callback.searchParams.get('state')||''))invalid();
  return u.href;
 }
 function connectChannel(){
  if(channel||typeof globalThis.BroadcastChannel!=='function')return;
  try{
   channel=new BroadcastChannel('gf-account-status');
   channel.onmessage=event=>{
    if(event.data?.type!=='signed-out'||typeof event.data.remoteRevoked!=='boolean')return;
    generation++;signedOut=true;emailChallenge=null;if(codeInput)codeInput.value='';hideIdentity();message.textContent=signedOutMessage(event.data.remoteRevoked);
   };
  }catch{channel=null;}
 }
 connectChannel();
 emailForm?.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!emailEnabled)return;
  busy=true;signedOut=false;const turn=++generation;emailChallenge=null;hideIdentity();message.textContent='Requesting your email code…';
  try{await withSessionLock(async()=>{
   if(!current(turn))return;
   const r=await api('email-start',{email:emailInput.value.trim()});if(!current(turn))return;
   if(r.sent!==true||typeof r.challenge!=='string'||!/^[A-Za-z0-9_-]{32}$/.test(r.challenge))throw Error('Email sign-in is temporarily unavailable.');
   emailChallenge=r.challenge;codeInput.value='';codeForm.hidden=false;message.textContent='If this address is eligible, check your inbox for a code. Enter it here within ten minutes.';codeInput.focus();
  });}catch(e){if(current(turn))message.textContent=e.message;}
  finally{busy=false;buttonState();}
 });
 codeForm?.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!emailEnabled||!emailChallenge)return;
  const code=codeInput.value.trim();if(!/^\d{8}$/.test(code)){message.textContent='Enter the eight-digit code from your email.';return;}
  busy=true;signedOut=false;const turn=++generation,challenge=emailChallenge;emailChallenge=null;codeInput.value='';buttonState();message.textContent='Confirming your email code…';
  try{await withSessionLock(async()=>{
   if(!current(turn))return;
   const r=await api('email-verify',{code,challenge});if(!current(turn))return;if(r.ok!==true)throw Error('Email sign-in could not be confirmed.');
   const session=await api('session');if(current(turn))signedIn(session.user);
  });}catch{if(current(turn)){codeForm.hidden=true;message.textContent='Sign-in could not be confirmed. Reload this page before requesting a new code.';emailEnabled=false;emailNeedsReload=true;}}
  finally{busy=false;buttonState();}
 });
 passwordForm?.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!passwordEnabled)return;
  const email=passwordEmail.value.trim();let password=passwordInput.value;
  passwordInput.value='';busy=true;signedOut=false;const turn=++generation;
  emailChallenge=null;if(codeInput)codeInput.value='';hideIdentity();message.textContent='Checking your sign-in…';
  try{await withSessionLock(async()=>{
   if(!current(turn))return;
   const pending=api('password-signin',{email,password});password='';
   const r=await pending;if(!current(turn))return;if(r.ok!==true)throw Error('signin');
   const session=await api('session');if(current(turn))signedIn(session.user);
  });}catch{if(current(turn)){message.textContent='Sign-in could not be confirmed. Reload before trying again, or use an email code.';passwordEnabled=false;passwordNeedsReload=true;hideIdentity();}}
  finally{password='';busy=false;buttonState();}
 });
 buttons.forEach(b=>b.addEventListener('click',async()=>{
  if(busy||emailNeedsReload||!providers.includes(b.id))return;
  busy=true;signedOut=false;const turn=++generation;hideIdentity();message.textContent='Opening your sign-in provider…';
  let navigating=false;
  try{await withSessionLock(async()=>{
   if(!current(turn))return;
   const r=await api('oauth',{provider:b.id});if(!current(turn))return;
   location.assign(oauthDestination(r.url,b.id));navigating=true;
  });}catch(e){if(current(turn))message.textContent=e.message;}
  finally{busy=navigating;buttonState();}
 }));
 logout.addEventListener('click',async()=>{
  if(busy)return;
  busy=true;generation++;signedOut=true;emailChallenge=null;if(codeInput)codeInput.value='';hideIdentity();logout.hidden=false;logout.disabled=true;message.textContent='Signing out…';
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
 globalThis.addEventListener?.('pagehide',()=>{try{channel?.close();}catch{}channel=null;generation++;emailChallenge=null;if(codeInput)codeInput.value='';hideIdentity(true);message.textContent='Account status will be checked when you return.';});
 globalThis.addEventListener?.('pageshow',event=>{connectChannel();if(event.persisted){busy=false;buttonState();start();}});
 if(failedSignin){message.textContent='Sign-in did not complete. Try again.';history.replaceState(null,'','/account');}
 start();
})();
