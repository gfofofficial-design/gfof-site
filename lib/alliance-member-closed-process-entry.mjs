// Explicit OS entry for an unpromotable closed bootstrap. No application factory,
// environment credential lookup, startup generation or provider connection.
import {open,constants} from 'node:fs/promises';
import {isAbsolute,normalize,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {persistentInstallation} from './alliance-avatar-server/persistent-installation.mjs';
import {createPersistentAllianceProcess} from './alliance-member-persistent-process.mjs';
import {createClosedMemberTlsFiles} from './alliance-member-closed-tls-files.mjs';

const unavailable=()=>Error('closed_member_process_unavailable');
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const absolute=v=>typeof v==='string'&&isAbsolute(v)&&normalize(v)===v;
const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');

async function boundedFile(path,maximum){
 let file;
 try{
  if(!absolute(path))throw unavailable();
  file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  const info=await file.stat();
  if(!info.isFile()||info.size<1||info.size>maximum||![0,process.getuid()].includes(info.uid)||(info.mode&0o022)!==0)throw unavailable();
  const buffer=Buffer.alloc(maximum+1);const {bytesRead}=await file.read(buffer,0,buffer.length,0);
  if(bytesRead!==info.size||bytesRead>maximum)throw unavailable();
  return buffer.subarray(0,bytesRead);
 }catch{throw unavailable();}finally{await file?.close();}
}

export async function runClosedMemberProcess(argv=process.argv.slice(2)){
 if(argv.length===0){emit({state:'disabled',memberServing:false});return 0;}
 let config,installation,tlsFiles;
 try{
  if(process.platform==='win32'||argv.length!==3||argv[0]!=='--closed-bootstrap'||argv[1]!=='--config'||!absolute(argv[2]))throw unavailable();
  config=JSON.parse((await boundedFile(argv[2],16384)).toString('utf8'));
  if(!exact(config,['format','origin','instanceArn','releaseSha256','bind','port','socketPath','tls'])||config.format!==1||config.origin!=='https://galacticfederation.co'||!['127.0.0.1','0.0.0.0'].includes(config.bind)||![0,443].includes(config.port)||!absolute(config.socketPath)||!exact(config.tls,['rootDirectory','currentLink','acknowledgementPath','ownerUid']))throw unavailable();
  installation=persistentInstallation({format:1,instanceArn:config.instanceArn,releaseSha256:config.releaseSha256,environment:'production',processId:randomUUID()});
  tlsFiles=createClosedMemberTlsFiles(config.tls);
 }catch{emit({state:'unavailable',memberServing:false});return 1;}
 let host,stopping=false,reloading=false,reloadReady=false,exitCode=0,finish;
 const done=new Promise(resolve=>{finish=resolve;});
 function stop(code=0){
  if(stopping)return;stopping=true;exitCode=code;
  const deadline=setTimeout(()=>{emit({state:'shutdown_unknown',memberServing:false,providerClosureVerified:false});process.exit(1);},10000);
  Promise.resolve().then(()=>host?.close()).then(()=>{
   emit({state:code?'unavailable':'stopped',memberServing:false,localClosed:true,providerClosureVerified:false});
  },()=>{exitCode=1;emit({state:'shutdown_unknown',memberServing:false,providerClosureVerified:false});}).finally(()=>{clearTimeout(deadline);finish(exitCode);});
 }
 const terminate=()=>stop();
 const reload=()=>{
  if(stopping||reloading||!reloadReady||!host)return;reloading=true;
  void host.reloadTls().then(async ok=>{if(stopping)return;if(ok)await tlsFiles.acknowledge();if(!stopping)emit({state:ok?'tls_reloaded':'tls_reload_failed',memberServing:false});}).catch(()=>{if(!stopping){emit({state:'tls_reload_failed',memberServing:false});stop(1);}}).finally(()=>{reloading=false;});
 };
 process.on('SIGTERM',terminate);process.on('SIGINT',terminate);process.on('SIGHUP',reload);
 try{
  host=createPersistentAllianceProcess({enabled:true,generationEnabled:false,origin:config.origin,installation,bind:config.bind,port:config.port,socketPath:config.socketPath,readTlsMaterial:tlsFiles.readTlsMaterial});
  const bound=await host.listen();
  if(!stopping)await tlsFiles.acknowledge();
  reloadReady=!stopping;
  if(!stopping)emit({state:'closed_bootstrap_listening',memberServing:false,port:bound.port,processId:installation.processId,pid:process.pid});
 }catch{if(!stopping)stop(1);}
 try{return await done;}finally{process.removeListener('SIGTERM',terminate);process.removeListener('SIGINT',terminate);process.removeListener('SIGHUP',reload);}
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 try{process.exitCode=await runClosedMemberProcess();}catch{emit({state:'unavailable',memberServing:false});process.exitCode=1;}
}
