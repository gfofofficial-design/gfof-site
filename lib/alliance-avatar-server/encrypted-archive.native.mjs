// Attended disposable three-server drill only. Actual synthetic SQL archives,
// same-host ciphertext copies and memory-retained provenance/identity, NOT DR.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,realpathSync,writeFileSync,readFileSync,copyFileSync,unlinkSync,rmdirSync,rmSync,lstatSync,existsSync,constants} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fixtureArchive} from './recovery-archive.fixture.mjs';
import {ageToolsFixture} from './age-tools.fixture.mjs';
import {createAllianceRecoveryPackage} from './recovery-package.mjs';
import {createAllianceRecoveryPair,RECOVERY_TABLES} from './recovery-pair.mjs';
import {startupCheckpointSha256} from './startup-gate.mjs';
import {allianceTrustRecord} from './trust-record.mjs';
import {removalChain} from './removal-anchor.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),json=v=>Buffer.from(JSON.stringify(v)+'\n');
export async function encryptedArchiveNative({mainTarget,journalTarget,memberAdmin,journalAdmin,controlAdmin,ledger,journal,scope,controlArchive,controlHandle,controlSnapshot,trustBytes,trustSha256,minimumGeneration}){
 if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture'||process.env.ALLIANCE_RECOVERY_PACKAGE_TEST_CONFIRM!=='synthetic_encrypted_package')throw Error('Wrong encrypted archive fixture');
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'alliance-encrypted-'))),archives=[],parts=[],packages=[];let identity,retainedIdentity,inspector;let phase='tools';
 try{
  // Setup uncertainty stops before changing any fixture data or feature switch.
  const tools=await ageToolsFixture(directory,process.env.ALLIANCE_AGE_TEST_RELEASE_ARCHIVE?'--cached-age':'--download-age');phase='synthetic_identity';
  identity=await tools.call(tools.keygen,[],Buffer.alloc(0));retainedIdentity=Buffer.from(identity);const recipient=(await tools.call(tools.keygen,['-y'],identity)).toString().trim();
  const expectedScope={memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,controlProjectRef:scope.controlProjectRef,epoch:scope.epoch},trust=allianceTrustRecord({bytes:trustBytes,expectedSha256:trustSha256,expectedScope,minimumGeneration});
  phase='closed_checkpoint';memberAdmin('update alliance_avatar.control set enabled=false,cleanup_enabled=false,creation_enabled=false;');journalAdmin('update alliance_journal.control set enabled=false,admission_enabled=false;');
  const frozenAt=new Date().toISOString(),member=await ledger.recoveryInventory(),independent=await journal.recoveryInventory(),control=controlSnapshot();
  assert.equal(control.data.policy.state,'closed');assert.equal(member.closed,true);assert.equal(independent.closed,true);
  const end={sequence:independent.sequence,sha256:independent.sha256},rows=await journal.records(end);removalChain(rows,end,expectedScope,trust.removalMinimum);assert.deepEqual({sequence:control.data.anchor.sequence,sha256:control.data.anchor.sha256},end);
  const checkpoint={format:2,memberProjectRef:scope.memberProjectRef,journalProjectRef:scope.journalProjectRef,epoch:scope.epoch,freezeId:randomUUID(),capturedAt:new Date().toISOString(),member,journal:independent};
  const evidence={freezeId:checkpoint.freezeId,frozenAt,checkpoint};inspector=createAllianceRecoveryPair({enabled:true,...expectedScope,minimum:trust.removalMinimum,ledger,journal});assert.deepEqual(await inspector.inspect(evidence),{state:'matches_checkpoint',access:'closed'});
  console.log('PASS encrypted archive drill captures stable closed member/journal/control state and full canonical acknowledged history against independent in-memory trust pins');
  phase='member_archive_create';const memberArchive=fixtureArchive({domain:'member',...mainTarget});archives.push(memberArchive);
  phase='journal_archive_create';const journalArchive=fixtureArchive({domain:'journal',...journalTarget});archives.push(journalArchive);
  phase='member_dump';const memberHandle=memberArchive.dump();phase='journal_dump';const journalHandle=journalArchive.dump(),domains=[{name:'member-data',archive:memberArchive,handle:memberHandle},{name:'journal-data',archive:journalArchive,handle:journalHandle},{name:'control-data',archive:controlArchive,handle:controlHandle}];
  for(const d of domains){phase=d.name+'_archive_read';const data=d.archive.readBytes(d.handle);assert.equal(sha(data),d.handle.sha256);assert.ok(data.subarray(0,5).equals(Buffer.from('PGDMP')));parts.push({name:d.name,data});}
  phase='archive_capture_equality';
  assert.deepEqual(await ledger.recoveryInventory(),member);assert.deepEqual(await journal.recoveryInventory(),independent);assert.deepEqual(controlSnapshot(),control);
  const archiveReceipts=domains.map(d=>({name:d.name,mode:d.handle.mode,bytes:d.handle.bytes,sha256:d.handle.sha256,tables:d.handle.tables,tocSha256:sha(json(d.handle.toc))}));
  parts.push({name:'schema-security',data:json({format:1,coverage:'control_schema_only',control,archives:archiveReceipts,memberJournal:'data_only_existing_schema',globalRoles:'existing_fixture_roles_not_rebuilt'})});
  for(const name of ['auth','storage','signing-recovery'])parts.push({name,data:json({format:1,coverage:'not_restored_in_this_drill',component:name,reason:name==='auth'?'Existing synthetic Auth schema/users/sessions remain outside these archives.':name==='storage'?'No Storage provider or object bytes are restored.':'Synthetic signer recovery is not part of this archive drill.'})});
  // Explicit public checkout metadata avoids invoking Linux Git on a Windows
  // worktree's absolute .git pointer. It is metadata, not source attestation.
  phase='source_commit';const sourceCommit=process.env.ALLIANCE_ENCRYPTED_ARCHIVE_SOURCE_COMMIT;assert.match(sourceCommit||'',/^[0-9a-f]{40}$/);
  parts.push({name:'deployment',data:json({format:1,coverage:'fixture_metadata_only',sourceCommit,scope:expectedScope,managedConfigurationRestored:false})});
  console.log('PASS three actual PGDMP archives cover member9/journal3/control2 with exact per-domain checksums and object lists; unsupported Auth/Storage/signing/global recovery is explicitly marked');
  phase='encryption';const options={enabled:true,expectedScope,trustSha256,minimumGeneration,recipient};
  const pack=createAllianceRecoveryPackage({...options,encryptBytes:(b,{signal})=>tools.call(tools.binary,['--encrypt','--recipient',recipient],b,signal)});packages.push(pack);
  const sealed=await pack.seal({packageId:randomUUID(),capturedAt:checkpoint.capturedAt,sourceCommit,freezeId:checkpoint.freezeId,checkpointSha256:startupCheckpointSha256(checkpoint),trustRecord:trustBytes,components:parts});assert.equal(sealed.state,'sealed');assert.equal(sealed.access,'closed');
  const primary=join(directory,'primary'),separate=join(directory,'separate');mkdirSync(primary,{mode:0o700});mkdirSync(separate,{mode:0o700});const firstFile=join(primary,'package.age'),separateFile=join(separate,'package.age');writeFileSync(firstFile,sealed.ciphertext,{flag:'wx',mode:0o600});copyFileSync(firstFile,separateFile,constants.COPYFILE_EXCL);assert.equal(sha(readFileSync(separateFile)),sealed.descriptor.sha256);unlinkSync(firstFile);rmdirSync(primary);pack.close();identity.fill(0);
  for(const d of domains){d.archive.discardPlaintext(d.handle);assert.throws(()=>d.archive.readBytes(d.handle));assert.throws(()=>d.archive.restore(d.handle));}for(const p of parts)p.data.fill(0);
  console.log('PASS encrypted separate copy is hash checked; primary ciphertext, all three original plaintext archives and mutable export buffers are removed before decryption');
  phase='fresh_process_decryption';
  const childInput=json({identity:retainedIdentity.toString('base64'),options,descriptor:sealed.descriptor,binarySha256:tools.binarySha256});let raw;
  const childEnv={...Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP'].includes(k))),ALLIANCE_RECOVERY_PACKAGE_TEST_CONFIRM:'synthetic_encrypted_package'};
  try{raw=await new Promise((resolve,reject)=>{const child=execFile(process.execPath,[fileURLToPath(new URL('./encrypted-archive-child.fixture.mjs',import.meta.url)),tools.binary,separateFile],{encoding:'buffer',timeout:20000,maxBuffer:8*1048576,windowsHide:true,env:childEnv},(error,out)=>error?reject(Error('Synthetic decryption child failed')):resolve(out));child.stdin?.on('error',()=>{});child.stdin?.end(childInput);});}finally{childInput.fill(0);retainedIdentity.fill(0);}
  const opened=JSON.parse(raw);raw.fill(0);assert.equal(opened.state,'verified_bytes');assert.equal(opened.access,'closed');assert.equal(opened.manifest.packageId,sealed.descriptor.packageId);assert.equal(opened.manifest.checkpointSha256,startupCheckpointSha256(checkpoint));
  const recovered=opened.components.map(c=>({name:c.name,data:Buffer.from(c.data,'base64')}));parts.push(...recovered);
  assert.deepEqual(recovered.map(p=>p.name),['member-data','journal-data','control-data','schema-security','auth','storage','signing-recovery','deployment']);
  for(let i=0;i<domains.length;i++){assert.equal(recovered[i].data.length,domains[i].handle.bytes);assert.equal(sha(recovered[i].data),domains[i].handle.sha256);}
  assert.deepEqual(JSON.parse(recovered[3].data).control,control);for(const p of recovered.slice(4,7))assert.equal(JSON.parse(p.data).coverage,'not_restored_in_this_drill');
  console.log('PASS fresh process decrypts the separate age copy into exact reviewed archive bytes and checkpoint/security metadata without restoring or granting access');
  phase='archive_provenance_refusal';
  assert.throws(()=>memberArchive.restoreBytes(memberHandle,recovered[1].data));assert.throws(()=>journalArchive.restoreBytes(journalHandle,recovered[0].data));const changed=Buffer.from(recovered[2].data);changed[changed.length-1]^=1;assert.throws(()=>controlArchive.restoreBytes(controlHandle,changed));changed.fill(0);
  assert.deepEqual(await ledger.recoveryInventory(),member);assert.deepEqual(await journal.recoveryInventory(),independent);assert.deepEqual(controlSnapshot(),control);
  console.log('PASS swapped-domain and changed decrypted archives refuse against retained original receipts before writing plaintext or changing any database state');
  phase='transactional_restore';
  memberAdmin('truncate '+RECOVERY_TABLES.member.join(',')+';');journalAdmin('truncate '+RECOVERY_TABLES.journal.join(',')+';');controlAdmin('begin;drop schema alliance_control cascade;commit;');
  memberArchive.restoreBytes(memberHandle,recovered[0].data);journalArchive.restoreBytes(journalHandle,recovered[1].data);controlArchive.restoreBytes(controlHandle,recovered[2].data);
  assert.deepEqual(await ledger.recoveryInventory(),member);assert.deepEqual(await journal.recoveryInventory(),independent);assert.deepEqual(controlSnapshot(),control);assert.deepEqual(await inspector.inspect(evidence),{state:'matches_checkpoint',access:'closed'});
  removalChain(await journal.records(end),end,expectedScope,trust.removalMinimum);assert.equal((await ledger.recoveryInventory()).closed,true);assert.equal((await journal.recoveryInventory()).closed,true);assert.equal(controlSnapshot().data.policy.state,'closed');
  for(const d of domains)d.archive.discardPlaintext(d.handle);
  console.log('PASS actual decrypted member9/journal3/control2 archives restore transactionally with exact inventories, control definitions/rights/locked roles and deletion floor; every feature remains closed');
 }catch(error){throw Error('Synthetic encrypted archive drill stopped ('+phase+'; '+(error?.name==='AssertionError'?'assertion':typeof error?.code==='string'&&/^[A-Z0-9_]{1,30}$/.test(error.code)?error.code:'operation_failed')+'); private detail withheld');}
 finally{
  identity?.fill(0);retainedIdentity?.fill(0);for(const p of parts)p.data.fill(0);for(const p of packages)p.close();inspector?.close();for(const a of archives)a.close();
  if(realpathSync(directory)!==directory||dirname(directory)!==realpathSync(tmpdir())||!basename(directory).startsWith('alliance-encrypted-')||lstatSync(directory).isSymbolicLink())throw Error('Wrong encrypted archive cleanup');rmSync(directory,{recursive:true});
 }
 assert.equal(existsSync(directory),false);console.log('PASS exact encrypted database drill copies/tools/plaintext removed; same-host fixtures and retained metadata/identity are not independent custody or full managed recovery');
}
