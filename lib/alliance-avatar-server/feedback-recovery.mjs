// Default-off, read-only composition. Inventory agreement never opens serving.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {performance} from 'node:perf_hooks';
import {createAllianceCommunityRecoveryReview,communityCheckpoint} from './community-recovery.mjs';
import {feedbackInventory} from '../../assets/federation/fed-alliance-feedback-contract.mjs';
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
const ref=v=>typeof v==='string'&&/^[a-z0-9]{20}$/.test(v);
const date=v=>typeof v==='string'&&v.length===24&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v&&Date.parse(v)>=0;
const fail=()=>Error('feedback_recovery_unavailable'),q=reason=>({state:'quarantine',access:'closed',reason});
export function feedbackCheckpoint(v){
 if(!exact(v,['format','memberProjectRef','journalProjectRef','epoch','freezeId','capturedAt','member','journal','community','feedback'])||v.format!==4)throw fail();
 const {feedback,...prior}=v,c=communityCheckpoint({...prior,format:3});
 return {...c,format:4,feedback:feedbackInventory(feedback)};
}
export function feedbackCheckpointSha256(v){return createHash('sha256').update('GF-ALLIANCE-FEEDBACK-CHECKPOINT-V1\0'+JSON.stringify(feedbackCheckpoint(v))).digest('hex');}
export function createAllianceFeedbackRecoveryReview({enabled=false,feedback,timeoutMs=25000,...scope}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>25000)throw fail();
 if(enabled===true){if(typeof feedback?.inventory!=='function')throw fail();const check=createAllianceCommunityRecoveryReview({...scope,enabled:true,timeoutMs});check.close();scope.minimum={...scope.minimum};}
 let closed=false,faulted=false,active,inspector;
 return Object.freeze({
  async inspect(input,{signal}={}){
   if(enabled!==true||closed||faulted)return q('unavailable');if(signal?.aborted)return q('cancelled');if(active)return q('busy');
   let cp,frozenAt,freezeId;
   try{if(!exact(input,['freezeId','frozenAt','checkpoint']))throw fail();cp=feedbackCheckpoint(input.checkpoint);frozenAt=input.frozenAt;freezeId=input.freezeId;if(!uuid(freezeId)||!date(frozenAt)||Date.parse(frozenAt)>Date.now()||Date.parse(cp.capturedAt)>Date.now())throw fail();}catch{return q('invalid_evidence');}
   if(cp.memberProjectRef!==scope.memberProjectRef||cp.journalProjectRef!==scope.journalProjectRef||cp.epoch!==scope.epoch)return q('scope_mismatch');
   if(cp.freezeId!==freezeId)return q('freeze_mismatch');if(Date.parse(cp.capturedAt)<Date.parse(frozenAt))return q('checkpoint_predates_freeze');
   if(cp.journal.sequence<scope.minimum.sequence)return q('floor_regression');
   if(cp.journal.sequence===scope.minimum.sequence&&cp.journal.sha256!==scope.minimum.sha256)return q('floor_fork');
   const c=new AbortController(),abort=()=>{faulted=true;c.abort();};active=c;signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();let onAbort;
   const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});if(c.signal.aborted)onAbort();});
   const timer=setTimeout(abort,timeoutMs),started=performance.now(),check=()=>{if(closed||faulted||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
   const phase=async fn=>{check();const out=await Promise.race([Promise.resolve().then(()=>{check();return fn();}),stopped]);check();return out;};
   const work=(async()=>{try{
    inspector=createAllianceCommunityRecoveryReview({...scope,enabled:true,timeoutMs});
    const before=feedbackInventory(await phase(()=>feedback.inventory({signal:c.signal})));
    // Preserve the complete community/member/journal review and all real
    // table hashes; feedback must agree both before and after that review.
    const {feedback:unused,...original}=cp;
    const result=await phase(()=>inspector.inspect({freezeId,frozenAt,checkpoint:{...original,format:3}},{signal:c.signal}));
    if(result?.state!=='matches_checkpoint'||result.access!=='closed')return result;
    const after=feedbackInventory(await phase(()=>feedback.inventory({signal:c.signal})));
    if(!isDeepStrictEqual(before,after))return q('snapshot_changed');
    if(!isDeepStrictEqual(cp.feedback,before))return q('feedback_mismatch');
    return {state:'matches_checkpoint',access:'closed'};
   }catch{faulted=true;return q('unavailable');}finally{inspector?.close();inspector=undefined;if(active===c)active=undefined;}})();
   try{return await Promise.race([work,stopped.catch(()=>q('unavailable'))]);}
   finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);}
  },
  close(){closed=true;active?.abort();inspector?.close();}
 });
}
