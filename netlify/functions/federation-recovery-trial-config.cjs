'use strict';
exports.handler=async event=>{
 const headers={'Content-Type':'application/json','Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
 if(event.httpMethod!=='GET'||event.path!=='/api/federation-recovery-trial/config')return {statusCode:404,headers,body:'{"enabled":false}'};
 const expected='https://deploy-preview-130--gfof.netlify.app';
 const email=process.env.FEDERATION_RECOVERY_TRIAL_EMAIL||'';
 const key=process.env.FEDERATION_EMAIL_TRIAL_PUBLISHABLE_KEY||'';let origin='';try{origin=new URL(event.rawUrl).origin;}catch{}
 const enabled=/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(email)&&email.length<=254&&origin===expected&&process.env.FEDERATION_EMAIL_TRIAL_ORIGIN===expected&&process.env.FEDERATION_RECOVERY_TRIAL_ENABLED==='true'&&/^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
 return {statusCode:200,headers,body:JSON.stringify(enabled?{enabled:true,key,email}:{enabled:false})};
};
