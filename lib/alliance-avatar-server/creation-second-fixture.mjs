// Only the confirmed disposable runner imports this. A second database SERVER
// keeps the journal's dedicated-host check real; no production transport override.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,realpathSync,rmSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
export async function secondCreationFixture({local,scratch,tlsDirectory,certificate}){
  if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture')throw Error('Wrong second fixture');
  const exec=(cmd,args,input)=>execFileSync(cmd,args,{input,encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
  let container,directory,started=false;const pools=[];
  let admin,port;
  const close=async()=>{
    try{for(const pool of pools)if(!pool.ended)await pool.end();}finally{
    if(local&&directory){if(realpathSync(scratch)!==scratch||realpathSync(directory)!==scratch+'/creation-journal')throw Error('Wrong second cleanup');
      if(started)exec('/usr/lib/postgresql/18/bin/pg_ctl',['-D',directory+'/data','-m','immediate','-w','stop']);rmSync(directory,{recursive:true});
    }else if(container){exec('docker',['rm','--force',container]);}
    }
  };
  try{
    if(local){
      if(!/^\/tmp\/fed-alliance-server-[A-Za-z0-9]{8}$/.test(scratch)||process.getuid?.()!==102||realpathSync(scratch)!==scratch)throw Error('Wrong second local fixture');
      directory=scratch+'/creation-journal';mkdirSync(directory,{mode:0o700});mkdirSync(directory+'/socket',{mode:0o700});port=55489;
      exec('/usr/lib/postgresql/18/bin/initdb',['-D',directory+'/data','-A','trust','--no-locale','-E','UTF8']);
      writeFileSync(directory+'/data/pg_hba.conf','local all all trust\nhostssl all all 127.0.0.1/32 scram-sha-256\nhostnossl all all 127.0.0.1/32 reject\n',{mode:0o600});
      exec('/usr/lib/postgresql/18/bin/pg_ctl',['-D',directory+'/data','-l',directory+'/server.log','-o',`-c listen_addresses=127.0.0.1 -k ${directory}/socket -p ${port} -c ssl=on -c ssl_cert_file=${scratch}/server.crt -c ssl_key_file=${scratch}/server.key`,'-w','start']);started=true;
      admin=sql=>exec('/usr/lib/postgresql/18/bin/psql',['-h',directory+'/socket','-p',String(port),'-U','postgres','-d','postgres','-X','-v','ON_ERROR_STOP=1'],sql);
      assert.match(admin('show data_directory;'),new RegExp(directory+'/data'));
    }else{
      const name='alliance-creation-journal-'+randomUUID();port=54330;
      container=exec('docker',['run','--rm','--detach','--name',name,'--publish','127.0.0.1:54330:5432','--env','POSTGRES_DB=postgres','--env','POSTGRES_PASSWORD=synthetic-second-fixture-only','postgres:17.11-bookworm']).trim();
      if(!/^[a-f0-9]{64}$/.test(container))throw Error('Wrong second container');
      const v=JSON.parse(exec('docker',['inspect',container]))[0],binding=v.HostConfig.PortBindings?.['5432/tcp'];
      if(v.Config.Image!=='postgres:17.11-bookworm'||binding?.length!==1||binding[0].HostIp!=='127.0.0.1'||binding[0].HostPort!=='54330')throw Error('Wrong second binding');
      let ready=false;for(let n=0;n<30&&!ready;n++){try{exec('docker',['exec',container,'pg_isready','-U','postgres']);ready=true;}catch{await new Promise(r=>setTimeout(r,300));}}if(!ready)throw Error('Second fixture not ready');
      admin=sql=>exec('docker',['exec','-i','-u','postgres',container,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],sql);
      for(const file of ['server.crt','server.key'])exec('docker',['cp',tlsDirectory+'/'+file,container+':/tmp/federation-'+file]);
      exec('docker',['exec','-u','root',container,'chown','postgres:postgres','/tmp/federation-server.key','/tmp/federation-server.crt']);exec('docker',['exec','-u','root',container,'chmod','600','/tmp/federation-server.key']);
      admin("alter system set ssl='on';alter system set ssl_cert_file='/tmp/federation-server.crt';alter system set ssl_key_file='/tmp/federation-server.key';");admin('select pg_reload_conf();select pg_sleep(0.2);');
    }
    assert.match(admin('show ssl;'),/\bon\b/);
    admin(`do $$ begin if current_database()<>'postgres' or current_setting('server_version_num')::integer<>${local?180006:170011} or to_regnamespace('auth') is not null or to_regnamespace('alliance_journal') is not null then raise exception 'Second fixture not empty';end if;end $$;`);
    return {admin,connection:{host:'db.uvwxyzabcdefghijklmn.supabase.co',password:'synthetic-journal-creation-password-only',ca:certificate},
      openPool:config=>{const pool=new Pool({...config,host:'127.0.0.1',port,ssl:{...config.ssl,servername:'localhost'}});pools.push(pool);return pool;},close};
  }catch(e){await close();throw e;}
}
