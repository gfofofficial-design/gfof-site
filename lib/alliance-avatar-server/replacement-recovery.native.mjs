// Fresh, disposable clusters only. Synthetic Auth is a dependency fixture, not
// managed Auth recovery. No cloud endpoint, real credential or key is accepted.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,copyFileSync,unlinkSync,rmdirSync,constants} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {secondCreationFixture} from './creation-second-fixture.mjs';
import {replacementArchiveIO} from './replacement-archive.fixture.mjs';
import {replacementSecurity,recreateReplacementRoles,recreateReplacementDefaults,REPLACEMENT_DOMAINS} from './replacement-security.fixture.mjs';
import {isDeepStrictEqual} from 'node:util';
import {createAllianceRecoveryPackage} from './recovery-package.mjs';
import {removalChain} from './removal-anchor.mjs';
import {assertAuthDeletionHeld} from './auth-deletion-guard.native.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),json=x=>Buffer.from(JSON.stringify(x)+'\n');
export async function replacementRecoveryNative({directory,tools,mainTarget,journalTarget,controlTarget,memberAdmin,journalAdmin,controlAdmin,scope,trustBytes,trustSha256,minimumGeneration,checkpoint,checkpointSha256,minimum}){
 if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture'||process.env.ALLIANCE_RECOVERY_PACKAGE_TEST_CONFIRM!=='synthetic_encrypted_package')throw Error('Wrong replacement recovery fixture');
 const sources={member:{target:mainTarget,admin:memberAdmin},journal:{target:journalTarget,admin:journalAdmin},control:{target:controlTarget,admin:controlAdmin}},exports=[],ios=[],targets=[],buffers=[];let identity,retained,pack,opened,phase='capture';
 const clusterIds=new Set(),clusterIdentity=admin=>{const id=admin('select system_identifier::text from pg_catalog.pg_control_system();').split('\n').map(x=>x.trim()).find(x=>/^\d{10,20}$/.test(x));assert.ok(id);assert.equal(clusterIds.has(id),false);clusterIds.add(id);};
 const data=(admin,security)=>Object.fromEntries(security.tables.map(([schema,table])=>{
  if(!/^[a-z_]+$/.test(schema)||!/^\w+$/.test(table))throw Error('Wrong fixed fixture table');
  const result=JSON.parse(admin(`set timezone='UTC';set datestyle='ISO, YMD';select jsonb_build_object('rows',count(*),'sha256',encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text,'UTF8')),'hex')) from ${schema}.${table} t;`).split('\n').map(x=>x.trim()).find(x=>x.startsWith('{')));return [schema+'.'+table,result];
 }));
 const locked=(admin,domain)=>{
  const rs=REPLACEMENT_DOMAINS[domain].roles;assert.match(admin(`select count(*) from pg_catalog.pg_authid where rolname in(${rs.map(r=>"'"+r+"'").join(',')}) and not rolcanlogin and rolpassword is null;`),new RegExp('\\n\\s*'+rs.length+'\\s*\\n'));
 };
 try{
  for(const [domain,s] of Object.entries(sources)){
   clusterIdentity(s.admin);
   phase=domain+'_security';s.security=replacementSecurity(s.admin,domain);phase=domain+'_data';s.data=data(s.admin,s.security);
   phase=domain+'_dump';const io=replacementArchiveIO({domain,target:s.target});ios.push(io);const dumped=io.dump();exports.push({...dumped,domain});buffers.push(dumped.bytes);
   assert.deepEqual(replacementSecurity(s.admin,domain),s.security);assert.deepEqual(data(s.admin,s.security),s.data);
  }
  assert.equal(JSON.parse(memberAdmin('select alliance_avatar.recovery_inventory();').split('\n').map(x=>x.trim()).find(x=>x.startsWith('{'))).closed,true);
  assert.equal(JSON.parse(journalAdmin(`select alliance_journal.recovery_inventory('${scope.memberProjectRef}','${scope.epoch}');`).split('\n').map(x=>x.trim()).find(x=>x.startsWith('{'))).closed,true);
  assert.match(controlAdmin("select state='closed' from alliance_control.policy;"),/\n\s*t\s*\n/);
  console.log('PASS replacement capture binds full member11 including synthetic Auth dependencies, journal3 and control2 schema/data with normalized security and original archive receipts');
  phase='encrypted_copy';identity=await tools.call(tools.keygen,[],Buffer.alloc(0));retained=Buffer.from(identity);const recipient=(await tools.call(tools.keygen,['-y'],identity)).toString().trim();
  const components=exports.map(e=>({name:e.domain==='member'?'member-data':e.domain==='journal'?'journal-data':'control-data',data:e.bytes}));
  components.push({name:'schema-security',data:json(Object.fromEntries(Object.entries(sources).map(([domain,s])=>[domain,{security:s.security,data:s.data}])))},
   {name:'auth',data:json({coverage:'synthetic_dependency_only',managedAuthRecovered:false})},{name:'storage',data:json({coverage:'not_restored_in_this_drill'})},{name:'signing-recovery',data:json({coverage:'not_restored_in_this_drill'})},{name:'deployment',data:json({coverage:'fixture_metadata_only',sourceCommit:process.env.ALLIANCE_ENCRYPTED_ARCHIVE_SOURCE_COMMIT})});
  for(const c of components.slice(3))buffers.push(c.data);
  const options={enabled:true,expectedScope:scope,trustSha256,minimumGeneration,recipient};pack=createAllianceRecoveryPackage({...options,encryptBytes:(b,{signal})=>tools.call(tools.binary,['--encrypt','--recipient',recipient],b,signal)});
  const sealed=await pack.seal({packageId:randomUUID(),capturedAt:checkpoint.capturedAt,sourceCommit:process.env.ALLIANCE_ENCRYPTED_ARCHIVE_SOURCE_COMMIT,freezeId:checkpoint.freezeId,checkpointSha256,trustRecord:trustBytes,components});assert.equal(sealed.state,'sealed');
  const folder=join(directory,'replacement-encrypted');mkdirSync(folder,{mode:0o700});const primary=join(folder,'primary.age'),copy=join(folder,'separate.age');writeFileSync(primary,sealed.ciphertext,{flag:'wx',mode:0o600});copyFileSync(primary,copy,constants.COPYFILE_EXCL);assert.equal(sha(readFileSync(copy)),sealed.descriptor.sha256);unlinkSync(primary);identity.fill(0);pack.close();for(const b of buffers)b.fill(0);
  const input=json({identity:retained.toString('base64'),options,descriptor:sealed.descriptor,binarySha256:tools.binarySha256});let response;
  const env={...Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP'].includes(k))),ALLIANCE_RECOVERY_PACKAGE_TEST_CONFIRM:'synthetic_encrypted_package'};
  try{response=await new Promise((resolve,reject)=>{const child=execFile(process.execPath,[fileURLToPath(new URL('./encrypted-archive-child.fixture.mjs',import.meta.url)),tools.binary,copy],{encoding:'buffer',env,windowsHide:true,timeout:20000,maxBuffer:8*1048576},(e,out)=>e?reject(Error('Replacement byte child stopped')):resolve(out));child.stdin?.on('error',()=>{});child.stdin?.end(input);});}finally{input.fill(0);retained.fill(0);}
  opened=JSON.parse(response);response.fill(0);assert.equal(opened.state,'verified_bytes');assert.equal(opened.access,'closed');assert.equal(opened.manifest.checkpointSha256,checkpointSha256);const recovered=opened.components.map(c=>({name:c.name,data:Buffer.from(c.data,'base64')}));buffers.push(...recovered.map(c=>c.data));
  for(let n=0;n<3;n++){assert.equal(recovered[n].data.length,exports[n].receipt.bytes);assert.equal(sha(recovered[n].data),exports[n].receipt.sha256);}assert.deepEqual(JSON.parse(recovered[3].data),Object.fromEntries(Object.entries(sources).map(([domain,s])=>[domain,{security:s.security,data:s.data}])));
  unlinkSync(copy);rmdirSync(folder);
  console.log('PASS full-schema replacement archives recover exact bytes/security from a separate age copy in a fresh byte-only process after original plaintext/export buffers are removed');
  phase='fresh_clusters';
  for(const domain of Object.keys(sources)){
   const t=await secondCreationFixture({...mainTarget,purpose:'replacement-'+domain});targets.push(t);t.domain=domain;
   clusterIdentity(t.admin);
   assert.match(t.admin("select count(*) from pg_catalog.pg_roles where rolname in('anon','authenticated','service_role') or rolname like 'alliance\\_%' escape '\\';"),/\n\s*0\s*\n/);
   const io=replacementArchiveIO({domain,target:t.archiveTarget,replacement:true});ios.push(io);t.io=io;recreateReplacementRoles(t.admin,domain);locked(t.admin,domain);
  }
  assert.equal(clusterIds.size,6);
  console.log('PASS three fresh independent disposable clusters begin without Alliance/Auth schemas or API/application roles; literal password-free nonprivileged roles are rebuilt with all logins locked');
  phase='restore';
  // A deliberately missing referenced owner must roll back all DDL/data. The
  // target, not a preserved source role/schema, supplies the dependency check.
  const member=targets[0];member.admin('drop role alliance_avatar_owner;');assert.throws(()=>member.io.restore(recovered[0].data,exports[0].receipt));assert.match(member.admin("select to_regnamespace('auth') is null and to_regnamespace('alliance_avatar') is null and to_regclass('public.alliance_profiles') is null;"),/\n\s*t\s*\n/);member.admin('create role alliance_avatar_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls password null;');
  console.log('PASS missing replacement owner causes a transactional full-schema restore failure with no partial Auth/Alliance schema or profile rows; only explicit reviewed dependency repair permits another restore');
  for(let n=0;n<targets.length;n++){
   const t=targets[n],domain=t.domain;
   phase=domain+'_restore';recreateReplacementDefaults(t.admin,domain);
   assert.throws(()=>t.io.restore(recovered[(n+1)%3].data,exports[(n+1)%3].receipt));
   t.io.restore(recovered[n].data,exports[n].receipt);phase=domain+'_locked';locked(t.admin,domain);phase=domain+'_security_compare';const afterSecurity=replacementSecurity(t.admin,domain);
   for(const key of Object.keys(afterSecurity))if(!isDeepStrictEqual(afterSecurity[key],sources[domain].security[key])){
    console.error('Replacement catalog difference: '+domain+'/'+key);
    // These two catalog categories contain only reviewed public DDL/ACL labels,
    // never table data, private identifiers, credentials or archive bytes.
    if(['constraints','schemas'].includes(key)){const a=afterSecurity[key]||[],b=sources[domain].security[key]||[];console.error(JSON.stringify({removed:b.filter(v=>!a.some(w=>isDeepStrictEqual(v,w))),added:a.filter(v=>!b.some(w=>isDeepStrictEqual(v,w)))}).slice(0,6000));}
    throw Error('Replacement security mismatch');
   }
   phase=domain+'_data_compare';assert.deepEqual(data(t.admin,sources[domain].security),sources[domain].data);
   assert.throws(()=>t.io.restore(recovered[n].data,exports[n].receipt));
  }
  console.log('PASS fresh replacement restores preserve all16 synthetic tables, function bodies/owners/search paths, defaults, constraints/indexes/triggers, forced RLS, named ACLs and effective rights; occupied/cross-domain targets refuse');
  phase='semantic_checks';
  const parse=text=>JSON.parse(text.split('\n').map(x=>x.trim()).find(x=>x.startsWith('{')));
  assert.deepEqual(parse(targets[0].admin('select alliance_avatar.recovery_inventory();')),checkpoint.member);assert.deepEqual(parse(targets[1].admin(`select alliance_journal.recovery_inventory('${scope.memberProjectRef}','${scope.epoch}');`)),checkpoint.journal);
  const tip={sequence:checkpoint.journal.sequence,sha256:checkpoint.journal.sha256},records=parse(targets[1].admin(`select jsonb_build_object('entries',alliance_journal.records('${scope.memberProjectRef}','${scope.epoch}',${tip.sequence},'${tip.sha256}'));`)).entries;
  removalChain(records,tip,scope,minimum);assert.match(targets[2].admin("select state='closed' from alliance_control.policy;"),/\n\s*t\s*\n/);
  const target=targets[0];target.admin('grant select on public.alliance_profiles to anon;');assert.notDeepEqual(replacementSecurity(target.admin,'member'),sources.member.security);target.admin('revoke select on public.alliance_profiles from anon;');assert.deepEqual(replacementSecurity(target.admin,'member'),sources.member.security);
  console.log('PASS new-cluster inventories and full acknowledged-deletion chain match the protected checkpoint; all controls remain closed and an accidental anonymous profile grant is detected and removed');
  assertAuthDeletionHeld(target.admin);assert.deepEqual(replacementSecurity(target.admin,'member'),sources.member.security);assert.deepEqual(data(target.admin,sources.member.security),sources.member.data);
  console.log('PASS encrypted fresh-cluster restore retains ALWAYS Auth deletion guards; hard/soft/bulk/replica attempts refuse while session revocation works and restored data/security remain unchanged');
  for(const [domain,s] of Object.entries(sources)){assert.deepEqual(replacementSecurity(s.admin,domain),s.security);assert.deepEqual(data(s.admin,s.security),s.data);}for(const t of targets)locked(t.admin,t.domain);
 }catch(error){
  const safe=Error('Synthetic replacement recovery stopped ('+phase+'; '+(error?.name==='AssertionError'?'assertion':'operation_failed')+'); private detail withheld');safe.code='RPL_'+phase.toUpperCase();
  console.error('Replacement stopped at fixed phase '+phase+' ('+(error?.name==='AssertionError'?'assertion':'operation')+').');
  // Only fixed helper labels or scalar assertion values are safe diagnostics.
  if(error?.name==='AssertionError'&&['number','boolean'].includes(typeof error.actual)&&['number','boolean'].includes(typeof error.expected))console.error('Replacement scalar assertion: '+error.actual+' '+error.operator+' '+error.expected);
  else if(['Unexpected fixed-schema archive object','Wrong replacement scratch','Wrong replacement binding'].includes(error?.message))console.error(error.message);
  throw safe;
 }
 finally{
  identity?.fill(0);retained?.fill(0);pack?.close();for(const b of buffers)b.fill(0);
  let cleanupFailed=false;for(const io of ios)try{io.close();}catch{cleanupFailed=true;}for(const t of targets.reverse())try{await t.close();}catch{cleanupFailed=true;}
  if(cleanupFailed)throw Error('Exact synthetic replacement cleanup could not be confirmed');
 }
 console.log('PASS exact replacement archive files and all three fresh clusters removed; original sources unchanged, no managed Auth/Storage/key custody or hosted recovery claimed');
}
