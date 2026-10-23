// Default-off, read-only composition. Inventory agreement never opens serving.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {performance} from 'node:perf_hooks';
import {createAllianceRecoveryPair,recoveryInventory} from './recovery-pair.mjs';
import {collaborationInventory} from '../../assets/federation/fed-alliance-collaboration-contract.mjs';
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
const ref=v=>typeof v==='string'&&/^[a-z0-9]{20}$/.test(v);
const date=v=>typeof v==='string'&&v.length===24&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v&&Date.parse(v)>=0;
const fail=()=>Error('community_recovery_unavailable'),q=reason=>({state:'quarantine',access:'closed',reason});
export function communityCheckpoint(v){
 if(!exact(v,['format','memberProjectRef','journalProjectRef','epoch','freezeId','capturedAt','member','journal','community'])||v.format!==3||
  !ref(v.memberProjectRef)||!ref(v.journalProjectRef)||v.memberProjectRef===v.journalProjectRef||!uuid(v.epoch)||!uuid(v.freezeId)||!date(v.capturedAt))throw fail();
 const tables=x=>x.tables.map(t=>({table:t.table,rows:t.rows,sha256:t.sha256}));
 const m=recoveryInventory(v.member,'member'),j=recoveryInventory(v.journal,'journal'),c=collaborationInventory(v.community);
 const member={...m,tables:tables(m)},journal={...j,tables:tables(j)},community={format:1,domain:'community',closed:true,tables:tables(c)};
 if(!member.closed||!journal.closed||journal.projectRef!==v.memberProjectRef||journal.epoch!==v.epoch)throw fail();
 return {format:3,memberProjectRef:v.memberProjectRef,journalProjectRef:v.journalProjectRef,epoch:v.epoch,freezeId:v.freezeId,capturedAt:v.capturedAt,member,journal,community};
}
export function communityCheckpointSha256(v){return createHash('sha256').update('GF-ALLIANCE-COMMUNITY-CHECKPOINT-V1\0'+JSON.stringify(communityCheckpoint(v))).digest('hex');}
export function createAllianceCommunityRecoveryReview({enabled=false,community,timeoutMs=25000,...scope}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>25000)throw fail();
 if(enabled===true){if(typeof community?.inventory!=='function')throw fail();const check=createAllianceRecoveryPair({...scope,enabled:true,timeoutMs});check.close();scope.minimum={...scope.minimum};}
 let closed=false,faulted=false,active,inspector;
 return Object.freeze({
  async inspect(input,{signal}={}){
   if(enabled!==true||closed||faulted)return q('unavailable');if(signal?.aborted)return q('cancelled');if(active)return q('busy');
   let cp,frozenAt,freezeId;
   try{if(!exact(input,['freezeId','frozenAt','checkpoint']))throw fail();cp=communityCheckpoint(input.checkpoint);frozenAt=input.frozenAt;freezeId=input.freezeId;if(!uuid(freezeId)||!date(frozenAt)||Date.parse(frozenAt)>Date.now()||Date.parse(cp.capturedAt)>Date.now())throw fail();}catch{return q('invalid_evidence');}
   if(cp.memberProjectRef!==scope.memberProjectRef||cp.journalProjectRef!==scope.journalProjectRef||cp.epoch!==scope.epoch)return q('scope_mismatch');
   if(cp.freezeId!==freezeId)return q('freeze_mismatch');if(Date.parse(cp.capturedAt)<Date.parse(frozenAt))return q('checkpoint_predates_freeze');
   if(cp.journal.sequence<scope.minimum.sequence)return q('floor_regression');
   if(cp.journal.sequence===scope.minimum.sequence&&cp.journal.sha256!==scope.minimum.sha256)return q('floor_fork');
   const c=new AbortController(),abort=()=>{faulted=true;c.abort();};active=c;signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();let onAbort;
   const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});if(c.signal.aborted)onAbort();});
   const timer=setTimeout(abort,timeoutMs),started=performance.now(),check=()=>{if(closed||faulted||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
   const phase=async fn=>{check();const out=await Promise.race([Promise.resolve().then(()=>{check();return fn();}),stopped]);check();return out;};
   const work=(async()=>{try{
    inspector=createAllianceRecoveryPair({...scope,enabled:true,timeoutMs});
    const before=collaborationInventory(await phase(()=>community.inventory({signal:c.signal})));
    // Compare unmodified real member/journal inventories through the existing
    // full-prefix/floor review. Never disguise a combined hash as a table hash.
    const {community:unused,...original}=cp;
    const result=await phase(()=>inspector.inspect({freezeId,frozenAt,checkpoint:{...original,format:2}},{signal:c.signal}));
    if(result?.state!=='matches_checkpoint'||result.access!=='closed')return result;
    const after=collaborationInventory(await phase(()=>community.inventory({signal:c.signal})));
    if(!isDeepStrictEqual(before,after))return q('snapshot_changed');
    if(!isDeepStrictEqual(cp.community,before))return q('community_mismatch');
    return {state:'matches_checkpoint',access:'closed'};
   }catch{faulted=true;return q('unavailable');}finally{inspector?.close();inspector=undefined;if(active===c)active=undefined;}})();
   try{return await Promise.race([work,stopped.catch(()=>q('unavailable'))]);}
   finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);}
  },
  close(){closed=true;active?.abort();inspector?.close();}
 });
}
