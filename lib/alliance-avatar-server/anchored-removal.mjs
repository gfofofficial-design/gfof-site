// Unmounted acknowledgement bridge. No key/env/provider cleanup/automatic retry.
import {createAllianceRemoval,removalEvents,removalResult} from './removal.mjs';
import {controlPoint,controlRef as ref,controlUuid as uuid,controlExact as exact,controlFailure as fail} from './control-policy.mjs';
import {removalAnchor,removalChain} from './removal-anchor.mjs';
import {performance} from 'node:perf_hooks';
export function createAllianceAnchoredRemoval({enabled=false,profileBinding=false,projectRef,journalProjectRef,epoch,minimum,ledger,journal,anchorStore,serving,timeoutMs=30000}={}){
 const scope={memberProjectRef:projectRef,journalProjectRef,epoch};
 if(enabled===true&&(!ref(projectRef)||!ref(journalProjectRef)||projectRef===journalProjectRef||!uuid(epoch)||!['prepareAnchoredRemovalSession','finishAnchoredRemovalSession'].every(k=>typeof ledger?.[k]==='function')||!['read','advance'].every(k=>typeof anchorStore?.[k]==='function')))throw fail();
 let active=false,deadline=0,expires=0;
 const check=options=>{if(options?.signal?.aborted||performance.now()>=deadline||Date.now()>=expires)throw fail();};
 const facade={
  async prepareProfileBoundRemovalSession(...args){const v=removalResult(await ledger.prepareProfileBoundAnchoredRemovalSession(...args));if(v.state!=='prepared')throw fail();return v;},
  async prepareRemovalSession(...args){const v=removalResult(await ledger.prepareAnchoredRemovalSession(...args));if(v.state!=='prepared')throw fail();return v;},
  async finishRemovalSession(actor,session,operation,plan,receipt,options){
   const raw=await journal.tip(options);
   check(options);
   if(!exact(raw,['projectRef','epoch','sequence','sha256','enabled'])||raw.projectRef!==projectRef||raw.epoch!==epoch||typeof raw.enabled!=='boolean')throw fail();
   const tip=controlPoint({sequence:raw.sequence,sha256:raw.sha256}),anchor=removalAnchor(await anchorStore.read(options),scope);
   check(options);
   const rows=removalChain(await journal.records(tip,options),tip,scope,controlPoint({sequence:anchor.sequence,sha256:anchor.sha256}));
   check(options);
   const events=removalEvents(plan);
   if(!exact(receipt,['records'])||receipt.records.length!==events.length)throw fail();
   for(let i=0;i<events.length;i++){const p=receipt.records[i],r=rows[p.sequence-1];if(!r||r.event.id!==events[i].id||r.sha256!==p.sha256||JSON.stringify(r.event)!==JSON.stringify(events[i]))throw fail();}
   const committed=await anchorStore.advance({expected:{sequence:anchor.sequence,sha256:anchor.sha256},through:tip,records:rows},options);
   check(options);
   if(!exact(committed,['state','anchor'])||committed.state!=='anchored')throw fail();const proof=removalAnchor(committed.anchor,scope);
   if(proof.sequence!==tip.sequence||proof.sha256!==tip.sha256)throw fail();
   return ledger.finishAnchoredRemovalSession(actor,session,operation,plan,receipt,proof,options);
  }
 };
 if(typeof profileBinding!=='boolean'||enabled===true&&profileBinding&&typeof ledger?.prepareProfileBoundAnchoredRemovalSession!=='function')throw fail();
 const worker=createAllianceRemoval({enabled,profileBinding,projectRef,epoch,minimum,ledger:facade,journal,serving,timeoutMs});
 return Object.freeze({async run(input,options){if(active)return {state:'busy'};active=true;deadline=performance.now()+timeoutMs;expires=input?.expiresAt||0;try{return await worker.run(input,options);}finally{active=false;}},close(){worker.close();}});
}

