// Explicit preview lifetime only. No route, environment lookup, credential loading,
// access transition or automatic preparation is provided by this factory.
import {performance} from 'node:perf_hooks';
import {allianceCommunityRoute} from './alliance-community-http.mjs';
import {allianceFeedbackRoute} from './alliance-feedback-http.mjs';
import {allianceReportReviewRoute} from './alliance-report-review-http.mjs';

const PREPARE_MS=25000,REQUEST_MS=40000,RESERVE_MS=1000;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const iso=v=>typeof v==='string'&&v.length===24&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const quarantine=()=>({state:'quarantine',access:'closed'});
const drained=()=>({state:'local_work_settled',access:'closed',providerClosureVerified:false});
const drainUnknown=()=>({state:'unknown',access:'closed',providerClosureVerified:false});
const reply=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
const unavailable=()=>reply(503,{state:'unavailable'});
const discard=response=>{try{Promise.resolve(response?.body?.cancel()).catch(()=>{});}catch{}};

// Preserve the application's existing write-uncertainty contract. This response
// is used only after dispatch could have started; denied admission is unavailable.
function interrupted(request,origin){
 if(allianceReportReviewRoute(request,origin)||allianceFeedbackRoute(request,origin)||allianceCommunityRoute(request,origin))return reply(request.signal.aborted?408:503,{state:request.method==='POST'?'unknown':'unavailable'});
 if(request.method==='DELETE')return reply(200,{state:'unknown'});
 return reply(request.signal.aborted?408:503,{error:{code:'profile_unavailable',message:'The member service could not confirm this request.'},...(request.method==='POST'?{mutation:'unknown'}:{})});
}

export function createFiniteAlliancePreviewHost(options={}){
 if(options.enabled===undefined||options.enabled===false)return Object.freeze({prepare:async()=>quarantine(),handle:async()=>reply(404,{state:'unavailable'}),close:async()=>{},drain:async()=>drained()});
 const {origin,expectedInstallation,window,openApplication,now=Date.now,monotonic=()=>performance.now()}=options;
 if(options.enabled!==true||!/^https:\/\/deploy-preview-[1-9][0-9]*--gfof\.netlify\.app$/.test(origin)||!exact(expectedInstallation,['siteId','deployId','context'])||!(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/).test(expectedInstallation.siteId)||!(/^[a-f0-9]{24}$/).test(expectedInstallation.deployId)||expectedInstallation.context!=='deploy-preview'||!exact(window,['notBeforeUtc','notAfterUtc'])||!iso(window.notBeforeUtc)||!iso(window.notAfterUtc)||![openApplication,now,monotonic].every(v=>typeof v==='function'))throw Error('finite_alliance_preview_configuration');
 const start=Date.parse(window.notBeforeUtc),end=Date.parse(window.notAfterUtc);
 if(end-start<=REQUEST_MS+RESERVE_MS||end-start>600000)throw Error('finite_alliance_preview_configuration');
 const expected={...expectedInstallation},flights=new Set();let closed=false,prepared=false,attempted=false,active,bundle,windowTimer,wallLast=-Infinity,monoLast=-Infinity,monoEnd,closing=Promise.resolve(),closeFailed=false;
 const retire=value=>{try{return Promise.resolve(value?.close?.()).catch(()=>{closeFailed=true;});}catch{closeFailed=true;return Promise.resolve();}};
 function close(){if(closed)return closing;closed=true;prepared=false;clearTimeout(windowTimer);active?.abort();closing=retire(bundle);return closing;}
 function remaining(){
  const wall=now(),mono=monotonic();
  if(!Number.isSafeInteger(wall)||!Number.isFinite(mono)||wall<wallLast||mono<monoLast){void close();return -1;}
  wallLast=wall;monoLast=mono;
  if(wall<start)return -1;
  if(monoEnd===undefined){monoEnd=mono+end-wall;windowTimer=setTimeout(()=>void close(),Math.max(1,end-wall));windowTimer.unref?.();}
  return Math.min(end-wall,monoEnd-mono);
 }
 function admitted(context,budget){
  if(closed||active)return false;
  try{
   if(context?.site?.id!==expected.siteId||context?.deploy?.id!==expected.deployId||context?.deploy?.context!==expected.context){void close();return false;}
   if(remaining()<budget+RESERVE_MS)return false;
   return true;
  }catch{void close();return false;}
 }
 async function run(budget,signal,work,fallback,drop=()=>{}){
  if(closed||active||signal?.aborted)return fallback();
  const controller=new AbortController();active=controller;const abort=()=>void close();
  const wallDeadline=wallLast+budget,monotonicDeadline=monoLast+budget;
  let onAbort;signal?.addEventListener('abort',abort,{once:true});
  const stopped=new Promise(resolve=>{onAbort=()=>resolve(fallback());controller.signal.addEventListener('abort',onAbort,{once:true});});
  const timer=setTimeout(abort,budget);
  const check=()=>{if(closed||controller.signal.aborted||remaining()<=0||wallLast>=wallDeadline||monoLast>=monotonicDeadline)throw Error('finite_alliance_preview_unavailable');};
  const job=Promise.resolve().then(()=>{check();return work(controller.signal,check);}).then(value=>{try{check();return value;}catch{drop(value);throw Error('finite_alliance_preview_unavailable');}});
  flights.add(job);
  void job.finally(()=>{flights.delete(job);if(active===controller)active=undefined;}).catch(()=>{});
  try{return await Promise.race([job,stopped]);}catch{void close();return fallback();}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',onAbort);}
 }
 return Object.freeze({
  prepare(checkpoint,context,{signal}={}){
   if(attempted||signal?.aborted||!admitted(context,PREPARE_MS))return Promise.resolve(quarantine());
   attempted=true;
   return run(PREPARE_MS,signal,async(signal,check)=>{
    const value=await openApplication({signal});
    try{check();}catch{await retire(value);throw Error('finite_alliance_preview_unavailable');}
    if(!exact(value,['application','close'])||typeof value.close!=='function'||!['prepare','handle','close'].every(k=>typeof value.application?.[k]==='function')){await retire(value);throw Error('finite_alliance_preview_unavailable');}
    bundle=value;
    const result=await bundle.application.prepare(checkpoint,context,{signal});check();
    if(!exact(result,['state','access'])||result.state!=='prepared'||result.access!=='closed')throw Error('finite_alliance_preview_unavailable');
    prepared=true;return {state:'prepared',access:'closed'};
   },quarantine);
  },
  handle(request,context){
   if(!prepared||!admitted(context,REQUEST_MS))return Promise.resolve(unavailable());
   if(!(request instanceof Request)||new URL(request.url).origin!==origin)return Promise.resolve(reply(403,{state:'forbidden'}));
   return run(REQUEST_MS,request.signal,async(signal,check)=>{
    const response=await bundle.application.handle(new Request(request,{signal}),context);
    try{check();if(!(response instanceof Response))throw Error('finite_alliance_preview_unavailable');return response;}
    catch{discard(response);throw Error('finite_alliance_preview_unavailable');}
   },()=>interrupted(request,origin),discard);
  },close,
  async drain({timeoutMs=45000}={}){
   if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>45000)throw Error('finite_alliance_preview_configuration');
   // Stop admission first, then observe the REAL jobs, not the early responses
   // produced by abort/deadline races. A late construction must retire its own
   // bundle before that job settles. Nothing can start a replacement here.
   close();let timer;
   try{
    const settled=await Promise.race([Promise.allSettled([closing,...flights]).then(()=>true),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),timeoutMs);})]);
    return settled&&!closeFailed&&flights.size===0?drained():drainUnknown();
   }finally{clearTimeout(timer);}
  },
 });
}
