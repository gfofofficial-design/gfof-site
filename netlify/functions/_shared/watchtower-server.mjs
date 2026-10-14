import {createHash,timingSafeEqual} from 'node:crypto';
import {inspectWatchtowerPilot} from '../../../scripts/check-watchtower-pilot.mjs';
import {createWatchtowerDatabaseBindings,watchtowerPgConfigs} from './watchtower-database.mjs';
import {createWatchtowerPilotRuntime} from './watchtower-pilot-runtime.mjs';
import pilot from '../../../config/watchtower-pilot.json' with {type:'json'};
import {WATCHTOWER_CA,WATCHTOWER_CA_SHA256} from './watchtower-public-ca.mjs';
import {WATCHTOWER_SOURCE_SHA256} from './watchtower-source-revision.mjs';

const PATHS={intake:'/api/watchtower/intake',worker:'/api/watchtower/process-one'};
const REQUIRED=['creditHeadroomChecked','automaticPurchasesDisabled','providerPauseReviewed','storageMigrationApproved','storageReady','limitsApproved','mainnetTransportReviewed'];
const SERVER_REQUIRED=['credentialProofReviewed','otherDatabaseScopeReviewed','providerWebhookCostsReviewed'];
const digest=value=>createHash('sha256').update(value).digest();
const bearer=value=>typeof value==='string'&&/^Bearer [-A-Za-z0-9_]{43,128}$/.test(value);
const reply=(status,code)=>new Response(JSON.stringify({schema:1,code}),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(Date.parse(value)).toISOString()===value;

// Deployment-owned declarations, not evidence of billing, provenance or privileges.
// An activation is limited to one reviewed source version on one site's branch deploys.
function activation(value,context,clock){
 if(typeof value!=='string'||value.length>4096)throw Error();
 const record=JSON.parse(value);
 if(!record||Array.isArray(record)||Object.keys(record).sort().join(',')!=='endsAtUtc,schema,siteId,sourceSha256,startsAtUtc,startup'||record.schema!==1||
  record.sourceSha256!==WATCHTOWER_SOURCE_SHA256||typeof record.siteId!=='string'||!/^[-a-f0-9]{36}$/.test(record.siteId)||
  !iso(record.startsAtUtc)||!iso(record.endsAtUtc)||context?.site?.id!==record.siteId||context?.deploy?.context!=='branch-deploy'||
  context.deploy.published!==false||typeof context.deploy.id!=='string'||!/^[a-f0-9]{24}$/.test(context.deploy.id)||
  record.startup?.additionalProviderSpendUsd!==0||![...REQUIRED,...SERVER_REQUIRED].every(key=>record.startup?.[key]===true))throw Error();
 const start=Date.parse(record.startsAtUtc),end=Date.parse(record.endsAtUtc);
 if(end<=start||end-start>600000||clock<start||clock>=end)throw Error();
 return {end,startup:record.startup};
}

// The production wrappers read only Netlify's server environment. Dependencies are
// injectable for offline tests; HTTP callers cannot supply configuration or SQL.
export function createWatchtowerServerHandler({kind,readEnv=name=>globalThis.Netlify?.env.get(name),now=Date.now,
 bindingsFactory=createWatchtowerDatabaseBindings,runtimeFactory=createWatchtowerPilotRuntime,fetcher=fetch}={}){
 if(!Object.hasOwn(PATHS,kind)||[readEnv,now,bindingsFactory,runtimeFactory,fetcher].some(value=>typeof value!=='function'))throw Error('Invalid Watchtower server configuration');
 return async(request,context)=>{
  let bindings,controller,timer,abort;
  try{
   // A closed deployment reads no credentials and constructs no database pools.
   if(readEnv('WATCHTOWER_PILOT_ENABLED')!=='true')return reply(503,'WATCHTOWER_DISABLED');
   const url=new URL(request.url);
   if(url.pathname!==PATHS[kind]||url.search)return reply(400,'INVALID_REQUEST');
   if(request.method!=='POST')return reply(405,'METHOD_NOT_ALLOWED');
   const intakeAuth=readEnv('WATCHTOWER_INTAKE_AUTHORIZATION'),workerAuth=readEnv('WATCHTOWER_WORKER_AUTHORIZATION');
   if(!bearer(intakeAuth)||!bearer(workerAuth)||intakeAuth===workerAuth)return reply(503,'WATCHTOWER_NOT_READY');
   const supplied=request.headers.get('authorization'),expected=kind==='intake'?intakeAuth:workerAuth;
   if(typeof supplied!=='string'||supplied.length>256||!timingSafeEqual(digest(expected),digest(supplied)))return reply(403,'AUTH_FAILED');
   // The worker trigger cannot submit a candidate, account, limit or settings.
   if(kind==='worker'&&(request.body!==null||!['0',null].includes(request.headers.get('content-length'))||request.headers.has('content-encoding')))return reply(400,'INVALID_REQUEST');
   const clock=now();if(!Number.isSafeInteger(clock)||clock<0)throw Error();
   const approved=activation(readEnv('WATCHTOWER_ACTIVATION'),context,clock);
   inspectWatchtowerPilot(pilot);
   if(request.signal.aborted)return reply(503,'REQUEST_STOPPED');
   const connection={projectRef:readEnv('WATCHTOWER_SUPABASE_PROJECT_REF'),host:readEnv('WATCHTOWER_SUPABASE_POOLER_HOST'),
    ca:WATCHTOWER_CA,caSha256:WATCHTOWER_CA_SHA256,intakePassword:readEnv('WATCHTOWER_INTAKE_DATABASE_PASSWORD'),workerPassword:readEnv('WATCHTOWER_WORKER_DATABASE_PASSWORD')};
   watchtowerPgConfigs(connection);
   const apiKey=readEnv('WATCHTOWER_HELIUS_API_KEY');
   if(typeof apiKey!=='string'||apiKey.length<16||apiKey.length>512||!/^[!-~]+$/.test(apiKey))throw Error();
   controller=new AbortController();abort=()=>controller.abort();request.signal.addEventListener('abort',abort,{once:true});
   const live=()=>{const current=now();if(controller.signal.aborted||!Number.isSafeInteger(current)||current<clock||current>=approved.end){controller.abort();throw Error();}};
   timer=setTimeout(abort,Math.min(kind==='intake'?750:10000,approved.end-clock));
   live();bindings=bindingsFactory({enabled:true,connection});
   const guard=query=>async(sql,args,options)=>{live();return query(sql,args,options);};
   const runtime=runtimeFactory({enabled:true,config:pilot,startup:approved.startup,apiKey,authorizationValue:intakeAuth,
    intakeQuery:guard(bindings.intakeQuery),workerQuery:guard(bindings.workerQuery),fetcher:async(...args)=>{live();return fetcher(...args);}});
   if(kind==='intake'){
    const result=await runtime.receive(request,{signal:controller.signal});
    // Never acknowledge a write after the approved window or request expired.
    live();return new Response(result.body,{status:result.status,headers:reply(200,'').headers});
   }
   const result=await runtime.processOne({signal:controller.signal});live();
   if(result?.emitsFinding!==false)throw Error();
   const codes={no_candidate:[200,'NO_CANDIDATE'],corroboration_saved:[200,'CORROBORATION_SAVED'],lease_or_completion_not_accepted:[409,'COMPLETION_NOT_ACCEPTED'],verification_not_completed:[503,'VERIFICATION_NOT_COMPLETED'],worker_failed:[503,'WORKER_NOT_COMPLETED']};
   if(!Object.hasOwn(codes,result.reason))throw Error();
   return reply(...codes[result.reason]);
  }catch{return reply(503,'WATCHTOWER_NOT_COMPLETED');}
  finally{clearTimeout(timer);if(abort)request.signal.removeEventListener('abort',abort);controller?.abort();if(bindings)try{await bindings.close();}catch{}}
 };
}
