// Read-only default-off review. Expiry reconciliation is a separate closed
// maintenance operation and must result in a NEW checkpoint, never reuse trust.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {performance} from 'node:perf_hooks';
import {feedbackCheckpoint,createAllianceFeedbackRecoveryReview} from './feedback-recovery.mjs';
import {reportReviewInventory} from '../../assets/federation/fed-alliance-report-review-contract.mjs';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const fail=()=>Error('report_review_recovery_unavailable'),q=reason=>({state:'quarantine',access:'closed',reason});
export function reportReviewCheckpoint(v){
 if(!exact(v,['format','memberProjectRef','journalProjectRef','epoch','freezeId','capturedAt','member','journal','community','feedback','reportReview'])||v.format!==5)throw fail();
 const {reportReview,...prior}=v,base=feedbackCheckpoint({...prior,format:4}),inventory=reportReviewInventory(reportReview);
 if(inventory.expiredReports!==0)throw fail();
 return {...base,format:5,reportReview:inventory};
}
export function reportReviewCheckpointSha256(v){return createHash('sha256').update('GF-ALLIANCE-REPORT-REVIEW-CHECKPOINT-V1\0'+JSON.stringify(reportReviewCheckpoint(v))).digest('hex');}
export function createAllianceReportReviewRecoveryReview({enabled=false,reportReview,timeoutMs=25000,...scope}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>25000)throw fail();
 if(enabled===true){if(typeof reportReview?.inventory!=='function')throw fail();const prior=createAllianceFeedbackRecoveryReview({...scope,enabled:true,timeoutMs});prior.close();scope.minimum={...scope.minimum};}
 let closed=false,faulted=false,active,inspector;
 return Object.freeze({
  async inspect(input,{signal}={}){
   if(enabled!==true||closed||faulted||signal?.aborted)return q('unavailable');if(active)return q('busy');
   let cp;
   try{if(!exact(input,['freezeId','frozenAt','checkpoint']))throw fail();cp=reportReviewCheckpoint(input.checkpoint);}catch{return q('invalid_evidence');}
   // Delegate scope/freeze/minimum validation before any report-review read.
   if(cp.memberProjectRef!==scope.memberProjectRef||cp.journalProjectRef!==scope.journalProjectRef||cp.epoch!==scope.epoch||cp.freezeId!==input.freezeId||typeof input.frozenAt!=='string'||input.frozenAt.length!==24||!Number.isFinite(Date.parse(input.frozenAt))||new Date(input.frozenAt).toISOString()!==input.frozenAt||Date.parse(input.frozenAt)>Date.now()||Date.parse(cp.capturedAt)<Date.parse(input.frozenAt)||Date.parse(cp.capturedAt)>Date.now())return q('scope_or_freeze_mismatch');
   if(cp.journal.sequence<scope.minimum.sequence||cp.journal.sequence===scope.minimum.sequence&&cp.journal.sha256!==scope.minimum.sha256)return q('floor_regression_or_fork');
   const c=new AbortController(),abort=()=>{faulted=true;c.abort();};active=c;signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
   const began=performance.now();let onAbort;
   const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});if(c.signal.aborted)onAbort();});
   const timer=setTimeout(abort,timeoutMs),check=()=>{if(closed||faulted||c.signal.aborted||performance.now()-began>=timeoutMs)throw fail();};
   const phase=async fn=>{check();const out=await Promise.race([Promise.resolve().then(()=>{check();return fn();}),stopped]);check();return out;};
   const work=(async()=>{try{
    const before=reportReviewInventory(await phase(()=>reportReview.inventory({signal:c.signal})));
    if(before.expiredReports!==0)return q('expiry_reconciliation_required');
    const {reportReview:unused,...prior}=cp;
    inspector=createAllianceFeedbackRecoveryReview({...scope,enabled:true,timeoutMs});
    const outcome=await phase(()=>inspector.inspect({...input,checkpoint:{...prior,format:4}},{signal:c.signal}));
    if(outcome?.state!=='matches_checkpoint'||outcome.access!=='closed')return outcome;
    const after=reportReviewInventory(await phase(()=>reportReview.inventory({signal:c.signal})));
    if(after.expiredReports!==0)return q('expiry_reconciliation_required');
    if(!isDeepStrictEqual(before,after))return q('snapshot_changed');
    if(!isDeepStrictEqual(cp.reportReview,before))return q('report_review_mismatch');
    return {state:'matches_checkpoint',access:'closed'};
   }catch{faulted=true;return q('unavailable');}finally{inspector?.close();inspector=undefined;if(active===c)active=undefined;}})();
   try{return await Promise.race([work,stopped.catch(()=>q('unavailable'))]);}
   finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);}
  },close(){closed=true;active?.abort();inspector?.close();},
 });
}
