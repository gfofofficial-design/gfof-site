// Real age, synthetic byte components only. No real DB/Auth/Storage/key inputs.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,copyFileSync,unlinkSync,rmdirSync,rmSync,realpathSync,lstatSync,existsSync,constants} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {ageToolsFixture} from './age-tools.fixture.mjs';
import {packageFixture} from './recovery-package.fixture.mjs';
import {createAllianceRecoveryPackage,createAllianceCommunityRecoveryPackage} from './recovery-package.mjs';
import {communityRecoveryFixture} from './community-recovery.fixture.mjs';
import {communityCheckpointSha256} from './community-recovery.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),unavailable={state:'unavailable',access:'closed'};
if(process.env.ALLIANCE_RECOVERY_PACKAGE_TEST_CONFIRM!=='synthetic_encrypted_package')throw Error('Wrong encrypted package fixture');
function decryptor(tools,identity,directory){return async(cipher,{signal})=>{
 const file=join(directory,randomUUID()+'.age');writeFileSync(file,cipher,{flag:'wx',mode:0o600});
 try{return await tools.call(tools.binary,['--decrypt','--identity','-',file],identity,signal);}finally{unlinkSync(file);}
};}
async function child(){
 let identity;try{
  let data='';for await(const chunk of process.stdin){data+=chunk;if(data.length>20000)throw Error();}const args=JSON.parse(data);identity=Buffer.from(args.identity,'base64');data='';
  const [binary,file]=process.argv.slice(3);if(!binary||!file||!basename(file).endsWith('.age')||sha(readFileSync(binary))!==args.binarySha256||args.options.expectedScope.memberProjectRef!=='abcdefghijklmnopqrst'||args.options.expectedScope.controlProjectRef!=='opqrstuvwxyzabcdefgh')throw Error();
  const call=(executable,argv,input,signal)=>new Promise((resolve,reject)=>{const proc=execFile(executable,argv,{encoding:'buffer',timeout:12000,maxBuffer:8*1048576,windowsHide:true,signal},(error,out)=>error?reject(Error('Synthetic child decryption failed')):resolve(out));proc.stdin?.on('error',()=>{});proc.stdin?.end(input);});
  const p=createAllianceRecoveryPackage({...args.options,decryptBytes:decryptor({binary,call},identity,dirname(file))});
  try{const r=await p.open({descriptor:args.descriptor,ciphertext:readFileSync(file)});if(r.state!=='verified_bytes')throw Error();const components=r.components.map(c=>({name:c.name,bytes:c.data.length,sha256:sha(c.data)}));for(const c of r.components)c.data.fill(0);process.stdout.write(JSON.stringify({state:r.state,access:r.access,packageId:r.manifest.packageId,components})+'\n');}finally{p.close();}
 }finally{identity?.fill(0);}
}
async function main(){
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'alliance-encrypted-')));let identity,savedIdentity,wrongIdentity;const packages=[];
 try{
  const tools=await ageToolsFixture(directory,process.argv[2]),primary=join(directory,'primary'),separate=join(directory,'separate');mkdirSync(primary,{mode:0o700});mkdirSync(separate,{mode:0o700});
  identity=await tools.call(tools.keygen,[],Buffer.alloc(0));wrongIdentity=await tools.call(tools.keygen,[],Buffer.alloc(0));
  const recipient=(await tools.call(tools.keygen,['-y'],identity)).toString().trim();assert.match(recipient,/^age1[0-9a-z]{58}$/);savedIdentity=Buffer.from(identity);
  console.log('PASS official checksum-pinned age1.3.2 test tools generate two synthetic identities only in memory; no private key file or key output');
  const f=packageFixture(),options={...f.options,recipient},encryptBytes=(plain,{signal})=>tools.call(tools.binary,['--encrypt','--recipient',recipient],plain,signal),make=extra=>{const p=createAllianceRecoveryPackage({...options,...extra});packages.push(p);return p;};
  const exporter=make({encryptBytes}),sealed=await exporter.seal(f.input);assert.equal(sealed.state,'sealed');assert.equal(sealed.access,'closed');assert.equal(sealed.ciphertext.includes(Buffer.from('SYNTHETIC component')),false);assert.equal(sealed.ciphertext.includes(Buffer.from('member-data')),false);
  const primaryFile=join(primary,'package.age');writeFileSync(primaryFile,sealed.ciphertext,{flag:'wx',mode:0o600});
  console.log('PASS actual age encryption produces opaque ciphertext and an external descriptor; component metadata/plaintext stay inside the encrypted package and access stays closed');
  const communityFixture=communityRecoveryFixture();communityFixture.gate.close();const cp=communityFixture.checkpoint;
  const combinedInput={...f.input,freezeId:cp.freezeId,checkpoint:cp,checkpointSha256:communityCheckpointSha256(cp),components:[f.input.components[0],{name:'community-data',data:Buffer.from('SYNTHETIC private collaboration archive; not a database dump.')},...f.input.components.slice(1)]};
  const combined=createAllianceCommunityRecoveryPackage({...options,encryptBytes,decryptBytes:decryptor(tools,identity,directory)});packages.push(combined);
  const combinedCipher=await combined.seal(combinedInput);assert.equal(combinedCipher.state,'sealed');assert.equal(combinedCipher.ciphertext.includes(Buffer.from('community-data')),false);
  const combinedOpen=await combined.open({descriptor:combinedCipher.descriptor,ciphertext:combinedCipher.ciphertext});assert.equal(combinedOpen.state,'verified_bytes');assert.equal(combinedOpen.manifest.format,2);assert.deepEqual(combinedOpen.manifest.checkpoint,cp);assert.deepEqual(combinedOpen.components,combinedInput.components);for(const part of combinedOpen.components)part.data.fill(0);
  assert.deepEqual(await make({decryptBytes:decryptor(tools,identity,directory)}).open({descriptor:combinedCipher.descriptor,ciphertext:combinedCipher.ciphertext}),unavailable);
  combinedCipher.ciphertext.fill(0);
  console.log('PASS actual age encrypts and verifies explicit community checkpoint/package2 and nine exact synthetic components; a legacy reader refuses it; no community database restore or custody proof claimed');
  assert.deepEqual(await make({decryptBytes:decryptor(tools,wrongIdentity,directory)}).open({descriptor:sealed.descriptor,ciphertext:sealed.ciphertext}),unavailable);
  console.log('PASS wrong synthetic recovery identity cannot decrypt the age package and returns only a sanitized unavailable status');
  for(const truncate of [false,true]){const cipher=Buffer.from(truncate?sealed.ciphertext.subarray(0,-12):sealed.ciphertext);if(!truncate)cipher[cipher.length-1]^=1;assert.deepEqual(await make({decryptBytes:decryptor(tools,identity,directory)}).open({descriptor:{...sealed.descriptor,bytes:cipher.length,sha256:sha(cipher)},ciphertext:cipher}),unavailable);}
  console.log('PASS actual age authentication refuses changed and truncated ciphertext even when a deliberately changed outer checksum is supplied');
  const plain=await decryptor(tools,identity,directory)(sealed.ciphertext,{}),v=JSON.parse(plain);plain.fill(0);v.components[0].sha256='f'.repeat(64);const malformedPlain=Buffer.from(JSON.stringify(v)+'\n'),badCipher=await encryptBytes(malformedPlain,{});malformedPlain.fill(0);
  assert.deepEqual(await make({decryptBytes:decryptor(tools,identity,directory)}).open({descriptor:{...sealed.descriptor,bytes:badCipher.length,sha256:sha(badCipher)},ciphertext:badCipher}),unavailable);
  console.log('PASS valid age encryption does not excuse an invalid inner component checksum; packaging verification remains separate from cryptographic decryption');
  const separateFile=join(separate,'package.age');copyFileSync(primaryFile,separateFile,constants.COPYFILE_EXCL);assert.equal(sha(readFileSync(separateFile)),sealed.descriptor.sha256);unlinkSync(primaryFile);rmdirSync(primary);exporter.close();identity.fill(0);assert.equal(existsSync(primaryFile),false);
  const childInput=Buffer.from(JSON.stringify({identity:savedIdentity.toString('base64'),options,descriptor:sealed.descriptor,binarySha256:tools.binarySha256}));
  const childResult=await new Promise((resolve,reject)=>{const proc=execFile(process.execPath,[fileURLToPath(import.meta.url),'--recover-child',tools.binary,separateFile],{encoding:'buffer',timeout:20000,maxBuffer:65536,windowsHide:true},(error,out)=>error?reject(Error('Synthetic fresh-process recovery failed')):resolve(out));proc.stdin?.on('error',()=>{});proc.stdin?.end(childInput);});childInput.fill(0);savedIdentity.fill(0);
  const result=JSON.parse(childResult);assert.equal(result.state,'verified_bytes');assert.equal(result.access,'closed');assert.equal(result.packageId,f.input.packageId);assert.deepEqual(result.components,f.input.components.map(c=>({name:c.name,bytes:c.data.length,sha256:sha(c.data)})));
  console.log('PASS a fresh Node process recovers all exact synthetic component bytes from the separate ciphertext after the primary file and original in-memory identity are cleared; access remains closed');
  let decryptCalls=0;const mixed=make({decryptBytes:()=>{decryptCalls++;throw Error();}});assert.deepEqual(await mixed.open({descriptor:{...sealed.descriptor,sha256:'e'.repeat(64)},ciphertext:readFileSync(separateFile)}),unavailable);assert.equal(decryptCalls,0);unlinkSync(separateFile);assert.throws(()=>readFileSync(separateFile));
  console.log('PASS mixed external descriptor refuses before decryption and a missing copy cannot be treated as a verified backup; no DB restore or public activation occurs');
 }finally{
  identity?.fill(0);savedIdentity?.fill(0);wrongIdentity?.fill(0);for(const p of packages)p.close();
  if(realpathSync(directory)!==directory||dirname(directory)!==realpathSync(tmpdir())||!basename(directory).startsWith('alliance-encrypted-')||lstatSync(directory).isSymbolicLink())throw Error('Wrong encrypted test cleanup');rmSync(directory,{recursive:true});
 }
 assert.equal(existsSync(directory),false);console.log('PASS exact encrypted fixture copies, temporary official tools and scratch removed; no real identity, off-device custody, managed-service recovery or running backup is claimed');
}
try{if(process.argv[2]==='--recover-child')await child();else await main();}catch{process.stderr.write('Synthetic encrypted package fixture failed; private process detail withheld.\n');process.exitCode=1;}
