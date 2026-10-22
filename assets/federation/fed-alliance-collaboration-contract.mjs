// Shared DTOs only. No identity, storage, network, runtime or publication.
import {challengeFields} from './fed-alliance-community-core.mjs';
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const fail=()=>Error('collaboration_invalid');
export const collaborationId=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v)&&v!=='00000000-0000-0000-0000-000000000000';
const revision=v=>Number.isSafeInteger(v)&&v>=1&&v<=1025;
const date=v=>typeof v==='string'&&v.length===24&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
function note(v,min,max){if(typeof v!=='string'||v.trim()!==v||v.length<min||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069<>]/u.test(v))throw fail();return v;}
export function collaborationCommand(v){
 const action=v?.action,extra=action==='invite'?['target','kit','scope','days','goal','note','format']:action==='contribute'?['note']:['acknowledge','reject'].includes(action)?['proofId']:[];
 if(!['invite','accept','decline','cancel','contribute','acknowledge','reject'].includes(action)||!exact(v,['operationId','challengeId','revision','action',...extra])||
  !collaborationId(v.operationId)||!collaborationId(v.challengeId)||!Number.isSafeInteger(v.revision)||v.revision<0||v.revision>1024)throw fail();
 const out={operationId:v.operationId,challengeId:v.challengeId,revision:v.revision,action};
 if(action==='invite'){
  if(v.format!==1||v.operationId!==v.challengeId||v.revision!==0||!collaborationId(v.target))throw fail();
  const fields=challengeFields(v);return {...out,target:v.target,...fields,format:1};
 }
 if(v.revision<1)throw fail();
 if(action==='contribute')out.note=note(v.note,10,240);
 if(['acknowledge','reject'].includes(action)){if(!collaborationId(v.proofId))throw fail();out.proofId=v.proofId;}
 return out;
}
export function collaborationSnapshot(v){
 if(!exact(v,['id','from','to','kit','scope','days','goal','note','status','revision','winner','createdAt','acceptedAt','endsAt','proofs'])||
  ![v.id,v.from,v.to].every(collaborationId)||v.from===v.to||!revision(v.revision)||!date(v.createdAt)||
  !['invited','active','expired','declined','cancelled','complete'].includes(v.status)||!Array.isArray(v.proofs)||v.proofs.length>46)throw fail();
 const fields=challengeFields(v);if(fields.note!==v.note)throw fail();
 if(['invited','declined','cancelled'].includes(v.status)){
  if(v.acceptedAt!==null||v.endsAt!==null||v.winner!==null||v.proofs.length)throw fail();
 }else{
  if(!date(v.acceptedAt)||!date(v.endsAt)||Date.parse(v.acceptedAt)<Date.parse(v.createdAt)||Date.parse(v.endsAt)-Date.parse(v.acceptedAt)!==v.days*86400000||
   (v.status==='complete'?![v.from,v.to].includes(v.winner):v.winner!==null))throw fail();
 }
 const seen=new Set(),proofs=v.proofs.map(p=>{
  if(!exact(p,['id','owner','note','status'])||!collaborationId(p.id)||seen.has(p.id)||![v.from,v.to].includes(p.owner)||!['pending','acknowledged','declined'].includes(p.status))throw fail();
  seen.add(p.id);return {id:p.id,owner:p.owner,note:note(p.note,10,240),status:p.status};
 });
 for(const owner of [v.from,v.to])if(proofs.filter(p=>p.owner===owner).length>v.goal+3)throw fail();
 if(v.status==='complete'&&proofs.filter(p=>p.owner===v.winner&&p.status==='acknowledged').length<v.goal)throw fail();
 return {...v,...fields,proofs,status:v.status==='active'&&Date.parse(v.endsAt)<=Date.now()?'expired':v.status};
}
export function collaborationResult(v){
 if(exact(v,['state','revision'])&&v.state==='conflict'&&revision(v.revision))return {...v};
 if(!exact(v,['state','operationId','challenge'])||!['applied','replayed'].includes(v.state)||!collaborationId(v.operationId))throw fail();
 return {state:v.state,operationId:v.operationId,challenge:collaborationSnapshot(v.challenge)};
}
export function collaborationPage(v,{after=null,limit=5}={}){
 if(after!==null&&!collaborationId(after)||!Number.isSafeInteger(limit)||limit<1||limit>5||!exact(v,['items','next'])||!Array.isArray(v.items)||v.items.length>limit||v.next!==null&&!collaborationId(v.next))throw fail();
 const items=v.items.map(collaborationSnapshot);for(let i=0;i<items.length;i++)if((i?items[i-1].id:after)!==null&&items[i].id<=(i?items[i-1].id:after))throw fail();
 if(v.next!==null&&(items.length!==limit||v.next!==items.at(-1).id))throw fail();return {items,next:v.next};
}
export function collaborationInventory(v){
 const names=['control','challenges','contributions','operations','blocks'];
 if(!exact(v,['format','domain','closed','tables'])||v.format!==1||v.domain!=='community'||v.closed!==true||!Array.isArray(v.tables)||v.tables.length!==5)throw fail();
 return {...v,tables:v.tables.map((t,i)=>{if(!exact(t,['table','rows','sha256'])||t.table!=='alliance_community.'+names[i]||!Number.isSafeInteger(t.rows)||t.rows<0||t.rows>[1,128,512,1024,256][i]||i===0&&t.rows!==1||typeof t.sha256!=='string'||!/^[0-9a-f]{64}$/.test(t.sha256))throw fail();return {...t};})};
}
