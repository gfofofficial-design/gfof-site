import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign} from 'node:crypto';
import {createAllianceMemberApplication,createAllianceCommunityApplication,createAllianceFeedbackApplication,createAllianceReportReviewApplication} from '../lib/alliance-member-application.mjs';
import {createNetlifyGatewaySigningRuntime} from '../lib/alliance-avatar-server/netlify-signing-runtime.mjs';
import {RECOVERY_TABLES} from '../lib/alliance-avatar-server/recovery-pair.mjs';
import {startupCheckpointSha256,startupDecisionBytes} from '../lib/alliance-avatar-server/startup-gate.mjs';
import {deletionWitnessBytes} from '../lib/alliance-avatar-server/deletion-journal.mjs';
import {createMemberProfileClient} from '../assets/federation/fed-alliance-member-client.mjs';
import {createProfileRemovalClient} from '../assets/federation/fed-alliance-profile-removal-client.mjs';
import {createProfileRemovalStatusClient} from '../assets/federation/fed-alliance-profile-removal-status-client.mjs';
import {memberHttpFixture,origin,fields,operation} from './alliance-member-http.fixture.mjs';
import {communityCheckpointSha256} from '../lib/alliance-avatar-server/community-recovery.mjs';
import {feedbackCheckpointSha256} from '../lib/alliance-avatar-server/feedback-recovery.mjs';
import {reportReviewCheckpointSha256} from '../lib/alliance-avatar-server/report-review-recovery.mjs';
import {createAllianceReportReviewClient} from '../assets/federation/fed-alliance-report-review-client.mjs';
import {createFiniteAlliancePreviewHost} from '../lib/alliance-member-finite-host.mjs';
const zero='0'.repeat(64),tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
// Three ephemeral signing roles, synthetic inventory/SQL/Auth. No private key is
// exported to a file, logged or used against a provider. Transport stays memory-only.
function fixture({readDecisionWork,drift=false,withCommunity=false,withFeedback=false,withReview=false}={}){
  withFeedback=withFeedback||withReview;withCommunity=withCommunity||withFeedback;
  const f=memberHttpFixture(),root=generateKeyPairSync('ed25519'),witness=generateKeyPairSync('ed25519'),caller=generateKeyPairSync('ed25519');
  const publicHex=pair=>Buffer.from(pair.publicKey.export({format:'jwk'}).x,'base64url').toString('hex');
  const scope={memberProjectRef:'abcdefghijklmnopqrst',journalProjectRef:'uvwxyzabcdefghijklmn',epoch:'11111111-1111-4111-8111-111111111111'};
  const expected={siteId:'11111111-2222-4333-8444-555555555555',deployId:'1234567890abcdef12345678',context:'deploy-preview'};
  const context={site:{id:expected.siteId},deploy:{id:expected.deployId,context:expected.context}};
  const inventory=domain=>({format:2,domain,closed:true,tables:RECOVERY_TABLES[domain].map(table=>({table,rows:table.endsWith('.control')?1:0,sha256:zero})),...(domain==='journal'?{projectRef:scope.memberProjectRef,epoch:scope.epoch,sequence:0,sha256:zero}:{})});
  const checkpoint={format:2,...scope,freezeId:'66666666-6666-4666-8666-666666666666',capturedAt:new Date().toISOString(),member:inventory('member'),journal:inventory('journal')};
  if(withCommunity){checkpoint.format=3;checkpoint.community={format:1,domain:'community',closed:true,tables:['control','challenges','contributions','operations','blocks'].map(t=>({table:'alliance_community.'+t,rows:t==='control'?1:0,sha256:zero}))};}
  if(withFeedback){checkpoint.format=4;checkpoint.feedback={format:1,domain:'feedback',closed:true,tables:['control','ideas','supports','reports'].map(t=>({table:'alliance_feedback.'+t,rows:t==='control'?1:0,sha256:zero}))};}
  if(withReview){checkpoint.format=5;checkpoint.reportReview={format:1,closed:true,expiredReports:0,tables:[{table:'alliance_report_review.control',rows:1,sha256:zero},{table:'alliance_report_review.reviews',rows:0,sha256:zero}]};}
  f.options.ledger.recoveryInventory=()=>{const v=structuredClone(checkpoint.member);if(drift)v.tables[0].sha256='f'.repeat(64);return v;};
  f.journal.recoveryInventory=()=>structuredClone(checkpoint.journal);
  const control={state:'review',revision:1,freezeId:checkpoint.freezeId,frozenAt:new Date(Date.now()-1000).toISOString(),checkpointSha256:(withReview?reportReviewCheckpointSha256:withFeedback?feedbackCheckpointSha256:withCommunity?communityCheckpointSha256:startupCheckpointSha256)(checkpoint),floor:{sequence:0,sha256:zero}};
  const spki=caller.publicKey.export({format:'der',type:'spki'}),callerKey={keyId:createHash('sha256').update(spki).digest('hex'),spki:spki.toString('base64'),notBeforeUtc:new Date(Date.now()-10000).toISOString(),notAfterUtc:new Date(Date.now()+3600000).toISOString()};
  let keyReads=0,decisions=0,witnesses=0;
  const signing=createNetlifyGatewaySigningRuntime({enabled:true,expectedInstallation:expected,callerKey,readSecret:()=>{keyReads++;return caller.privateKey.export({format:'der',type:'pkcs8'}).toString('base64');}});
  const options={enabled:true,origin,url:f.options.url,key:f.options.key,scope,minimum:{sequence:0,sha256:zero},minimumRevision:1,startupVerificationKey:publicHex(root),journalVerificationKey:publicHex(witness),expectedInstallation:expected,
    ledger:f.options.ledger,journalStore:f.journal,anchorStore:f.anchorStore,signingRuntime:signing,processor:f.options.processor,storage:f.options.storage,fetcher:f.options.fetcher,
    readDecision:async request=>{decisions++;await readDecisionWork?.();await signing.signingKey();const decision={...request,...structuredClone(control),issuedAt:new Date().toISOString()};return Buffer.from(JSON.stringify({decision,signature:sign(null,startupDecisionBytes(decision),root.privateKey).toString('hex')}));},
    readWitness:async input=>{witnesses++;await signing.signingKey();const anchor={format:1,projectRef:scope.memberProjectRef,epoch:scope.epoch,sequence:f.journal.rows.length,sha256:f.journal.rows.at(-1)?.sha256||zero,challenge:input.challenge,issuedAt:new Date().toISOString()};return Buffer.from(JSON.stringify({anchor,signature:sign(null,deletionWitnessBytes(anchor),witness.privateKey).toString('hex')}));},
  };
  if(withCommunity)options.communityStore={inventory:async()=>structuredClone(checkpoint.community),list:async()=>({items:[],next:null}),read:async()=>{throw Error('No fixture challenge');},change:async(a,s,input)=>({state:'conflict',revision:1}),block:async(a,s,input)=>({...input})};
  if(withFeedback)options.feedbackStore={inventory:async()=>structuredClone(checkpoint.feedback),list:async()=>({items:[],next:null}),read:async()=>{throw Error('No fixture idea');},change:async(a,s,input)=>({state:'recorded',id:input.id,kind:input.kind,target:input.target,removed:false})};
  if(withReview){
   options.reviewerActor='11111111-1111-4111-8111-111111111111';
   const report={id:operation(85),kind:'member',target:'99999999-9999-4999-8999-999999999999',contextState:'available',contextLoaded:true,targetTitle:'Fictional member',targetSummary:'A fictional context served only during this local test.',createdAt:new Date(Date.now()-1000).toISOString(),reviewedAt:null,disposition:'unreviewed',expiresAt:new Date(Date.now()-1000+90*86400000).toISOString()};
   const evidence=loaded=>({record:{...report,contextLoaded:loaded,...(!loaded?{targetTitle:null,targetSummary:null}:{})},evidenceProfiles:['88888888-8888-4888-8888-888888888888',report.target]});
   options.reportReviewStore={inventory:async()=>structuredClone(checkpoint.reportReview),listEvidence:async()=>({items:[evidence(false)],next:null}),readEvidence:async()=>evidence(true),reviewEvidence:async(a,s,v)=>{report.disposition=v.disposition;report.reviewedAt??=new Date().toISOString();report.expiresAt=new Date(Date.parse(report.reviewedAt)+30*86400000).toISOString();return evidence(true);}};
  }
  const app=(withReview?createAllianceReportReviewApplication:withFeedback?createAllianceFeedbackApplication:withCommunity?createAllianceCommunityApplication:createAllianceMemberApplication)(options);
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
test('malformed member queries are refused before any signed authority, Auth or profile work',async()=>{
  const f=fixture();try{
    await f.app.prepare(f.checkpoint,f.context);f.serve();const before=f.counts;
    for(const [path,method]of [
      ['/me?ignored=1','GET'],['/me?actorId=fixture','POST'],
      ['/me/profile?ignored=1','DELETE'],['/me/profile/removal-status?ignored=1','GET'],
      ['/directory?ignored=1','GET'],['/directory?limit=0','GET'],['/directory?limit=21','GET'],
      ['/directory?limit=1&limit=2','GET'],['/directory?after=invalid','GET'],
      ['/directory?after=11111111-1111-4111-8111-111111111111&after=22222222-2222-4222-8222-222222222222','GET']
    ]){
      const response=await f.app.handle(f.f.request(path,{method}),f.context);
      assert.deepEqual(f.counts,before,'malformed query spent an authority exchange: '+path);
      assert.equal(response.status,404,path);assert.equal(f.f.calls.length,0,path);
    }
    assert.equal((await f.app.handle(f.f.request('/directory?limit=1&after=11111111-1111-4111-8111-111111111111'),f.context)).status,200);
    assert.ok(f.counts.decisions>before.decisions);
  }finally{f.close();}
});
test('malformed collaboration, feedback and owner-review queries cannot spend an authority exchange',async()=>{
  const f=fixture({withReview:true}),client=createMemberProfileClient({enabled:true,profileRevisions:true,origin,newOperationId:()=>operation(86),fetcher:f.fetcher});try{
    await f.app.prepare(f.checkpoint,f.context);f.serve();const before=f.counts;
    for(const [path,method]of [
      ['/community/challenges?limit=0','GET'],['/community/challenge','GET'],['/community/challenge?id=invalid','GET'],
      ['/community/change?ignored=1','POST'],['/community/visibility?ignored=1','POST'],
      ['/feedback/ideas?limit=6','GET'],['/feedback/idea?id=invalid','GET'],['/feedback/change?ignored=1','POST'],
      ['/report-review/reports?limit=1&limit=2','GET'],['/report-review/report?id=invalid','GET'],['/report-review/review?ignored=1','POST']
    ]){
      const response=await f.app.handle(f.f.request(path,{method}),f.context);
      assert.deepEqual(f.counts,before,'malformed query spent an authority exchange: '+path);
      assert.equal(response.status,404,path);assert.equal(f.f.calls.length,0,path);
    }
    await client.load();await client.save({...fields(),listed:true});
    for(const path of ['/community/challenges?limit=1','/feedback/ideas?limit=1','/report-review/reports?limit=1']){
      assert.equal((await f.app.handle(f.f.request(path),f.context)).status,200,path);
    }
    assert.ok(f.counts.decisions>before.decisions);
  }finally{client.dispose();f.close();}
});
test('shutdown during an uncooperative startup reply prevents late preparation and closes owned components',async()=>{
  const wait=deferred(),f=fixture({readDecisionWork:()=>wait.promise});try{const preparing=f.app.prepare(f.checkpoint,f.context);await tick();f.app.close();assert.deepEqual(await preparing,{state:'quarantine',access:'closed'});wait.resolve();await tick();assert.equal((await f.app.handle(f.f.request(),f.context)).status,503);assert.equal(f.f.dependencyCloses,0);}finally{wait.resolve();f.close();}
});


test('combined application binds format3 startup to both profile and verified-cookie community paths',async()=>{
 const f=fixture({withCommunity:true}),client=createMemberProfileClient({enabled:true,profileRevisions:true,origin,newOperationId:()=>operation(80),fetcher:f.fetcher});
 try{
  assert.deepEqual(await f.app.prepare(f.checkpoint,f.context),{state:'prepared',access:'closed'});f.serve();
  await client.load();await client.save({...fields(),listed:true});assert.ok(f.f.profile);
  const list=await f.app.handle(f.f.request('/community/challenges'),f.context);assert.equal(list.status,200);assert.deepEqual(await list.json(),{state:'ready',page:{items:[],next:null}});
  const target='99999999-9999-4999-8999-999999999999';
  const hidden=await f.app.handle(f.f.request('/community/visibility',{method:'POST',body:{target,hidden:true}}),f.context);assert.equal(hidden.status,200);assert.deepEqual(await hidden.json(),{state:'set',target,hidden:true});
  f.f.activeSession=false;assert.equal((await f.app.handle(f.f.request('/community/challenges'),f.context)).status,403);
 }finally{client.dispose();f.close();}
});
test('combined application rejects legacy checkpoint and cannot borrow a prepared profile gate',async()=>{
 const f=fixture({withCommunity:true});try{const legacy={...f.checkpoint,format:2};delete legacy.community;assert.deepEqual(await f.app.prepare(legacy,f.context),{state:'quarantine',access:'closed'});assert.equal((await f.app.handle(f.f.request('/community/challenges'),f.context)).status,503);}finally{f.close();}
 const old=fixture();try{await old.app.prepare(old.checkpoint,old.context);old.serve();const before=old.counts;assert.equal((await old.app.handle(old.f.request('/community/challenges'),old.context)).status,404);assert.deepEqual(old.counts,before);}finally{old.close();}
});
test('combined serving withdrawal closes both profile and community routes before Auth',async()=>{
 const f=fixture({withCommunity:true});try{await f.app.prepare(f.checkpoint,f.context);f.serve();f.control.state='closed';f.control.revision++;const before=f.f.calls.length;assert.equal((await f.app.handle(f.f.request('/community/challenges'),f.context)).status,503);assert.equal(f.f.calls.length,before);f.serve();assert.equal((await f.app.handle(f.f.request(),f.context)).status,503);}finally{f.close();}
});

test('explicit feedback application binds all four recovery domains and protects cookie paths under the shared authority',async()=>{
 const f=fixture({withFeedback:true}),client=createMemberProfileClient({enabled:true,profileRevisions:true,origin,newOperationId:()=>operation(81),fetcher:f.fetcher});
 try{
  assert.deepEqual(await f.app.prepare(f.checkpoint,f.context),{state:'prepared',access:'closed'});f.serve();await client.load();await client.save(fields());
  const list=await f.app.handle(f.f.request('/feedback/ideas'),f.context);assert.equal(list.status,200);assert.deepEqual(await list.json(),{state:'ready',page:{items:[],next:null}});
  const target='99999999-9999-4999-8999-999999999999',command={action:'report',id:operation(82),kind:'member',target};
  const report=await f.app.handle(f.f.request('/feedback/change',{method:'POST',body:command}),f.context);assert.equal(report.status,200);assert.deepEqual(await report.json(),{state:'recorded',id:command.id,kind:'member',target,removed:false});
  f.control.state='closed';f.control.revision++;const before=f.f.calls.length;assert.equal((await f.app.handle(f.f.request('/feedback/ideas'),f.context)).status,503);assert.equal(f.f.calls.length,before);
 }finally{client.dispose();f.close();}
});
test('old applications cannot route feedback and missing feedback coverage cannot prepare the expanded application',async()=>{
 for(const withCommunity of [false,true]){const f=fixture({withCommunity});try{await f.app.prepare(f.checkpoint,f.context);f.serve();const before=f.counts;assert.equal((await f.app.handle(f.f.request('/feedback/ideas'),f.context)).status,404);assert.deepEqual(f.counts,before);}finally{f.close();}}
 const f=fixture({withFeedback:true});try{const old={...f.checkpoint,format:3};delete old.feedback;assert.deepEqual(await f.app.prepare(old,f.context),{state:'quarantine',access:'closed'});assert.equal(f.counts.decisions,0);}finally{f.close();}
});


test('review-aware combined application serves the real cookie client under signed checkpoint5',async()=>{
 const f=fixture({withReview:true}),c=createAllianceReportReviewClient({enabled:true,origin,fetcher:f.fetcher});
 try{
  assert.deepEqual(await f.app.prepare(f.checkpoint,f.context),{state:'prepared',access:'closed'});f.serve();
  assert.equal((await c.list()).items.length,1);assert.equal((await c.read(operation(85))).targetTitle,'Fictional member');
  assert.equal((await c.review({id:operation(85),expected:'unreviewed',disposition:'no_action'})).disposition,'no_action');
  f.control.state='closed';f.control.revision++;const before=f.f.calls.length;assert.equal((await f.app.handle(f.f.request('/report-review/reports'),f.context)).status,503);assert.equal(f.f.calls.length,before);
 }finally{c.close();f.close();}
});
test('review application rejects incomplete recovery; legacy apps do not route private review',async()=>{
 const f=fixture({withReview:true});try{const old={...f.checkpoint,format:4};delete old.reportReview;assert.deepEqual(await f.app.prepare(old,f.context),{state:'quarantine',access:'closed'});assert.equal(f.counts.decisions,0);}finally{f.close();}
 const old=fixture({withFeedback:true});try{await old.app.prepare(old.checkpoint,old.context);old.serve();const before=old.counts;assert.equal((await old.app.handle(old.f.request('/report-review/reports'),old.context)).status,404);assert.deepEqual(old.counts,before);}finally{old.close();}
});

test('finite preview host carries the existing cookie profile and owner-review journey then closes without new work',async()=>{
 const f=fixture({withReview:true}),now=Date.now();
 const host=createFiniteAlliancePreviewHost({enabled:true,origin,expectedInstallation:f.options.expectedInstallation,
  window:{notBeforeUtc:new Date(now-1000).toISOString(),notAfterUtc:new Date(now+120000).toISOString()},
  openApplication:async()=>({application:f.app,close:()=>f.close()})});
 const fetcher=(endpoint,init)=>host.handle(new Request(endpoint,{...init,headers:{...init.headers,origin,'sec-fetch-site':'same-origin',cookie:'__Host-gf-access='+f.f.token}}),f.context);
 const profile=createMemberProfileClient({enabled:true,profileRevisions:true,origin,newOperationId:()=>operation(91),fetcher});
 const review=createAllianceReportReviewClient({enabled:true,origin,fetcher});
 try{
  assert.deepEqual(await host.prepare(f.checkpoint,f.context),{state:'prepared',access:'closed'});f.serve();
  await profile.load();assert.equal((await profile.save(fields())).revision,1);
  assert.equal((await review.list()).items.length,1);await review.read(operation(85));
  assert.equal((await review.review({id:operation(85),expected:'unreviewed',disposition:'no_action'})).disposition,'no_action');
  await host.close();const before=f.counts;
  assert.equal((await host.handle(f.f.request('/report-review/reports'),f.context)).status,503);assert.deepEqual(f.counts,before);
 }finally{profile.dispose();review.close();await host.close();f.close();}
});
