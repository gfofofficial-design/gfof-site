// Explicit, unmounted cookie boundary. No credentials, routes or Auth are enabled
// by importing this file. The caller owns the deletion/session-aware service.
import bounded from '../netlify/lib/read-json-bounded.cjs';
import {createProfileStore} from './alliance-profile-store.mjs';
import {verifiedAccountContext} from './alliance-avatar-server/member.mjs';
import {reportReviewId,reportReviewCommand,reportReviewRecord,reportReviewPage} from '../assets/federation/fed-alliance-report-review-contract.mjs';
const ROOT='/api/alliance-members/report-review';
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const reply=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
function cookie(raw){
 if(typeof raw!=='string'||raw.length>24000)return null;let token;
 for(const part of raw.split(';')){const at=part.indexOf('=');if(at<0||part.slice(0,at).trim()!=='__Host-gf-access')continue;if(token!==undefined)return null;try{token=decodeURIComponent(part.slice(at+1));}catch{return null;}}
 return typeof token==='string'&&token.length<=4096&&/^[A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{1,2048}\.[A-Za-z0-9_-]{1,2048}$/.test(token)?token:null;
}
// The same pure query policy runs before authority admission and again inside
// the cookie boundary. It does not read a request body or call a dependency.
function queryInput(kind,u){
 if(kind==='review'){if(u.search)throw Error('request_invalid');return null;}
 const keys=kind==='read'?['id']:['after','limit'];
 if([...u.searchParams.keys()].some(k=>!keys.includes(k))||keys.some(k=>u.searchParams.getAll(k).length>1))throw Error('request_invalid');
 if(kind==='read'){const id=u.searchParams.get('id');if(!reportReviewId(id))throw Error('request_invalid');return id;}
 const after=u.searchParams.get('after'),limit=u.searchParams.get('limit');
 if(after!==null&&!reportReviewId(after)||limit!==null&&!/^[1-5]$/.test(limit))throw Error('request_invalid');
 return {after,limit:limit===null?5:Number(limit)};
}
export function allianceReportReviewRoute(request,origin){
 if(!(request instanceof Request))return null;const u=new URL(request.url);
 if(u.origin!==origin||u.username||u.password||u.hash)return null;
 let kind=null;
 if(u.pathname===ROOT+'/reports'&&request.method==='GET')kind='list';
 if(u.pathname===ROOT+'/report'&&request.method==='GET')kind='read';
 if(u.pathname===ROOT+'/review'&&request.method==='POST')kind='review';
 if(!kind)return null;
 try{queryInput(kind,u);return kind;}catch{return null;}
}
export function createAllianceReportReviewHttp({enabled=false,origin,url,key,service,fetcher=globalThis.fetch,timeoutMs=30000}={}){
 if(typeof enabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw Error('report_review_http_configuration');
 if(enabled){
  if(!/^https:\/\/(?:galacticfederation\.co|deploy-preview-[1-9][0-9]*--gfof\.netlify\.app)$/.test(origin)||!['read','list','review'].every(k=>typeof service?.[k]==='function')||typeof fetcher!=='function')throw Error('report_review_http_configuration');
  createProfileStore({enabled:true,url,key,fetcher});
 }
 let closed=false,active=null;
 const close=()=>{closed=true;active?.controller.abort();};
 async function handle(request){
  if(!enabled)return reply(404,{state:'unavailable'});if(closed||active)return reply(503,{state:'unavailable'});
  const kind=allianceReportReviewRoute(request,origin);if(!kind)return reply(404,{state:'unavailable'});
  const from=request.headers.get('origin'),site=request.headers.get('sec-fetch-site'),mutation=kind==='review';
  if(request.headers.has('authorization')||from!==null&&from!==origin||site!==null&&site!=='same-origin'||(mutation?from!==origin:from!==origin&&site!=='same-origin'))return reply(403,{state:'forbidden'});
  if(request.signal.aborted)return reply(408,{state:'unavailable'});
  const flight={controller:new AbortController(),started:false};active=flight;const signal=flight.controller.signal;
  const abort=()=>close(),check=()=>{if(closed||signal.aborted)throw Error('ended');};
  request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted)abort();
  let onAbort;const interrupted=()=>reply(request.signal.aborted?408:503,{state:flight.started&&mutation?'unknown':'unavailable'});
  const stopped=new Promise(resolve=>{onAbort=()=>resolve(interrupted());signal.addEventListener('abort',onAbort,{once:true});if(signal.aborted)onAbort();});
  const timer=setTimeout(close,timeoutMs);
  const work=(async()=>{
   try{
    check();const u=new URL(request.url);let input;
    try{
     const query=queryInput(kind,u);
     if(mutation){
      if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw Error();
      const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>4096))throw Error();
      input=await bounded.readJsonBounded(request.url,{}, {timeoutMs:2000,maxBytes:4096,fetcher:async()=>({ok:true,body:request.body})});check();
      input=reportReviewCommand(input);
     }else{
      if(request.body||request.headers.get('content-length')&&request.headers.get('content-length')!=='0')throw Error();
      input=query;
     }
    }catch(e){if(e?.name==='AbortError')close();check();return reply(400,{state:'invalid'});}
    const token=cookie(request.headers.get('cookie'));if(!token)return reply(401,{state:'sign_in_required'});
    let context;
    try{
     const account=await bounded.readJsonBounded(url+'/auth/v1/user',{method:'GET',credentials:'omit',headers:{apikey:key,Authorization:'Bearer '+token}},{timeoutMs:8000,maxBytes:65536,fetcher:async(endpoint,init)=>{
      check();const r=await fetcher(endpoint,{...init,signal:AbortSignal.any([init.signal,signal])});
      if(signal.aborted){void r.body?.cancel().catch(()=>{});check();}
      if(r.status===401||r.status===403){void r.body?.cancel().catch(()=>{});throw Object.assign(Error(),{authRejected:true});}return r;
     }});check();context=Object.freeze(verifiedAccountContext(token,account,url));
    }catch(e){check();if(e?.authRejected||e?.state==='sign_in_required')return reply(401,{state:'sign_in_required'});close();return reply(503,{state:'unavailable'});}
    check();if(context.expiresAt<=Date.now())return reply(401,{state:'sign_in_required'});
    flight.started=true;const result=await service[kind](context,input,{signal});check();
    if(context.expiresAt<=Date.now()){close();return interrupted();}
    let body;
    if((kind==='read'||kind==='review')&&exact(result,['state','report'])&&result.state==='ready'){
     body={state:'ready',report:reportReviewRecord(result.report)};
     if(body.report.id!==(mutation?input.id:input)||!body.report.contextLoaded||Date.parse(body.report.expiresAt)<=Date.now()||mutation&&body.report.disposition!==input.disposition)throw Error('binding');
    }
    else if(kind==='list'&&exact(result,['state','page'])&&result.state==='ready')body={state:'ready',page:reportReviewPage(result.page,input)};
    else if(exact(result,['state'])&&['unavailable','unknown','busy','sign_in_required','invalid','refused'].includes(result.state))body={...result};
    else throw Error('response');
    return reply(body.state==='sign_in_required'?401:body.state==='invalid'?400:body.state==='refused'?403:['unavailable','busy'].includes(body.state)?503:200,body);
   }catch{close();return interrupted();}
  })();
  // Keep the instance occupied until ignored cancellation has actually settled.
  void work.finally(()=>{if(active===flight)active=null;}).catch(()=>{});
  try{return await Promise.race([work,stopped]);}
  finally{clearTimeout(timer);request.signal.removeEventListener('abort',abort);signal.removeEventListener('abort',onAbort);}
 }
 return Object.freeze({handle,close});
}
