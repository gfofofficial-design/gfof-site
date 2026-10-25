// Trusted-server candidate only. Caller must supply independently verified Auth
// context plus a FEEDBACK-aware startup permission, not the profile-only gate.
import {isDeepStrictEqual} from 'node:util';
import {collaborationSnapshot} from '../../assets/federation/fed-alliance-collaboration-contract.mjs';
import {feedbackId,feedbackCommand,feedbackInternal,feedbackMutation,feedbackPage} from '../../assets/federation/fed-alliance-feedback-contract.mjs';
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const failure=()=>Error('feedback_service_unavailable');
export function createAllianceFeedbackService({enabled=false,ledger,store,community,journal,serving,timeoutMs=20000}={}){
 if(typeof enabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>20000)throw failure();
 if(enabled&&(!['read','list','change'].every(k=>typeof store?.[k]==='function')||typeof community?.read!=='function'||typeof ledger?.authorizeSession!=='function'||typeof journal?.review!=='function'||typeof serving?.authorizeFeedback!=='function'))throw failure();
 let closed=false,faulted=false,active=null;
 const unavailable=()=>({state:'unavailable'});
 async function run(kind,input,context,{signal}={}){
  const mutation=kind==='change',unknown=()=>mutation?{state:'unknown'}:unavailable();
  if(!enabled||closed||faulted||signal?.aborted)return unavailable();if(active)return {state:'busy'};
  if(!exact(context,['actorId','sessionId','expiresAt'])||![context.actorId,context.sessionId].every(feedbackId)||!Number.isSafeInteger(context.expiresAt)||context.expiresAt<=Date.now())return {state:'sign_in_required'};
  let value;
  try{
   if(kind==='change')value=feedbackCommand(input);
   else if(kind==='read'){if(!feedbackId(input))throw failure();value=input;}
   else if(kind==='list'){if(!exact(input,['after','limit'])||input.after!==null&&!feedbackId(input.after)||!Number.isSafeInteger(input.limit)||input.limit<1||input.limit>5)throw failure();value={...input};}
   else throw failure();
  }catch{return {state:'invalid'};}
  const ctx={...context},c=new AbortController();active=c;let onAbort,view,started=false,deadline;
  const abort=()=>{faulted=true;c.abort();};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const check=()=>{if(closed||faulted||c.signal.aborted||Date.now()>=ctx.expiresAt)throw failure();};
  const stopped=new Promise(resolve=>{onAbort=()=>resolve(started?unknown():unavailable());c.signal.addEventListener('abort',onAbort,{once:true});if(c.signal.aborted)onAbort();});
  deadline=setTimeout(abort,Math.min(timeoutMs,ctx.expiresAt-Date.now()));
  const drop=()=>{try{view?.close?.();}catch{}view=undefined;};
  const permit=async()=>{check();if(await serving.authorizeFeedback({signal:c.signal})!==true){faulted=true;throw failure();}check();};
  const review=async()=>{
   drop();await permit();const next=await journal.review({signal:c.signal});
   if(closed||c.signal.aborted){next?.close?.();throw failure();}view=next;check();
   if(view?.state!=='verified_evidence'||typeof view.checkProfile!=='function'||typeof view.close!=='function')throw failure();
  };
  const profiles=ids=>{
   check();if(view?.state!=='verified_evidence')throw failure();
   for(const profileId of new Set(ids))if(!isDeepStrictEqual(view.checkProfile({profileId}),{state:'not_listed'}))throw failure();
  };
  const job=(async()=>{
   try{
    await permit();const bound=await ledger.authorizeSession(ctx.actorId,ctx.sessionId,{signal:c.signal});check();
    if(!exact(bound,['actorId','sessionId','profileId'])||bound.actorId!==ctx.actorId||bound.sessionId!==ctx.sessionId||!feedbackId(bound.profileId))throw failure();
    await review();let result,ids=[bound.profileId];
    if(kind==='change'){
     if(value.action==='report'){
      if(value.kind==='member')ids.push(value.target);
      else if(value.kind==='idea'){
       const before=feedbackInternal(await store.read(ctx.actorId,ctx.sessionId,value.target,{signal:c.signal}));check();ids.push(...before.evidenceProfiles);
      }else{
       const before=collaborationSnapshot(await community.read(ctx.actorId,ctx.sessionId,value.target,{signal:c.signal}));check();
       if(![before.from,before.to].includes(bound.profileId))throw failure();ids.push(before.from,before.to);
      }
     }else if(value.action==='support'&&value.supported){
      const before=feedbackInternal(await store.read(ctx.actorId,ctx.sessionId,value.id,{signal:c.signal}));check();ids.push(...before.evidenceProfiles);
     }
     profiles(ids);await permit();check();started=true;
     result=feedbackMutation(await store.change(ctx.actorId,ctx.sessionId,value,{signal:c.signal}),value);check();
     if(value.action==='post'){
      if(result.record.idea.owner!==bound.profileId)throw failure();ids.push(...result.record.evidenceProfiles);
     }
    }else{
     result=kind==='read'?feedbackInternal(await store.read(ctx.actorId,ctx.sessionId,value,{signal:c.signal})):feedbackPage(await store.list(ctx.actorId,ctx.sessionId,value,{signal:c.signal}),value);check();
     if(kind==='read'&&result.idea.id!==value)throw failure();
     for(const row of kind==='read'?[result]:result.items)ids.push(...row.evidenceProfiles);
     profiles(ids);
    }
    await review();profiles(ids);const after=await ledger.authorizeSession(ctx.actorId,ctx.sessionId,{signal:c.signal});check();
    if(!isDeepStrictEqual(after,bound))throw failure();await permit();profiles(ids);
    if(kind==='change')return value.action==='post'?{state:result.state,idea:result.record.idea}:result;
    return {state:'ready',...(kind==='read'?{idea:result.idea}:{page:{items:result.items.map(row=>row.idea),next:result.next}})};
   }catch(e){if(c.signal.aborted||e?.outcome==='unknown'||started&&e?.outcome!=='rejected')faulted=true;return started&&e?.outcome!=='rejected'?unknown():e?.outcome==='rejected'?{state:'refused'}:unavailable();}
   finally{drop();if(active===c)active=null;}
  })();
  // Keep the latch until the actual work settles even when a transport ignores
  // cancellation. No old completion can reopen this instance or start a retry.
  try{return await Promise.race([job,stopped]);}
  finally{clearTimeout(deadline);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);}
 }
 return Object.freeze({read:(ctx,id,options)=>run('read',id,ctx,options),list:(ctx,input={after:null,limit:5},options)=>run('list',input,ctx,options),change:(ctx,input,options)=>run('change',input,ctx,options),close(){closed=true;currentAbort();}});
 function currentAbort(){active?.abort();}
}
