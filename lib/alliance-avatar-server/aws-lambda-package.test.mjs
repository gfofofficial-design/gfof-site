import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,copyFile,mkdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {inflateRawSync,crc32} from 'node:zlib';
import {createHash} from 'node:crypto';
import {gatewayHandler,authorityHandler} from './aws-lambda-entry.mjs';
import {memberAuthorityHandler} from './member-aws-lambda-entry.mjs';
import {prepareClosedAwsLambdaPackage as build,AWS_CLOSED_LAMBDA_PACKAGE_FILES as sources,AWS_CLOSED_MEMBER_LAMBDA_PACKAGE_FILES as memberSources,AWS_CLOSED_MEMBER_LAMBDA_ASSETS as memberAssets} from './aws-lambda-package.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const options=kind=>({kind,sourceDirectory:root,dependencyDirectory:root});
const error=/^Error: alliance_lambda_package_unavailable$/;
const sha=b=>createHash('sha256').update(b).digest('hex');
// Independent reader follows the central directory, checks local headers/CRC,
// and inflates every entry rather than trusting the builder's review JSON.
function unpack(zip){
 const end=zip.length-22;assert.equal(zip.readUInt32LE(end),0x06054b50);
 const count=zip.readUInt16LE(end+10),directory=zip.readUInt32LE(end+16),size=zip.readUInt32LE(end+12);assert.equal(directory+size,end);
 let pos=directory;const files=new Map();
 for(let i=0;i<count;i++){
  assert.equal(zip.readUInt32LE(pos),0x02014b50);assert.equal(zip.readUInt16LE(pos+10),8);
  const compressed=zip.readUInt32LE(pos+20),uncompressed=zip.readUInt32LE(pos+24),length=zip.readUInt16LE(pos+28),extra=zip.readUInt16LE(pos+30),comment=zip.readUInt16LE(pos+32),offset=zip.readUInt32LE(pos+42),name=zip.subarray(pos+46,pos+46+length).toString('utf8');
  assert.equal(zip.readUInt32LE(offset),0x04034b50);assert.equal(zip.readUInt16LE(offset+8),8);assert.equal(zip.readUInt16LE(offset+26),length);
  const start=offset+30+length+zip.readUInt16LE(offset+28),bytes=inflateRawSync(zip.subarray(start,start+compressed));
  assert.ok(start+compressed<=directory);assert.equal(bytes.length,uncompressed);assert.equal(crc32(bytes),zip.readUInt32LE(pos+16));assert.equal(crc32(bytes),zip.readUInt32LE(offset+14));assert.ok(!files.has(name));
  files.set(name,bytes);pos+=46+length+extra+comment;
 }
 assert.equal(pos,end);return files;
}
test('closed entry points ignore event/context, including activation-shaped input',async()=>{
 const inaccessible=new Proxy({},{get(){throw Error('event/context was read');},ownKeys(){throw Error('event/context was enumerated');}});
 for(const event of [inaccessible,{enabled:true,mode:'live',installation:{},AWS_ACCESS_KEY_ID:'not-a-real-key'}]){
  assert.deepEqual(await gatewayHandler(event,inaccessible),{statusCode:503,isBase64Encoded:false,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'},body:'{"state":"unavailable"}'});
  assert.deepEqual(await memberAuthorityHandler(event,inaccessible),await gatewayHandler(event,inaccessible));
  await assert.rejects(authorityHandler(event,inaccessible),/^Error: alliance_account_aws_unavailable$/);
 }
});
test('entry import and calls read no role credential/runtime fields in an isolated child',()=>{
 const code=`import {strict as assert} from 'node:assert';const original=process.env;let reads=0;const blocked=new Set(['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN','AWS_REGION','AWS_EXECUTION_ENV','AWS_LAMBDA_FUNCTION_NAME','AWS_LAMBDA_FUNCTION_VERSION','AWS_LAMBDA_INITIALIZATION_TYPE']);process.env=new Proxy({}, {get(_,k){if(blocked.has(k)){reads++;throw Error('forbidden runtime lookup');}return undefined;},ownKeys(){throw Error('forbidden environment enumeration');}});try{const m=await import(${JSON.stringify(new URL('./aws-lambda-entry.mjs',import.meta.url).href)});assert.equal((await m.gatewayHandler({},{})).statusCode,503);await assert.rejects(m.authorityHandler({},{}));const member=await import(${JSON.stringify(new URL('./member-aws-lambda-entry.mjs',import.meta.url).href)});assert.equal((await member.memberAuthorityHandler({enabled:true},{})).statusCode,503);assert.equal(reads,0);}finally{process.env=original;}`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{env:{TZ:'UTC'},encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'');
});
test('packages are deterministic, contain root-level handlers and stay within direct-upload limits',async()=>{
 const a=await build(options('gateway')),b=await build(options('gateway')),c=await build(options('authority')),d=await build(options('member-authority')),e=await build(options('member-authority'));
 assert.deepEqual(a.zip,b.zip);assert.deepEqual(a.review,b.review);assert.notEqual(a.review.zipSha256,c.review.zipSha256);
 assert.deepEqual(d.zip,e.zip);assert.deepEqual(d.review,e.review);assert.notEqual(d.review.zipSha256,c.review.zipSha256);
 for(const item of [a,c,d]){
  const files=unpack(item.zip),manifest=JSON.parse(files.get('preview-package.json'));
  const member=item.review.kind==='member-authority';assert.match(files.get('index.mjs').toString(),new RegExp(`export \\{${member?'memberAuthorityHandler':item.review.kind+'Handler'} as handler\\}`));
  assert.equal(manifest.mode,'closed');assert.equal(item.review.mode,'closed');assert.equal(item.review.runtime,'nodejs24.x');assert.equal(item.review.handler,'index.handler');
  assert.equal(item.review.zipBytes,item.zip.length);assert.equal(item.review.zipSha256,sha(item.zip));assert.equal(item.review.codeSha256Base64,createHash('sha256').update(item.zip).digest('base64'));assert.equal(item.review.manifestSha256,sha(files.get('preview-package.json')));
  assert.ok(item.zip.length<50*1024*1024);assert.ok(item.review.unpackedBytes<250*1024*1024);assert.equal(item.review.files,files.size);
  assert.deepEqual(Object.keys(manifest.sourceFiles),member?[...memberSources.map(n=>'lib/alliance-avatar-server/'+n),...memberAssets]:[...sources]);
  for(const [name,hash] of Object.entries({...manifest.sourceFiles,...manifest.dependencyFiles}))assert.equal(sha(files.get(name)),hash);
  assert.equal(item.review.sourceLockSha256,sha(files.get('provenance/package-lock.json')));
  assert.equal(manifest.packageVersions['@aws-sdk/client-dynamodb'],'3.1152.0');assert.equal(manifest.packageVersions['@aws-sdk/client-lambda'],'3.1152.0');
  assert.equal(manifest.packageVersions['@aws-sdk/client-kms'],'3.1152.0');assert.equal(files.has(member?'lib/alliance-avatar-server/member-kms-signer.mjs':'member-kms-signer.mjs'),member);assert.equal(files.has('member-kms-plan.mjs'),false);
  assert.equal(files.has('member-aws-runtime.fixture.mjs'),false);assert.equal(files.has('lib/alliance-avatar-server/member-aws-runtime.fixture.mjs'),false);assert.equal(files.has('account-dynamodb-store.mjs'),!member);
  if(member){assert.equal(files.has('aws-lambda-entry.mjs'),false);assert.ok(memberAssets.every(n=>files.has(n)));}
  assert.equal([...files.keys()].some(k=>/\.(?:test|native)\.mjs$|\.sql$|(?:^|\/)\.env(?:\.|$)|^docs\//.test(k)),false);
  assert.equal(files.has('aws-lambda-package.mjs'),false);assert.equal(files.has('installation.json'),false);
 }
});
test('extracted packages import and refuse locally without inherited credentials or external SDK paths',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'alliance-package-'));
 try{
  for(const kind of ['gateway','authority','member-authority']){
   const dir=join(temp,kind);await mkdir(dir);
   for(const [name,bytes] of unpack((await build(options(kind))).zip)){const path=join(dir,name);await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,bytes);}
   // The child converts a native path so Windows drive letters work too.
   const code=`import {pathToFileURL} from 'node:url';import {strict as assert} from 'node:assert';const m=await import(pathToFileURL(${JSON.stringify(join(dir,'index.mjs'))}));assert.deepEqual(Object.keys(m),['handler']);${kind!=='authority'?"assert.equal((await m.handler({enabled:true},{})).statusCode,503);":"await assert.rejects(m.handler({enabled:true},{}),/^Error: alliance_account_aws_unavailable$/);"}`;
   const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:dir,env:{TZ:'UTC'},encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'');
  }
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('wrong kind, missing sources and mismatched staged lock fail with a sanitized error',async()=>{
 await assert.rejects(build(options('live')),error);await assert.rejects(build({...options('gateway'),sourceDirectory:join(root,'absent-package-source')}),error);
 const temp=await mkdtemp(join(tmpdir(),'alliance-lock-'));
 try{await copyFile(join(root,'package.json'),join(temp,'package.json'));await writeFile(join(temp,'package-lock.json'),Buffer.concat([await readFile(join(root,'package-lock.json')),Buffer.from('\n')]));await assert.rejects(build({...options('gateway'),dependencyDirectory:temp}),error);}finally{await rm(temp,{recursive:true,force:true});}
});
test('source directory symlinks/junctions are refused',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'alliance-link-'));
 try{const path=join(temp,'source');await symlink(root,path,'junction');await assert.rejects(build({...options('gateway'),sourceDirectory:path}),error);}finally{await rm(temp,{recursive:true,force:true});}
});
test('staged package metadata must match the pinned lock entry',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'alliance-metadata-'));
 try{
  for(const name of ['package.json','package-lock.json'])await copyFile(join(root,name),join(temp,name));
  const lock=JSON.parse(await readFile(join(root,'package-lock.json'))),first=Object.keys(lock.packages).filter(Boolean).sort()[0],path=join(temp,first);await mkdir(path,{recursive:true});await writeFile(join(path,'package.json'),JSON.stringify({name:first.split('node_modules/').at(-1),version:'0.0.0'}));
  await assert.rejects(build({...options('gateway'),dependencyDirectory:temp}),error);
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('CLI rejects writing into source and does not overwrite an existing package',async()=>{
 const cli=fileURLToPath(new URL('./aws-lambda-package.mjs',import.meta.url)),temp=await mkdtemp(join(tmpdir(),'alliance-cli-'));
 try{
  const invalid=spawnSync(process.execPath,[cli,'gateway',root,root,join(root,'unsafe.zip')],{env:{TZ:'UTC'},encoding:'utf8',timeout:15000});assert.equal(invalid.status,1);assert.equal(invalid.stdout,'');assert.equal(invalid.stderr,'alliance_lambda_package_unavailable\n');
  const out=join(temp,'closed.zip'),first=spawnSync(process.execPath,[cli,'gateway',root,root,out],{env:{TZ:'UTC'},encoding:'utf8',timeout:30000});assert.equal(first.status,0,first.stderr);const bytes=await readFile(out);
  const second=spawnSync(process.execPath,[cli,'gateway',root,root,out],{env:{TZ:'UTC'},encoding:'utf8',timeout:30000});assert.equal(second.status,1);assert.deepEqual(await readFile(out),bytes);assert.equal(second.stdout,'');assert.equal(second.stderr,'alliance_lambda_package_unavailable\n');
 }finally{await rm(temp,{recursive:true,force:true});}
});
