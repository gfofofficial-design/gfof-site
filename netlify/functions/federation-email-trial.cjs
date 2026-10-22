'use strict';
// Preview-only adapter. Never inherit production account credentials or switches.
const {createHandler}=require('./federation-account.cjs');
const TARGET='https://arjycxziiqlkfomieocc.supabase.co';
function createTrialHandler({env=process.env,fetchImpl=fetch,now=Date.now}={}){
  let origin='';
  try{
    const u=new URL(env.FEDERATION_EMAIL_TRIAL_ORIGIN||'');
    if(u.protocol==='https:'&&/^deploy-preview-[1-9][0-9]*--gfof\.netlify\.app$/.test(u.hostname)&&!u.port&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash)origin=u.origin;
  }catch{}
  const enabled=env.FEDERATION_EMAIL_TRIAL_ENABLED==='true'&&!!origin;
  return createHandler({env:{
    FEDERATION_ACCOUNT_ENABLED:String(enabled),
    FEDERATION_ACCOUNT_ORIGIN:origin,
    FEDERATION_AUTH_URL:TARGET,
    FEDERATION_AUTH_PUBLISHABLE_KEY:env.FEDERATION_EMAIL_TRIAL_PUBLISHABLE_KEY||'',
    FEDERATION_AUTH_EMAIL_ENABLED:'true',
    FEDERATION_AUTH_EMAIL_SIGNUP_ENABLED:'false',
    FEDERATION_AUTH_GOOGLE_ENABLED:'false',
    FEDERATION_AUTH_APPLE_ENABLED:'false'
  },fetchImpl,now});
}
exports.handler=createTrialHandler();
exports.createTrialHandler=createTrialHandler;

