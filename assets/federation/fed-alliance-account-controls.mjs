import {createAllianceAccountBridge} from './fed-alliance-account-bridge.mjs';
// Host controls only. An enabled member controller and independently reviewed
// backend/CSP configuration are still required; DOM attributes enable nothing.
export function mountAllianceAccountControls(document,{memberPage,enabled=false,...options}={}){
 const button=document.getElementById('ap-account-check'),status=document.getElementById('ap-account-status');
 if(!button||!status||typeof memberPage?.attach!=='function'||typeof memberPage?.detach!=='function')throw Error('account_controls_configuration');
 let disposed=false,busy=false;
 const closed=()=>{status.textContent=enabled?'Profile editing is closed. Check your sign-in to continue. Earlier interrupted requests may still need reconciliation.':'Alliance profiles are not open here. No sign-in check will start.';};
 const bridge=createAllianceAccountBridge({...options,document,enabled,memberPage:{
  attach:g=>memberPage.attach(g),detach(){memberPage.detach();closed();}
 }});
 button.disabled=!enabled;button.setAttribute('aria-busy','false');
 async function check(){
  if(disposed||!enabled||busy)return;
  busy=true;button.disabled=true;button.setAttribute('aria-busy','true');
  try{
   const pending=bridge.verify();
   status.textContent='Checking your sign-in. Previous profile details and unsaved edits are cleared.';
   const attached=await pending;if(disposed)return;
   if(attached)status.textContent='Sign-in checked. Choose Read current profile to load your details. No profile has been read or saved.';
   else{const state=bridge.getState().status;status.textContent=state==='signed_out'?'Sign in on the account page, then return and check again.':state==='unavailable'?'Sign-in could not be checked. Profile editing remains closed. You can try again.':'Profile editing is closed. Check your sign-in to continue.';}
  }catch{if(!disposed)status.textContent='Sign-in could not be checked. Profile editing remains closed.';}
  finally{busy=false;if(!disposed){button.disabled=!enabled;button.setAttribute('aria-busy','false');}}
 }
 button.addEventListener('click',check);
 return Object.freeze({dispose(){if(disposed)return;disposed=true;button.removeEventListener('click',check);bridge.dispose();button.disabled=true;button.setAttribute('aria-busy','false');status.textContent='Profile editing is closed. No further sign-in checks will start.';}});
}
