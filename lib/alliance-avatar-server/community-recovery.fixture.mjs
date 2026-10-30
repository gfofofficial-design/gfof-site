// Fictional inventories and an ephemeral signing key; no provider or custody.
import {startupFixture} from './startup-gate.fixture.mjs';
import {createAllianceCommunityStartupGate} from './startup-gate.mjs';
import {communityCheckpointSha256} from './community-recovery.mjs';
import {chain,event} from './deletion-journal.fixture.mjs';
export function communityRecoveryFixture({readCommunity,changeDecision=d=>d,readDecision,options={}}={}){
 const f=startupFixture();f.gate.close();
 const cp={...f.checkpoint,format:3,community:{format:1,domain:'community',closed:true,tables:['control','challenges','contributions','operations','blocks'].map((t,i)=>({table:'alliance_community.'+t,rows:i===0?1:2,sha256:String(i+1).repeat(64)}))}};
 const control={...f.control,checkpointSha256:communityCheckpointSha256(cp)},calls=[],requests=[];
 const deps={enabled:true,memberProjectRef:cp.memberProjectRef,journalProjectRef:cp.journalProjectRef,epoch:cp.epoch,verificationKey:f.verificationKey,minimumRevision:1,minimum:{...control.floor},
  ledger:{recoveryInventory(){calls.push('member');return structuredClone(cp.member);}},
  journal:{recoveryInventory(){calls.push('journal');return structuredClone(cp.journal);},records(){calls.push('records');return chain([event()]);}},
  community:{inventory(o){calls.push('community');return readCommunity?readCommunity(o):structuredClone(cp.community);}},
  async readDecision(request,{signal}){calls.push('decision');requests.push({request,signal});const decision=changeDecision({...request,...structuredClone(control),issuedAt:new Date().toISOString()},requests.length);return readDecision?readDecision({request,signal,decision,signDecision:f.signDecision}):f.signDecision(decision);}
 };
 const make=extra=>createAllianceCommunityStartupGate({...deps,...options,...extra});
 return {gate:make(),make,deps,checkpoint:cp,control,calls,requests,serve(){control.state='serve';control.revision++;}};
}
