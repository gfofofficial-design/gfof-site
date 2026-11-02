// Explicit one-generation OS entry. Startup never reads private delivery,
// prepares the application, grants provider access or transitions to SERVE.
import {open,constants} from 'node:fs/promises';
import {isAbsolute,normalize,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {persistentInstallation} from './alliance-avatar-server/persistent-installation.mjs';
import {createPersistentAllianceProcess} from './alliance-member-persistent-process.mjs';
import {createPersistentAlliancePrivateBundle} from './alliance-member-private-bundle.mjs';
import {createGenerationMemberTlsFiles} from './alliance-member-closed-tls-files.mjs';

const fail=()=>Error('member_generation_unavailable');
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const absolute=v=>typeof v==='string'&&isAbsolute(v)&&normalize(v)===v;
const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');
async function publicConfiguration(path){
 let file,bytes;
 try{
  if(!absolute(path))throw fail();
  file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  const info=await file.stat();
  if(!info.isFile()||info.nlink!==1||info.size<1||info.size>16384||![0,process.getuid()].includes(info.uid)||(info.mode&0o022)!==0)throw fail();
  bytes=Buffer.alloc(info.size+1);const {bytesRead}=await file.read(bytes,0,bytes.length,0);
  if(bytesRead!==info.size)throw fail();
  return JSON.parse(bytes.subarray(0,bytesRead).toString('utf8'));
 }catch{throw fail();}finally{bytes?.fill(0);await file?.close();}
}
export async function runMemberGenerationProcess(argv=process.argv.slice(2)){
 if(argv.length===0){emit({state:'disabled',memberServing:false});return 0;}
 let config,installation,tlsFiles,privateFiles;
 try{
  if(process.platform==='win32'||argv.length!==3||argv[0]!=='--generation'||argv[1]!=='--config'||!absolute(argv[2]))throw fail();
  config=await publicConfiguration(argv[2]);
  if(!exact(config,['format','origin','instanceArn','releaseSha256','bind','port','socketPath','tls','window','privateRuntime'])||config.format!==1||config.origin!=='https://galacticfederation.co'||!['127.0.0.1','0.0.0.0'].includes(config.bind)||![0,443].includes(config.port)||!absolute(config.socketPath)||
   !exact(config.tls,['rootDirectory','currentLink','acknowledgementPath','ownerUid'])||!exact(config.window,['notBeforeUtc','notAfterUtc'])||!exact(config.privateRuntime,['rootDirectory','ownerUid']))throw fail();
  installation=persistentInstallation({format:1,instanceArn:config.instanceArn,releaseSha256:config.releaseSha256,environment:'production',processId:randomUUID()});
  tlsFiles=createGenerationMemberTlsFiles(config.tls);
  privateFiles=createPersistentAlliancePrivateBundle({enabled:true,installation,...config.privateRuntime});
 }catch{emit({state:'unavailable',memberServing:false});return 1;}
 let host,stopping=false,reloading=false,reloadReady=false,exitCode=0,finish;
 const done=new Promise(resolve=>{finish=resolve;});
 function stop(code=0){
  if(stopping)return;stopping=true;exitCode=code;
  const deadline=setTimeout(()=>{emit({state:'shutdown_unknown',memberServing:false,providerClosureVerified:false});process.exit(1);},10000);
  void Promise.allSettled([Promise.resolve().then(()=>host?.close()),Promise.resolve().then(()=>privateFiles.close())]).then(results=>{
   if(results.some(result=>result.status==='rejected'))throw fail();
   emit({state:code?'unavailable':'stopped',memberServing:false,localClosed:true,providerClosureVerified:false});
  }).catch(()=>{exitCode=1;emit({state:'shutdown_unknown',memberServing:false,providerClosureVerified:false});}).finally(()=>{clearTimeout(deadline);finish(exitCode);});
 }
 const terminate=()=>stop();
 const reload=()=>{
  if(stopping||reloading||!reloadReady||!host)return;reloading=true;
  void host.reloadTls().then(async ok=>{
   if(stopping)return;if(ok)await tlsFiles.acknowledge();
   if(!stopping)emit({state:ok?'tls_reloaded':'tls_reload_failed',authority:'not_certified'});
  }).catch(()=>{if(!stopping){emit({state:'tls_reload_failed',authority:'not_certified'});stop(1);}}).finally(()=>{reloading=false;});
 };
 process.on('SIGTERM',terminate);process.on('SIGINT',terminate);process.on('SIGHUP',reload);
 try{
  host=createPersistentAllianceProcess({enabled:true,generationEnabled:true,origin:config.origin,installation,window:config.window,openApplication:privateFiles.openApplication,
   bind:config.bind,port:config.port,socketPath:config.socketPath,readTlsMaterial:tlsFiles.readTlsMaterial});
  const bound=await host.listen();if(!stopping)await tlsFiles.acknowledge();reloadReady=!stopping;
  if(!stopping)emit({state:'generation_listening',memberServing:false,preparation:'not_started',port:bound.port,processId:installation.processId,pid:process.pid});
 }catch{if(!stopping)stop(1);}
 try{return await done;}finally{process.removeListener('SIGTERM',terminate);process.removeListener('SIGINT',terminate);process.removeListener('SIGHUP',reload);}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 try{process.exitCode=await runMemberGenerationProcess();}catch{emit({state:'unavailable',memberServing:false});process.exitCode=1;}
}
