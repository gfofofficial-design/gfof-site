// Unmounted server integration candidate. No environment reads, route or default
// handler: the account release must explicitly compose and enable this factory.
import bounded from '../netlify/lib/read-json-bounded.cjs';
import {createProfileStore,validateProfileInput} from './alliance-profile-store.mjs';
import {createAllianceProfileView} from './alliance-avatar-server/profile-view.mjs';
import {verifiedAccountContext} from './alliance-avatar-server/member.mjs';
import {performance} from 'node:perf_hooks';
import {profileWriteReceipt} from './alliance-avatar-server/profile-write-receipt.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN=/^[A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{1,2048}$/;
const COOKIE='__Host-gf-access';
const ROOT='/api/alliance-members';
const MESSAGES={not_found:'Member service unavailable.',request_invalid:'Check the profile request.',sign_in_required:'Sign in again before using your member profile.',account_unavailable:'Account verification is unavailable. No profile change was started.',profile_unavailable:'Your profile could not be confirmed. Reload it before submitting again.',profile_changes_paused:'Profile changes are paused until the earlier save is reviewed.',request_ended:'The request ended. Reload your profile before submitting again.'};
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
export function createAllianceProfileApi({enabled=false,origin,url,key,fetcher=globalThis.fetch,journal,serving,creation,ledger}={}){
  let configuredOrigin;
  if(enabled===true){
    // Only the reviewed Federation host family, bound to one exact caller origin.
    if(typeof origin!=='string'||!/^https:\/\/(?:galacticfederation\.co|deploy-preview-[1-9][0-9]*--gfof\.netlify\.app)$/.test(origin))throw Error('profile_configuration_unavailable');
    configuredOrigin=origin;
    // Validates the exact HTTPS Supabase origin and publishable key, never a
    // service-role key. The caller supplies only trusted server configuration.
    createProfileStore({enabled:true,url,key,fetcher});
  }
  const guarded=enabled===true&&typeof journal?.review==='function'&&typeof serving?.authorize==='function'&&typeof ledger?.authorizeAccountSession==='function';
  const viewer=createAllianceProfileView({enabled:guarded,journal,serving});
  let closed=false,current=null,writesPaused=false;
  async function handle(request,flight){
    if(enabled!==true)return problem(404,'not_found');
    let target;try{target=new URL(request.url);}catch{return problem(404,'not_found');}
    if(target.origin!==configuredOrigin||target.username||target.password||target.hash||![ROOT+'/me',ROOT+'/directory'].includes(target.pathname))return problem(404,'not_found');
    const self=target.pathname===ROOT+'/me',method=request.method;
    if(!(self?['GET','POST','DELETE']:['GET']).includes(method))return problem(405,'request_invalid');
    // The legacy bearer/RPC removal bypasses the independent journal. A future
    // mounted host must use the session-bound, journal-first member coordinator.
    if(method==='DELETE')return problem(503,'profile_unavailable');
    if(method==='POST'&&typeof creation?.profile!=='function')return problem(503,'profile_unavailable');
    if(!guarded)return problem(503,'profile_unavailable');
    const requestOrigin=request.headers.get('origin'),fetchSite=request.headers.get('sec-fetch-site');
    if(request.headers.has('authorization')||(requestOrigin!==null&&requestOrigin!==configuredOrigin)||(fetchSite!==null&&fetchSite!=='same-origin')||method!=='GET'&&requestOrigin!==configuredOrigin)return problem(403,'request_invalid');
    if(request.signal.aborted)return problem(408,'request_ended');
    if(method==='POST'&&writesPaused)return problem(503,'profile_changes_paused');
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
    }catch(error){if(error?.name==='AbortError')flight.retire=true;return problem(request.signal.aborted?408:400,request.signal.aborted?'request_ended':'request_invalid');}
    const token=accessCookie(request.headers.get('cookie'));
    if(!token)return problem(401,'sign_in_required');
    if(request.signal.aborted)return problem(408,'request_ended');
    // Verify the cookie against the pinned Auth server before decoding its
    // subject/session/expiry binding. This is not a live auth.sessions lookup.
    // Never authorize from user_metadata, a supplied ID or a display name.
    let context;
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
      context=Object.freeze(verifiedAccountContext(token,account,url));
      if(!Number.isSafeInteger(context.expiresAt))throw Error('account_context_unavailable');
    }catch(error){if(!error.authRejected)flight.retire=true;return problem(request.signal.aborted?408:error.authRejected?401:503,request.signal.aborted?'request_ended':error.authRejected?'sign_in_required':'account_unavailable');}
    if(request.signal.aborted)return problem(408,'request_ended');
    let writeStarted=false;
    const controller=new AbortController(),abort=()=>controller.abort();
    request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted)abort();
    const remaining=Math.max(0,context.expiresAt-Date.now()),started=performance.now(),tokenDeadline=started+remaining,deadline=started+Math.min(8000,remaining);
    const timer=setTimeout(abort,Math.min(8000,remaining));
    const expired=()=>Date.now()>=context.expiresAt||performance.now()>=tokenDeadline;
    const check=()=>{if(controller.signal.aborted||expired()||performance.now()>=deadline)throw Error('profile_request_ended');};
    const interrupted=()=>{
      if(request.signal.aborted)return problem(408,'request_ended',writeStarted);
      // A dispatched save may have committed. Never turn its lost confirmation
      // into a plain 401 that would invite the client to retry the mutation.
      if(expired())return writeStarted?problem(408,'request_ended',true):problem(401,'sign_in_required');
      return controller.signal.aborted||performance.now()>=deadline?problem(503,'profile_unavailable',writeStarted):null;
    };
    // A verified JWT can outlive logout. The trusted SQL ledger checks the exact
    // current account/session without requiring an existing profile. No caching.
    const currentSession=async(signal=controller.signal)=>{
      check();if(signal.aborted)throw Error('profile_request_ended');
      let onAbort;const stopped=new Promise((_,reject)=>{onAbort=()=>reject(Error('profile_request_ended'));signal.addEventListener('abort',onAbort,{once:true});});
      try{
        const value=await Promise.race([Promise.resolve().then(()=>{check();if(signal.aborted)throw Error('profile_request_ended');return ledger.authorizeAccountSession(context.actorId,context.sessionId,{signal});}),stopped]);
        check();if(signal.aborted||!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==2||!Object.hasOwn(value,'actorId')||!Object.hasOwn(value,'sessionId')||value.actorId!==context.actorId||value.sessionId!==context.sessionId)throw Error('profile_session_unavailable');
      }finally{signal.removeEventListener('abort',onAbort);}
    };
    try{
      check();
      const store=createProfileStore({enabled:true,url,key,fetcher:(endpoint,init)=>{check();return fetcher(endpoint,{...init,signal:AbortSignal.any([init.signal,controller.signal])});}});
      const result=await viewer.read(self?{kind:'self'}:{kind:'directory',...options},{signal:controller.signal,load:async({signal})=>{
        await currentSession(signal);check();let value;
        if(!self)value=await store.directory(token,options);
        else if(method==='GET')value=await store.mine(token);
        else{
          const receipt=profileWriteReceipt(await ledger.profileWriteStatusSession(context.actorId,context.sessionId,{signal}));check();
          if(receipt?.pending){flight.persistedPause=true;throw Error('profile_write_review_required');}
          writeStarted=true;flight.writeStarted=true;value=await creation.profile(context,input,{signal});
        }
        check();return value;
      }});
      const stopped=interrupted();if(stopped)return stopped;
      if(flight.persistedPause)return problem(503,'profile_changes_paused');
      if(result.state!=='ready')return problem(503,'profile_unavailable',writeStarted);
      const response=reply(200,result.body);await currentSession();return interrupted()||response;
    }catch{return interrupted()||problem(503,'profile_unavailable',writeStarted);}
    finally{if(controller.signal.aborted||performance.now()>=deadline)flight.retire=true;clearTimeout(timer);request.signal.removeEventListener('abort',abort);controller.abort();}
  }
  // One request owns the instance from inbound validation through Auth and final
  // verification. An interrupted instance cannot admit another orphaned call.
  const api=async function allianceProfileApi(request){
    if(enabled!==true)return problem(404,'not_found');
    if(closed||current)return problem(503,'profile_unavailable');
    let sourceSignal,snapshot;
    try{
      sourceSignal=request.signal;if(sourceSignal.aborted)return problem(408,'request_ended');
      snapshot={url:request.url,method:request.method,headers:new Headers(request.headers),body:request.body};
    }catch{return problem(400,'request_invalid');}
    const flight={controller:new AbortController(),writeStarted:false,shutdown:false,retire:false};current=flight;
    const abort=()=>flight.controller.abort();let onAbort;
    sourceSignal.addEventListener('abort',abort,{once:true});if(sourceSignal.aborted)abort();
    snapshot.signal=flight.controller.signal;
    const stopped=new Promise(resolve=>{
      onAbort=()=>{flight.retire=true;resolve(problem(flight.shutdown?503:408,flight.shutdown?'profile_unavailable':'request_ended',flight.writeStarted));};
      snapshot.signal.addEventListener('abort',onAbort,{once:true});if(snapshot.signal.aborted)onAbort();
    });
    try{
      const response=await Promise.race([Promise.resolve().then(()=>handle(snapshot,flight)),stopped]);
      if(flight.writeStarted&&response.status!==200)writesPaused=true;
      return response;
    }catch{if(flight.writeStarted)writesPaused=true;flight.retire=true;return problem(503,'profile_unavailable',flight.writeStarted);}
    finally{
      sourceSignal.removeEventListener('abort',abort);snapshot.signal.removeEventListener('abort',onAbort);flight.controller.abort();
      if(flight.retire){closed=true;viewer.close();}if(current===flight)current=null;
    }
  };
  return Object.freeze(Object.assign(api,{close(){
    if(closed)return;closed=true;
    if(current){current.shutdown=true;current.controller.abort();}
    // Injected adapters remain caller-owned; other services may share them.
    viewer.close();
  }}));
}
