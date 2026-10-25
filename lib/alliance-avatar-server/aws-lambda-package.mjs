// Offline closed-preview ZIP builder. No SDK, credential, cloud or install calls.
import {readFile,readdir,lstat,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,relative,dirname,sep,parse,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {crc32,deflateRawSync} from 'node:zlib';
import {finiteMemberEntrySource,reviewFiniteMemberEntry} from './member-finite-entry.mjs';

const fail=()=>Error('alliance_lambda_package_unavailable');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const AWS_CLOSED_LAMBDA_PACKAGE_FILES=Object.freeze([
 'account-authority-wire.mjs','account-aws-runtime.mjs','account-checkpoint-authority.mjs',
 'account-dynamodb-store.mjs','account-gateway-nonce.mjs','account-gateway.mjs',
 'account-handoff.mjs','account-history.mjs','account-lambda-authority.mjs',
 'account-resolution.mjs','aws-runtime-credentials.mjs','control-policy.mjs',
 'gateway-aws-policy.mjs','gateway-signing-key.mjs','lambda-invocation-runtime.mjs',
 'aws-lambda-entry.mjs'
]);
export const AWS_CLOSED_MEMBER_LAMBDA_PACKAGE_FILES=Object.freeze([
 'account-gateway-nonce.mjs','anchored-witness.mjs','aws-runtime-credentials.mjs',
 'community-recovery.mjs','feedback-recovery.mjs','control-authority.mjs','control-managed.mjs',
 'control-policy.mjs','control-store.mjs','control-transport.mjs',
 'deletion-journal.mjs','gateway-signing-key.mjs','journal-store.mjs',
 'journal-witness.mjs','lambda-invocation-runtime.mjs','member-authority-service.mjs',
 'member-authority-transport.mjs','member-aws-lambda-entry.mjs','member-aws-runtime.mjs',
 'member-kms-signer.mjs','member-connection-secrets.mjs','recovery-pair.mjs','removal-anchor.mjs',
 'startup-gate.mjs','trust-record.mjs'
]);
export const AWS_CLOSED_MEMBER_LAMBDA_ASSETS=Object.freeze([
 'assets/federation/fed-alliance-collaboration-contract.mjs',
 'assets/federation/fed-alliance-feedback-contract.mjs',
 'assets/federation/fed-alliance-community-core.mjs'
]);
const packagePath=/^node_modules\/(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+(?:\/node_modules\/(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+)*$/;
const safeName=name=>typeof name==='string'&&name.length>0&&name.length<512&&!name.includes('\\')&&!name.includes('\0')&&!name.startsWith('/')&&name.split('/').every(p=>p!==''&&p!=='.'&&p!=='..');
async function regular(base,name){
 if(!safeName(name))throw fail();
 let path=base;
 for(const [i,part] of name.split('/').entries()){
  path=join(path,part);const st=await lstat(path);
  if(st.isSymbolicLink()||(i===name.split('/').length-1?(!st.isFile()||st.size>16*1024*1024):!st.isDirectory()))throw fail();
 }
 return readFile(path);
}
async function directory(path){let part=parse(path).root;for(const item of relative(part,path).split(sep).filter(Boolean)){part=join(part,item);const st=await lstat(part);if(!st.isDirectory()||st.isSymbolicLink())throw fail();}return path;}
// Fixed metadata, sorted paths, no symlinks, data descriptors, ZIP64 or comments.
// This classic ZIP contains regular 0644 files compressed with raw DEFLATE.
function archive(entries){
 if(entries.size<1||entries.size>60000)throw fail();
 const local=[],central=[];let offset=0,unpacked=0;
 for(const [name,bytes] of [...entries].sort(([a],[b])=>a<b?-1:a>b?1:0)){
  if(!safeName(name)||!Buffer.isBuffer(bytes))throw fail();
  unpacked+=bytes.length;if(unpacked>250*1024*1024)throw fail();
  const n=Buffer.from(name,'utf8'),body=deflateRawSync(bytes,{level:9}),crc=crc32(bytes);
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(8,8);h.writeUInt16LE(33,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(body.length,18);h.writeUInt32LE(bytes.length,22);h.writeUInt16LE(n.length,26);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(0x0314,4);h.copy(c,6,4,30);c.writeUInt32LE(0o100644*65536,38);c.writeUInt32LE(offset,42);
  local.push(h,n,body);central.push(c,n);offset+=h.length+n.length+body.length;
  if(offset>50*1024*1024)throw fail();
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.size,8);end.writeUInt16LE(entries.size,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 const zip=Buffer.concat([...local,directory,end]);if(zip.length>50*1024*1024)throw fail();
 return {zip,unpacked};
}
export async function prepareClosedAwsLambdaPackage({sourceDirectory,dependencyDirectory,kind}={}){
 return preparePackage({sourceDirectory,dependencyDirectory,kind});
}
// Separate explicit API: the existing closed builder/CLI has no trial switch.
export async function prepareFiniteAwsMemberTrialPackage({sourceDirectory,dependencyDirectory,configuration}={}){
 try{return await preparePackage({sourceDirectory,dependencyDirectory,kind:'member-authority',trial:reviewFiniteMemberEntry(configuration)});}catch{throw fail();}
}
async function preparePackage({sourceDirectory,dependencyDirectory,kind,trial}){
 try{
  if(!['gateway','authority','member-authority'].includes(kind)||typeof sourceDirectory!=='string'||typeof dependencyDirectory!=='string')throw fail();
  const source=await directory(resolve(sourceDirectory)),dependencies=await directory(resolve(dependencyDirectory));
  const entries=new Map(),sourceHashes={},dependencyHashes={};let active=0,totalBytes=0;const waiting=[];
  async function io(operation){if(active<16)active++;else await new Promise(r=>waiting.push(r));try{return await operation();}finally{if(waiting.length)waiting.shift()();else active--;}}
  const pkgBytes=await regular(source,'package.json'),lockBytes=await regular(source,'package-lock.json');
  if(!lockBytes.equals(await regular(dependencies,'package-lock.json'))||!pkgBytes.equals(await regular(dependencies,'package.json')))throw fail();
  const pkg=JSON.parse(pkgBytes),lock=JSON.parse(lockBytes);
  if(lock.lockfileVersion!==3||!lock.packages||!pkg.dependencies||Object.keys(pkg.dependencies).length!==5||pkg.dependencies['@aws-sdk/client-dynamodb']!=='3.1152.0'||pkg.dependencies['@aws-sdk/client-kms']!=='3.1152.0'||pkg.dependencies['@aws-sdk/client-lambda']!=='3.1152.0'||pkg.dependencies['@aws-sdk/client-secrets-manager']!=='3.1152.0'||pkg.dependencies.pg!=='8.23.1'||JSON.stringify(lock.packages['']?.dependencies)!==JSON.stringify(pkg.dependencies))throw fail();
  const member=kind==='member-authority';
  for(const name of member?AWS_CLOSED_MEMBER_LAMBDA_PACKAGE_FILES:AWS_CLOSED_LAMBDA_PACKAGE_FILES){
   const bytes=await regular(source,name),path=member?'lib/alliance-avatar-server/'+name:name;
   sourceHashes[path]=sha(bytes);entries.set(path,bytes);
  }
  if(member){
   // Preserve reviewed relative imports into the two shared public contracts;
   // never rewrite module bytes or permit ZIP paths to escape the package root.
   const repository=await directory(resolve(source,'../..'));
   for(const path of AWS_CLOSED_MEMBER_LAMBDA_ASSETS){const bytes=await regular(repository,path);sourceHashes[path]=sha(bytes);entries.set(path,bytes);}
   if(trial)for(const name of ['member-finite-entry.mjs','member-aws-trial-policy.mjs','member-kms-plan.mjs']){
    const path='lib/alliance-avatar-server/'+name,bytes=await regular(source,name);sourceHashes[path]=sha(bytes);entries.set(path,bytes);
   }
  }
  async function files(path,name){
   await Promise.all((await io(()=>readdir(path,{withFileTypes:true}))).map(async item=>{
    const full=join(path,item.name),key=name+'/'+item.name,st=await io(()=>lstat(full));
    if(st.isSymbolicLink()||!safeName(key))throw fail();
    if(st.isDirectory()){
     // Nested dependencies are handled only by their own lockfile entries.
     if(item.name==='node_modules')return;
     await files(full,key);
    }else if(st.isFile()){
     totalBytes+=st.size;if(st.size>16*1024*1024||totalBytes>240*1024*1024)throw fail();
     const bytes=await io(()=>readFile(full));if(entries.has(key)||bytes.length!==st.size)throw fail();
     dependencyHashes[key]=sha(bytes);entries.set(key,bytes);
    }else throw fail();
   }));
  }
  const packageVersions={};
  for(const [name,record] of Object.entries(lock.packages).sort(([a],[b])=>a<b?-1:a>b?1:0)){
   if(name==='')continue;
   if(!packagePath.test(name)||record.link||record.dev||record.hasInstallScript||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(record.version)||typeof record.resolved!=='string'||!record.resolved.startsWith('https://registry.npmjs.org/')||typeof record.integrity!=='string'||!/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(record.integrity))throw fail();
   const metadata=JSON.parse(await regular(dependencies,name+'/package.json'));
   if(metadata.version!==record.version||metadata.name!==name.split('node_modules/').at(-1))throw fail();
   packageVersions[metadata.name]=record.version;await files(join(dependencies,name),name);
  }
  for(const [name,version] of Object.entries(pkg.dependencies))if(packageVersions[name]!==version)throw fail();
  const entry=member?'lib/alliance-avatar-server/member-aws-lambda-entry.mjs':'aws-lambda-entry.mjs',handler=member?'memberAuthorityHandler':kind+'Handler';
  const index=Buffer.from(trial?finiteMemberEntrySource(trial):`// Closed preview only; changing environment or event cannot activate it.\nexport {${handler} as handler} from './${entry}';\n`);
  entries.set('index.mjs',index);
  entries.set('package.json',Buffer.from(JSON.stringify({name:pkg.name,version:pkg.version,private:true,type:'module',engines:{node:'24.x'},dependencies:pkg.dependencies})+'\n'));
  entries.set('provenance/package-lock.json',lockBytes);
  const sortedDependencyHashes=Object.fromEntries(Object.entries(dependencyHashes).sort(([a],[b])=>a<b?-1:a>b?1:0));
  const mode=trial?'finite-reviewed-trial':'closed';
  const manifest={format:1,kind,mode,runtime:'nodejs24.x',handler:'index.handler',sourceLockSha256:sha(lockBytes),sourcePackageSha256:sha(pkgBytes),sourceFiles:sourceHashes,dependencyFiles:sortedDependencyHashes,packageVersions,
   ...(trial?{trialPolicySha256:trial.expectedPolicySha256,window:trial.policy.window,generatedEntrySha256:sha(index)}:{})};
  const manifestBytes=Buffer.from(JSON.stringify(manifest)+'\n');entries.set('preview-package.json',manifestBytes);
  const {zip,unpacked}=archive(entries),review={format:1,kind,mode,runtime:'nodejs24.x',handler:'index.handler',files:entries.size,unpackedBytes:unpacked,zipBytes:zip.length,zipSha256:sha(zip),codeSha256Base64:createHash('sha256').update(zip).digest('base64'),manifestSha256:sha(manifestBytes),sourceLockSha256:manifest.sourceLockSha256,packageCount:Object.keys(packageVersions).length,
   ...(trial?{trialPolicySha256:trial.expectedPolicySha256,window:trial.policy.window}:{})};
  return {zip,review};
 }catch{throw fail();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const [kind,sourceDirectory,dependencyDirectory,output]=process.argv.slice(2);
  if(process.argv.length!==6||!output)throw fail();
  const out=resolve(output),source=resolve(sourceDirectory),dependencies=resolve(dependencyDirectory);
  const outside=base=>{const path=relative(base,out);return isAbsolute(path)||path==='..'||path.startsWith('..'+sep);};
  if(!outside(source)||!outside(dependencies))throw fail();
  for(const path of [out,out+'.review.json']){try{await lstat(path);throw fail();}catch(error){if(error.code!=='ENOENT')throw fail();}}
  const {zip,review}=await prepareClosedAwsLambdaPackage({sourceDirectory,dependencyDirectory,kind});
  await mkdir(dirname(out),{recursive:true});await writeFile(out,zip,{flag:'wx',mode:0o600});
  await writeFile(out+'.review.json',JSON.stringify(review,null,2)+'\n',{flag:'wx',mode:0o600});
  process.stdout.write(JSON.stringify(review)+'\n');
 }catch{process.stderr.write('alliance_lambda_package_unavailable\n');process.exitCode=1;}
}
