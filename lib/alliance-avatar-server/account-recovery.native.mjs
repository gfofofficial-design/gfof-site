// Synthetic two-domain account capsule, NOT a whole-Federation restore, real key
// custody or production installer. Only confirmed disposable clusters accepted.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtempSync,realpathSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,unlinkSync,rmSync,lstatSync,constants} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {ageToolsFixture} from './age-tools.fixture.mjs';
import {packageFixture} from './recovery-package.fixture.mjs';
import {allianceTrustRecordBytes} from './trust-record.mjs';
import {createAllianceRecoveryPackage} from './recovery-package.mjs';
import {replacementArchiveIO} from './replacement-archive.fixture.mjs';
import {replacementSecurity,recreateReplacementRoles,recreateReplacementDefaults} from './replacement-security.fixture.mjs';
import {secondCreationFixture} from './creation-second-fixture.mjs';
import {reviewAccountHistory} from './account-history.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),json=v=>Buffer.from(JSON.stringify(v)+'\n');
const parse=t=>JSON.parse(t.split('\n').map(x=>x.trim()).find(x=>x.startsWith('{')));
export async function accountRecoveryNative({historyDomain,ackDomain,scope,secondOptions}){
 if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture'||process.env.ALLIANCE_RECOVERY_PACKAGE_TEST_CONFIRM!=='synthetic_encrypted_package')throw Error('Wrong account recovery fixture');
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'alliance-encrypted-'))),ios=[],targets=[],buffers=[];
 const sources=[{domain:'account-history',fixture:historyDomain},{domain:'account-ack',fixture:ackDomain}];
 const scopeJSON=JSON.stringify(scope),expectedScope={...scope,controlProjectRef:'opqrstuvwxyzabcdefgh'};let identity,retained,pack,phase='freeze';
 const inventory=(admin,security)=>Object.fromEntries(security.tables.map(([schema,table])=>{
  assert.equal(schema,'alliance_account');assert.ok(['history_control','entries','ack_control'].includes(table));
  return [schema+'.'+table,parse(admin(`set timezone='UTC';set datestyle='ISO, YMD';select jsonb_build_object('rows',count(*),'sha256',encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text,'UTF8')),'hex')) from ${schema}.${table} t;`))];
 }));
 const snapshot=admin=>parse(admin(`select alliance_account.snapshot('${scopeJSON}'::jsonb);`));
 const floor=admin=>parse(admin(`select alliance_account.ack_read('${scopeJSON}'::jsonb);`));
 const locked=admin=>assert.match(admin("select count(*) from pg_authid where rolname like 'alliance_account_%' and not rolcanlogin and rolpassword is null;"),/\n\s*4\s*\n/);
 const ids=new Set();function cluster(admin){const id=admin('select system_identifier::text from pg_control_system();').split('\n').map(x=>x.trim()).find(x=>/^\d{10,20}$/.test(x));assert.ok(id);assert.ok(!ids.has(id));ids.add(id);}
 try{
  historyDomain.admin('update alliance_account.history_control set enabled=false,admissions_open=false;');ackDomain.admin('update alliance_account.ack_control set enabled=false;');
  for(const s of sources){s.fixture.admin('alter role alliance_account_reader nologin password null;alter role alliance_account_writer nologin password null;alter role alliance_account_operator nologin password null;');locked(s.fixture.admin);cluster(s.fixture.admin);}
  const history=snapshot(historyDomain.admin),minimum=floor(ackDomain.admin);assert.equal(history.enabled,false);assert.equal(history.admissionsOpen,false);assert.deepEqual(history.head,minimum);
  reviewAccountHistory({scope,records:history.records,head:history.head,acknowledged:minimum,minimum});
  for(const s of sources){s.security=replacementSecurity(s.fixture.admin,s.domain);s.data=inventory(s.fixture.admin,s.security);s.io=replacementArchiveIO({domain:s.domain,target:s.fixture.archiveTarget});ios.push(s.io);s.dump=s.io.dump();buffers.push(s.dump.bytes);assert.deepEqual(inventory(s.fixture.admin,s.security),s.data);}
  const metadata={format:1,purpose:'alliance-account-recovery-v1',scope:expectedScope,minimum,domains:Object.fromEntries(sources.map(s=>[s.domain,{security:s.security,data:s.data,archive:{bytes:s.dump.receipt.bytes,sha256:s.dump.receipt.sha256,toc:s.dump.receipt.toc}}]))};
  const metadataBytes=json(metadata),checkpointSha256=sha(metadataBytes);buffers.push(metadataBytes);
  console.log('PASS account capsule captures exact three-table inventories and complete account schema/security on two frozen locked source clusters, with a separately retained acknowledged minimum');
  phase='encrypt';const tools=await ageToolsFixture(directory,process.env.ALLIANCE_AGE_TEST_RELEASE_ARCHIVE?'--cached-age':'--download-age');
  identity=await tools.call(tools.keygen,[],Buffer.alloc(0));retained=Buffer.from(identity);const recipient=(await tools.call(tools.keygen,['-y'],identity)).toString().trim();
  // Existing byte-container trust is used ONLY for scope/generation provenance.
  // Its content-journal floors are genesis placeholders, not account authority.
  const f=packageFixture(),trustRecord=allianceTrustRecordBytes({...JSON.parse(f.input.trustRecord),...expectedScope}),options={enabled:true,expectedScope,trustSha256:sha(trustRecord),minimumGeneration:1,recipient};
  const components=[{name:'member-data',data:json({coverage:'not_captured_in_account_capsule'})},{name:'journal-data',data:sources[0].dump.bytes},{name:'control-data',data:sources[1].dump.bytes},{name:'schema-security',data:metadataBytes},
   {name:'auth',data:json({coverage:'not_captured'})},{name:'storage',data:json({coverage:'not_captured'})},{name:'signing-recovery',data:json({coverage:'synthetic_memory_key_only'})},{name:'deployment',data:json({purpose:metadata.purpose,sourceCommit:process.env.ALLIANCE_ENCRYPTED_ARCHIVE_SOURCE_COMMIT})}];buffers.push(...components.map(c=>c.data));
  pack=createAllianceRecoveryPackage({...options,encryptBytes:(b,{signal})=>tools.call(tools.binary,['--encrypt','--recipient',recipient],b,signal)});
  const sealed=await pack.seal({packageId:randomUUID(),capturedAt:new Date().toISOString(),sourceCommit:process.env.ALLIANCE_ENCRYPTED_ARCHIVE_SOURCE_COMMIT,freezeId:randomUUID(),checkpointSha256,trustRecord,components});assert.equal(sealed.state,'sealed');
  const copyDir=join(directory,'separate');mkdirSync(copyDir,{mode:0o700});const primary=join(directory,'primary.age'),copy=join(copyDir,'account.age');writeFileSync(primary,sealed.ciphertext,{flag:'wx',mode:0o600});copyFileSync(primary,copy,constants.COPYFILE_EXCL);assert.equal(sha(readFileSync(copy)),sealed.descriptor.sha256);unlinkSync(primary);
  pack.close();identity.fill(0);for(const b of buffers)b.fill(0);
  phase='fresh_child';const input=json({identity:retained.toString('base64'),options,descriptor:sealed.descriptor,binarySha256:tools.binarySha256});let response;
  const env={...Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP'].includes(k))),ALLIANCE_RECOVERY_PACKAGE_TEST_CONFIRM:'synthetic_encrypted_package'};
  try{response=await new Promise((resolve,reject)=>{const child=execFile(process.execPath,[fileURLToPath(new URL('./encrypted-archive-child.fixture.mjs',import.meta.url)),tools.binary,copy],{env,encoding:'buffer',windowsHide:true,timeout:20000,maxBuffer:8*1048576},(e,out)=>e?reject(Error('Account recovery child stopped')):resolve(out));child.stdin?.on('error',()=>{});child.stdin?.end(input);});}finally{input.fill(0);retained.fill(0);}
  const opened=JSON.parse(response);response.fill(0);assert.equal(opened.state,'verified_bytes');assert.equal(opened.access,'closed');assert.equal(opened.manifest.checkpointSha256,checkpointSha256);
  const recovered=opened.components.map(c=>({name:c.name,data:Buffer.from(c.data,'base64')}));buffers.push(...recovered.map(c=>c.data));
  assert.equal(sha(recovered[3].data),checkpointSha256);assert.deepEqual(JSON.parse(recovered[3].data),metadata);assert.equal(JSON.parse(recovered[3].data).purpose,'alliance-account-recovery-v1');
  for(let n=0;n<2;n++){assert.equal(recovered[n+1].data.length,sources[n].dump.receipt.bytes);assert.equal(sha(recovered[n+1].data),sources[n].dump.receipt.sha256);}
  unlinkSync(copy);console.log('PASS actual account PGDMP archives recover through real age encryption and a fresh byte-only process from a separate copy after primary plaintext buffers/files are cleared; purpose and original receipts match');
  phase='targets';
  for(const s of sources){const t=await secondCreationFixture({...secondOptions,purpose:s.domain==='account-history'?'replacement-journal':'replacement-control'});targets.push({...t,domain:s.domain});cluster(t.admin);recreateReplacementRoles(t.admin,s.domain);const io=replacementArchiveIO({domain:s.domain,target:t.archiveTarget,replacement:true});ios.push(io);targets.at(-1).io=io;}
  const damaged=Buffer.from(recovered[1].data);damaged[damaged.length-1]^=1;assert.throws(()=>targets[0].io.restore(damaged,sources[0].dump.receipt));damaged.fill(0);
  assert.throws(()=>targets[0].io.restore(recovered[2].data,sources[1].dump.receipt));
  targets[0].admin('drop role alliance_account_owner;');assert.throws(()=>targets[0].io.restore(recovered[1].data,sources[0].dump.receipt));assert.match(targets[0].admin("select to_regnamespace('alliance_account') is null;"),/\n\s*t\s*\n/);targets[0].admin('create role alliance_account_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null;');recreateReplacementDefaults(targets[0].admin,'account-history');
  console.log('PASS changed or crossed account archives refuse before writes; a missing owner rolls back the entire empty-target restore without a partial account schema');
  phase='restore';for(let n=0;n<2;n++){
   const s=sources[n],t=targets[n];recreateReplacementDefaults(t.admin,t.domain);t.io.restore(recovered[n+1].data,s.dump.receipt);locked(t.admin);assert.deepEqual(replacementSecurity(t.admin,t.domain),s.security);assert.deepEqual(inventory(t.admin,s.security),s.data);assert.throws(()=>t.io.restore(recovered[n+1].data,s.dump.receipt));
  }
  const restoredHistory=snapshot(targets[0].admin),restoredFloor=floor(targets[1].admin);assert.deepEqual(restoredHistory,history);assert.deepEqual(restoredFloor,minimum);reviewAccountHistory({scope,records:restoredHistory.records,head:restoredHistory.head,acknowledged:restoredFloor,minimum});assert.equal(restoredHistory.enabled,false);
  targets[0].admin('grant select on alliance_account.entries to anon;');assert.notDeepEqual(replacementSecurity(targets[0].admin,'account-history'),sources[0].security);targets[0].admin('revoke select on alliance_account.entries from anon;');assert.deepEqual(replacementSecurity(targets[0].admin,'account-history'),sources[0].security);
  console.log('PASS fresh account history/ack replacements preserve all three tables and exact rows, forced RLS, private function definitions/owners/search paths/ACLs/defaults and locked roles; occupied restores refuse and grant drift is detected');
  phase='old_copy';targets[0].admin('begin;set local role alliance_account_owner;delete from alliance_account.entries where sequence>1;update alliance_account.history_control set sequence=1,sha256=(select record->>\'sha256\' from alliance_account.entries where sequence=1);commit;');
  const old=snapshot(targets[0].admin);assert.throws(()=>reviewAccountHistory({scope,records:old.records,head:old.head,acknowledged:restoredFloor,minimum}));assert.deepEqual(floor(targets[1].admin),minimum);
  targets[1].admin(`update alliance_account.ack_control set sequence=1,sha256='${old.head.sha256}';`);assert.throws(()=>reviewAccountHistory({scope,records:old.records,head:old.head,acknowledged:floor(targets[1].admin),minimum}));
  for(const s of sources){assert.deepEqual(replacementSecurity(s.fixture.admin,s.domain),s.security);assert.deepEqual(inventory(s.fixture.admin,s.security),s.data);locked(s.fixture.admin);}
  console.log('PASS restored older account history refuses the separately current floor; rolling back both restored domains still refuses the protected external minimum, with original source rows/security unchanged');
 }catch(e){console.error('Account recovery fixed phase: '+phase);throw Error('Synthetic account recovery stopped ('+phase+'); private detail withheld');}
 finally{
  identity?.fill(0);retained?.fill(0);pack?.close();for(const b of buffers)b.fill(0);let failed=false;
  for(const io of ios)try{io.close();}catch{failed=true;}for(const t of targets.reverse())try{await t.close();}catch{failed=true;}
  if(realpathSync(directory)!==directory||dirname(directory)!==realpathSync(tmpdir())||!basename(directory).startsWith('alliance-encrypted-')||lstatSync(directory).isSymbolicLink())throw Error('Wrong account recovery cleanup');rmSync(directory,{recursive:true});if(failed)throw Error('Account replacement cleanup failed');
 }
 console.log('PASS exact account capsule archives, synthetic in-memory identities, age scratch and both fresh replacement clusters removed; no hosted/managed recovery, independent real custody or serving permission claimed');
}
