'use strict';
(()=>{
 const message=document.getElementById('account-message');
 const buttons=['google','apple'].map(p=>document.getElementById(p));
 const logout=document.getElementById('logout');
 let busy=false;
 const sensitiveFragment=/(?:^#|&)(?:access_token|refresh_token|token_hash|provider_token|provider_refresh_token|error_code)=/i.test(location.hash||'');
 if(sensitiveFragment){
  // This page uses a server-side PKCE callback; it must not consume an implicit token.
  history.replaceState(null,'','/account');
  message.textContent='This account preview cannot finish that sign-in or recovery link. For your security, its temporary details were removed from the address bar. Contact the Federation for help; do not share the original link.';
  return;
 }
 const failedSignin=new URLSearchParams(location.search).get('signin')==='failed';
 const passport=globalThis.FederationPassport;
 if(passport){const saved=passport.read();if(saved.available){document.getElementById('passport-summary').textContent=saved.enabled?`This device remembers ${saved.done.length} of ${passport.missions.length} mission badges. Sign-in does not sync them.`:'No Explorer Passport is remembered on this device. Every mission is still open.';}}
 async function api(action,body){const r=await fetch('/api/federation-account/'+action,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});if(r.status===429)throw Object.assign(Error('Too many account requests. Please wait a minute and try again.'),{status:429});let data;try{data=await r.json();}catch{throw Object.assign(Error('Account service is temporarily unavailable.'),{status:r.status});}if(!r.ok)throw Object.assign(Error(data.error||'Account service unavailable.'),{status:r.status});return data;}
 function signedIn(user){buttons.forEach(b=>b.hidden=true);logout.hidden=false;document.getElementById('identity').hidden=false;document.getElementById('member-email').textContent=user.email||'Signed-in member';message.textContent='You are signed in. Staking and lending remain in preparation.';}
 async function start(){try{const cfg=await api('config');if(!cfg.enabled){message.textContent='Accounts are being prepared. Google and Apple sign-in are not open yet.';return;}buttons.forEach(b=>{b.disabled=!cfg.providers.includes(b.id);});message.textContent=failedSignin?'Sign-in did not complete. Try again.':cfg.providers.length?'Choose an available sign-in option.':'Provider setup is in progress. Sign-in is not open yet.';if(cfg.hasSessionCookie===false)return;try{let session;try{session=await api('session');}catch(e){if(e.status!==401)throw e;await api('refresh',{});session=await api('session');}signedIn(session.user);}catch(e){if(e.status!==401)message.textContent='Sign-in is temporarily unavailable. You can still browse the Federation.';}}catch{message.textContent='Account status is unavailable. You can still browse the Federation.';}}
 buttons.forEach(b=>b.addEventListener('click',async()=>{if(busy)return;busy=true;buttons.forEach(x=>x.disabled=true);message.textContent='Opening your sign-in provider…';try{const r=await api('oauth',{provider:b.id});const u=new URL(r.url);if(u.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.co$/.test(u.hostname)||u.pathname!=='/auth/v1/authorize')throw Error('Invalid sign-in destination.');location.assign(u.href);}catch(e){busy=false;await start();message.textContent=e.message;}}));
 logout.addEventListener('click',async()=>{if(busy)return;busy=true;logout.disabled=true;try{const r=await api('logout',{});document.getElementById('identity').hidden=true;document.getElementById('member-email').textContent='';logout.hidden=true;buttons.forEach(b=>b.hidden=false);await start();message.textContent=r.remoteRevoked?'Signed out.':'Signed out of this browser. Remote session revocation could not be confirmed.';}catch{message.textContent='Sign-out could not be completed. Try again.';}finally{busy=false;logout.disabled=false;}});
 if(failedSignin){message.textContent='Sign-in did not complete. Try again.';history.replaceState(null,'','/account');}
 start();
})();
