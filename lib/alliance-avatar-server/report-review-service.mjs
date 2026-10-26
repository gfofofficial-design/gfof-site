// Explicit trusted-server composition. Default off; no credentials or owner discovery.
import {isDeepStrictEqual} from 'node:util';
import {reportReviewId,reportReviewCommand} from '../../assets/federation/fed-alliance-report-review-contract.mjs';
import {reportReviewEvidence,reportReviewEvidencePage} from './report-review-evidence.mjs';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const fail=()=>Error('report_review_service_unavailable');
export function createAllianceReportReviewService({enabled=false,reviewerActor,ledger,store,journal,serving,timeoutMs=20000}={}){
 if(typeof enabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>20000)throw fail();
 if(enabled&&(!reportReviewId(reviewerActor)||typeof ledger?.authorizeAccountSession!=='function'||!['listEvidence','readEvidence','reviewEvidence'].every(k=>typeof store?.[k]==='function')||typeof journal?.review!=='function'||typeof serving?.authorizeReportReview!=='function'))throw fail();
 let closed=false,faulted=false,active=null;
 const unavailable=()=>({state:'unavailable'});
 async function run(kind,context,input,{signal}={}){
  const mutation=kind==='review';
  if(!enabled||closed||faulted||signal?.aborted)return unavailable();if(active)return {state:'busy'};
  if(!exact(context,['actorId','sessionId','expiresAt'])||context.actorId!==reviewerActor||!reportReviewId(context.sessionId)||!Number.isSafeInteger(context.expiresAt)||context.expiresAt<=Date.now())return {state:'refused'};
  let value;
  try{
   if(kind==='review')value=reportReviewCommand(input);
   else if(kind==='read'){if(!reportReviewId(input))throw fail();value=input;}
   else if(kind==='list'){if(!exact(input,['after','limit'])||input.after!==null&&!reportReviewId(input.after)||!Number.isInteger(input.limit)||input.limit<1||input.limit>5)throw fail();value={...input};}
   else throw fail();
  }catch{return {state:'invalid'};}
  const ctx={...context},c=new AbortController();active=c;let view,started=false,onAbort;
  const unknown=()=>started&&mutation?{state:'unknown'}:unavailable();
  const abort=()=>{faulted=true;c.abort();},check=()=>{if(closed||faulted||c.signal.aborted||Date.now()>=ctx.expiresAt)throw fail();};
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const stopped=new Promise(resolve=>{onAbort=()=>resolve(unknown());c.signal.addEventListener('abort',onAbort,{once:true});if(c.signal.aborted)onAbort();});
  const timer=setTimeout(abort,Math.min(timeoutMs,ctx.expiresAt-Date.now()));
  const drop=()=>{try{view?.close?.();}catch{}view=undefined;};
  const permit=async()=>{check();if(await serving.authorizeReportReview({signal:c.signal})!==true){faulted=true;throw fail();}check();};
  const account=async()=>{check();const v=await ledger.authorizeAccountSession(ctx.actorId,ctx.sessionId,{signal:c.signal});check();if(!exact(v,['actorId','sessionId'])||v.actorId!==ctx.actorId||v.sessionId!==ctx.sessionId)throw fail();};
  const review=async()=>{drop();await permit();const next=await journal.review({signal:c.signal});if(closed||c.signal.aborted){next?.close?.();throw fail();}view=next;check();if(view?.state!=='verified_evidence'||typeof view.checkProfile!=='function'||typeof view.close!=='function')throw fail();};
  const profiles=rows=>{check();if(view?.state!=='verified_evidence')throw fail();for(const row of rows){if(Date.parse(row.record.expiresAt)<=Date.now())throw fail();for(const profileId of new Set(row.evidenceProfiles))if(!isDeepStrictEqual(view.checkProfile({profileId}),{state:'not_listed'}))throw fail();}};
  const work=(async()=>{
   try{
    await permit();await account();await review();let result,rows;
    if(mutation){
     const before=reportReviewEvidence(await store.readEvidence(ctx.actorId,ctx.sessionId,value.id,{signal:c.signal}));check();
     if(before.record.id!==value.id||!before.record.contextLoaded)throw fail();profiles([before]);await permit();check();started=true;
     result=reportReviewEvidence(await store.reviewEvidence(ctx.actorId,ctx.sessionId,value,{signal:c.signal}));check();
     if(result.record.id!==value.id||result.record.disposition!==value.disposition||!result.record.contextLoaded||!isDeepStrictEqual(result.evidenceProfiles,before.evidenceProfiles))throw fail();rows=[result];
    }else if(kind==='read'){
     result=reportReviewEvidence(await store.readEvidence(ctx.actorId,ctx.sessionId,value,{signal:c.signal}));check();if(result.record.id!==value||!result.record.contextLoaded)throw fail();rows=[result];
    }else{result=reportReviewEvidencePage(await store.listEvidence(ctx.actorId,ctx.sessionId,value,{signal:c.signal}),value);check();rows=result.items;}
    profiles(rows);await review();profiles(rows);await account();await permit();profiles(rows);
    return kind==='list'?{state:'ready',page:{items:rows.map(x=>x.record),next:result.next}}:{state:'ready',report:result.record};
   }catch(e){if(c.signal.aborted||e?.outcome==='unknown'||started&&e?.outcome!=='rejected')faulted=true;return started&&e?.outcome!=='rejected'?{state:'unknown'}:e?.outcome==='rejected'?{state:'refused'}:unavailable();}
   finally{drop();if(active===c)active=null;}
  })();
  try{return await Promise.race([work,stopped]);}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);}
 }
 return Object.freeze({list:(ctx,input={after:null,limit:5},options)=>run('list',ctx,input,options),read:(ctx,id,options)=>run('read',ctx,id,options),review:(ctx,input,options)=>run('review',ctx,input,options),close(){closed=true;active?.abort();}});
}
