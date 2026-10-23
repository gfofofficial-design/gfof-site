// Official pinned test tools only; no account, key store, plugin or installer.
import {execFile,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync,readFileSync,lstatSync,realpathSync} from 'node:fs';
import {join,dirname,basename} from 'node:path';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function ageToolsFixture(directory,mode){
 if(process.env.ALLIANCE_RECOVERY_PACKAGE_TEST_CONFIRM!=='synthetic_encrypted_package'||realpathSync(directory)!==directory||!basename(directory).startsWith('alliance-encrypted-')||!['--local-age','--download-age','--cached-age'].includes(mode)||process.arch!=='x64'||!['win32','linux'].includes(process.platform))throw Error('Wrong age test tool scope');
 const suffix=process.platform==='win32'?'.exe':'';let binary,keygen;
 if(mode==='--local-age'){
  if(process.platform!=='win32')throw Error('Local test tool binding unavailable');
  const root='C:\\GFOF\\local-tools\\age-1.3.2\\age';binary=join(root,'age.exe');keygen=join(root,'age-keygen.exe');
  if(hash(readFileSync(binary))!=='2821a4ed191da07372acd302e5f6feae7a7985e285e1417765ebe74025af45f0'||hash(readFileSync(keygen))!=='1549c7049be32695594bedd09bbd352a94b6013a9d5c43364f3c6cd7a09ab61c')throw Error('Wrong existing age test binary');
 }else{
  const windows=process.platform==='win32',archive=windows?'age-v1.3.2-windows-amd64.zip':'age-v1.3.2-linux-amd64.tar.gz',expected=windows?'f48d8f8f9ebe903ab5027ed067652f2cc1db94bc206976430133b905dcd8e8c7':'cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10';
  let data;
  if(mode==='--cached-age'){
   const cache=process.env.ALLIANCE_AGE_TEST_RELEASE_ARCHIVE;
   if(!cache||basename(cache)!==archive||!lstatSync(cache).isFile()||lstatSync(cache).isSymbolicLink()||lstatSync(cache).size>40*1048576)throw Error('Wrong age test release cache');data=readFileSync(cache);
  }else{
   let response;try{response=await fetch('https://github.com/FiloSottile/age/releases/download/v1.3.2/'+archive,{signal:AbortSignal.timeout(30000)});}catch(error){const safe=Error('Age test download unavailable');safe.code=typeof error?.cause?.code==='string'&&/^[A-Z0-9_]{1,40}$/.test(error.cause.code)?error.cause.code:'AGE_DOWNLOAD_FAILED';throw safe;}
   if(!response.ok||!response.body||Number(response.headers.get('content-length'))>40*1048576)throw Error('Age test download unavailable');
   const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>40*1048576)throw Error('Age test download too large');chunks.push(chunk);}data=Buffer.concat(chunks);
  }
  if(hash(data)!==expected)throw Error('Age test release checksum mismatch');
  const file=join(directory,archive);writeFileSync(file,data,{flag:'wx',mode:0o600});
  execFileSync(windows?'tar.exe':'tar',['-xf',file,'-C',directory,'age/age'+suffix,'age/age-keygen'+suffix],{stdio:'pipe',timeout:10000,windowsHide:true});
  binary=join(directory,'age','age'+suffix);keygen=join(directory,'age','age-keygen'+suffix);
 }
 for(const file of [binary,keygen])if(!lstatSync(file).isFile()||lstatSync(file).isSymbolicLink()||realpathSync(dirname(file))!==dirname(file))throw Error('Wrong age test file');
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP'].includes(k)));
 const call=(file,args,input,signal)=>new Promise((resolve,reject)=>{
  const child=execFile(file,args,{env,encoding:'buffer',timeout:12000,maxBuffer:8*1048576,windowsHide:true,signal},(error,stdout)=>{if(error)reject(Error('Synthetic age operation failed'));else resolve(stdout);});
  child.stdin?.on('error',()=>{});child.stdin?.end(input);
 });
 const version=await call(binary,['--version'],Buffer.alloc(0));if(version.toString().trim()!=='v1.3.2')throw Error('Wrong age test version');
 return {binary,keygen,call,binarySha256:hash(readFileSync(binary))};
}
