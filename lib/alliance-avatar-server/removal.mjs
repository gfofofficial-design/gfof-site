// Unmounted coordinator. No credentials, provider cleanup, route or auto retry.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {performance} from 'node:perf_hooks';
import {deletionRecord} from './deletion-journal.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,HASH=/^[0-9a-f]{64}$/,ZERO='0'.repeat(64);
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const fail=()=>Error('avatar_removal_unavailable'),out=state=>({state});
export function removalPlan(v){
  if(!exact(v,['format','kind','operationId','profileId','version','objectIds'])||v.format!==1||!['image','profile'].includes(v.kind)||!UUID.test(v.operationId)||!UUID.test(v.profileId)||!Number.isSafeInteger(v.version)||v.version<0||!Array.isArray(v.objectIds)||v.objectIds.length>4||v.kind==='profile'&&v.objectIds.length||v.objectIds.some((id,i)=>typeof id!=='string'||!UUID.test(id)||i>0&&id<=v.objectIds[i-1]))throw fail();
  return {format:1,kind:v.kind,operationId:v.operationId,profileId:v.profileId,version:v.version,objectIds:[...v.objectIds]};
}
export function removalEvents(plan){
  const p=removalPlan(plan),subjects=p.kind==='profile'?[p.profileId]:p.objectIds;
  return subjects.map(subject=>{
    const h=createHash('sha256').update('GF-ALLIANCE-REMOVAL-ID-V1\0'+p.kind+'\0'+p.profileId+'\0'+subject).digest('hex').slice(0,32);
    return {id:`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`,kind:p.kind==='profile'?'profile_remove_requested':'image_remove_requested',profileId:p.profileId,objectId:p.kind==='profile'?null:subject};
  });
}
export function removalResult(v){
  if(exact(v,['state','version'])&&v.state==='committed'&&Number.isSafeInteger(v.version)&&v.version>0)return {...v};
  if(exact(v,['state','plan'])&&v.state==='prepared')return {state:'prepared',plan:removalPlan(v.plan)};
  throw fail();
}
export function createAllianceRemoval({enabled=false,profileBinding=false,projectRef,epoch,minimum,ledger,journal,serving,timeoutMs=30000}={}){
  const point=v=>{if(!exact(v,['sequence','sha256'])||!Number.isSafeInteger(v.sequence)||v.sequence<0||v.sequence>256||typeof v.sha256!=='string'||!HASH.test(v.sha256)||v.sequence===0&&v.sha256!==ZERO)throw fail();return {...v};};
  let floor;if(typeof profileBinding!=='boolean'||enabled===true&&profileBinding&&typeof ledger?.prepareProfileBoundRemovalSession!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw fail();
  if(enabled===true){if(!/^[a-z0-9]{20}$/.test(projectRef)||!UUID.test(epoch)||!['prepareRemovalSession','finishRemovalSession'].every(k=>typeof ledger?.[k]==='function')||!['tip','records','append'].every(k=>typeof journal?.[k]==='function')||typeof serving?.authorize!=='function')throw fail();floor=point(minimum);}
  let closed=false,active=false,faulted=false,controller;
  return Object.freeze({
    async run(input,{signal}={}){
      if(enabled!==true||closed||faulted)return out('unavailable');
      const bound=profileBinding&&input?.kind==='profile';
      if(!exact(input,['actorId','sessionId','expiresAt','operationId','version','kind',...(bound?['expectedProfileId']:[])])||!['actorId','sessionId','operationId',...(bound?['expectedProfileId']:[])].every(k=>typeof input[k]==='string'&&UUID.test(input[k]))||!['image','profile'].includes(input.kind)||!Number.isSafeInteger(input.version)||input.version<0||!Number.isSafeInteger(input.expiresAt)||input.expiresAt<=Date.now())return out('invalid');
      if(signal?.aborted)return out('request_ended');if(active)return out('busy');
      const context={...input},c=new AbortController(),abort=()=>c.abort(),started=performance.now();let onAbort,prepared=false,dispatched=false;
      active=true;controller=c;signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,Math.min(timeoutMs,context.expiresAt-Date.now()));
      const check=()=>{if(closed||c.signal.aborted||Date.now()>=context.expiresAt||performance.now()-started>=timeoutMs)throw fail();};
      const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn();}),stopped]);
      const permit=async()=>{if(await phase(()=>serving.authorize({signal:c.signal}))!==true)throw fail();check();};
      const validateRecord=v=>{
        if(!exact(v,['format','projectRef','epoch','sequence','previous','event','sha256'])||v.format!==1||v.projectRef!==projectRef||v.epoch!==epoch)throw fail();
        const r=deletionRecord({projectRef,epoch,sequence:v.sequence,previous:v.previous,event:v.event});if(r.sha256!==v.sha256)throw fail();return r;
      };
      try{
        await permit();dispatched=true;
        const p=removalResult(await phase(()=>bound?ledger.prepareProfileBoundRemovalSession(context.actorId,context.sessionId,context.operationId,context.version,context.expectedProfileId,{signal:c.signal}):ledger.prepareRemovalSession(context.actorId,context.sessionId,context.operationId,context.version,context.kind,{signal:c.signal})));check();
        if(bound&&p.state!=='prepared')throw fail();
        if(p.state==='committed'){if(p.version!==context.version+1)throw fail();return p;}prepared=true;dispatched=false;
        const plan=p.plan;if(plan.operationId!==context.operationId||plan.version!==context.version||plan.kind!==context.kind||bound&&plan.profileId!==context.expectedProfileId)throw fail();
        const rawTip=await phase(()=>journal.tip({signal:c.signal}));check();
        if(!exact(rawTip,['projectRef','epoch','sequence','sha256','enabled'])||rawTip.projectRef!==projectRef||rawTip.epoch!==epoch||typeof rawTip.enabled!=='boolean')throw fail();
        let tip=point({sequence:rawTip.sequence,sha256:rawTip.sha256});
        if(tip.sequence<floor.sequence||tip.sequence===floor.sequence&&tip.sha256!==floor.sha256){faulted=true;throw fail();}
        const rows=await phase(()=>journal.records({...tip},{signal:c.signal}));check();
        if(!Array.isArray(rows)||rows.length!==tip.sequence||Buffer.byteLength(JSON.stringify(rows))>262144)throw fail();
        const known=new Map();let previous=ZERO;
        for(let i=0;i<rows.length;i++){const r=validateRecord(rows[i]);if(r.sequence!==i+1||r.previous!==previous||known.has(r.event.id)||r.sequence===floor.sequence&&r.sha256!==floor.sha256){faulted=true;throw fail();}known.set(r.event.id,r);previous=r.sha256;}
        if(previous!==tip.sha256)throw fail();floor={...tip};
        const receipts=[];
        for(const event of removalEvents(plan)){
          let r=known.get(event.id);
          if(r&&!isDeepStrictEqual(r.event,event)){faulted=true;throw fail();}
          if(!r){
            await permit();dispatched=true;
            const value=await phase(()=>journal.append({expected:{...tip},event:{...event}},{signal:c.signal}));check();
            if(value?.state!=='recorded')return out('removal_pending');
            r=validateRecord(value.record);
            // A concurrent exact replay may return an older record. Refuse the
            // mutation this time and reconcile its complete chain on an explicit
            // later request; never guess continuity from a standalone receipt.
            if(!isDeepStrictEqual(r.event,event)||r.sequence!==tip.sequence+1||r.previous!==tip.sha256)return out('removal_pending');
            if(!exact(value,['state','record','tip'])||!exact(value.tip,['projectRef','epoch','sequence','sha256','enabled'])||value.tip.projectRef!==projectRef||value.tip.epoch!==epoch||value.tip.sequence!==r.sequence||value.tip.sha256!==r.sha256||value.tip.enabled!==true)throw fail();
            dispatched=false;tip={sequence:r.sequence,sha256:r.sha256};floor={...tip};
          }
          receipts.push({id:r.event.id,sequence:r.sequence,sha256:r.sha256});
        }
        await permit();dispatched=true;
        const done=removalResult(await phase(()=>ledger.finishRemovalSession(context.actorId,context.sessionId,context.operationId,plan,{records:receipts},{signal:c.signal})));check();
        if(done.state!=='committed'||done.version!==context.version+1)throw fail();return done;
      }catch(error){
        if(c.signal.aborted)faulted=true; // A late write cannot overlap another run.
        return out(dispatched?'unknown':prepared?'removal_pending':error?.outcome==='rejected'?'sign_in_required':c.signal.aborted?'request_ended':'unavailable');
      }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();controller=undefined;active=false;}
    },close(){closed=true;controller?.abort();}
  });
}

