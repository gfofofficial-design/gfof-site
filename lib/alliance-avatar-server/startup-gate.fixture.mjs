// Synthetic protocol fixture only: ephemeral signing key and IN-MEMORY policy.
// This is not the independent persistent authority required for deployment.
import {generateKeyPairSync,sign} from 'node:crypto';
import {RECOVERY_TABLES} from './recovery-pair.mjs';
import {createAllianceStartupGate,startupCheckpointSha256,startupDecisionBytes} from './startup-gate.mjs';
import {chain,event,projectRef as memberProjectRef,epoch,other} from './deletion-journal.fixture.mjs';
export const journalProjectRef='uvwxyzabcdefghijklmn';
export function startupFixture({checkpoint,ledger,journal,change=d=>d,read,options={}}={}){
  const history=chain([event()]),inventory=domain=>({format:2,domain,closed:true,tables:RECOVERY_TABLES[domain].map((table,i)=>({table,rows:table.endsWith('.control')?1:domain==='journal'&&table.endsWith('.entries')?1:2,sha256:String(i).repeat(64)})),...(domain==='journal'?{projectRef:memberProjectRef,epoch,sequence:1,sha256:history[0].sha256}:{})});
  const cp=checkpoint||{format:2,memberProjectRef,journalProjectRef,epoch,freezeId:other,capturedAt:'2026-01-01T00:01:00.000Z',member:inventory('member'),journal:inventory('journal')};
  const {privateKey,publicKey}=generateKeyPairSync('ed25519'),verificationKey=Buffer.from(publicKey.export({format:'jwk'}).x,'base64url').toString('hex');
  const control={state:'review',revision:1,freezeId:cp.freezeId,frozenAt:'2026-01-01T00:00:00.000Z',checkpointSha256:startupCheckpointSha256(cp),floor:{sequence:cp.journal.sequence,sha256:cp.journal.sha256}};
  const calls=[],requests=[];
  const signDecision=d=>Buffer.from(JSON.stringify({decision:d,signature:sign(null,startupDecisionBytes(d),privateKey).toString('hex')}));
  const readDecision=async(request,{signal})=>{
    calls.push('decision');requests.push({request,signal});
    const decision=change({...request,...structuredClone(control),issuedAt:new Date().toISOString()},requests.length);
    return read?read({request,signal,decision,signDecision}):signDecision(decision);
  };
  const deps={enabled:true,memberProjectRef:cp.memberProjectRef,journalProjectRef:cp.journalProjectRef,epoch:cp.epoch,verificationKey,minimumRevision:1,minimum:{...control.floor},readDecision,ledger:ledger||{recoveryInventory(){calls.push('member');return structuredClone(cp.member);}},journal:journal||{recoveryInventory(){calls.push('journal');return structuredClone(cp.journal);},records(){calls.push('records');return history;}}};
  const make=overrides=>createAllianceStartupGate({...deps,...options,...overrides});
  return {gate:make(),make,checkpoint:cp,control,calls,requests,signDecision,verificationKey,serve(){control.state='serve';control.revision++;}};
}
