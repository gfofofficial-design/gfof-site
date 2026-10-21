// Source-only composition. No private key material, file/env lookup, database
// mutation, trust-pin write or HTTP route. Capabilities are injected explicitly.
import {allianceTrustRecord} from './trust-record.mjs';
import {createAnchoredControlAuthority} from './control-authority.mjs';
import {createAnchoredJournalWitness} from './anchored-witness.mjs';
import {createAllianceStartupGate} from './startup-gate.mjs';
import {removalAnchor,removalChain} from './removal-anchor.mjs';
import {controlExact as exact} from './control-policy.mjs';
import {performance} from 'node:perf_hooks';
const fail=()=>Error('alliance_trust_unavailable');
function signer(value,key){if(!exact(value,['publicKey','signBytes'])||value.publicKey!==key||typeof value.signBytes!=='function')throw fail();return value.signBytes.bind(value);}
export function createPinnedAllianceAuthorities({enabled=false,trustBytes,expectedSha256,expectedScope,minimumGeneration,controlStore,anchorStore,journalStore,ledger,controlSigner,journalSigner}={}){
 if(enabled!==true)return Object.freeze({startup:Object.freeze({prepare:async()=>({state:'quarantine',access:'closed'}),authorize:async()=>false}),witness:Object.freeze({issue:async()=>({state:'unavailable'})}),close(){}});
 let control,witness,startup;
 try{
  const trust=allianceTrustRecord({bytes:trustBytes,expectedSha256,expectedScope,minimumGeneration});
  const {memberProjectRef,journalProjectRef,epoch}=trust,s={memberProjectRef,journalProjectRef,epoch};
  const signControl=signer(controlSigner,trust.controlVerificationKey),signJournal=signer(journalSigner,trust.journalVerificationKey);
  if(typeof anchorStore?.read!=='function'||typeof journalStore?.records!=='function')throw fail();
  // The external latest-copy floor applies to control decisions as well as
  // journal signatures. Database rollback cannot lower it in a fresh process.
  const readAnchor=anchorStore.read.bind(anchorStore),readRecords=journalStore.records.bind(journalStore),floor=trust.removalMinimum;
  const pinnedAnchor={async read(options){
   const started=performance.now(),check=()=>{if(options?.signal?.aborted||performance.now()-started>=3000)throw fail();};check();
   const a=removalAnchor(await readAnchor(options),s);check();
   if(a.sequence<floor.sequence||a.sequence===floor.sequence&&a.sha256!==floor.sha256)throw fail();
   // A higher sequence alone cannot prove it contains the external minimum.
   const point={sequence:a.sequence,sha256:a.sha256},rows=await readRecords(point,options);check();removalChain(rows,point,s,floor);return a;
  }};
  control=createAnchoredControlAuthority({enabled:true,...s,verificationKey:trust.controlVerificationKey,minimum:trust.controlMinimum,store:controlStore,anchorStore:pinnedAnchor,signBytes:signControl});
  witness=createAnchoredJournalWitness({enabled:true,projectRef:memberProjectRef,journalProjectRef,epoch,minimum:floor,verificationKey:trust.journalVerificationKey,signBytes:signJournal,anchorStore:pinnedAnchor,store:journalStore});
  startup=createAllianceStartupGate({enabled:true,...s,verificationKey:trust.controlVerificationKey,minimumRevision:trust.controlMinimum.revision,minimum:trust.controlMinimum.floor,ledger,journal:journalStore,readDecision:async(request,options)=>{const r=await control.issue(request,options);if(r.state!=='signed')throw fail();return r.bytes;}});
  return Object.freeze({startup,witness,close(){startup.close();witness.close();control.close();}});
 }catch{startup?.close();witness?.close();control?.close();throw fail();}
}
