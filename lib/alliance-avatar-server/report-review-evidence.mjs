// Server-only envelope. Reporter/target profile IDs never enter the public API.
import {reportReviewRecord,reportReviewPage,reportReviewId} from '../../assets/federation/fed-alliance-report-review-contract.mjs';
const fail=()=>Error('report_review_evidence_unavailable');
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function reportReviewEvidence(v){
 if(!exact(v,['record','evidenceProfiles'])||!Array.isArray(v.evidenceProfiles)||v.evidenceProfiles.length!==2||!v.evidenceProfiles.every(reportReviewId))throw fail();
 const record=reportReviewRecord(v.record);
 if(record.kind==='member'&&record.target!==v.evidenceProfiles[1])throw fail();
 return Object.freeze({record,evidenceProfiles:Object.freeze([...v.evidenceProfiles])});
}
export function reportReviewEvidencePage(v,input){
 if(!exact(v,['items','next'])||!Array.isArray(v.items))throw fail();
 const items=v.items.map(reportReviewEvidence);reportReviewPage({items:items.map(x=>x.record),next:v.next},input);
 return Object.freeze({items:Object.freeze(items),next:v.next});
}
