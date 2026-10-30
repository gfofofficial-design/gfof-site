// Public shapes only. No owner binding, connection, storage or automatic request.
const fail=()=>Error('report_review_invalid');
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export const reportReviewId=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v)&&v!=='00000000-0000-0000-0000-000000000000';
const date=v=>typeof v==='string'&&v.length===24&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const dispositions=['unreviewed','no_action','owner_follow_up'];
export function reportReviewRecord(v){
 if(!exact(v,['id','kind','target','contextState','contextLoaded','targetTitle','targetSummary','createdAt','reviewedAt','disposition','expiresAt'])||!reportReviewId(v.id)||!reportReviewId(v.target)
 ||!['member','idea','challenge'].includes(v.kind)||!['available','removed','unavailable'].includes(v.contextState)
 ||!date(v.createdAt)||!date(v.expiresAt)||!dispositions.includes(v.disposition)
 ||(v.disposition==='unreviewed'?v.reviewedAt!==null:!date(v.reviewedAt)||Date.parse(v.reviewedAt)<Date.parse(v.createdAt)))throw fail();
 if(typeof v.contextLoaded!=='boolean')throw fail();
 const hasContext=v.contextLoaded&&v.contextState==='available'&&v.kind!=='challenge';
 if(hasContext?(typeof v.targetTitle!=='string'||v.targetTitle.length<2||v.targetTitle.length>80||typeof v.targetSummary!=='string'||v.targetSummary.length<10||v.targetSummary.length>600):(v.targetTitle!==null||v.targetSummary!==null))throw fail();
 const expiry=Date.parse(v.reviewedAt??v.createdAt)+(v.reviewedAt===null?90:30)*86400000;
 if(Date.parse(v.expiresAt)!==expiry)throw fail();
 return Object.freeze({...v});
}
export function reportReviewPage(v,{after=null,limit=5}={}){
 if(after!==null&&!reportReviewId(after)||!Number.isInteger(limit)||limit<1||limit>5||!exact(v,['items','next'])||!Array.isArray(v.items)||v.items.length>limit)throw fail();
 const items=v.items.map(reportReviewRecord);
 if(items.some(r=>r.contextLoaded))throw fail();
 for(let i=0;i<items.length;i++)if((i?items[i-1].id:after)!==null&&items[i].id<=(i?items[i-1].id:after))throw fail();
 if(v.next!==null&&(!reportReviewId(v.next)||items.length!==limit||v.next!==items.at(-1)?.id))throw fail();
 return Object.freeze({items:Object.freeze(items),next:v.next});
}
export function reportReviewCommand(v){
 if(!exact(v,['id','expected','disposition'])||!reportReviewId(v.id)||!dispositions.includes(v.expected)||!dispositions.slice(1).includes(v.disposition))throw fail();
 return Object.freeze({...v});
}
export function reportReviewInventory(v){
 if(!exact(v,['format','closed','expiredReports','tables'])||v.format!==1||v.closed!==true||!Number.isSafeInteger(v.expiredReports)||v.expiredReports<0||v.expiredReports>256||!Array.isArray(v.tables)||v.tables.length!==2)throw fail();
 const tables=v.tables.map((t,i)=>{
  if(!exact(t,['table','rows','sha256'])||t.table!==['alliance_report_review.control','alliance_report_review.reviews'][i]
  ||!Number.isSafeInteger(t.rows)||t.rows<0||t.rows>(i===0?1:256)||!/^([0-9a-f]{64})$/.test(t.sha256))throw fail();return Object.freeze({...t});
 });
 if(tables[0].rows!==1)throw fail();return Object.freeze({format:1,closed:true,expiredReports:v.expiredReports,tables:Object.freeze(tables)});
}
