import {createHash} from 'node:crypto';
const HASH=/^[0-9a-f]{64}$/,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,ZERO='0'.repeat(64);
export const controlFailure=()=>Error('alliance_control_unavailable');
export const controlExact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export const controlHash=v=>typeof v==='string'&&HASH.test(v),controlUuid=v=>typeof v==='string'&&UUID.test(v),controlRef=v=>typeof v==='string'&&/^[a-z0-9]{20}$/.test(v);
const date=v=>typeof v==='string'&&v.length===24&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v&&Date.parse(v)>=0;
export function controlPoint(v){if(!controlExact(v,['sequence','sha256'])||!Number.isSafeInteger(v.sequence)||v.sequence<0||v.sequence>256||!controlHash(v.sha256)||v.sequence===0&&v.sha256!==ZERO)throw controlFailure();return {sequence:v.sequence,sha256:v.sha256};}
function body(v){
 if(!controlExact(v,['format','memberProjectRef','journalProjectRef','epoch','revision','state','changeId','freezeId','frozenAt','checkpointSha256','floor'])||v.format!==1||!controlRef(v.memberProjectRef)||!controlRef(v.journalProjectRef)||v.memberProjectRef===v.journalProjectRef||!controlUuid(v.epoch)||!Number.isSafeInteger(v.revision)||v.revision<1||v.revision>2147483646||!['closed','review','serve'].includes(v.state)||!controlUuid(v.changeId))throw controlFailure();
 const floor=controlPoint(v.floor),empty=v.freezeId===null&&v.frozenAt===null&&v.checkpointSha256===null;
 if(empty?(v.state!=='closed'||floor.sequence!==0):(!controlUuid(v.freezeId)||!date(v.frozenAt)||!controlHash(v.checkpointSha256)))throw controlFailure();
 return {format:1,memberProjectRef:v.memberProjectRef,journalProjectRef:v.journalProjectRef,epoch:v.epoch,revision:v.revision,state:v.state,changeId:v.changeId,freezeId:v.freezeId,frozenAt:v.frozenAt,checkpointSha256:v.checkpointSha256,floor};
}
export function controlPolicySha256(value){const v=body(value);return createHash('sha256').update('GF-ALLIANCE-CONTROL-ROW-V1\0'+[v.memberProjectRef,v.journalProjectRef,v.epoch,v.revision,v.state,v.changeId,v.freezeId??'-',v.frozenAt??'-',v.checkpointSha256??'-',v.floor.sequence,v.floor.sha256].join('\n')).digest('hex');}
export function controlPolicy(value){
 if(!controlExact(value,['format','memberProjectRef','journalProjectRef','epoch','revision','state','changeId','freezeId','frozenAt','checkpointSha256','floor','sha256']))throw controlFailure();
 const {sha256,...raw}=value,v=body(raw);if(!controlHash(sha256)||controlPolicySha256(v)!==sha256)throw controlFailure();return {...v,sha256};
}
