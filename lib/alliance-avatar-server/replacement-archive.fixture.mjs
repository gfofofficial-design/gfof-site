// Synthetic, fixed-schema archives and disposable replacement servers only.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,realpathSync,writeFileSync,readFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {REPLACEMENT_DOMAINS} from './replacement-security.fixture.mjs';
const receipts=new WeakSet(),sha=b=>createHash('sha256').update(b).digest('hex');
export function replacementArchiveIO({domain,target,replacement=false}){
 if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture'||!Object.hasOwn(REPLACEMENT_DOMAINS,domain))throw Error('Wrong replacement archive fixture');
 const physical={'account-history':'journal','account-ack':'control'}[domain]||domain;
 const {local,scratch,container}=target,index=['member','journal','control'].indexOf(physical),port=(local?(replacement?55491:55488):(replacement?54332:54329))+index;
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^PG/i.test(k))),exec=(cmd,args,input)=>execFileSync(cmd,args,{input,env,encoding:'buffer',timeout:20000,maxBuffer:8*1048576});
 let socket,directory;
 if(local){
  if(process.getuid?.()!==102||!/^\/tmp\/fed-alliance-server-[A-Za-z0-9]{8}$/.test(scratch)||realpathSync(scratch)!==scratch)throw Error('Wrong replacement scratch');
  socket=scratch+(replacement?'/creation-replacement-'+physical:physical==='member'?'':'/creation-'+physical)+'/socket';assert.equal(realpathSync(socket),socket);
  directory=scratch+'/replacement-archive-'+randomUUID();mkdirSync(directory,{mode:0o700});
 }else{
  if(!/^[a-f0-9]{12,64}$/.test(container||''))throw Error('Wrong replacement container');
  const v=JSON.parse(exec('docker',['inspect',container]))[0],b=(replacement?v.NetworkSettings.Ports:v.HostConfig.PortBindings)?.['5432/tcp'];
  const expectedPort=replacement?target.hostPort:port;
  if(replacement&&(!Number.isInteger(expectedPort)||expectedPort<1||expectedPort>65535||
    !new RegExp('^/alliance-creation-replacement-'+physical+'-[a-f0-9-]{36}$').test(v.Name)))throw Error('Wrong replacement binding');
  if(v.Config.Image!=='postgres:17.11-bookworm'||b?.length!==1||b[0].HostIp!=='127.0.0.1'||b[0].HostPort!==String(expectedPort))throw Error('Wrong replacement binding');
  directory='/tmp/alliance-replacement-'+randomUUID();exec('docker',['exec','-u','postgres',container,'mkdir','-m','700',directory]);
 }
 const file=directory+'/fixture.dump',connection=local?['-h',socket,'-p',String(port),'-U','postgres','-d','postgres']:['-U','postgres','-d','postgres'];let closed=false,receipt;
 const tool=(name,args,input)=>local?exec('/usr/lib/postgresql/18/bin/'+name,args,input):exec('docker',['exec',...(input?['-i']:[]),'-u','postgres',container,name,...args],input);
 const remove=()=>local?unlinkSync(file):exec('docker',['exec','-u','postgres',container,'rm','--',file]);
 const contents=()=>{
  const lines=tool('pg_restore',['--list',file]).toString().split('\n').map(x=>x.trim()).filter(x=>x&&!x.startsWith(';'));
  const schemas=REPLACEMENT_DOMAINS[domain].schemas;
  for(const line of lines){
   const match=/^\d+; \d+ \d+ (?:SCHEMA - ([a-z_]+) |(?:ACL|COMMENT) - SCHEMA ([a-z_]+) |(?:TABLE DATA|TABLE|FUNCTION|CONSTRAINT|POLICY|ROW SECURITY|TRIGGER|ACL|COMMENT|DEFAULT ACL|INDEX|FK CONSTRAINT) ([a-z_]+) )/.exec(line);
   // Global owner default ACLs have '-' instead of a schema; their exact text
   // still binds the original receipt and separately reviewed security snapshot.
   if(!match||!schemas.includes(match[1]||match[2]||match[3])){
    if(!/^\d+; \d+ \d+ DEFAULT ACL - DEFAULT PRIVILEGES FOR FUNCTIONS alliance_(?:avatar|journal|control|account)_owner$/.test(line)){const safe=Error('Unexpected fixed-schema archive object');safe.code='RPL_ARCHIVE_TOC';throw safe;}
   }
  }
  assert.equal(lines.filter(x=>/^\d+; \d+ \d+ TABLE DATA /.test(x)).length,REPLACEMENT_DOMAINS[domain].tables);return lines;
 };
 const api={
  dump(){
   if(closed||replacement||receipt)throw Error('Wrong replacement export state');
   tool('pg_dump',[...connection,'--format=custom','--no-large-objects','--strict-names',...REPLACEMENT_DOMAINS[domain].schemas.map(s=>'--schema='+s),'--file='+file]);
   const bytes=local?readFileSync(file):exec('docker',['exec','-u','postgres',container,'cat','--',file]);assert.ok(bytes.length>5&&bytes.length<=1048576);assert.equal(bytes.subarray(0,5).toString(),'PGDMP');
   receipt=Object.freeze({domain,bytes:bytes.length,sha256:sha(bytes),toc:Object.freeze(contents())});receipts.add(receipt);remove();return {bytes,receipt};
  },
  restore(bytes,original){
   if(closed||!replacement||!receipts.has(original)||original.domain!==domain||!(bytes instanceof Uint8Array)||bytes.length!==original.bytes||sha(bytes)!==original.sha256)throw Error('Wrong original replacement archive');
   const schemas=REPLACEMENT_DOMAINS[domain].schemas.filter(s=>s!=='public');
   const rs=REPLACEMENT_DOMAINS[domain].roles.map(r=>"'"+r+"'").join(',');
   tool('psql',[...connection,'-X','-v','ON_ERROR_STOP=1','-c',`do $$ begin if exists(select 1 from pg_catalog.pg_namespace where nspname in(${schemas.map(s=>"'"+s+"'").join(',')})) or exists(select 1 from pg_catalog.pg_class where relnamespace='public'::regnamespace) or exists(select 1 from pg_catalog.pg_proc where pronamespace='public'::regnamespace) or exists(select 1 from pg_catalog.pg_type where typnamespace='public'::regnamespace) then raise exception 'Replacement target occupied';end if;if exists(select 1 from pg_catalog.pg_authid where rolname in(${rs}) and (rolcanlogin or rolpassword is not null or rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication)) or exists(select 1 from pg_catalog.pg_auth_members m join pg_catalog.pg_roles r on r.oid=m.member or r.oid=m.roleid where r.rolname in(${rs})) then raise exception 'Replacement roles unsafe';end if;end $$;`]);
   if(local)writeFileSync(file,bytes,{flag:'wx',mode:0o600});else exec('docker',['exec','-i','-u','postgres',container,'sh','-c','umask 077; set -C; cat > "$1"','fixture-writer',file],bytes);
   // --clean is confined to this independently confirmed empty target. It lets
   // pg_restore replace initdb's empty public schema in the same transaction;
   // it is never permission to overwrite an occupied database.
   let sql,script;
   try{
    assert.deepEqual(contents(),original.toc);sql=tool('pg_restore',['--clean','--if-exists','--file=-',file]);
    // Recreating initdb's public schema can omit its implicit PUBLIC USAGE.
    // Restore that one literal reviewed bootstrap default within the SAME
    // transaction, not by accepting a weaker post-restore comparison.
    const baseline=domain==='member'?'\ngrant usage on schema public to public;revoke create on schema public from public;\n':'';
    script=Buffer.concat([sql,Buffer.from(baseline)]);tool('psql',[...connection,'-X','-v','ON_ERROR_STOP=1','--single-transaction','--file=-'],script);
   }finally{sql?.fill(0);script?.fill(0);remove();}
  },
  close(){if(closed)return;closed=true;if(local){if(realpathSync(directory)!==directory||!directory.startsWith(scratch+'/replacement-archive-'))throw Error('Wrong replacement archive cleanup');try{unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}rmdirSync(directory);}else{exec('docker',['exec','-u','postgres',container,'rm','-f','--',file]);exec('docker',['exec','-u','postgres',container,'rmdir','--',directory]);}}
 };return Object.freeze(api);
}
