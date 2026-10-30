// Fictional inventories and an ephemeral signing key; no provider or custody.
import {startupFixture} from './startup-gate.fixture.mjs';
import {createAllianceFeedbackStartupGate} from './startup-gate.mjs';
import {feedbackCheckpointSha256} from './feedback-recovery.mjs';
import {chain,event} from './deletion-journal.fixture.mjs';
export function feedbackRecoveryFixture({readFeedback,readCommunity,changeDecision=d=>d,readDecision,options={}}={}){
 const f=startupFixture();f.gate.close();
 const cp={...f.checkpoint,format:4,feedback:{format:1,domain:'feedback',closed:true,tables:['control','ideas','supports','reports'].map((t,i)=>({table:'alliance_feedback.'+t,rows:i===0?1:2,sha256:String(i+5).repeat(64)}))},community:{format:1,domain:'community',closed:true,tables:['control','challenges','contributions','operations','blocks'].map((t,i)=>({table:'alliance_community.'+t,rows:i===0?1:2,sha256:String(i+1).repeat(64)}))}};
 const control={...f.control,checkpointSha256:feedbackCheckpointSha256(cp)},calls=[],requests=[];
 const deps={enabled:true,memberProjectRef:cp.memberProjectRef,journalProjectRef:cp.journalProjectRef,epoch:cp.epoch,verificationKey:f.verificationKey,minimumRevision:1,minimum:{...control.floor},
  ledger:{recoveryInventory(){calls.push('member');return structuredClone(cp.member);}},
  journal:{recoveryInventory(){calls.push('journal');return structuredClone(cp.journal);},records(){calls.push('records');return chain([event()]);}},
  feedback:{inventory(o){calls.push('feedback');return readFeedback?readFeedback(o):structuredClone(cp.feedback);}},
  community:{inventory(o){calls.push('community');return readCommunity?readCommunity(o):structuredClone(cp.community);}},
  async readDecision(request,{signal}){calls.push('decision');requests.push({request,signal});const decision=changeDecision({...request,...structuredClone(control),issuedAt:new Date().toISOString()},requests.length);return readDecision?readDecision({request,signal,decision,signDecision:f.signDecision}):f.signDecision(decision);}
 };
 const make=extra=>createAllianceFeedbackStartupGate({...deps,...options,...extra});
 return {gate:make(),make,deps,checkpoint:cp,control,calls,requests,serve(){control.state='serve';control.revision++;}};
}
