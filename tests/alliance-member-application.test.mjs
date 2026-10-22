import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign} from 'node:crypto';
import {createAllianceMemberApplication} from '../lib/alliance-member-application.mjs';
import {createNetlifyGatewaySigningRuntime} from '../lib/alliance-avatar-server/netlify-signing-runtime.mjs';
import {RECOVERY_TABLES} from '../lib/alliance-avatar-server/recovery-pair.mjs';
import {startupCheckpointSha256,startupDecisionBytes} from '../lib/alliance-avatar-server/startup-gate.mjs';
import {deletionWitnessBytes} from '../lib/alliance-avatar-server/deletion-journal.mjs';
import {createMemberProfileClient} from '../assets/federation/fed-alliance-member-client.mjs';
import {createProfileRemovalClient} from '../assets/federation/fed-alliance-profile-removal-client.mjs';
import {createProfileRemovalStatusClient} from '../assets/federation/fed-alliance-profile-removal-status-client.mjs';
import {memberHttpFixture,origin,fields,operation} from './alliance-member-http.fixture.mjs';
const zero='0'.repeat(64),tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
// Three ephemeral signing roles, synthetic inventory/SQL/Auth. No private key is
// exported to a file, logged or used against a provider. Transport stays memory-only.
function fixture({readDecisionWork,drift=false}={}){
  const f=memberHttpFixture(),root=generateKeyPairSync('ed25519'),witness=generateKeyPairSync('ed25519'),caller=generateKeyPairSync('ed25519');
  const publicHex=pair=>Buffer.from(pair.publicKey.export({format:'jwk'}).x,'base64url').toString('hex');
  const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',epoch:'11111111-1111-4111-8111-111111111111'};
  const expected={siteId:'11111111-2222-4333-8444-555555555555',deployId:'1234567890abcdef12345678',context:'deploy-preview'};
  const context={site:{id:expected.siteId},deploy:{id:expected.deployId,context:expected.context}};
  const inventory=domain=>({format:2,domain,closed:true,tables:RECOVERY_TABLES[domain].map(table=>({table,rows:table.endsWith('.control')?1:0,sha256:zero})),...(domain==='journal'?{projectRef:scope.memberProjectRef,epoch:scope.epoch,sequence:0,sha256:zero}:{})});
  const checkpoint={format:2,...scope,freezeId:'66666666-6666-4666-8666-666666666666',capturedAt:new Date().toISOString(),member:inventory('member'),journal:inventory('journal')};
  f.options.ledger.recoveryInventory=()=>{const v=structuredClone(checkpoint.member);if(drift)v.tables[0].sha256='f'.repeat(64);return v;};
  f.journal.recoveryInventory=()=>structuredClone(checkpoint.journal);
  const control={state:'review',revision:1,freezeId:checkpoint.freezeId,frozenAt:new Date(Date.now()-1000).toISOString(),checkpointSha256:startupCheckpointSha256(checkpoint),floor:{sequence:0,sha256:zero}};
  const spki=caller.publicKey.export({format:'der',type:'spki'}),callerKey={keyId:createHash('sha256').update(spki).digest('hex'),spki:spki.toString('base64'),notBeforeUtc:new Date(Date.now()-10000).toISOString(),notAfterUtc:new Date(Date.now()+3600000).toISOString()};
  let keyReads=0,decisions=0,witnesses=0;
  const signing=createNetlifyGatewaySigningRuntime({enabled:true,expectedInstallation:expected,callerKey,readSecret:()=>{keyReads++;return caller.privateKey.export({format:'der',type:'pkcs8'}).toString('base64');}});
  const options={enabled:true,origin,url:f.options.url,key:f.options.key,scope,minimum:{sequence:0,sha256:zero},minimumRevision:1,startupVerificationKey:publicHex(root),journalVerificationKey:publicHex(witness),expectedInstallation:expected,
    ledger:f.options.ledger,journalStore:f.journal,anchorStore:f.anchorStore,signingRuntime:signing,processor:f.options.processor,storage:f.options.storage,fetcher:f.options.fetcher,
    readDecision:async request=>{decisions++;await readDecisionWork?.();await signing.signingKey();const decision={...request,...structuredClone(control),issuedAt:new Date().toISOString()};return Buffer.from(JSON.stringify({decision,signature:sign(null,startupDecisionBytes(decision),root.privateKey).toString('hex')}));},
    readWitness:async input=>{witnesses++;await signing.signingKey();const anchor={format:1,projectRef:scope.memberProjectRef,epoch:scope.epoch,sequence:f.journal.rows.length,sha256:f.journal.rows.at(-1)?.sha256||zero,challenge:input.challenge,issuedAt:new Date().toISOString()};return Buffer.from(JSON.stringify({anchor,signature:sign(null,deletionWitnessBytes(anchor),witness.privateKey).toString('hex')}));},
  };
  const app=createAllianceMemberApplication(options);
  const fetcher=(endpoint,init)=>app.handle(new Request(endpoint,{...init,headers:{...init.headers,origin,'sec-fetch-site':'same-origin',cookie:'__Host-gf-access='+f.token}}),context);
  return {f,app,options,context,checkpoint,control,fetcher,get counts(){return {keyReads,decisions,witnesses};},serve(){control.state='serve';control.revision++;},close(){app.close();signing.close();f.close();}};
}
test('default application has no dependency lookup, startup, signing or automatic mount',async()=>{
  const trap=new Proxy({},{get(){throw Error('No dependency lookup');}}),app=createAllianceMemberApplication({ledger:trap,scope:trap,expectedInstallation:trap});
  assert.deepEqual(await app.prepare(trap,trap),{state:'quarantine',access:'closed'});assert.equal((await app.handle(null,trap)).status,404);app.close();
});
test('real startup, per-exchange Netlify signing, journal and anchored service compose the normal member cycle',async()=>{
  const f=fixture();let n=0;const c=createMemberProfileClient({enabled:true,profileRevisions:true,origin,newOperationId:()=>operation(++n),fetcher:f.fetcher});
  const r=createProfileRemovalStatusClient({enabled:true,origin,fetcher:f.fetcher}),remove=createProfileRemovalClient({enabled:true,profileBinding:true,origin,newOperationId:()=>operation(99),fetcher:f.fetcher});
  try{
    assert.equal((await f.app.handle(f.f.request(),f.context)).status,503);assert.deepEqual(f.counts,{keyReads:0,decisions:0,witnesses:0});assert.equal(f.f.calls.length,0);
    assert.deepEqual(await f.app.prepare(f.checkpoint,f.context),{state:'prepared',access:'closed'});assert.equal(f.counts.decisions,2);assert.equal(f.counts.witnesses,0);f.serve();
    await c.load();assert.equal((await c.save(fields())).revision,1);assert.equal((await c.save({...fields(),name:'A second edit',listed:true})).revision,2);assert.equal((await c.save({...fields(),listed:false})).revision,3);
    const current=await r.read();assert.equal((await remove.confirm({...current,confirm:'remove_my_profile'})).state,'committed');assert.equal(f.f.profile,null);assert.equal(f.f.anchor.sequence,1);assert.equal(f.f.journal.rows.length,1);assert.ok(f.counts.keyReads>4);assert.ok(f.counts.witnesses>0);
  }finally{c.dispose();r.dispose();remove.dispose();f.close();}
});
test('wrong deployment context refuses before startup authority, secret read or database inspection',async()=>{
  const f=fixture();try{const context=structuredClone(f.context);context.deploy.id='f'.repeat(24);assert.deepEqual(await f.app.prepare(f.checkpoint,context),{state:'quarantine',access:'closed'});assert.deepEqual(f.counts,{keyReads:0,decisions:0,witnesses:0});assert.deepEqual(await f.app.prepare(f.checkpoint,f.context),{state:'quarantine',access:'closed'});assert.equal(f.f.calls.length,0);}finally{f.close();}
});
test('changed checkpoint refuses once and cannot be silently prepared again',async()=>{
  const f=fixture({drift:true});try{assert.deepEqual(await f.app.prepare(f.checkpoint,f.context),{state:'quarantine',access:'closed'});assert.equal(f.counts.decisions,1);assert.equal((await f.app.handle(f.f.request(),f.context)).status,503);assert.deepEqual(await f.app.prepare(f.checkpoint,f.context),{state:'quarantine',access:'closed'});assert.equal(f.counts.decisions,1);assert.equal(f.f.calls.length,0);}finally{f.close();}
});
test('serve withdrawal closes the application before Auth or profile work and never auto-reopens',async()=>{
  const f=fixture();try{await f.app.prepare(f.checkpoint,f.context);f.serve();f.control.state='closed';f.control.revision++;assert.equal((await f.app.handle(f.f.request(),f.context)).status,503);assert.equal(f.f.calls.length,0);f.serve();assert.equal((await f.app.handle(f.f.request(),f.context)).status,503);}finally{f.close();}
});
test('a different deployment cannot use an already prepared application',async()=>{
  const f=fixture();try{await f.app.prepare(f.checkpoint,f.context);f.serve();const wrong=structuredClone(f.context);wrong.site.id='ffffffff-ffff-4fff-8fff-ffffffffffff';const before=f.counts;
    assert.equal((await f.app.handle(f.f.request(),wrong)).status,503);assert.deepEqual(f.counts,before);assert.equal(f.f.calls.length,0);assert.equal((await f.app.handle(f.f.request(),f.context)).status,503);
  }finally{f.close();}
});
test('unsupported/cross-site input cannot spend a signed authority exchange after preparation',async()=>{
  const f=fixture();try{await f.app.prepare(f.checkpoint,f.context);f.serve();const before=f.counts;assert.equal((await f.app.handle(f.f.request('/me/image'),f.context)).status,404);assert.equal((await f.app.handle(f.f.request('/me',{headers:{origin:'https://other.example'}}),f.context)).status,403);assert.deepEqual(f.counts,before);}finally{f.close();}
});
test('shutdown during an uncooperative startup reply prevents late preparation and closes owned components',async()=>{
  const wait=deferred(),f=fixture({readDecisionWork:()=>wait.promise});try{const preparing=f.app.prepare(f.checkpoint,f.context);await tick();f.app.close();assert.deepEqual(await preparing,{state:'quarantine',access:'closed'});wait.resolve();await tick();assert.equal((await f.app.handle(f.f.request(),f.context)).status,503);assert.equal(f.f.dependencyCloses,0);}finally{wait.resolve();f.close();}
});
