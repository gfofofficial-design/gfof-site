// Actual third disposable PG server; no real credentials, hosted project or key.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {generateKeyPairSync,sign,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {secondCreationFixture} from './creation-second-fixture.mjs';
import {createAllianceControlStore} from './control-store.mjs';
import {controlPolicy} from './control-policy.mjs';
import {createAllianceControlAuthority} from './control-authority.mjs';
import {createAllianceStartupGate,startupCheckpointSha256} from './startup-gate.mjs';
import {deletionRecord} from './deletion-journal.mjs';
export async function controlNative({mainTarget,ledger,journal,evidence}){
 const third=await secondCreationFixture({...mainTarget,purpose:'control'}),admin=third.admin,cp=evidence.checkpoint,scope={memberProjectRef:cp.memberProjectRef,journalProjectRef:cp.journalProjectRef,controlProjectRef:'opqrstuvwxyzabcdefgh',epoch:cp.epoch};
 let reader,operator,config,installed=false;const authorities=[],gates=[];
 const open=async()=>{reader=await createAllianceControlStore({enabled:true,...scope,connection:third.connection,openPool:c=>{config=c;return third.openPool(c);}});operator=third.openPool({...config,user:'alliance_control_operator',password:'synthetic-control-operator-password-only'});};
 async function mutation(name,values,{discard=false,rollback=false}={}){
  const client=await operator.connect();let committed=false;
  try{await client.query('BEGIN');await client.query("SET LOCAL synchronous_commit='on';SET LOCAL statement_timeout='2000ms';SET LOCAL lock_timeout='750ms'");
   const sig=name==='bootstrap'?'$1::text,$2::text,$3::uuid,$4::uuid':'$1::text,$2::text,$3::uuid,$4::integer,$5::text,$6::uuid,$7::jsonb,$8::jsonb';
   const r=await client.query('SELECT alliance_control.'+name+'('+sig+') AS result',values);
   await client.query(rollback?'ROLLBACK':'COMMIT');committed=true;if(discard)throw Error('synthetic_lost_commit_reply');return r.rows[0].result;
  }catch(e){if(!committed)await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
 const binding=(p,state=p.state)=>({state,freezeId:p.freezeId,frozenAt:p.frozenAt,checkpointSha256:p.checkpointSha256,floor:p.floor});
 const transition=(p,policy,records=[],options)=>mutation('transition',[scope.memberProjectRef,scope.journalProjectRef,scope.epoch,p.revision,p.sha256,randomUUID(),JSON.stringify(policy),JSON.stringify(records)],options);
 const pair=generateKeyPairSync('ed25519'),verificationKey=Buffer.from(pair.publicKey.export({format:'jwk'}).x,'base64url').toString('hex');
 const authority=(pin,signer=bytes=>sign(null,bytes,pair.privateKey))=>{const a=createAllianceControlAuthority({enabled:true,...scope,verificationKey,minimum:{revision:pin.revision,sha256:pin.sha256,floor:pin.floor},store:reader,signBytes:signer});authorities.push(a);return a;};
 const gate=(a,minimum)=>{const g=createAllianceStartupGate({enabled:true,...scope,verificationKey,minimumRevision:minimum.revision,minimum:minimum.floor,ledger,journal,readDecision:async(request,options)=>{const r=await a.issue(request,options);if(r.state!=='signed')throw Error('Synthetic unavailable');return r.bytes;}});gates.push(g);return g;};
 try{
  admin('create role anon nologin;create role authenticated nologin;create role service_role nologin;begin;'+readFileSync(new URL('../../sql/alliance-control-store-candidate.sql',import.meta.url),'utf8')+'commit;');
  installed=true;
  assert.match(admin("select count(*) from pg_roles where rolname in('alliance_control_owner','alliance_control_reader','alliance_control_operator') and not rolcanlogin and not rolsuper and not rolinherit;"),/\n\s*3\s*\n/);
  admin("alter role alliance_control_reader login password 'synthetic-journal-creation-password-only' valid until '2099-01-01';alter role alliance_control_operator login password 'synthetic-control-operator-password-only' valid until '2099-01-01';");
  await open();await assert.rejects(reader.read());
  const initial=controlPolicy(await mutation('bootstrap',[scope.memberProjectRef,scope.journalProjectRef,scope.epoch,randomUUID()]));assert.equal(initial.state,'closed');assert.equal(initial.revision,1);assert.equal((await reader.read()).sha256,initial.sha256);
  await assert.rejects(mutation('bootstrap',[scope.memberProjectRef,scope.journalProjectRef,scope.epoch,randomUUID()]));
  console.log('PASS third dedicated control server installs three locked roles/private forced-RLS singleton; reader never initializes missing control and explicit bootstrap remains closed');
  const history=await journal.records({sequence:cp.journal.sequence,sha256:cp.journal.sha256});
  const reviewPolicy={state:'review',freezeId:evidence.freezeId,frozenAt:evidence.frozenAt,checkpointSha256:startupCheckpointSha256(cp),floor:{sequence:cp.journal.sequence,sha256:cp.journal.sha256}};
  const review=controlPolicy((await transition(initial,reviewPolicy,history)).policy);assert.equal(review.revision,2);
  const a=authority(initial),g=gate(a,review);assert.equal(await g.authorize(),false);assert.deepEqual(await g.prepare(cp),{state:'prepared',access:'closed'});
  const competing=await Promise.all([transition(review,binding(review,'serve')),transition(review,binding(review,'serve'))]);assert.equal(competing.filter(x=>x.state==='committed').length,1);assert.equal(competing.filter(x=>x.state==='conflict').length,1);
  let current=await reader.read();assert.equal(current.revision,3);assert.equal(current.state,'serve');assert.equal(await g.authorize(),true);
  console.log('PASS actual three-server composition verifies persisted review, fresh signed startup preparation and separate release; concurrent CAS requests yield exactly one commit and one conflict');
  const snapshot=await reader.read(),client=await third.openPool(config).connect();
  try{await assert.rejects(client.query('select * from alliance_control.policy'),e=>e.code==='42501');await assert.rejects(client.query('select alliance_control.bootstrap($1,$2,$3,$4)',[scope.memberProjectRef,scope.journalProjectRef,scope.epoch,randomUUID()]),e=>e.code==='42501');}finally{client.release();}
  assert.deepEqual(await reader.read(),snapshot);assert.equal((await ledger.recoveryInventory()).closed,true);assert.equal((await journal.recoveryInventory()).closed,true);
  console.log('PASS read identity has no direct table, bootstrap or mutation capability; authority signing never opens either data-domain switch');
  await assert.rejects(operator.query('select * from alliance_control.policy'),e=>e.code==='42501');
  for(const grant of ['DELETE','SELECT(revision)']){admin('grant '+grant+' on alliance_control.policy to alliance_control_reader;');try{await assert.rejects(reader.read());}finally{admin('revoke '+grant+' on alliance_control.policy from alliance_control_reader;');}}
  assert.deepEqual(await reader.read(),snapshot);
  console.log('PASS runtime identity rejects accidental table-delete and column-select grants; exact revoked rights restore readonly access and operator has no direct table access');
  await assert.rejects(transition(current,binding(current,'closed'),[],{discard:true}),/synthetic_lost_commit_reply/);
  current=await reader.read();assert.equal(current.state,'closed');assert.equal(current.revision,4);assert.equal(await g.authorize(),false);assert.equal(await g.authorize(),false);
  console.log('PASS lost operator COMMIT reply is reconciled by an independent read without retry; committed closure invalidates the live serving consumer');
  const newReview={...reviewPolicy,freezeId:randomUUID(),frozenAt:new Date().toISOString()};
  await transition(current,newReview,history,{rollback:true});assert.deepEqual(await reader.read(),current);
  const newRow=controlPolicy((await transition(current,newReview,history)).policy);assert.equal(newRow.revision,5);
  const closing=authority(newRow,async bytes=>{await transition(newRow,binding(newRow,'closed'));return sign(null,bytes,pair.privateKey);});
  const request={format:1,memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch,bootId:'a'.repeat(64),challenge:'b'.repeat(64)};
  assert.deepEqual(await closing.issue(request),{state:'unavailable'});current=await reader.read();assert.equal(current.revision,6);assert.equal(current.state,'closed');
  console.log('PASS rollback leaves durable revision unchanged; closure committed during signing discards otherwise valid response and latches authority unavailable');
  const forkFirst=deletionRecord({projectRef:scope.memberProjectRef,epoch:scope.epoch,sequence:1,previous:'0'.repeat(64),event:{...history[0].event,profileId:'99999999-9999-4999-8999-999999999999'}});
  const forkSecond=deletionRecord({projectRef:scope.memberProjectRef,epoch:scope.epoch,sequence:2,previous:forkFirst.sha256,event:{...history[0].event,id:randomUUID()}});
  const two=deletionRecord({projectRef:scope.memberProjectRef,epoch:scope.epoch,sequence:2,previous:history[0].sha256,event:{...history[0].event,id:randomUUID()}});
  for(const [policy,rows] of [[{...newReview,freezeId:randomUUID(),floor:{sequence:0,sha256:'0'.repeat(64)}},[]],[{...newReview,freezeId:randomUUID(),floor:{sequence:1,sha256:'a'.repeat(64)}},[]],[{...newReview,freezeId:randomUUID(),floor:{sequence:2,sha256:forkSecond.sha256}},[forkFirst,forkSecond]],[{...newReview,freezeId:randomUUID(),floor:{sequence:2,sha256:two.sha256}},[history[0]]],[{...newReview,freezeId:randomUUID(),floor:{sequence:2,sha256:two.sha256}},[history[0],{...two,extra:'PRIVATE'}]]])await assert.rejects(transition(current,policy,rows));
  assert.deepEqual(await reader.read(),current);
  console.log('PASS SQL rejects deletion-floor regression, same-height fork, higher forked prefix, partial chain and extra record fields without advancing persistent revision');
  const conflict=await transition({...current,sha256:'a'.repeat(64)},{...newReview,freezeId:randomUUID()},history);assert.equal(conflict.state,'conflict');assert.deepEqual(await reader.read(),current);
  const higher=controlPolicy((await transition(current,{...newReview,freezeId:randomUUID(),floor:{sequence:2,sha256:two.sha256}},[...history,two])).policy);assert.equal(higher.floor.sequence,2);
  current=controlPolicy((await transition(higher,binding(higher,'closed'))).policy);assert.equal(current.revision,8);
  console.log('PASS exact revision plus content digest rejects same-revision stale state; a full chain extending a nonzero floor advances once and closure preserves the higher floor');
  await reader.close();await operator.end();for(const v of authorities)v.close();for(const v of gates)v.close();
  await third.restart();await open();assert.deepEqual(await reader.read(),current);
  const childConfig={...config,host:'127.0.0.1',port:mainTarget.local?55490:54331,ssl:{...config.ssl,servername:'localhost'}};
  const childHash=execFileSync(process.execPath,[fileURLToPath(new URL('./control-read.fixture.mjs',import.meta.url))],{input:JSON.stringify({config:childConfig,scope}),encoding:'utf8',timeout:10000,maxBuffer:4096}).trim();assert.equal(childHash,current.sha256);
  console.log('PASS committed control state survives actual database stop/start and fresh Node process with certificate validation; member and journal domains remain separate');
  const fresh=authority(current),closedGate=gate(fresh,current);assert.deepEqual(await closedGate.prepare(cp),{state:'quarantine',access:'closed'});assert.equal(await closedGate.authorize(),false);
  admin("update alliance_control.policy set revision=1,state='closed',freeze_id=null,frozen_at=null,checkpoint_sha256=null,floor_sequence=0,floor_sha256=repeat('0',64);");
  assert.deepEqual(await authority(current).issue(request),{state:'unavailable'});
  admin('delete from alliance_control.policy;');await assert.rejects(reader.read());assert.deepEqual(await authority(current).issue(request),{state:'unavailable'});
  console.log('PASS independently supplied newer pin refuses privileged simulated rollback after restart; missing control row stays unavailable without recreating genesis');
 }finally{
  for(const v of authorities)v.close();for(const v of gates)v.close();await reader?.close();if(operator&&!operator.ended)await operator.end();
  try{if(installed)admin('begin;drop owned by alliance_control_owner,alliance_control_reader,alliance_control_operator,anon,authenticated,service_role cascade;drop schema if exists alliance_control cascade;drop role alliance_control_owner,alliance_control_reader,alliance_control_operator,anon,authenticated,service_role;commit;');}finally{await third.close();}
  console.log('PASS exact synthetic third control server, singleton, roles, pools and restart artifacts removed; no hosted access or real signing key');
 }
}
