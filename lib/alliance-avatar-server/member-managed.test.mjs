import test from 'node:test';
import assert from 'node:assert/strict';
import {rootCertificates} from 'node:tls';
import {createAvatarLedger} from './ledger.mjs';
import {MANAGED_MEMBER_ISOLATION,memberDeploymentProfile} from './member-managed-auth.mjs';
const actor='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222';
async function fixture({profile='supabase-managed',driftAt=0}={}){
  const calls=[],releases=[];let scans=0;
  const ledger=await createAvatarLedger({enabled:true,deploymentProfile:profile,connection:{host:'db.abcdefghijklmnopqrst.supabase.co',password:'synthetic-managed-member-password-only',ca:rootCertificates[0]},openPool:()=>({on(){},end(){},async connect(){return {release:v=>releases.push(v),async query(q){calls.push(q.text);if(q.text.startsWith('select current_database')){scans++;return {rows:[{database:'postgres',actor:'alliance_avatar_executor',login:'alliance_avatar_executor',tls:true,restricted:true,isolated:scans!==driftAt,limited:true}]};}if(q.text.startsWith('SELECT alliance_avatar.'))return {rows:[{result:q.text.includes('prepare_profile_session')?{kind:'profile',profileId:actor,objectId:null,operationId:null,version:0}:{actorId:actor,sessionId:session}}]};return {command:q.text==='COMMIT'?'COMMIT':'SET'};}};}})});
  return {ledger,calls,releases,get scans(){return scans;}};
}
test('managed profile is explicit; strict retains its exact previous transaction order',async()=>{
  for(const profile of [null,true,'managed',{}]){assert.throws(()=>memberDeploymentProfile(profile));await assert.rejects(createAvatarLedger({deploymentProfile:profile}));}
  const f=await fixture({profile:'strict'});try{await f.ledger.authorizeAccountSession(actor,session);assert.equal(f.scans,1);assert.equal(f.calls.at(-1),'COMMIT');assert.ok(!f.calls[2].includes(MANAGED_MEMBER_ISOLATION));}finally{await f.ledger.close();}
});
test('managed profile requires exact verifier/admin edges before dispatch and after COMMIT',async()=>{
  const f=await fixture();try{assert.deepEqual(await f.ledger.authorizeAccountSession(actor,session),{actorId:actor,sessionId:session});assert.equal(f.scans,2);assert.equal(f.calls[2],f.calls.at(-1));assert.ok(f.calls[2].includes(MANAGED_MEMBER_ISOLATION));assert.deepEqual(f.releases,[false]);}finally{await f.ledger.close();}
});
test('pre-dispatch drift starts no member command; post-COMMIT drift withholds an uncertain mutation',async()=>{
  for(const driftAt of [1,2]){const f=await fixture({driftAt});try{await assert.rejects(f.ledger.prepareProfileSession(actor,session),e=>e.message==='avatar_ledger_unavailable'&&e.outcome===(driftAt===1?'not_started':'unknown'));assert.equal(f.calls.filter(x=>x.startsWith('SELECT alliance_avatar.')).length,driftAt===1?0:1);assert.deepEqual(f.releases,[true]);}finally{await f.ledger.close();}}
});
