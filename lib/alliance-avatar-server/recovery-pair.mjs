// Disabled operator-only READ-ONLY comparison. All outcomes keep access closed.
// Checkpoint authenticity, actual quiescence and an independent trusted floor
// must be supplied outside this module; inventories are not signatures/backups.
import {isDeepStrictEqual} from 'node:util';
import {performance} from 'node:perf_hooks';
import {deletionRecord} from './deletion-journal.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,HASH=/^[0-9a-f]{64}$/,ZERO='0'.repeat(64);
export const RECOVERY_TABLES=Object.freeze({member:Object.freeze(['public.alliance_member_owners','public.alliance_profiles','alliance_avatar.control','alliance_avatar.heads','alliance_avatar.operations','alliance_avatar.objects','alliance_avatar.daily','alliance_avatar.cleanup_attempts','alliance_avatar.creation_plans']),journal:Object.freeze(['alliance_journal.control','alliance_journal.admissions','alliance_journal.entries'])});
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=v=>typeof v==='string'&&UUID.test(v),hash=v=>typeof v==='string'&&HASH.test(v),ref=v=>typeof v==='string'&&/^[a-z0-9]{20}$/.test(v);
const fail=()=>Error('alliance_recovery_pair_unavailable'),q=reason=>({state:'quarantine',access:'closed',reason});
const date=v=>typeof v==='string'&&v.length===24&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v&&Date.parse(v)>=0;
function point(v){if(!exact(v,['sequence','sha256'])||!Number.isSafeInteger(v.sequence)||v.sequence<0||v.sequence>256||!hash(v.sha256)||v.sequence===0&&v.sha256!==ZERO)throw fail();return {...v};}
export function recoveryInventory(value,domain){
  if(!Object.hasOwn(RECOVERY_TABLES,domain)||!exact(value,domain==='member'?['format','domain','closed','tables']:['format','domain','closed','tables','projectRef','epoch','sequence','sha256'])||value.format!==2||value.domain!==domain||typeof value.closed!=='boolean'||!Array.isArray(value.tables)||value.tables.length!==RECOVERY_TABLES[domain].length)throw fail();
  const tables=value.tables.map((t,i)=>{
    if(!exact(t,['table','rows','sha256'])||t.table!==RECOVERY_TABLES[domain][i]||!Number.isSafeInteger(t.rows)||t.rows<0||t.rows>(domain==='journal'||t.table.endsWith('.creation_plans')?256:1000)||!hash(t.sha256)||t.table.endsWith('.control')&&t.rows!==1)throw fail();return {...t};
  });
  if(domain==='member')return {format:2,domain,closed:value.closed,tables};
  if(!ref(value.projectRef)||!uuid(value.epoch))throw fail();const tip=point({sequence:value.sequence,sha256:value.sha256});
  if(tables[2].rows!==tip.sequence||tables[1].rows<tip.sequence)throw fail();
  return {format:2,domain,closed:value.closed,projectRef:value.projectRef,epoch:value.epoch,...tip,tables};
}
export function createAllianceRecoveryPair({enabled=false,ledger,journal,memberProjectRef,journalProjectRef,epoch,minimum,timeoutMs=25000}={}){
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>25000)throw fail();let floor;
  if(enabled===true){if(typeof ledger?.recoveryInventory!=='function'||!['recoveryInventory','records'].every(k=>typeof journal?.[k]==='function')||!ref(memberProjectRef)||!ref(journalProjectRef)||memberProjectRef===journalProjectRef||!uuid(epoch))throw fail();floor=point(minimum);}
  let active=false,ended=false,controller;
  return Object.freeze({
    async inspect(input,{signal}={}){
      if(enabled!==true||ended)return q('unavailable');if(signal?.aborted)return q('cancelled');if(active)return q('busy');
      let expected;
      try{
        if(!exact(input,['freezeId','frozenAt','checkpoint'])||!uuid(input.freezeId)||!date(input.frozenAt)||Date.parse(input.frozenAt)>Date.now())throw fail();
        const p=input.checkpoint;
        if(!exact(p,['format','memberProjectRef','journalProjectRef','epoch','freezeId','capturedAt','member','journal'])||p.format!==2||!uuid(p.freezeId)||!date(p.capturedAt)||Date.parse(p.capturedAt)>Date.now())throw fail();
        if(p.memberProjectRef!==memberProjectRef||p.journalProjectRef!==journalProjectRef||p.epoch!==epoch)return q('scope_mismatch');
        if(p.freezeId!==input.freezeId)return q('freeze_mismatch');if(Date.parse(p.capturedAt)<Date.parse(input.frozenAt))return q('checkpoint_predates_freeze');
        expected={member:recoveryInventory(p.member,'member'),journal:recoveryInventory(p.journal,'journal')};
        if(expected.journal.projectRef!==memberProjectRef||expected.journal.epoch!==epoch)return q('scope_mismatch');
        if(!expected.member.closed||!expected.journal.closed)return q('feature_open');
        if(expected.journal.sequence<floor.sequence)return q('floor_regression');
        if(expected.journal.sequence===floor.sequence&&expected.journal.sha256!==floor.sha256)return q('floor_fork');
      }catch{return q('invalid_evidence');}
      const c=new AbortController(),abort=()=>c.abort(),started=performance.now();let onAbort,finished=false;active=true;controller=c;signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
      const check=()=>{if(finished||ended||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
      const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn();}),stopped]);
      const read=async domain=>{const v=recoveryInventory(await phase(()=>domain==='member'?ledger.recoveryInventory({signal:c.signal}):journal.recoveryInventory({signal:c.signal})),domain);check();if(domain==='journal'&&(v.projectRef!==memberProjectRef||v.epoch!==epoch))throw fail();return v;};
      try{
        const member=await read('member'),j=await read('journal');if(!member.closed||!j.closed)return q('feature_open');
        if(j.sequence<floor.sequence)return q('floor_regression');
        const through={sequence:j.sequence,sha256:j.sha256},records=await phase(()=>journal.records(through,{signal:c.signal}));check();
        if(!Array.isArray(records)||records.length!==j.sequence)throw fail();let previous=ZERO;const ids=new Set();
        for(let i=0;i<records.length;i++){
          const r=records[i];if(!exact(r,['format','projectRef','epoch','sequence','previous','event','sha256'])||r.format!==1||r.projectRef!==memberProjectRef||r.epoch!==epoch||r.sequence!==i+1||r.previous!==previous||ids.has(r.event?.id))throw fail();
          const canonical=deletionRecord({projectRef:r.projectRef,epoch:r.epoch,sequence:r.sequence,previous:r.previous,event:r.event});if(canonical.sha256!==r.sha256)throw fail();previous=r.sha256;ids.add(r.event.id);
        }
        if(previous!==j.sha256)throw fail();if(floor.sequence>0&&records[floor.sequence-1].sha256!==floor.sha256)return q('floor_fork');
        const memberAfter=await read('member'),journalAfter=await read('journal');
        if(!memberAfter.closed||!journalAfter.closed)return q('feature_open');
        if(!isDeepStrictEqual(member,memberAfter)||!isDeepStrictEqual(j,journalAfter))return q('snapshot_changed');
        if(!isDeepStrictEqual(expected.member,member))return q('member_mismatch');if(!isDeepStrictEqual(expected.journal,j))return q('journal_mismatch');
        return {state:'matches_checkpoint',access:'closed'};
      }catch{return q('unavailable');}
      finally{finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();active=false;controller=undefined;}
    },close(){ended=true;controller?.abort();}
  });
}
