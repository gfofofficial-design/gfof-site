// Actual data-only archives from a fixed synthetic source to a fixed, different
// disposable target. Not a production exporter; no caller paths/SQL/credentials.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {realpathSync,mkdirSync,writeFileSync,readFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {RECOVERY_TABLES} from './recovery-pair.mjs';
const tables=Object.freeze({member:RECOVERY_TABLES.member,community:Object.freeze(['control','challenges','contributions','operations','blocks'].map(t=>'alliance_community.'+t))});
const receipts=new WeakSet(),sha=b=>createHash('sha256').update(b).digest('hex');
export function communityArchiveIO({domain,target,replacement=false}){
 if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture'||!Object.hasOwn(tables,domain)||typeof replacement!=='boolean')throw Error('Wrong community archive fixture');
 const {local,scratch,container}=target,port=local?(replacement?55493:55490):(replacement?54334:54331);
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^PG/i.test(k)));
 const exec=(cmd,args,input)=>execFileSync(cmd,args,{input,env,encoding:'buffer',timeout:20000,maxBuffer:2*1048576});
 let socket,directory,closed=false,receipt;
 if(local){
  if(process.getuid?.()!==102||!/^\/tmp\/fed-alliance-server-[A-Za-z0-9]{8}$/.test(scratch)||realpathSync(scratch)!==scratch)throw Error('Wrong community archive scratch');
  socket=scratch+'/creation-'+(replacement?'replacement-control':'control')+'/socket';assert.equal(realpathSync(socket),socket);
  directory=scratch+'/community-archive-'+randomUUID();mkdirSync(directory,{mode:0o700});assert.equal(realpathSync(directory),directory);
 }else{
  if(!/^[a-f0-9]{12,64}$/.test(container||''))throw Error('Wrong community archive container');
  const v=JSON.parse(exec('docker',['inspect',container])),b=v[0].HostConfig.PortBindings?.['5432/tcp'];
  if(v[0].Config.Image!=='postgres:17.11-bookworm'||b?.length!==1||b[0].HostIp!=='127.0.0.1'||b[0].HostPort!==String(port))throw Error('Wrong community archive binding');
  directory='/tmp/alliance-community-archive-'+randomUUID();exec('docker',['exec','-u','postgres',container,'mkdir','-m','700',directory]);
 }
 const file=directory+'/data.dump',connection=local?['-h',socket,'-p',String(port),'-U','fixture_root','-d','postgres']:['-U','fixture_root','-d','postgres'];
 const tool=(name,args)=>local?exec('/usr/lib/postgresql/18/bin/'+name,args):exec('docker',['exec','-u','postgres',container,name,...args]);
 const remove=()=>local?unlinkSync(file):exec('docker',['exec','-u','postgres',container,'rm','--',file]);
 const read=()=>local?readFileSync(file):exec('docker',['exec','-u','postgres',container,'cat','--',file]);
 const sql=q=>tool('psql',[...connection,'-X','-At','-v','ON_ERROR_STOP=1','-c',q]).toString().trim();
 const cluster=()=>{const id=sql('select system_identifier::text from pg_catalog.pg_control_system();');if(!/^\d{10,20}$/.test(id))throw Error('Wrong community archive cluster');return id;};
 const toc=()=>{
  const lines=tool('pg_restore',['--list',file]).toString().split('\n').map(v=>v.trim()).filter(v=>v&&!v.startsWith(';'));
  const actual=lines.map(v=>{const m=/^\d+; \d+ \d+ TABLE DATA ([a-z_]+) ([a-z_]+) [a-z_]+$/.exec(v);if(!m)throw Error('Unexpected community archive object');return m[1]+'.'+m[2];}).sort();
  assert.deepEqual(actual,[...tables[domain]].sort());return lines;
 };
 return Object.freeze({
  dump(){
   if(closed||replacement||receipt)throw Error('Wrong community export state');
   tool('pg_dump',[...connection,'--format=custom','--data-only','--no-owner','--no-privileges','--no-large-objects','--strict-names',...tables[domain].map(t=>'--table='+t),'--file='+file]);
   try{const bytes=read();assert.ok(bytes.length>5&&bytes.length<=1048576);assert.equal(bytes.subarray(0,5).toString(),'PGDMP');receipt=Object.freeze({domain,sourceCluster:cluster(),bytes:bytes.length,sha256:sha(bytes),toc:Object.freeze(toc())});receipts.add(receipt);return {bytes,receipt};}finally{remove();}
  },
  restore(bytes,original){
   if(closed||!replacement||!receipts.has(original)||original.domain!==domain||!(bytes instanceof Uint8Array)||bytes.length!==original.bytes||sha(bytes)!==original.sha256||cluster()===original.sourceCluster)throw Error('Wrong original community archive');
   // Canonical schemas must already be installed. Refuse any occupied table;
   // the caller separately validates the disabled boundary before clearing its
   // two literal empty control rows. No TRUNCATE/clean or schema SQL is accepted.
   if(sql('select '+tables[domain].map(t=>'(select count(*) from '+t+')').join('+')+';')!=='0')throw Error('Community replacement target occupied');
   if(local)writeFileSync(file,bytes,{flag:'wx',mode:0o600});else exec('docker',['exec','-i','-u','postgres',container,'sh','-c','umask 077; set -C; cat > "$1"','fixture-writer',file],bytes);
   try{assert.deepEqual(toc(),original.toc);tool('pg_restore',[...connection,'--single-transaction','--exit-on-error','--data-only','--no-owner','--no-privileges',file]);}finally{remove();}
  },
  close(){if(closed)return;closed=true;if(local){if(realpathSync(directory)!==directory||!directory.startsWith(scratch+'/community-archive-'))throw Error('Wrong community archive cleanup');try{unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}rmdirSync(directory);}else{exec('docker',['exec','-u','postgres',container,'rm','-f','--',file]);exec('docker',['exec','-u','postgres',container,'rmdir','--',directory]);}}
 });
}
