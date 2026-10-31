// Administrative RPC over one OS-protected local Unix socket, never TCP.
// This does not grant provider permissions or perform a SERVE transition.
import {createServer} from 'node:http';
import {lstat,realpath,chmod} from 'node:fs/promises';
import {dirname,isAbsolute,normalize} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {persistentInstallation} from './alliance-avatar-server/persistent-installation.mjs';

const failure=()=>Error('alliance_local_control_unavailable');
const closedReply=()=>({state:'closed',access:'closed',providerClosureVerified:false});
const unavailable=()=>({state:'unavailable',access:'closed',providerClosureVerified:false});
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
function send(response,status,value){if(!response.destroyed&&!response.writableEnded){response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store','Connection':'close'});response.end(JSON.stringify(value));}}
function read(request,signal){
 return new Promise((resolve,reject)=>{
  const chunks=[];let size=0;
  const finish=(error,value)=>{request.removeListener('data',data);request.removeListener('end',end);request.removeListener('error',failed);request.removeListener('aborted',failed);signal.removeEventListener('abort',failed);error?reject(error):resolve(value);};
  const failed=()=>finish(failure());
  const data=chunk=>{size+=chunk.length;if(size>65536){finish(failure());request.resume();}else chunks.push(chunk);};
  const end=()=>{try{finish(null,JSON.parse(Buffer.concat(chunks,size).toString('utf8')));}catch{failed();}};
  request.on('data',data);request.once('end',end);request.once('error',failed);request.once('aborted',failed);signal.addEventListener('abort',failed,{once:true});if(signal.aborted)failed();
 });
}

export function createPersistentAllianceLocalControl({enabled=false,socketPath='/run/alliance-member-control/control.sock',installation,applicationHost}={}){
 if(enabled===false)return Object.freeze({listen:async()=>({state:'disabled'}),close:async()=>{}});
 let identity;
 try{
  identity=Object.freeze(persistentInstallation(installation));
  if(enabled!==true||process.platform==='win32'||typeof process.getuid!=='function'||typeof socketPath!=='string'||!isAbsolute(socketPath)||normalize(socketPath)!==socketPath||Buffer.byteLength(socketPath)>100||!['prepare','close','drain'].every(k=>typeof applicationHost?.[k]==='function'))throw failure();
 }catch{throw failure();}
 const context=Object.freeze({server:identity});let server,attempted=false,closed=false,prepared=false,active,closing,applicationClosing;
 function closeApplication(){if(!applicationClosing)applicationClosing=Promise.resolve().then(()=>applicationHost.close());return applicationClosing;}
 function close(){
  if(closing)return closing;closed=true;active?.abort();
  const app=closeApplication();
  const network=server?new Promise(resolve=>{server.close(()=>resolve());server.closeAllConnections();}):Promise.resolve();
  closing=Promise.all([app,network]).then(()=>undefined);return closing;
 }
 async function handle(request,response){
  const refuse=(status)=>{request.resume();send(response,status,unavailable());};
  const protectedHeaders=new Set(['host','content-type','content-length','transfer-encoding','authorization']);const seen=new Set();
  for(let i=0;i<request.rawHeaders.length;i+=2){const k=request.rawHeaders[i].toLowerCase();if(protectedHeaders.has(k)&&seen.has(k))return refuse(400);seen.add(k);}
  if(closed||request.method!=='POST'||!['/v1/prepare','/v1/close','/v1/drain'].includes(request.url))return refuse(404);
  if(request.headers.host!=='alliance-control.local'||seen.has('authorization')||seen.has('transfer-encoding')||request.headers['content-type']!=='application/json'||!/^[1-9][0-9]*$/.test(request.headers['content-length']||'')||Number(request.headers['content-length'])>65536)return refuse(400);
  // Closure may interrupt preparation; other operations never queue or overlap.
  if(active&&request.url!=='/v1/close')return refuse(503);
  const controller=new AbortController();const abort=()=>controller.abort();let dispatched=false,deadlineResolve;
  request.once('aborted',abort);const disconnected=()=>{if(!response.writableFinished)abort();};response.once('close',disconnected);
  const interrupted=new Promise(resolve=>{deadlineResolve=resolve;});
  const stopped=()=>{if(dispatched)void closeApplication().catch(()=>{});deadlineResolve(null);};controller.signal.addEventListener('abort',stopped,{once:true});
  const timer=setTimeout(abort,request.url==='/v1/drain'?48000:28000);
  let flight=false;
  const work=(async()=>{
   const input=await read(request,controller.signal);
   const fields=request.url==='/v1/prepare'?['installation','checkpoint']:['installation'];
   if(!exact(input,fields)||!isDeepStrictEqual(persistentInstallation(input.installation),identity)||controller.signal.aborted)throw failure();
   if(request.url!=='/v1/close'){if(active)throw failure();active=controller;flight=true;}
   dispatched=true;
   if(request.url==='/v1/close'){active?.abort();await closeApplication();return closedReply();}
   if(request.url==='/v1/drain'){
    const result=await applicationHost.drain({timeoutMs:45000});
    if(!exact(result,['state','access','providerClosureVerified'])||result.access!=='closed'||result.providerClosureVerified!==false||!['local_work_settled','unknown'].includes(result.state))throw failure();
    return {...result};
   }
   if(prepared||applicationClosing)throw failure();prepared=true;
   const result=await applicationHost.prepare(input.checkpoint,context,{signal:controller.signal});
   if(!exact(result,['state','access'])||result.state!=='prepared'||result.access!=='closed')throw failure();
   return {state:'prepared',access:'closed',providerClosureVerified:false};
  })().catch(()=>null);
  void work.finally(()=>{if(flight&&active===controller)active=undefined;}).catch(()=>{});
  try{
   const result=await Promise.race([work,interrupted]);
   if(!result&&dispatched)void closeApplication().catch(()=>{});
   send(response,result?200:503,result||unavailable());
  }finally{clearTimeout(timer);request.removeListener('aborted',abort);response.removeListener('close',disconnected);controller.signal.removeEventListener('abort',stopped);}
 }
 return Object.freeze({
  async listen(){
   if(attempted||closed)throw failure();attempted=true;
   try{
    const directory=dirname(socketPath),info=await lstat(directory);
    if(!info.isDirectory()||info.isSymbolicLink()||info.uid!==process.getuid()||(info.mode&0o777)!==0o700||await realpath(directory)!==directory)throw failure();
    try{await lstat(socketPath);throw failure();}catch(e){if(e.code!=='ENOENT')throw failure();}
    server=createServer({maxHeaderSize:4096,headersTimeout:5000,requestTimeout:5000,keepAliveTimeout:1000,connectionsCheckingInterval:1000},(q,s)=>{void handle(q,s).catch(()=>{send(s,503,unavailable());void close().catch(()=>{});});});
    server.maxConnections=4;server.maxHeadersCount=16;server.maxRequestsPerSocket=1;server.setTimeout(50000,s=>s.destroy());server.on('clientError',(_e,s)=>s.destroy());
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(socketPath,()=>{server.removeListener('error',reject);resolve();});});
    await chmod(socketPath,0o600);const infoSocket=await lstat(socketPath);if(!infoSocket.isSocket()||infoSocket.uid!==process.getuid()||(infoSocket.mode&0o777)!==0o600||closed)throw failure();
    server.on('error',()=>{void close().catch(()=>{});});
    return {state:'local_control_listening',providerClosureVerified:false};
   }catch{try{await close();}catch{}throw failure();}
  },close,
 });
}
