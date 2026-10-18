// Guarded synthetic-only pg_dump/pg_restore test helper. Not a production backup
// tool. No URL/password input; fixed tables and exact loopback fixture identities.
import {execFileSync} from 'node:child_process';
import {mkdirSync,realpathSync,readFileSync,statSync,unlinkSync,rmdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {RECOVERY_TABLES} from './recovery-pair.mjs';
export function fixtureArchive({domain,local,scratch,container}){
  if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture'||!Object.hasOwn(RECOVERY_TABLES,domain))throw Error('Wrong archive fixture');
  const tables=RECOVERY_TABLES[domain],port=domain==='member'?55488:55489;
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^PG/i.test(k)));
  const exec=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',env,timeout:15000,maxBuffer:2*1024*1024});
  let directory,socket;
  if(local){
    if(process.getuid?.()!==102||!/^\/tmp\/fed-alliance-server-[A-Za-z0-9]{8}$/.test(scratch)||realpathSync(scratch)!==scratch)throw Error('Wrong local archive fixture');
    socket=domain==='member'?scratch+'/socket':scratch+'/creation-journal/socket';if(realpathSync(socket)!==socket)throw Error('Wrong archive socket');
    directory=scratch+'/recovery-'+randomUUID();mkdirSync(directory,{mode:0o700});if(realpathSync(directory)!==directory)throw Error('Wrong archive directory');
  }else{
    if(!/^[a-f0-9]{12,64}$/.test(container||''))throw Error('Wrong archive container');
    const v=JSON.parse(exec('docker',['inspect',container]))[0],b=v.HostConfig.PortBindings?.['5432/tcp'];
    if(v.Config.Image!=='postgres:17.11-bookworm'||b?.length!==1||b[0].HostIp!=='127.0.0.1'||b[0].HostPort!==(domain==='member'?'54329':'54330'))throw Error('Wrong archive container binding');
    directory='/tmp/alliance-recovery-'+randomUUID();exec('docker',['exec','-u','postgres',container,'mkdir','-m','700',directory]);
  }
  const file=directory+'/'+domain+'.dump';let handle,closed=false;
  const tool=(name,args)=>local?exec('/usr/lib/postgresql/18/bin/'+name,args):exec('docker',['exec','-u','postgres',container,name,...args]);
  const connection=()=>local?['-h',socket,'-p',String(port),'-U','postgres','-d','postgres']:['-U','postgres','-d','postgres'];
  const fingerprint=()=>{
    const bytes=local?statSync(file).size:Number(exec('docker',['exec',container,'stat','-c','%s',file]).trim());
    if(!Number.isSafeInteger(bytes)||bytes<1||bytes>8*1024*1024)throw Error('Wrong archive size');
    const sha256=local?createHash('sha256').update(readFileSync(file)).digest('hex'):exec('docker',['exec',container,'sha256sum','--',file]).split(/\s/)[0];
    if(!/^[0-9a-f]{64}$/.test(sha256))throw Error('Wrong archive digest');return {bytes,sha256};
  };
  const contents=()=>{
    const lines=tool('pg_restore',['--list',file]).split('\n').map(x=>x.trim()).filter(x=>x&&!x.startsWith(';'));
    const actual=lines.map(line=>{const m=/^\d+; \d+ \d+ TABLE DATA ([a-z_]+) ([a-z_]+) [a-z_]+$/.exec(line);if(!m)throw Error('Unexpected archive object');return m[1]+'.'+m[2];}).sort();
    if(JSON.stringify(actual)!==JSON.stringify([...tables].sort()))throw Error('Incomplete archive table coverage');
  };
  return Object.freeze({
    dump(){
      if(closed||handle)throw Error('One archive only');
      tool('pg_dump',[...connection(),'--format=custom','--data-only','--no-owner','--no-privileges','--no-large-objects','--strict-names',...tables.map(t=>'--table='+t),'--file='+file]);contents();
      handle=Object.freeze({domain,...fingerprint(),tables:[...tables]});return handle;
    },
    restore(value){
      if(closed||value!==handle||!handle)throw Error('Exact same-domain archive handle required');
      const current=fingerprint();if(current.bytes!==handle.bytes||current.sha256!==handle.sha256)throw Error('Archive bytes changed');contents();
      tool('pg_restore',[...connection(),'--data-only','--single-transaction','--exit-on-error','--no-owner','--no-privileges',file]);
    },
    close(){
      if(closed)return;closed=true;
      if(local){if(realpathSync(directory)!==directory||!directory.startsWith(scratch+'/recovery-'))throw Error('Wrong archive cleanup');try{unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}rmdirSync(directory);}
      else{exec('docker',['exec','-u','postgres',container,'rm','-f','--',file]);exec('docker',['exec','-u','postgres',container,'rmdir','--',directory]);}
    }
  });
}
