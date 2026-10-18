// Synthetic tests only: ephemeral signing keys stay in memory, never printed/saved.
import {generateKeyPairSync,sign} from 'node:crypto';
import {createAvatarDeletionJournal,deletionRecord,deletionWitnessBytes} from './deletion-journal.mjs';
export const projectRef='abcdefghijklmnopqrst',epoch='11111111-1111-4111-8111-111111111111';
export const profileId='22222222-2222-4222-8222-222222222222',objectId='33333333-3333-4333-8333-333333333333';
export const other='44444444-4444-4444-8444-444444444444',zero='0'.repeat(64);
export const event=(overrides={})=>({id:'55555555-5555-4555-8555-555555555555',kind:'profile_remove_requested',profileId,objectId:null,...overrides});
export function chain(events){let previous=zero;return events.map((event,i)=>{const r=deletionRecord({projectRef,epoch,sequence:i+1,previous,event});previous=r.sha256;return r;});}
export function journalFixture({events=[event()],minimum={sequence:0,sha256:zero},witness,readRecords,options={}}={}){
  const pair=generateKeyPairSync('ed25519'),verificationKey=Buffer.from(pair.publicKey.export({format:'jwk'}).x,'base64url').toString('hex');
  const calls=[],history=chain(events),encode=value=>Buffer.from(JSON.stringify(value));
  const signAnchor=anchor=>({anchor,signature:sign(null,deletionWitnessBytes(anchor),pair.privateKey).toString('hex')});
  const client=createAvatarDeletionJournal({enabled:true,projectRef,epoch,verificationKey,minimum,
    readWitness:async args=>{
      calls.push({phase:'witness',args});const anchor={format:1,projectRef,epoch,sequence:history.length,sha256:history.at(-1)?.sha256||zero,challenge:args.challenge,issuedAt:new Date().toISOString()};
      return witness?witness({args,anchor,signAnchor,encode}):encode(signAnchor(anchor));
    },
    readRecords:async args=>{calls.push({phase:'records',args});return readRecords?readRecords({args,history,encode,signAnchor}):encode(history);},...options});
  return {client,calls,history,encode,signAnchor,verificationKey,signBytes:bytes=>sign(null,bytes,pair.privateKey)};
}
