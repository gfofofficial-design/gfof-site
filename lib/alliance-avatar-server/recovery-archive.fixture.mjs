// Guarded synthetic-only pg_dump/pg_restore test helper. Not a production backup
// tool. No URL/password input; fixed tables and exact loopback fixture identities.
import {execFileSync} from 'node:child_process';
import {mkdirSync,realpathSync,readFileSync,statSync,unlinkSync,rmdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {RECOVERY_TABLES} from './recovery-pair.mjs';
export function fixtureArchive({domain,local,scratch,container,mode='data-only'}){
  if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture'||!['member','journal','control'].includes(domain)||!['data-only','schema-and-data'].includes(mode)||mode==='schema-and-data'&&domain!=='control')throw Error('Wrong archive fixture');
  const tables=domain==='control'?['alliance_control.policy','alliance_control.removal_anchor']:RECOVERY_TABLES[domain],port={member:55488,journal:55489,control:55490}[domain];
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^PG/i.test(k)));
  const exec=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',env,timeout:15000,maxBuffer:2*1024*1024});
  let directory,socket;
  if(local){
    if(process.getuid?.()!==102||!/^\/tmp\/fed-alliance-server-[A-Za-z0-9]{8}$/.test(scratch)||realpathSync(scratch)!==scratch)throw Error('Wrong local archive fixture');
    socket=domain==='member'?scratch+'/socket':scratch+'/creation-'+domain+'/socket';if(realpathSync(socket)!==socket)throw Error('Wrong archive socket');
    directory=scratch+'/recovery-'+randomUUID();mkdirSync(directory,{mode:0o700});if(realpathSync(directory)!==directory)throw Error('Wrong archive directory');
  }else{
    if(!/^[a-f0-9]{12,64}$/.test(container||''))throw Error('Wrong archive container');
    const v=JSON.parse(exec('docker',['inspect',container]))[0],b=v.HostConfig.PortBindings?.['5432/tcp'];
    if(v.Config.Image!=='postgres:17.11-bookworm'||b?.length!==1||b[0].HostIp!=='127.0.0.1'||b[0].HostPort!==String({member:54329,journal:54330,control:54331}[domain]))throw Error('Wrong archive container binding');
    directory='/tmp/alliance-recovery-'+randomUUID();exec('docker',['exec','-u','postgres',container,'mkdir','-m','700',directory]);
  }
  const file=directory+'/'+domain+'.dump';let handle,closed=false;
  const tool=(name,args)=>local?exec('/usr/lib/postgresql/18/bin/'+name,args):exec('docker',['exec','-u','postgres',container,name,...args]);
  const connection=()=>local?['-h',socket,'-p',String(port),'-U','postgres','-d','postgres']:['-U','postgres','-d','postgres'];
  const controlPreflight=restoring=>{
    if(mode!=='schema-and-data')return;
    const checks=restoring?"if pg_catalog.to_regnamespace('alliance_control') is not null then raise exception 'Control target not empty';end if;":"if (select count(*) from alliance_control.policy where state='closed')<>1 or (select count(*) from alliance_control.removal_anchor)<>1 then raise exception 'Control source not closed';end if;";
    tool('psql',[...connection(),'-X','-v','ON_ERROR_STOP=1','-c',"do $$ begin if (select count(*) from pg_catalog.pg_roles where rolname in('alliance_control_owner','alliance_control_reader','alliance_control_operator','alliance_control_anchor_writer') and not rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication and not rolinherit)<>4 then raise exception 'Control roles not locked';end if;if exists(select 1 from pg_catalog.pg_auth_members m join pg_catalog.pg_roles r on r.oid=m.roleid or r.oid=m.member where r.rolname in('alliance_control_owner','alliance_control_reader','alliance_control_operator','alliance_control_anchor_writer')) then raise exception 'Unexpected control role membership';end if;"+checks+'end $$;']);
  };
  const fingerprint=()=>{
    const bytes=local?statSync(file).size:Number(exec('docker',['exec',container,'stat','-c','%s',file]).trim());
    if(!Number.isSafeInteger(bytes)||bytes<1||bytes>8*1024*1024)throw Error('Wrong archive size');
    const sha256=local?createHash('sha256').update(readFileSync(file)).digest('hex'):exec('docker',['exec',container,'sha256sum','--',file]).split(/\s/)[0];
    if(!/^[0-9a-f]{64}$/.test(sha256))throw Error('Wrong archive digest');return {bytes,sha256};
  };
  const contents=()=>{
    const lines=tool('pg_restore',['--list',file]).split('\n').map(x=>x.trim()).filter(x=>x&&!x.startsWith(';'));
    if(mode==='schema-and-data')for(const line of lines){
      // Fixed synthetic schema only, including owners, ACLs, policy/functions.
      // No unreviewed archive or caller-specified schema can enter this helper.
      if(!/^\d+; \d+ \d+ (?:SCHEMA - alliance_control |(?:ACL|COMMENT) - SCHEMA alliance_control |(?:TABLE DATA|TABLE|FUNCTION|CONSTRAINT|POLICY|ROW SECURITY|TRIGGER|ACL|COMMENT|DEFAULT ACL) alliance_control )/.test(line))throw Error('Unexpected synthetic control archive object: '+line.slice(0,240));
    }
    const data=mode==='schema-and-data'?lines.filter(line=>/^\d+; \d+ \d+ TABLE DATA /.test(line)):lines;
    const actual=data.map(line=>{const m=/^\d+; \d+ \d+ TABLE DATA ([a-z_]+) ([a-z_]+) [a-z_]+$/.exec(line);if(!m)throw Error('Unexpected archive object');return m[1]+'.'+m[2];}).sort();
    if(JSON.stringify(actual)!==JSON.stringify([...tables].sort()))throw Error('Incomplete archive table coverage');
    return lines;
  };
  return Object.freeze({
    dump(){
      if(closed||handle)throw Error('One archive only');
      controlPreflight(false);
      tool('pg_dump',[...connection(),'--format=custom','--no-large-objects','--strict-names',...(mode==='data-only'?['--data-only','--no-owner','--no-privileges',...tables.map(t=>'--table='+t)]:['--schema=alliance_control']),'--file='+file]);const toc=contents();
      handle=Object.freeze({domain,mode,...fingerprint(),tables:Object.freeze([...tables]),toc:Object.freeze(toc)});return handle;
    },
    restore(value){
      if(closed||value!==handle||!handle)throw Error('Exact same-domain archive handle required');
      const current=fingerprint();if(current.bytes!==handle.bytes||current.sha256!==handle.sha256)throw Error('Archive bytes changed');if(JSON.stringify(contents())!==JSON.stringify(handle.toc))throw Error('Archive object list changed');
      controlPreflight(true);
      tool('pg_restore',[...connection(),'--single-transaction','--exit-on-error',...(mode==='data-only'?['--data-only','--no-owner','--no-privileges']:[]),file]);
    },
    close(){
      if(closed)return;closed=true;
      if(local){if(realpathSync(directory)!==directory||!directory.startsWith(scratch+'/recovery-'))throw Error('Wrong archive cleanup');try{unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}rmdirSync(directory);}
      else{exec('docker',['exec','-u','postgres',container,'rm','-f','--',file]);exec('docker',['exec','-u','postgres',container,'rmdir','--',directory]);}
    }
  });
}
