// Unmounted server integration candidate. No environment reads, route or default
// handler: the account release must explicitly compose and enable this factory.
import bounded from '../netlify/lib/read-json-bounded.cjs';
import {createProfileStore,validateProfileInput} from './alliance-profile-store.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN=/^[A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{1,2048}$/;
const COOKIE='__Host-gf-access';
const ROOT='/api/alliance-members';
const MESSAGES={not_found:'Member service unavailable.',request_invalid:'Check the profile request.',sign_in_required:'Sign in again before using your member profile.',account_unavailable:'Account verification is unavailable. No profile change was started.',profile_unavailable:'Your profile could not be confirmed. Reload it before submitting again.',request_ended:'The request ended. Reload your profile before submitting again.'};
function reply(status,body){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});}
function problem(status,code,unknown=false){return reply(status,{error:{code,message:MESSAGES[code]},...(unknown?{mutation:'unknown'}:{})});}
function accessCookie(raw){
  if(typeof raw!=='string'||raw.length>24000)return null;
  let token=null;
  for(const pair of raw.split(';')){
    const at=pair.indexOf('=');if(at<0||pair.slice(0,at).trim()!==COOKIE)continue;
    if(token!==null)return null;
    try{token=decodeURIComponent(pair.slice(at+1));}catch{return null;}
  }
  return typeof token==='string'&&token.length<=4096&&TOKEN.test(token)?token:null;
}
function directoryOptions(url){
  if([...url.searchParams.keys()].some(k=>!['after','limit'].includes(k))||['after','limit'].some(k=>url.searchParams.getAll(k).length>1))throw Error('request_invalid');
  const after=url.searchParams.get('after'),raw=url.searchParams.get('limit');
  if(after!==null&&!UUID.test(after)||raw!==null&&!/^(?:[1-9]|1[0-9]|20)$/.test(raw))throw Error('request_invalid');
  return {after,limit:raw===null?20:Number(raw)};
}
export function createAllianceProfileApi({enabled=false,origin,url,key,fetcher=globalThis.fetch}={}){
  let configuredOrigin;
  if(enabled===true){
    // Only the reviewed Federation host family, bound to one exact caller origin.
    if(typeof origin!=='string'||!/^https:\/\/(?:galacticfederation\.co|deploy-preview-[1-9][0-9]*--gfof\.netlify\.app)$/.test(origin))throw Error('profile_configuration_unavailable');
    configuredOrigin=origin;
    // Validates the exact HTTPS Supabase origin and publishable key, never a
    // service-role key. The caller supplies only trusted server configuration.
    createProfileStore({enabled:true,url,key,fetcher});
  }
  return async function allianceProfileApi(request){
    if(enabled!==true)return problem(404,'not_found');
    let target;try{target=new URL(request.url);}catch{return problem(404,'not_found');}
    if(target.origin!==configuredOrigin||target.username||target.password||target.hash||![ROOT+'/me',ROOT+'/directory'].includes(target.pathname))return problem(404,'not_found');
    const self=target.pathname===ROOT+'/me',method=request.method;
    if(!(self?['GET','POST','DELETE']:['GET']).includes(method))return problem(405,'request_invalid');
    // The legacy bearer/RPC removal bypasses the independent journal. A future
    // mounted host must use the session-bound, journal-first member coordinator.
    if(method==='DELETE')return problem(503,'profile_unavailable');
    const requestOrigin=request.headers.get('origin'),fetchSite=request.headers.get('sec-fetch-site');
    if(request.headers.has('authorization')||(requestOrigin!==null&&requestOrigin!==configuredOrigin)||(fetchSite!==null&&fetchSite!=='same-origin')||method!=='GET'&&requestOrigin!==configuredOrigin)return problem(403,'request_invalid');
    if(request.signal.aborted)return problem(408,'request_ended');
    let input,options;
    try{
      if(self&&target.search)throw Error('request_invalid');
      if(!self)options=directoryOptions(target);
      if(method==='GET'){
        if(request.body||request.headers.get('content-length')&&request.headers.get('content-length')!=='0')throw Error('request_invalid');
      }else{
        if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw Error('request_invalid');
        const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>4096))throw Error('request_invalid');
        input=await bounded.readJsonBounded(request.url,{}, {timeoutMs:2000,maxBytes:4096,fetcher:async()=>({ok:true,body:request.body})});
        if(method==='POST')input=validateProfileInput(input);
        else if(!input||Object.keys(input).join(',')!=='confirm'||input.confirm!=='remove_my_profile')throw Error('request_invalid');
      }
    }catch{return problem(request.signal.aborted?408:400,request.signal.aborted?'request_ended':'request_invalid');}
    const token=accessCookie(request.headers.get('cookie'));
    if(!token)return problem(401,'sign_in_required');
    if(request.signal.aborted)return problem(408,'request_ended');
    // Supabase performs actual token/session/account verification. Never decode
    // browser claims or authorize from user_metadata, a supplied ID or a name.
    try{
      const account=await bounded.readJsonBounded(url+'/auth/v1/user',{method:'GET',credentials:'omit',headers:{apikey:key,Authorization:'Bearer '+token}}, {
        timeoutMs:8000,maxBytes:65536,
        fetcher:async(endpoint,init)=>{
          const response=await fetcher(endpoint,{...init,signal:AbortSignal.any([init.signal,request.signal])});
          if(response.status===401||response.status===403){void response.body?.cancel().catch(()=>{});throw Object.assign(Error('auth'),{authRejected:true});}
          return response;
        },
      });
      if(!account||!UUID.test(account.id)||typeof account.email_confirmed_at!=='string'||!Number.isFinite(Date.parse(account.email_confirmed_at))||account.is_anonymous!==false)return problem(401,'sign_in_required');
    }catch(error){return problem(request.signal.aborted?408:error.authRejected?401:503,request.signal.aborted?'request_ended':error.authRejected?'sign_in_required':'account_unavailable');}
    if(request.signal.aborted)return problem(408,'request_ended');
    let writeStarted=false;
    try{
      const store=createProfileStore({enabled:true,url,key,fetcher:(endpoint,init)=>fetcher(endpoint,{...init,signal:AbortSignal.any([init.signal,request.signal])})});
      let body;
      if(!self)body=await store.directory(token,options);
      else if(method==='GET')body={profile:await store.mine(token)};
      else if(method==='POST'){writeStarted=true;body={profile:await store.save(token,input)};}
      else{writeStarted=true;body=await store.remove(token);}
      if(request.signal.aborted)return problem(408,'request_ended',writeStarted);
      return reply(200,body);
    }catch{return problem(request.signal.aborted?408:502,request.signal.aborted?'request_ended':'profile_unavailable',writeStarted);}
  };
}
