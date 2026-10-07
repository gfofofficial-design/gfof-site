'use strict';
const {randomBytes, createHash, timingSafeEqual} = require('node:crypto');
const COOKIE = {access:'__Host-gf-access',refresh:'__Host-gf-refresh',flow:'__Host-gf-flow'};
const headers = {'Content-Type':'application/json','Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
function result(statusCode, body, cookies=[], extra={}) {
  return {statusCode,headers:{...headers,...extra},multiValueHeaders:{'Set-Cookie':cookies},body:JSON.stringify(body)};
}
function cookie(name,value,age) { return `${name}=${encodeURIComponent(value)}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`; }
function clear() {return Object.values(COOKIE).map(n=>cookie(n,'',0));}
function cookies(event) {
  const out={}; const raw=event.headers?.cookie||event.headers?.Cookie||'';
  if(raw.length>24000) return out;
  for(const pair of raw.split(';')) {const i=pair.indexOf('=');if(i<0)continue;const name=pair.slice(0,i).trim();if(Object.values(COOKIE).includes(name)){if(name in out)return {};try{out[name]=decodeURIComponent(pair.slice(i+1));}catch{return {};}}}
  return out;
}
function config(env) {
  if(env.FEDERATION_ACCOUNT_ENABLED!=='true')return null;
  const origin=new URL(env.FEDERATION_ACCOUNT_ORIGIN||'');
  const url=new URL(env.FEDERATION_AUTH_URL||'');
  if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)throw Error('config');
  if(['deploy-preview','branch-deploy'].includes(env.CONTEXT)){
    const preview=new URL(env.DEPLOY_PRIME_URL||'');
    if(preview.protocol!=='https:'||origin.origin!==preview.origin)throw Error('preview-origin');
  }
  if(env.CONTEXT==='production'&&origin.origin!=='https://galacticfederation.co')throw Error('production-origin');
  if(url.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.co$/.test(url.hostname)||url.pathname!=='/'||url.port||url.username||url.password||url.search||url.hash)throw Error('config');
  const key=env.FEDERATION_AUTH_PUBLISHABLE_KEY||'';
  if(!/^sb_publishable_[a-zA-Z0-9_-]+$/.test(key))throw Error('config');
  const providers=['google','apple'].filter(p=>env[`FEDERATION_AUTH_${p.toUpperCase()}_ENABLED`]==='true');
  return {origin:origin.origin,url:url.origin,key,providers};
}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function sessionCookies(data){
  if(typeof data.access_token!=='string'||typeof data.refresh_token!=='string'||data.access_token.length>8000||data.refresh_token.length>8000||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw Error('session');
  return [cookie(COOKIE.access,data.access_token,Math.min(3600,Math.floor(data.expires_in))),cookie(COOKIE.refresh,data.refresh_token,86400),cookie(COOKIE.flow,'',0)];
}
function createHandler({env=process.env,fetchImpl=fetch,now=Date.now}={}){
  return async event=>{
    // Netlify's direct function URL must not bypass the account redirect's edge limit.
    const path=event.path||'';
    if(!/^\/api\/federation-account\/(?:config|oauth|callback|session|refresh|logout)$/.test(path))return result(404,{error:'Account route unavailable.'});
    const action=path.split('/').at(-1);
    const method=event.httpMethod;
    let cfg;try{cfg=config(env);}catch{return result(503,{error:'Account configuration is unavailable.'});}
    if(action==='config'&&method==='GET')return result(200,{enabled:!!cfg,providers:cfg?.providers||[]});
    if(!cfg)return result(503,{error:'Federation accounts are being prepared.'});
    const jar=cookies(event);
    const origin=event.headers?.origin||event.headers?.Origin;
    const site=event.headers?.['sec-fetch-site'];
    if(method==='POST'&&(origin!==cfg.origin||(site&&site!=='same-origin')))return result(403,{error:'Request origin rejected.'});
    async function api(path,{token,body,method='GET'}={}){
      const response=await fetchImpl(cfg.url+path,{method,headers:{apikey:cfg.key,...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000),redirect:'error'});
      if(!response.ok){const error=Error('upstream');error.status=response.status;throw error;}
      if(response.status===204)return null;
      return response.json();
    }
    async function user(token){if(!token)throw Object.assign(Error('auth'),{status:401});const u=await api('/auth/v1/user',{token});if(!u?.id||!u.email_confirmed_at||u.is_anonymous)throw Object.assign(Error('auth'),{status:401});return u;}
    try{
      if(action==='oauth'&&method==='POST'){
        if((event.body||'').length>1024)return result(413,{error:'Request too large.'});
        const body=JSON.parse(event.body||'{}');if(!cfg.providers.includes(body.provider))return result(400,{error:'Sign-in provider is not available.'});
        const verifier=randomBytes(32).toString('base64url'),state=randomBytes(24).toString('base64url');
        const redirect=cfg.origin+'/api/federation-account/callback?state='+state;
        const url=new URL(cfg.url+'/auth/v1/authorize');url.search=new URLSearchParams({provider:body.provider,redirect_to:redirect,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'s256'}).toString();
        return result(200,{url:url.href},[cookie(COOKIE.flow,JSON.stringify({verifier,state,created:now()}),600)]);
      }
      if(action==='callback'&&method==='GET'){
        const q=event.queryStringParameters||{};let f;try{f=JSON.parse(jar[COOKIE.flow]||'null');}catch{}
        if(!f||!equal(f.state,q.state)||!Number.isFinite(f.created)||now()-f.created>600000||now()<f.created||typeof f.verifier!=='string'||!/^[a-zA-Z0-9_-]{43}$/.test(f.verifier)||typeof q.code!=='string'||q.code.length>2048)return result(303,{},[cookie(COOKIE.flow,'',0)],{Location:cfg.origin+'/account?signin=failed'});
        const data=await api('/auth/v1/token?grant_type=pkce',{method:'POST',body:{auth_code:q.code,code_verifier:f.verifier}});await user(data.access_token);
        return result(303,{},sessionCookies(data),{Location:cfg.origin+'/account'});
      }
      if(action==='session'&&method==='GET'){
        const u=await user(jar[COOKIE.access]);return result(200,{signedIn:true,user:{id:u.id,email:u.email||null},staking:{status:'preparation'},lending:{status:'private-prototype'}});
      }
      if(action==='refresh'&&method==='POST'){
        if(!jar[COOKIE.refresh])return result(401,{error:'Sign in again.'},clear());
        const data=await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:jar[COOKIE.refresh]}});await user(data.access_token);return result(200,{ok:true},sessionCookies(data));
      }
      if(action==='logout'&&method==='POST'){
        let revoked=false;if(jar[COOKIE.access]){try{await api('/auth/v1/logout?scope=local',{method:'POST',token:jar[COOKIE.access]});revoked=true;}catch{}}
        return result(200,{signedOut:true,remoteRevoked:revoked},clear());
      }
      return result(405,{error:'Method or route not available.'});
    }catch(error){
      if(action==='callback')return result(303,{},[cookie(COOKIE.flow,'',0)],{Location:cfg.origin+'/account?signin=failed'});
      if(error instanceof SyntaxError)return result(400,{error:'Invalid request.'});
      if(error.status===401||error.status===403)return result(401,{error:'Sign in again.'},clear());
      return result(502,{error:'Account service is temporarily unavailable.'});
    }
  };
}
exports.handler=createHandler();
exports.createHandler=createHandler;
