// Explicit application composition. No default handler, connection/secret lookup,
// deployment, authority transition, schema installation or automatic startup.
import {AsyncLocalStorage} from 'node:async_hooks';
import {isDeepStrictEqual} from 'node:util';
import {createAllianceMemberHttp,allianceMemberRoute} from './alliance-member-http.mjs';
import {createAvatarDeletionJournal} from './alliance-avatar-server/deletion-journal.mjs';
import {createAllianceStartupGate,createAllianceCommunityStartupGate,createAllianceFeedbackStartupGate} from './alliance-avatar-server/startup-gate.mjs';
import {createAllianceCommunityHttp,allianceCommunityRoute} from './alliance-community-http.mjs';
import {createAllianceCommunityService} from './alliance-avatar-server/community-service.mjs';
import {createAllianceFeedbackHttp,allianceFeedbackRoute} from './alliance-feedback-http.mjs';
import {createAllianceFeedbackService} from './alliance-avatar-server/feedback-service.mjs';
import {createAllianceCreation} from './alliance-avatar-server/creation.mjs';
import {createAllianceAnchoredRemoval} from './alliance-avatar-server/anchored-removal.mjs';
import {controlPoint} from './alliance-avatar-server/control-policy.mjs';
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const ref=v=>typeof v==='string'&&/^[a-z0-9]{20}$/.test(v);
const fail=()=>Error('alliance_member_application_configuration');
const quarantine=()=>({state:'quarantine',access:'closed'});
const response=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
function installation(v){
  if(!exact(v,['siteId','deployId','context'])||!(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/).test(v.siteId)||!(/^[a-f0-9]{24}$/).test(v.deployId)||!['deploy-preview','production'].includes(v.context))throw fail();
  return {...v};
}
export function createAllianceMemberApplication(options={}){return application(options,false);}
export function createAllianceCommunityApplication(options={}){return application(options,true);}
export function createAllianceFeedbackApplication(options={}){return application(options,'feedback');}
function application({enabled=false,origin,url,key,scope,minimum,minimumRevision,
  startupVerificationKey,journalVerificationKey,expectedInstallation,ledger,journalStore,anchorStore,
  readDecision,readWitness,signingRuntime,processor,storage,communityStore,feedbackStore,fetcher=globalThis.fetch}={},withCommunity){
  if(typeof enabled!=='boolean')throw fail();
  const local=new AsyncLocalStorage(),owned=[];let closed=false,active=null,prepared=false,expected,startup,http,communityHttp,feedbackHttp,permission;
  const close=()=>{closed=true;prepared=false;for(const v of owned)v.close();active?.abort();};
  if(enabled){
    try{
      if(!exact(scope,['memberProjectRef','journalProjectRef','epoch'])||!ref(scope.memberProjectRef)||!ref(scope.journalProjectRef)||scope.memberProjectRef===scope.journalProjectRef||
        url!==`https://${scope.memberProjectRef}.supabase.co`||typeof readDecision!=='function'||typeof readWitness!=='function'||typeof signingRuntime?.run!=='function'||
        !['tip','records','append','admit','admission','recoveryInventory'].every(k=>typeof journalStore?.[k]==='function'))throw fail();
      expected=installation(expectedInstallation);
      if(expected.context==='production'?origin!=='https://galacticfederation.co':!/^https:\/\/deploy-preview-[1-9][0-9]*--gfof\.netlify\.app$/.test(origin))throw fail();
      const bound={...scope},floor=controlPoint(minimum);
      const signed=async work=>{
        const current=local.getStore();if(!current||closed||current.controller.signal.aborted)throw fail();
        // Scope one remote signed exchange, not the entire member operation:
        // the signing adapter has its own shorter exchange deadline.
        return signingRuntime.run(current.context,({signal})=>work(AbortSignal.any([current.controller.signal,signal])),{signal:current.controller.signal});
      };
      const review=createAvatarDeletionJournal({enabled:true,projectRef:bound.memberProjectRef,epoch:bound.epoch,verificationKey:journalVerificationKey,minimum:floor,
        readWitness:input=>signed(signal=>readWitness({...input,signal:AbortSignal.any([input.signal,signal])})),
        readRecords:async({through,sha256,signal})=>{
          const rows=await journalStore.records({sequence:through,sha256},{signal});
          const bytes=Buffer.from(JSON.stringify(rows));if(bytes.byteLength>262144)throw fail();return bytes;
        }});owned.push(review);
      const journal={review:options=>review.review(options)};
      for(const name of ['tip','records','append','admit','admission','recoveryInventory'])journal[name]=(...args)=>journalStore[name](...args);
      Object.freeze(journal);
      startup=(withCommunity==='feedback'?createAllianceFeedbackStartupGate:withCommunity?createAllianceCommunityStartupGate:createAllianceStartupGate)({enabled:true,...bound,verificationKey:startupVerificationKey,minimumRevision,minimum:floor,community:communityStore,feedback:feedbackStore,
        readDecision:(request,{signal})=>signed(runtimeSignal=>readDecision(request,{signal:AbortSignal.any([signal,runtimeSignal])})),ledger,journal});owned.push(startup);
      // Explicitly map one combined current permission to profile operations.
      // A profile-only gate can never grant community access.
      permission=withCommunity==='feedback'?Object.freeze({authorize:options=>startup.authorizeFeedback(options),authorizeCommunity:options=>startup.authorizeFeedback(options),authorizeFeedback:options=>startup.authorizeFeedback(options)}):withCommunity?Object.freeze({authorize:options=>startup.authorizeCommunity(options),authorizeCommunity:options=>startup.authorizeCommunity(options)}):startup;
      if(withCommunity){
        const service=createAllianceCommunityService({enabled:true,ledger,store:communityStore,journal,serving:permission});owned.push(service);
        communityHttp=createAllianceCommunityHttp({enabled:true,origin,url,key,service,fetcher});owned.push(communityHttp);
      }
      if(withCommunity==='feedback'){
        const service=createAllianceFeedbackService({enabled:true,ledger,store:feedbackStore,community:communityStore,journal,serving:permission});owned.push(service);
        feedbackHttp=createAllianceFeedbackHttp({enabled:true,origin,url,key,service,fetcher});owned.push(feedbackHttp);
      }
      const creation=createAllianceCreation({enabled:true,profileRevisions:true,ledger,journal,serving:permission});owned.push(creation);
      const removal=createAllianceAnchoredRemoval({enabled:true,profileBinding:true,projectRef:bound.memberProjectRef,journalProjectRef:bound.journalProjectRef,epoch:bound.epoch,minimum:floor,ledger,journal,anchorStore,serving:permission});owned.push(removal);
      http=createAllianceMemberHttp({enabled:true,origin,url,key,ledger,journal,serving:permission,creation,removal,processor,storage,fetcher});owned.push(http);
    }catch{close();throw fail();}
  }
  const contextValid=context=>{
    try{return isDeepStrictEqual(installation({siteId:context?.site?.id,deployId:context?.deploy?.id,context:context?.deploy?.context}),expected);}catch{return false;}
  };
  async function run(context,signal,ms,work,fallback){
    if(!enabled||closed||active||signal?.aborted)return fallback();
    if(!contextValid(context)){close();return fallback();}
    const controller=new AbortController();active=controller;
    const abort=()=>close();let onAbort;
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    const stopped=new Promise(resolve=>{onAbort=()=>resolve(fallback());controller.signal.addEventListener('abort',onAbort,{once:true});if(controller.signal.aborted)onAbort();});
    const timer=setTimeout(close,ms);
    const job=local.run({context,controller},()=>Promise.resolve().then(()=>controller.signal.aborted?fallback():work(controller.signal)));
    // No replacement work enters this instance while a late operation settles.
    void job.finally(()=>{if(active===controller)active=null;}).catch(()=>{});
    try{const value=await Promise.race([job,stopped]);return controller.signal.aborted?fallback():value;}
    catch{close();return fallback();}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',onAbort);}
  }
  return Object.freeze({
    prepare(checkpoint,context,{signal}={}){
      if(prepared)return Promise.resolve(quarantine());
      return run(context,signal,25000,async signal=>{
        const value=await startup.prepare(checkpoint,{signal});
        if(value.state!=='prepared'||value.access!=='closed'){close();return quarantine();}
        prepared=true;return {state:'prepared',access:'closed'};
      },quarantine);
    },
    handle(request,context){
      if(!enabled)return Promise.resolve(response(404,{state:'unavailable'}));
      if(!prepared||closed)return Promise.resolve(response(503,{state:'unavailable'}));
      const feedbackKind=withCommunity==='feedback'&&allianceFeedbackRoute(request,origin);
      const communityKind=withCommunity&&allianceCommunityRoute(request,origin);
      if(!feedbackKind&&!communityKind&&!allianceMemberRoute(request,origin))return Promise.resolve(response(404,{state:'unavailable'}));
      const from=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
      if(request.headers.has('authorization')||from!==null&&from!==origin||site!==null&&site!=='same-origin'||from!==origin&&site!=='same-origin')return Promise.resolve(response(403,{state:'forbidden'}));
      const ended=()=>feedbackKind||communityKind?response(request.signal.aborted?408:503,{state:request.method==='POST'?'unknown':'unavailable'}):request.method==='DELETE'?response(200,{state:'unknown'}):response(request.signal.aborted?408:503,{error:{code:'profile_unavailable',message:'The member service could not confirm this request.'},...(request.method==='POST'?{mutation:'unknown'}:{})});
      return run(context,request.signal,40000,async signal=>{
        if(await permission.authorize({signal})!==true){close();return response(503,{state:'unavailable'});}
        return (feedbackKind?feedbackHttp:communityKind?communityHttp:http).handle(new Request(request,{signal}));
      },ended);
    },close,
  });
}
