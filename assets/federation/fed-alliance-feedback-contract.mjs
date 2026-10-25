// Shared bounded records only. No Auth, persistence, transport or activation.
import {ideaFields} from './fed-alliance-community-core.mjs';
import {collaborationId} from './fed-alliance-collaboration-contract.mjs';
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const fail=()=>Error('feedback_invalid');
const date=v=>typeof v==='string'&&v.length===24&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
export const feedbackId=collaborationId;
export function feedbackCommand(v){
 if(!feedbackId(v?.id))throw fail();
 if(v.action==='post'){
  if(!exact(v,['action','id','title','category','detail']))throw fail();
  const fields=ideaFields(v);if(fields.title!==v.title||fields.detail!==v.detail)throw fail();
  return {action:'post',id:v.id,...fields};
 }
 if(v.action==='remove'&&exact(v,['action','id']))return {...v};
 if(v.action==='support'&&exact(v,['action','id','supported'])&&typeof v.supported==='boolean')return {...v};
 if(v.action==='report'&&exact(v,['action','id','kind','target'])&&['member','idea','challenge'].includes(v.kind)&&feedbackId(v.target))return {...v};
 throw fail();
}
export function feedbackIdea(v){
 if(!exact(v,['id','owner','title','category','detail','createdAt','supportCount','supported'])||![v.id,v.owner].every(feedbackId)||!date(v.createdAt)||!Number.isSafeInteger(v.supportCount)||v.supportCount<0||v.supportCount>512||typeof v.supported!=='boolean'||v.supported&&v.supportCount<1)throw fail();
 const fields=ideaFields(v);if(fields.title!==v.title||fields.detail!==v.detail)throw fail();
 return {id:v.id,owner:v.owner,...fields,createdAt:v.createdAt,supportCount:v.supportCount,supported:v.supported};
}
export function feedbackInternal(v){
 if(!exact(v,['idea','evidenceProfiles'])||!Array.isArray(v.evidenceProfiles)||v.evidenceProfiles.length<1||v.evidenceProfiles.length>513||!v.evidenceProfiles.every(feedbackId)||new Set(v.evidenceProfiles).size!==v.evidenceProfiles.length)throw fail();
 const idea=feedbackIdea(v.idea);
 if(v.evidenceProfiles[0]!==idea.owner||v.evidenceProfiles.length-1<idea.supportCount)throw fail();
 return {idea,evidenceProfiles:[...v.evidenceProfiles]};
}
export function feedbackPage(v,{after=null,limit=5}={}){
 if(after!==null&&!feedbackId(after)||!Number.isSafeInteger(limit)||limit<1||limit>5||!exact(v,['items','next'])||!Array.isArray(v.items)||v.items.length>limit||v.next!==null&&!feedbackId(v.next))throw fail();
 const items=v.items.map(feedbackInternal);
 for(let i=0;i<items.length;i++)if((i?items[i-1].idea.id:after)!==null&&items[i].idea.id<=(i?items[i-1].idea.id:after))throw fail();
 if(v.next!==null&&(items.length!==limit||v.next!==items.at(-1).idea.id))throw fail();
 return {items,next:v.next};
}
export function feedbackMutation(v,command){
 const c=feedbackCommand(command);
 if(c.action==='post'&&exact(v,['state','record'])&&['applied','replayed'].includes(v.state)){
  const record=feedbackInternal(v.record);if(record.idea.id!==c.id||!['title','category','detail'].every(k=>record.idea[k]===c[k]))throw fail();return {state:v.state,record};
 }
 if(c.action==='remove'&&exact(v,['state','id'])&&v.state==='removed'&&v.id===c.id)return {...v};
 if(c.action==='support'&&exact(v,['state','id','supported'])&&v.state==='set'&&v.id===c.id&&v.supported===c.supported)return {...v};
 if(c.action==='report'&&exact(v,['state','id','kind','target','removed'])&&v.state==='recorded'&&v.id===c.id&&v.kind===c.kind&&v.target===c.target&&v.removed===false)return {...v};
 throw fail();
}
// Browser boundary deliberately cannot carry internal supporter/deletion IDs.
export function feedbackPublicPage(v,{after=null,limit=5}={}){
 if(!exact(v,['items','next'])||!Array.isArray(v.items))throw fail();
 // Public pagination uses the same order/bounds without fabricating evidence.
 if(after!==null&&!feedbackId(after)||!Number.isSafeInteger(limit)||limit<1||limit>5||v.items.length>limit||v.next!==null&&!feedbackId(v.next))throw fail();
 const items=v.items.map(feedbackIdea);
 for(let i=0;i<items.length;i++)if((i?items[i-1].id:after)!==null&&items[i].id<=(i?items[i-1].id:after))throw fail();
 if(v.next!==null&&(items.length!==limit||v.next!==items.at(-1).id))throw fail();
 return {items,next:v.next};
}
export function feedbackPublicMutation(v,command){
 const c=feedbackCommand(command);
 if(c.action==='post'){
  if(!exact(v,['state','idea'])||!['applied','replayed'].includes(v.state))throw fail();
  const idea=feedbackIdea(v.idea);if(idea.id!==c.id||!['title','category','detail'].every(k=>idea[k]===c[k]))throw fail();return {state:v.state,idea};
 }
 return feedbackMutation(v,c);
}
export function feedbackInventory(v){
 const tables=['control','ideas','supports','reports'],caps=[1,128,512,256];
 if(!exact(v,['format','domain','closed','tables'])||v.format!==1||v.domain!=='feedback'||v.closed!==true||!Array.isArray(v.tables)||v.tables.length!==4)throw fail();
 return {format:1,domain:'feedback',closed:true,tables:v.tables.map((t,i)=>{
  if(!exact(t,['table','rows','sha256'])||t.table!=='alliance_feedback.'+tables[i]||!Number.isSafeInteger(t.rows)||t.rows<0||t.rows>caps[i]||i===0&&t.rows!==1||typeof t.sha256!=='string'||!/^[a-f0-9]{64}$/.test(t.sha256))throw fail();return {table:t.table,rows:t.rows,sha256:t.sha256};
 })};
}
