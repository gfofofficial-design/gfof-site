// Default-off host-side controller. Unix socket only; no TCP, credentials,
// database permission, service restart, SERVE transition or automatic retry.
import {request} from 'node:http';
import {lstat,realpath} from 'node:fs/promises';
import {dirname,isAbsolute,normalize} from 'node:path';
import {persistentInstallation} from './alliance-avatar-server/persistent-installation.mjs';
import {reportReviewCheckpoint} from './alliance-avatar-server/report-review-recovery.mjs';

const fail=()=>Error('alliance_local_controller_unavailable');
const exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(n=>Object.hasOwn(v,n));
export function createAllianceLocalControlClient(options={}){
 const disabled=()=>Object.freeze({status:async()=>({state:'disabled'}),closeAndDrain:async()=>({state:'unknown',access:'unverified',providerClosureVerified:false}),prepare:async()=>({state:'quarantine',access:'closed'}),close(){}});
 if(options.enabled===undefined||options.enabled===false)return disabled();
 const {socketPath,ownerUid,expected}=options;
 let binding;
 try{
  if(options.enabled!==true||process.platform==='win32'||typeof socketPath!=='string'||!isAbsolute(socketPath)||normalize(socketPath)!==socketPath||Buffer.byteLength(socketPath)>100||
   !Number.isInteger(ownerUid)||ownerUid<1||ownerUid>65534||!exact(expected,['instanceArn','releaseSha256','environment']))throw fail();
  binding=persistentInstallation({format:1,...expected,processId:'00000000-0000-4000-8000-000000000000'});
 }catch{throw fail();}
 let closed=false,busy=false,faulted=false,active;
 function identity(value){const v=persistentInstallation(value);if(['instanceArn','releaseSha256','environment'].some(k=>v[k]!==binding[k]))throw fail();return v;}
 async function exchange(path,input,signal,timeoutMs){
  if(closed||signal?.aborted)throw fail();
  const directory=dirname(socketPath),d=await lstat(directory),s=await lstat(socketPath);
  if(!d.isDirectory()||d.isSymbolicLink()||d.uid!==ownerUid||(d.mode&0o777)!==0o700||await realpath(directory)!==directory||
   !s.isSocket()||s.isSymbolicLink()||s.uid!==ownerUid||s.nlink!==1||(s.mode&0o777)!==0o600||closed||signal?.aborted)throw fail();
  const body=Buffer.from(JSON.stringify(input));if(body.length>65536)throw fail();
  return new Promise((resolve,reject)=>{
   let q,r,ended=false,timer;const chunks=[];let size=0;
   const finish=(error,value)=>{if(ended)return;ended=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);active=undefined;
    r?.destroy();q?.destroy();error?reject(fail()):resolve(value);};
   const abort=()=>finish(fail());
   try{
    q=request({socketPath,path,method:'POST',agent:false,maxHeaderSize:4096,headers:{Host:'alliance-control.local','Content-Type':'application/json','Content-Length':body.length,Connection:'close'}},response=>{
     r=response;
     if(response.statusCode!==200||!/^application\/json(?:;|$)/.test(response.headers['content-type']??'')||response.headers['content-encoding']||response.headers['set-cookie']||response.headers.location){finish(fail());return;}
     r.on('data',chunk=>{size+=chunk.length;if(size>4096)finish(fail());else chunks.push(chunk);});
     r.on('error',abort);r.on('aborted',abort);r.on('end',()=>{try{finish(null,JSON.parse(Buffer.concat(chunks,size).toString('utf8')));}catch{finish(fail());}});
    });
    q.on('error',abort);active=abort;signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(abort,timeoutMs);
    if(closed||signal?.aborted)abort();else q.end(body);
   }catch{finish(fail());}
  });
 }
 async function status(signal){
  const v=await exchange('/v1/status',{},signal,3000);
  if(!exact(v,['state','installation','preparationAttempted','applicationCloseRequested','providerClosureVerified'])||v.state!=='local_control_available'||
   typeof v.preparationAttempted!=='boolean'||typeof v.applicationCloseRequested!=='boolean'||v.providerClosureVerified!==false)throw fail();
  return {...v,installation:identity(v.installation)};
 }
 async function run(signal,work){
  if(closed||faulted||busy||signal!==undefined&&!(signal instanceof AbortSignal)||signal?.aborted)throw fail();busy=true;
  try{return await work();}catch{faulted=true;throw fail();}finally{busy=false;}
 }
 return Object.freeze({
  status:({signal}={})=>run(signal,()=>status(signal)),
  closeAndDrain:({signal}={})=>run(signal,async()=>{
   const current=await status(signal),installation=current.installation;
   const closedReply=await exchange('/v1/close',{installation},signal,30000);
   if(!exact(closedReply,['state','access','providerClosureVerified'])||closedReply.state!=='closed'||closedReply.access!=='closed'||closedReply.providerClosureVerified!==false)throw fail();
   const drained=await exchange('/v1/drain',{installation},signal,50000);
   if(!exact(drained,['state','access','providerClosureVerified'])||drained.state!=='local_work_settled'||drained.access!=='closed'||drained.providerClosureVerified!==false)throw fail();
   return {installation,...drained};
  }),
  prepare:(checkpoint,{retiredInstallation,signal}={})=>run(signal,async()=>{
   const cp=reportReviewCheckpoint(checkpoint),retired=identity(retiredInstallation),current=await status(signal);
   if(current.preparationAttempted||current.applicationCloseRequested||current.installation.processId===retired.processId)throw fail();
   const r=await exchange('/v1/prepare',{installation:current.installation,checkpoint:cp},signal,30000);
   if(!exact(r,['state','access','providerClosureVerified'])||r.state!=='prepared'||r.access!=='closed'||r.providerClosureVerified!==false)throw fail();
   // Only acknowledges the existing application's REVIEW preparation. The
   // separately newer signed SERVE decision remains mandatory per request.
   return {installation:current.installation,...r};
  }),
  close(){closed=true;active?.();}
 });
}
