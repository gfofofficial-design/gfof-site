// Actual member9/community5 PGDMP -> age -> fresh-process bytes -> different
// disposable server. Other recovery domains/dependencies remain stand-ins.
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
import {createAvatarLedger} from './ledger.mjs';
import {createAllianceCommunityStore} from './community-store.mjs';
import {createAllianceCommunityService} from './community-service.mjs';
import {communityCheckpointSha256} from './community-recovery.mjs';
import {createAllianceCommunityRecoveryPackage,COMMUNITY_RECOVERY_COMPONENTS} from './recovery-package.mjs';
import {ageToolsFixture} from './age-tools.fixture.mjs';
import {packageFixture} from './recovery-package.fixture.mjs';
import {communityRecoveryFixture} from './community-recovery.fixture.mjs';
import {collaborationId} from '../../assets/federation/fed-alliance-collaboration-contract.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),json=v=>Buffer.from(JSON.stringify(v)+'\n');
export async function communityArchiveNative({source,ledger,store,secondOptions,participants,saved,pendingCommand,evidence}){
 if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture'||process.env.ALLIANCE_RECOVERY_PACKAGE_TEST_CONFIRM!=='synthetic_encrypted_package'||participants?.length!==3||participants.some(p=>!collaborationId(p.actor)||!collaborationId(p.session)))throw Error('Wrong community archive drill');
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'alliance-encrypted-'))),ios=[],buffers=[],handles=[];let identity,retained,pack,target,phase='tools';
 try{
  const tools=await ageToolsFixture(directory,process.env.ALLIANCE_AGE_TEST_RELEASE_ARCHIVE?'--cached-age':'--download-age');
  phase='capture';const member=await ledger.recoveryInventory(),community=await store.inventory();
  assert.equal(member.closed,true);assert.equal(community.closed,true);assert.equal(community.tables.every(t=>t.rows>0),true);
  const exports=[];
  for(const domain of ['member','community']){const io=communityArchiveIO({domain,target:source.archiveTarget});ios.push(io);const e=io.dump();exports.push({...e,domain});buffers.push(e.bytes);}
  assert.deepEqual(await ledger.recoveryInventory(),member);assert.deepEqual(await store.inventory(),community);
  console.log('PASS actual nonempty member9/community5 data-only PGDMP capture has exact object lists, stable closed row digests and all five community tables represented; source plaintext files removed');
  phase='encrypt';const f=packageFixture(),framing=communityRecoveryFixture();framing.gate.close();
  const cp={...framing.checkpoint,freezeId:randomUUID(),capturedAt:new Date().toISOString(),member,community};
  const components=COMMUNITY_RECOVERY_COMPONENTS.map(name=>({name,data:name==='member-data'?exports[0].bytes:name==='community-data'?exports[1].bytes:json({coverage:'not_restored_in_this_drill',component:name,canonicalSchemasRecreated:name==='schema-security',syntheticAuthDependenciesSeeded:name==='auth'})}));
  buffers.push(...components.slice(2).map(c=>c.data));
  identity=await tools.call(tools.keygen,[],Buffer.alloc(0));retained=Buffer.from(identity);const recipient=(await tools.call(tools.keygen,['-y'],identity)).toString().trim();
  const options={...f.options,recipient};pack=createAllianceCommunityRecoveryPackage({...options,encryptBytes:(b,{signal})=>tools.call(tools.binary,['--encrypt','--recipient',recipient],b,signal)});
  const sealed=await pack.seal({packageId:randomUUID(),capturedAt:cp.capturedAt,sourceCommit:process.env.ALLIANCE_ENCRYPTED_ARCHIVE_SOURCE_COMMIT||'a'.repeat(40),freezeId:cp.freezeId,checkpointSha256:communityCheckpointSha256(cp),checkpoint:cp,trustRecord:f.input.trustRecord,components});assert.equal(sealed.state,'sealed');
  const primary=join(directory,'primary'),separate=join(directory,'separate');mkdirSync(primary,{mode:0o700});mkdirSync(separate,{mode:0o700});const first=join(primary,'package.age'),copy=join(separate,'package.age');
  writeFileSync(first,sealed.ciphertext,{flag:'wx',mode:0o600});copyFileSync(first,copy,constants.COPYFILE_EXCL);assert.equal(sha(readFileSync(copy)),sealed.descriptor.sha256);unlinkSync(first);rmdirSync(primary);pack.close();identity.fill(0);for(const b of buffers)b.fill(0);sealed.ciphertext.fill(0);
  phase='fresh_process';const input=json({profile:'community',identity:retained.toString('base64'),options,descriptor:sealed.descriptor,binarySha256:tools.binarySha256});let raw;
  const env={...Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP'].includes(k))),ALLIANCE_RECOVERY_PACKAGE_TEST_CONFIRM:'synthetic_encrypted_package'};
  try{raw=await new Promise((resolve,reject)=>{const child=execFile(process.execPath,[fileURLToPath(new URL('./encrypted-archive-child.fixture.mjs',import.meta.url)),tools.binary,copy],{env,encoding:'buffer',windowsHide:true,timeout:20000,maxBuffer:8*1048576},(e,out)=>e?reject(Error('Community byte child stopped')):resolve(out));child.stdin?.on('error',()=>{});child.stdin?.end(input);});}finally{input.fill(0);retained.fill(0);}
  const opened=JSON.parse(raw);raw.fill(0);assert.equal(opened.state,'verified_bytes');assert.equal(opened.access,'closed');assert.equal(opened.manifest.checkpointSha256,communityCheckpointSha256(cp));assert.deepEqual(opened.manifest.checkpoint.community,community);
  const recovered=opened.components.map(c=>({name:c.name,data:Buffer.from(c.data,'base64')}));buffers.push(...recovered.map(c=>c.data));
  for(let n=0;n<2;n++)assert.equal(sha(recovered[n].data),exports[n].receipt.sha256);
  unlinkSync(copy);rmdirSync(separate);
  console.log('PASS real age and a fresh byte-only process recover exact member/community PGDMP from a separate same-host ciphertext after primary/plaintext/export buffers are cleared; other domains are explicit stand-ins');
  phase='replacement_setup';target=await secondCreationFixture({...secondOptions,purpose:'replacement-control'});prepareCommunityMemberFixture(target);target.admin(managedCommunityExtensionSql());const root=q=>target.admin(q,'fixture_root');
  for(const p of participants)root(`insert into auth.users values('${p.actor}',clock_timestamp(),false,null,null);insert into auth.sessions values('${p.session}','${p.actor}',null);`);
  const targetMember=communityArchiveIO({domain:'member',target:target.archiveTarget,replacement:true}),targetCommunity=communityArchiveIO({domain:'community',target:target.archiveTarget,replacement:true});ios.push(targetMember,targetCommunity);
  assert.throws(()=>targetMember.restore(recovered[0].data,exports[0].receipt),/occupied/);
  root(`do $$ begin if (select count(*) from alliance_avatar.control where id and not enabled and not creation_enabled and not cleanup_enabled and not profile_revision_enabled)<>1 or exists(select 1 from public.alliance_profiles) or exists(select 1 from public.alliance_member_owners) or (select count(*) from alliance_community.control where id and not enabled and mutations=0 and invitations=0 and contributions=0)<>1 or exists(select 1 from alliance_community.challenges) then raise exception 'Replacement is not empty and closed';end if;end $$;delete from alliance_avatar.control;delete from alliance_community.control;`);
  const bad=Buffer.from(recovered[1].data);bad[bad.length-1]^=1;assert.throws(()=>targetCommunity.restore(bad,exports[1].receipt));bad.fill(0);
  assert.throws(()=>targetCommunity.restore(recovered[0].data,exports[0].receipt));
  // Explicit dependency failure must roll back all community COPY statements.
  assert.throws(()=>targetCommunity.restore(recovered[1].data,exports[1].receipt));assert.match(root('select (select count(*) from alliance_community.control)+(select count(*) from alliance_community.challenges)+(select count(*) from alliance_community.contributions)+(select count(*) from alliance_community.operations)+(select count(*) from alliance_community.blocks);'),/\n\s*0\s*\n/);
  phase='restore';targetMember.restore(recovered[0].data,exports[0].receipt);targetCommunity.restore(recovered[1].data,exports[1].receipt);assert.throws(()=>targetCommunity.restore(recovered[1].data,exports[1].receipt),/occupied/);
  const password='synthetic-recovered-community-'+randomUUID();root(`alter role alliance_avatar_executor login password '${password}';`);
  const connection={...target.connection,password},targetLedger=await createAvatarLedger({enabled:true,deploymentProfile:'supabase-managed',connection,openPool:target.openPool}),targetStore=await createAllianceCommunityStore({enabled:true,deploymentProfile:'supabase-managed',connection,openPool:target.openPool});handles.push(targetLedger,targetStore);
  assert.deepEqual(await targetLedger.recoveryInventory(),member);assert.deepEqual(await targetStore.inventory(),community);
  console.log('PASS different empty managed-role cluster restores all14 data tables transactionally with exact inventory hashes; occupied, changed, cross-component and missing-profile dependency archives refuse without partial data');
  phase='semantic_read_write';const [a,b]=participants;root('update alliance_avatar.control set enabled=true;update alliance_community.control set enabled=true;');
  await assert.rejects(targetStore.read(a.actor,a.session,saved.id));await targetStore.block(b.actor,b.session,{target:a.actor,hidden:false});assert.deepEqual(await targetStore.read(a.actor,a.session,saved.id),saved);
  assert.equal((await targetStore.change(a.actor,a.session,pendingCommand)).state,'replayed');
  let r=await targetStore.change(b.actor,b.session,{operationId:randomUUID(),challengeId:pendingCommand.challengeId,revision:1,action:'accept'});assert.equal(r.challenge.status,'active');
  const proof=randomUUID();r=await targetStore.change(a.actor,a.session,{operationId:proof,challengeId:pendingCommand.challengeId,revision:2,action:'contribute',note:'A new contribution after the isolated restore.'});assert.equal(r.challenge.proofs[0].id,proof);
  r=await targetStore.change(b.actor,b.session,{operationId:randomUUID(),challengeId:pendingCommand.challengeId,revision:3,action:'acknowledge',proofId:proof});assert.equal(r.challenge.status,'complete');
  const facade=createAllianceCommunityService({enabled:true,ledger:targetLedger,store:targetStore,journal:evidence,serving:{authorizeCommunity:async()=>true}});handles.push(facade);
  const context={actorId:a.actor,sessionId:a.session,expiresAt:Date.now()+60000};assert.deepEqual(await facade.read(context,saved.id),{state:'unavailable'});
  console.log('PASS fresh restricted TLS clients preserve hidden peer/contribution/replay state and can accept/contribute/acknowledge after restore; independently retained synthetic signed deletion evidence still withholds old peer records');
  root('update alliance_avatar.control set enabled=false;update alliance_community.control set enabled=false;alter role alliance_avatar_executor nologin password null;');
 }catch(e){const error=Error('Synthetic community archive stopped ('+phase+'; '+(e?.name==='AssertionError'?'assertion':'operation_failed')+'); private detail withheld');error.code='COMMUNITY_ARCHIVE_'+phase.toUpperCase();throw error;}
 finally{
  identity?.fill(0);retained?.fill(0);pack?.close();for(const b of buffers)b.fill(0);let failed=false;
  for(const h of handles.reverse())try{await h.close();}catch{failed=true;}
  for(const io of ios.reverse())try{io.close();}catch{failed=true;}
  try{await target?.close();}catch{failed=true;}
  if(realpathSync(directory)!==directory||dirname(directory)!==realpathSync(tmpdir())||!basename(directory).startsWith('alliance-encrypted-')||lstatSync(directory).isSymbolicLink())throw Error('Wrong community archive cleanup');rmSync(directory,{recursive:true});
  if(failed)throw Error('Community archive fixture cleanup failed');
 }
 console.log('PASS community recovery copies, ephemeral identities, pools and replacement cluster retired; zero hosted member/provider/credential changes');
}
