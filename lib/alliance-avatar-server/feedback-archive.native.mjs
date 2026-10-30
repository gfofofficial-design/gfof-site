// Synthetic member9/community5/feedback4 data archives only. Other domains are
// explicit stand-ins. No production exporter, provider or real recovery key.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtempSync,realpathSync,mkdirSync,writeFileSync,readFileSync,copyFileSync,unlinkSync,rmdirSync,rmSync,lstatSync,constants} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {communityArchiveIO} from './community-archive.fixture.mjs';
import {secondCreationFixture} from './creation-second-fixture.mjs';
import {prepareCommunityMemberFixture} from './community-database.fixture.mjs';
import {managedCommunityExtensionSql} from './community-managed-install.mjs';
import {managedFeedbackExtensionSql} from './feedback-managed-install.mjs';
import {createAvatarLedger} from './ledger.mjs';
import {createAllianceCommunityStore} from './community-store.mjs';
import {createAllianceFeedbackStore} from './feedback-store.mjs';
import {createAllianceFeedbackService} from './feedback-service.mjs';
import {feedbackCheckpointSha256} from './feedback-recovery.mjs';
import {createAllianceFeedbackRecoveryPackage,FEEDBACK_RECOVERY_COMPONENTS} from './recovery-package.mjs';
import {ageToolsFixture} from './age-tools.fixture.mjs';
import {packageFixture} from './recovery-package.fixture.mjs';
import {feedbackRecoveryFixture} from './feedback-recovery.fixture.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),json=v=>Buffer.from(JSON.stringify(v)+'\n');
export async function feedbackArchiveNative({source,ledger,community,store,secondOptions,participants,saved,evidence}){
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'alliance-encrypted-'))),ios=[],buffers=[],handles=[];let identity,retained,pack,target,phase='tools';
 try{
  const tools=await ageToolsFixture(directory,process.env.ALLIANCE_AGE_TEST_RELEASE_ARCHIVE?'--cached-age':'--download-age');
  phase='capture';const member=await ledger.recoveryInventory(),collaboration=await community.inventory(),feedback=await store.inventory();
  assert.ok(feedback.tables.every(t=>t.rows>0));const exports=[];
  for(const domain of ['member','community','feedback']){const io=communityArchiveIO({domain,target:source.archiveTarget});ios.push(io);const e=io.dump();exports.push(e);buffers.push(e.bytes);}
  assert.deepEqual(await ledger.recoveryInventory(),member);assert.deepEqual(await community.inventory(),collaboration);assert.deepEqual(await store.inventory(),feedback);
  phase='encrypt';const f=packageFixture(),framing=feedbackRecoveryFixture();framing.gate.close();
  const cp={...framing.checkpoint,freezeId:randomUUID(),capturedAt:new Date().toISOString(),member,community:collaboration,feedback};
  const components=FEEDBACK_RECOVERY_COMPONENTS.map((name,i)=>({name,data:i<3?exports[i].bytes:json({coverage:'not_restored_in_this_drill',component:name})}));buffers.push(...components.slice(3).map(c=>c.data));
  identity=await tools.call(tools.keygen,[],Buffer.alloc(0));retained=Buffer.from(identity);const recipient=(await tools.call(tools.keygen,['-y'],identity)).toString().trim(),options={...f.options,recipient};
  pack=createAllianceFeedbackRecoveryPackage({...options,encryptBytes:(b,{signal})=>tools.call(tools.binary,['--encrypt','--recipient',recipient],b,signal)});
  const sealed=await pack.seal({packageId:randomUUID(),capturedAt:cp.capturedAt,sourceCommit:process.env.ALLIANCE_ENCRYPTED_ARCHIVE_SOURCE_COMMIT||'a'.repeat(40),freezeId:cp.freezeId,checkpointSha256:feedbackCheckpointSha256(cp),checkpoint:cp,trustRecord:f.input.trustRecord,components});assert.equal(sealed.state,'sealed');
  const primary=join(directory,'primary'),separate=join(directory,'separate');mkdirSync(primary,{mode:0o700});mkdirSync(separate,{mode:0o700});const first=join(primary,'package.age'),copy=join(separate,'package.age');
  writeFileSync(first,sealed.ciphertext,{flag:'wx',mode:0o600});copyFileSync(first,copy,constants.COPYFILE_EXCL);assert.equal(sha(readFileSync(copy)),sealed.descriptor.sha256);unlinkSync(first);rmdirSync(primary);pack.close();identity.fill(0);for(const b of buffers)b.fill(0);sealed.ciphertext.fill(0);
  phase='fresh_process';const input=json({profile:'feedback',identity:retained.toString('base64'),options,descriptor:sealed.descriptor,binarySha256:tools.binarySha256});let raw;
  const env={...Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP'].includes(k))),ALLIANCE_RECOVERY_PACKAGE_TEST_CONFIRM:'synthetic_encrypted_package'};
  try{raw=await new Promise((resolve,reject)=>{const child=execFile(process.execPath,[fileURLToPath(new URL('./encrypted-archive-child.fixture.mjs',import.meta.url)),tools.binary,copy],{env,encoding:'buffer',windowsHide:true,timeout:20000,maxBuffer:8*1048576},(e,out)=>e?reject(Error('Feedback byte child stopped')):resolve(out));child.stdin?.on('error',()=>{});child.stdin?.end(input);});}finally{input.fill(0);retained.fill(0);}
  const opened=JSON.parse(raw);raw.fill(0);assert.equal(opened.state,'verified_bytes');assert.equal(opened.access,'closed');assert.equal(opened.manifest.format,3);assert.equal(opened.manifest.checkpointSha256,feedbackCheckpointSha256(cp));assert.deepEqual(opened.manifest.checkpoint.feedback,feedback);
  const recovered=opened.components.map(c=>({name:c.name,data:Buffer.from(c.data,'base64')}));buffers.push(...recovered.map(c=>c.data));for(let i=0;i<3;i++)assert.equal(sha(recovered[i].data),exports[i].receipt.sha256);unlinkSync(copy);rmdirSync(separate);
  console.log('PASS actual member9/community5/feedback4 PGDMP captures exact stable inventories; real age/fresh byte-only process recover separate ciphertext after original plaintext/identity clearing; other domains remain stand-ins');
  phase='replacement_setup';target=await secondCreationFixture({...secondOptions,purpose:'replacement-control'});prepareCommunityMemberFixture(target);target.admin(managedCommunityExtensionSql());target.admin(managedFeedbackExtensionSql());const root=q=>target.admin(q,'fixture_root');
  for(const p of participants)root(`insert into auth.users values('${p.actor}',clock_timestamp(),false,null,null);insert into auth.sessions values('${p.session}','${p.actor}',null);`);
  const targets=['member','community','feedback'].map(domain=>communityArchiveIO({domain,target:target.archiveTarget,replacement:true}));ios.push(...targets);
  assert.throws(()=>targets[0].restore(recovered[0].data,exports[0].receipt),/occupied/);
  root(`do $$ begin if (select count(*) from alliance_avatar.control where id and not enabled and not creation_enabled and not cleanup_enabled and not profile_revision_enabled)<>1 or exists(select 1 from public.alliance_profiles) or (select count(*) from alliance_community.control where id and not enabled and mutations=0)<>1 or (select count(*) from alliance_feedback.control where id and not enabled and mutations=0)<>1 or exists(select 1 from alliance_feedback.ideas) then raise exception 'Replacement is not empty and closed';end if;end $$;delete from alliance_avatar.control;delete from alliance_community.control;delete from alliance_feedback.control;`);
  const bad=Buffer.from(recovered[2].data);bad[bad.length-1]^=1;assert.throws(()=>targets[2].restore(bad,exports[2].receipt));bad.fill(0);assert.throws(()=>targets[2].restore(recovered[0].data,exports[0].receipt));
  assert.throws(()=>targets[2].restore(recovered[2].data,exports[2].receipt));assert.match(root('select (select count(*) from alliance_feedback.control)+(select count(*) from alliance_feedback.ideas)+(select count(*) from alliance_feedback.supports)+(select count(*) from alliance_feedback.reports);'),/\n\s*0\s*\n/);
  phase='restore';for(let i=0;i<3;i++)targets[i].restore(recovered[i].data,exports[i].receipt);assert.throws(()=>targets[2].restore(recovered[2].data,exports[2].receipt),/occupied/);
  const password='synthetic-recovered-feedback-'+randomUUID();root(`alter role alliance_avatar_executor login password '${password}';`);const connection={...target.connection,password};
  const targetLedger=await createAvatarLedger({enabled:true,deploymentProfile:'supabase-managed',connection,openPool:target.openPool}),targetCommunity=await createAllianceCommunityStore({enabled:true,deploymentProfile:'supabase-managed',connection,openPool:target.openPool}),targetStore=await createAllianceFeedbackStore({enabled:true,deploymentProfile:'supabase-managed',connection,openPool:target.openPool});handles.push(targetLedger,targetCommunity,targetStore);
  assert.deepEqual(await targetLedger.recoveryInventory(),member);assert.deepEqual(await targetCommunity.inventory(),collaboration);assert.deepEqual(await targetStore.inventory(),feedback);
  phase='semantic_read_write';const [a,b]=participants;root('update alliance_avatar.control set enabled=true;update alliance_community.control set enabled=true;update alliance_feedback.control set enabled=true;');
  assert.deepEqual(await targetStore.read(a.actor,a.session,saved.idea.id),saved);await assert.rejects(targetStore.change(b.actor,b.session,{action:'remove',id:saved.idea.id}));
  await targetStore.change(b.actor,b.session,{action:'support',id:saved.idea.id,supported:true});assert.equal((await targetStore.read(a.actor,a.session,saved.idea.id)).idea.supportCount,1);
  const facade=createAllianceFeedbackService({enabled:true,ledger:targetLedger,store:targetStore,community:targetCommunity,journal:evidence,serving:{authorizeFeedback:async()=>true}});handles.push(facade);
  assert.deepEqual(await facade.read({actorId:a.actor,sessionId:a.session,expiresAt:Date.now()+60000},saved.idea.id),{state:'unavailable'});
  await targetStore.change(a.actor,a.session,{action:'remove',id:saved.idea.id});await assert.rejects(targetStore.read(a.actor,a.session,saved.idea.id));
  console.log('PASS different empty managed-role cluster restores all18 table hashes transactionally, rejects occupied/changed/cross-domain/missing-profile archives, preserves ownership/support/removal and withholds restored deleted supporters');
  root('update alliance_avatar.control set enabled=false;update alliance_community.control set enabled=false;update alliance_feedback.control set enabled=false;alter role alliance_avatar_executor nologin password null;');
 }catch(e){const error=Error('Synthetic feedback archive stopped ('+phase+'; '+(e?.name==='AssertionError'?'assertion':'operation_failed')+'); private detail withheld');error.code='FEEDBACK_ARCHIVE_'+phase.toUpperCase();throw error;}
 finally{
  identity?.fill(0);retained?.fill(0);pack?.close();for(const b of buffers)b.fill(0);let failed=false;
  for(const h of handles.reverse())try{await h.close();}catch{failed=true;}for(const io of ios.reverse())try{io.close();}catch{failed=true;}try{await target?.close();}catch{failed=true;}
  if(realpathSync(directory)!==directory||dirname(directory)!==realpathSync(tmpdir())||!basename(directory).startsWith('alliance-encrypted-')||lstatSync(directory).isSymbolicLink())throw Error('Wrong feedback archive cleanup');rmSync(directory,{recursive:true});if(failed)throw Error('Feedback archive fixture cleanup failed');
 }
 console.log('PASS feedback scratch, synthetic keys/pools and replacement cluster retired; no hosted account or real recovery material used');
}
