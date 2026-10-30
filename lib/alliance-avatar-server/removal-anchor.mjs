// Fixed scope/point/chain protocol. No transport, persistence, key or permission.
import {deletionRecord} from './deletion-journal.mjs';
import {controlExact as exact,controlRef as ref,controlUuid as uuid,controlPoint,controlFailure as fail} from './control-policy.mjs';
export function removalAnchor(value,scope){
 if(!exact(value,['format','memberProjectRef','journalProjectRef','epoch','sequence','sha256'])||value.format!==1||!ref(value.memberProjectRef)||!ref(value.journalProjectRef)||value.memberProjectRef===value.journalProjectRef||!uuid(value.epoch)||value.memberProjectRef!==scope.memberProjectRef||value.journalProjectRef!==scope.journalProjectRef||value.epoch!==scope.epoch)throw fail();
 return {format:1,memberProjectRef:value.memberProjectRef,journalProjectRef:value.journalProjectRef,epoch:value.epoch,...controlPoint({sequence:value.sequence,sha256:value.sha256})};
}
export function removalChain(rows,through,scope,minimum={sequence:0,sha256:'0'.repeat(64)}){
 const end=controlPoint(through),floor=controlPoint(minimum);
 let encoded;try{encoded=JSON.stringify(rows);}catch{throw fail();}
 if(!Array.isArray(rows)||rows.length!==end.sequence||rows.length>256||Buffer.byteLength(encoded)>262144||end.sequence<floor.sequence)throw fail();
 let previous='0'.repeat(64);const ids=new Set(),copy=[];
 for(let i=0;i<rows.length;i++){
  const r=rows[i];if(!exact(r,['format','projectRef','epoch','sequence','previous','event','sha256'])||r.format!==1||r.projectRef!==scope.memberProjectRef||r.epoch!==scope.epoch||r.sequence!==i+1||r.previous!==previous)throw fail();
  const c=deletionRecord({projectRef:r.projectRef,epoch:r.epoch,sequence:r.sequence,previous:r.previous,event:r.event});
  if(c.sha256!==r.sha256||ids.has(c.event.id)||c.sequence===floor.sequence&&c.sha256!==floor.sha256)throw fail();ids.add(c.event.id);previous=c.sha256;copy.push(c);
 }
 if(previous!==end.sha256||end.sequence===floor.sequence&&previous!==floor.sha256)throw fail();return copy;
}
