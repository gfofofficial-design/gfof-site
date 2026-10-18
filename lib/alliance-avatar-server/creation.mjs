// Disabled trusted-server preparation/admission bridge. No route, credential,
// provider request, background work, retry, capacity refund or automatic resume.
import {isDeepStrictEqual} from 'node:util';
import {performance} from 'node:perf_hooks';
import {removalEvents} from './removal.mjs';
import {validateProfileInput,ownProfile} from '../../assets/federation/fed-alliance-profile-contract.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,ZERO='00000000-0000-0000-0000-000000000000';
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=v=>typeof v==='string'&&UUID.test(v);
const fail=(outcome='not_started')=>Object.assign(Error('alliance_creation_unavailable'),{outcome});
export function creationPlan(v){
  if(!exact(v,['kind','profileId','objectId','operationId','version'])||!['profile','image'].includes(v.kind)||typeof v.profileId!=='string'||!UUID.test(v.profileId)||!Number.isSafeInteger(v.version)||v.version<0||
    (v.kind==='profile'?(v.objectId!==null||v.operationId!==null||v.version!==0):(!uuid(v.objectId)||!uuid(v.operationId))))throw fail();
  return {...v};
}
export const creationEvent=v=>{const p=creationPlan(v);return removalEvents({format:1,kind:p.kind,profileId:p.profileId,operationId:p.operationId||p.profileId,version:p.version,objectIds:p.objectId?[p.objectId]:[]})[0];};
export function createAllianceCreation({enabled=false,ledger,journal,serving,timeoutMs=14000}={}){
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>14000)throw fail();
  if(enabled===true&&(!['prepareProfileSession','prepareImageSession','creationStatusSession','finishProfileSession','finishImageSession'].every(k=>typeof ledger?.[k]==='function')||!['admit','admission'].every(k=>typeof journal?.[k]==='function')||typeof serving?.authorize!=='function'))throw fail();
  let active=false,closed=false,faulted=false,controller;
  async function run(context,kind,input,inspect,{signal}={}){
    if(enabled!==true||closed||faulted||active)throw fail();
    if(!exact(context,['actorId','sessionId','expiresAt'])||!uuid(context.actorId)||!uuid(context.sessionId)||!Number.isSafeInteger(context.expiresAt)||context.expiresAt<=Date.now())throw fail();
    let value;try{value=kind==='profile'?(inspect?null:validateProfileInput(input)):{...input};if(kind==='image'&&(!exact(input,['operationId','version'])||!uuid(input.operationId)||!Number.isSafeInteger(input.version)||input.version<0))throw fail();}catch{throw fail();}
    const ctx={...context},c=new AbortController(),abort=()=>c.abort(),start=performance.now();let onAbort,dispatched=false,finished=false;
    active=true;controller=c;signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});});
    const timer=setTimeout(abort,Math.min(timeoutMs,ctx.expiresAt-Date.now()));
    const check=()=>{if(finished||closed||c.signal.aborted||Date.now()>=ctx.expiresAt||performance.now()-start>=timeoutMs)throw fail();};
    const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn();}),stopped]);
    const permit=async()=>{if(await phase(()=>serving.authorize({signal:c.signal}))!==true)throw fail();check();};
    try{
      check();await permit();
      const raw=await phase(()=>inspect?ledger.creationStatusSession(ctx.actorId,ctx.sessionId,kind,kind==='profile'?ZERO:value.operationId,{signal:c.signal}):
        (dispatched=true,kind==='profile'?ledger.prepareProfileSession(ctx.actorId,ctx.sessionId,{signal:c.signal}):ledger.prepareImageSession(ctx.actorId,ctx.sessionId,value.operationId,value.version,{signal:c.signal})));
      check();if(inspect&&raw===null)return {state:'missing'};
      const plan=Object.freeze(creationPlan(raw));if(plan.kind!==kind||kind==='image'&&(plan.operationId!==value.operationId||plan.version!==value.version))throw fail();
      const event=Object.freeze(creationEvent(plan));if(value)Object.freeze(value);await permit();
      const proof=await phase(()=>inspect?journal.admission(event,{signal:c.signal}):journal.admit(event,{signal:c.signal}));check();
      if(inspect){
        if(exact(proof,['state'])&&['missing','removed'].includes(proof.state))return {state:proof.state};
        if(!exact(proof,['state','event'])||proof.state!=='admitted'||!isDeepStrictEqual(proof.event,event))throw fail();
        await permit();return {state:'admitted',plan};
      }
      if(!exact(proof,['state','event'])||proof.state!=='admitted'||!isDeepStrictEqual(proof.event,event))throw fail('rejected');
      await permit();
      const saved=await phase(()=>kind==='profile'?ledger.finishProfileSession(ctx.actorId,ctx.sessionId,plan,value,event,{signal:c.signal}):ledger.finishImageSession(ctx.actorId,ctx.sessionId,plan,event,{signal:c.signal}));check();
      await permit();
      if(kind==='profile'){const p=ownProfile(saved);if(!p||p.id!==plan.profileId)throw fail();return p;}
      if(!exact(saved,saved?.dispatch?['dispatch','state','objectId']:['dispatch','state','objectId','version'])||typeof saved.dispatch!=='boolean'||saved.objectId!==plan.objectId||!['reserved','uploading','committed','stale','cancelled'].includes(saved.state)||saved.dispatch&&saved.state!=='reserved'||!saved.dispatch&&saved.version!==null&&(!Number.isSafeInteger(saved.version)||saved.version<0))throw fail();
      return {...saved};
    }catch(e){if(dispatched)faulted=true;throw fail(dispatched?'unknown':e?.outcome==='rejected'?'rejected':'not_started');}
    finally{finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();active=false;controller=undefined;}
  }
  return Object.freeze({profile:(context,input,options)=>run(context,'profile',input,false,options),reserve:(context,operationId,version,options)=>run(context,'image',{operationId,version},false,options),
    inspect:(context,kind,input,options)=>{if(!['profile','image'].includes(kind))throw fail();return run(context,kind,input,true,options);},close(){closed=true;controller?.abort();}});
}
