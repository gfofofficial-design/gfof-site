// Preserve the installed certificate hook's owned generation and public-only ACK.
import {open,lstat,realpath,rename,unlink,constants} from 'node:fs/promises';
import {dirname,basename,isAbsolute,normalize,join} from 'node:path';
import {X509Certificate} from 'node:crypto';
const fail=()=>Error('closed_member_tls_files_unavailable');
const absolute=v=>typeof v==='string'&&isAbsolute(v)&&normalize(v)===v;
export function createClosedMemberTlsFiles({rootDirectory,currentLink,acknowledgementPath,ownerUid}={}){
 if(process.platform==='win32'||![rootDirectory,currentLink,acknowledgementPath].every(absolute)||![0,process.getuid()].includes(ownerUid))throw fail();
 let pending;
 async function directory(path,uid,modes){const s=await lstat(path);if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==uid||s.gid!==process.getgid()||!modes.includes(s.mode&0o777)||await realpath(path)!==path)throw fail();}
 async function read(path){
  const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try{const s=await f.stat();if(!s.isFile()||s.uid!==ownerUid||s.gid!==process.getgid()||(s.mode&0o777)!==0o640||s.size<1||s.size>1048576)throw fail();const buffer=Buffer.alloc(s.size+1),{bytesRead}=await f.read(buffer,0,buffer.length,0);if(bytesRead!==s.size)throw fail();return buffer.subarray(0,bytesRead);}finally{await f.close();}
 }
 return Object.freeze({
  async readTlsMaterial(){
   try{
    await directory(rootDirectory,ownerUid,[0o750]);const generation=await realpath(currentLink);
    if(dirname(generation)!==rootDirectory||!/^generation-[a-zA-Z0-9_-]+$/.test(basename(generation)))throw fail();
    await directory(generation,ownerUid,[0o750]);const cert=await read(join(generation,'fullchain.pem')),key=await read(join(generation,'privkey.pem')),parsed=new X509Certificate(cert);
    pending={fingerprint:parsed.fingerprint256.replaceAll(':','').toLowerCase(),validToUtc:new Date(parsed.validTo).toISOString()};return {cert,key};
   }catch{throw fail();}
  },
  async acknowledge(){
   let f,created=false;const temporary=acknowledgementPath+'.'+process.pid,value=pending;
   try{
    if(!value)throw fail();await directory(dirname(acknowledgementPath),process.getuid(),[0o700,0o750]);
    f=await open(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);created=true;
    await f.writeFile(JSON.stringify({state:'closed_tls_ready',memberServing:false,...value})+'\n');await f.close();f=undefined;await rename(temporary,acknowledgementPath);created=false;
   }catch{throw fail();}finally{await f?.close();if(created)await unlink(temporary).catch(()=>{});}
  },
 });
}
