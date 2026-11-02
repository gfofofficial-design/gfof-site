// Deferred server-only private delivery. No environment/metadata lookup, listener,
// permission transition, automatic preparation, key creation or credential export.
import {open,lstat,realpath,constants} from 'node:fs/promises';
import {isAbsolute,normalize,join} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {persistentInstallation} from './alliance-avatar-server/persistent-installation.mjs';
import {PERSISTENT_GATEWAY_SIGNING_SECRET} from './alliance-avatar-server/netlify-signing-runtime.mjs';
import {createManagedAlliancePersistentBundle} from './alliance-member-preview-bundle.mjs';
import {createMemberPgPoolFactory} from './alliance-avatar-server/member-pg-pool-factory.mjs';

const fail=()=>Error('alliance_private_bundle_unavailable');
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const configFields=['origin','key','scope','minimum','minimumRevision','reviewerActor','gateway','resource','callerKey','controlVerificationKey','journalVerificationKey'];
const textOnlyMedia=async()=>Object.freeze({processor:{process(){throw fail();}},storage:{upload(){throw fail();}},close(){}});

export function createPersistentAlliancePrivateBundle(options={}){
 if(options.enabled===undefined||options.enabled===false)return Object.freeze({openApplication:()=>createManagedAlliancePersistentBundle(),close:async()=>{}});
 let expected,root,ownerUid,createBundle;
 try{
  if(options.enabled!==true||process.platform==='win32')throw fail();
  expected=Object.freeze(persistentInstallation(options.installation));root=options.rootDirectory;ownerUid=options.ownerUid;
  createBundle=options.createBundle??createManagedAlliancePersistentBundle;
  if(typeof root!=='string'||!isAbsolute(root)||normalize(root)!==root||![0,process.getuid()].includes(ownerUid)||typeof createBundle!=='function'||
   ['openPool','fetcher','transport'].some(k=>options[k]!==undefined&&typeof options[k]!=='function'))throw fail();
 }catch{throw fail();}
 let used=false,closed=false,bundle,ending,secret,inputSignal;
 const abort=()=>{void close().catch(()=>{});};
 function close(){
  if(ending)return ending;closed=true;secret=undefined;inputSignal?.removeEventListener('abort',abort);
  ending=Promise.resolve().then(()=>bundle?.close()).then(()=>undefined,()=>{throw fail();});return ending;
 }
 async function contents(){
  let file,bytes;
  try{
   const dir=await lstat(root);
   if(closed||!dir.isDirectory()||dir.isSymbolicLink()||dir.uid!==ownerUid||dir.gid!==process.getgid()||(dir.mode&0o777)!==0o750||await realpath(root)!==root)throw fail();
   file=await open(join(root,'runtime.json'),constants.O_RDONLY|constants.O_NOFOLLOW);
   const info=await file.stat();
   if(closed||!info.isFile()||info.nlink!==1||info.uid!==ownerUid||info.gid!==process.getgid()||![0o600,0o640].includes(info.mode&0o777)||info.size<1||info.size>65536)throw fail();
   bytes=Buffer.alloc(info.size+1);const {bytesRead}=await file.read(bytes,0,bytes.length,0);
   if(closed||bytesRead!==info.size)throw fail();
   return JSON.parse(bytes.subarray(0,bytesRead).toString('utf8'));
  }catch{throw fail();}finally{bytes?.fill(0);await file?.close();}
 }
 return Object.freeze({
  async openApplication({signal}={}){
   if(used||closed||signal!==undefined&&!(signal instanceof AbortSignal)||signal?.aborted)throw fail();used=true;
   inputSignal=signal;signal?.addEventListener('abort',abort,{once:true});
   try{
    const openPool=options.openPool??await createMemberPgPoolFactory({enabled:true});
    if(closed||signal?.aborted)throw fail();
    const value=await contents();
    const identity={instanceArn:expected.instanceArn,releaseSha256:expected.releaseSha256,environment:expected.environment};
    if(closed||signal?.aborted||!exact(value,['format','purpose','installation','configuration','connections','callerSecret'])||value.format!==1||value.purpose!=='alliance-member-private-runtime'||
     !exact(value.installation,['instanceArn','releaseSha256','environment'])||!isDeepStrictEqual(value.installation,identity)||!exact(value.configuration,configFields)||
     !exact(value.connections,['member','journal','anchor'])||typeof value.callerSecret!=='string'||!/^[A-Za-z0-9+/]{64}$/.test(value.callerSecret))throw fail();
    secret=value.callerSecret;value.callerSecret=undefined;
    const readCallerSecret=async name=>{if(closed||signal?.aborted||name!==PERSISTENT_GATEWAY_SIGNING_SECRET||secret===undefined)throw fail();return secret;};
    const created=await createBundle({enabled:true,configuration:{...value.configuration,expectedInstallation:expected},connections:value.connections,readCallerSecret,openMedia:textOnlyMedia,signal,openPool,
     ...Object.fromEntries(['fetcher','transport'].filter(k=>options[k]!==undefined).map(k=>[k,options[k]]))});
    if(closed||signal?.aborted){await created.close();throw fail();}
    bundle=created;
    return Object.freeze({application:Object.freeze({prepare:created.application.prepare,handle:created.application.handle,close}),close});
   }catch{await close().catch(()=>{});throw fail();}
  },close,
 });
}
