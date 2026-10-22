// Dedicated disposable TLS fixture only. Never accepts a project URL/password.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,chmodSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';
import {createAvatarLedger} from './ledger.mjs';
import {createAvatarFlow} from './flow.mjs';
import {memberNative} from './member.native.mjs';
import {cleanupNative} from './cleanup.native.mjs';
import {recoveryNative} from './recovery.native.mjs';
import {restoreReviewNative} from './restore-review.native.mjs';
import {deletionJournalNative} from './deletion-journal.native.mjs';
import {journalStoreNative} from './journal-store.native.mjs';
import {removalNative} from './removal.native.mjs';
import {creationNative} from './creation.native.mjs';
import {profileRevisionNative} from './profile-revision.native.mjs';
import {accountStoreNative} from './account-store.native.mjs';
import {accountManagedNative} from './account-managed.native.mjs';
import {controlManagedNative} from './control-managed.native.mjs';
import {memberManagedNative} from './member-managed.native.mjs';
import {journalManagedNative} from './journal-managed.native.mjs';
import {memberApplicationNative} from './member-application.native.mjs';
import {communityNative} from './community.native.mjs';
import {createAllianceAvatarStorage} from '../alliance-avatar-storage.mjs';
const local=process.argv.includes('--local18'),version=local?180006:170011;
if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture')throw Error('Explicit disposable fixture confirmation required');
let admin,port,certificate,ownedScratch;
const exec=(command,args,input)=>execFileSync(command,args,{input,encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
try{
if(local){
  const scratch=process.env.ALLIANCE_AVATAR_SERVER_TEST_SCRATCH||'';
  if(!/^\/tmp\/fed-alliance-server-[A-Za-z0-9]{8}$/.test(scratch)||process.getuid?.()!==102||realpathSync(scratch)!==scratch)throw Error('Wrong local fixture');
  port=55488;certificate=readFileSync(scratch+'/server.crt','utf8');
  admin=sql=>exec('/usr/lib/postgresql/18/bin/psql',['-h',scratch+'/socket','-p',String(port),'-U','postgres','-d','postgres','-X','-v','ON_ERROR_STOP=1'],sql);
  assert.match(admin('show data_directory;'),new RegExp(scratch+'/data'));
}else{
  const container=process.env.ALLIANCE_AVATAR_SERVER_TEST_CONTAINER||'';
  if(!/^[a-f0-9]{12,64}$/.test(container))throw Error('Wrong disposable container');
  const inspect=JSON.parse(exec('docker',['inspect',container]))[0];
  const binding=inspect.HostConfig.PortBindings?.['5432/tcp'];
  if(inspect.Config.Image!=='postgres:17.11-bookworm'||!inspect.Config.Env.includes('POSTGRES_DB=postgres')||!inspect.Config.Env.includes('PGDATA=/var/lib/postgresql/data')||binding?.length!==1||binding[0].HostIp!=='127.0.0.1'||binding[0].HostPort!=='54329')throw Error('Wrong container identity/binding');
  port=54329;admin=sql=>exec('docker',['exec','-i','-u','postgres',container,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],sql);
  // Check emptiness before configuring only this fixture's TLS.
  admin(`do $$ begin if current_database()<>'postgres' or current_setting('server_version_num')::integer<>170011 or exists(select 1 from pg_namespace where nspname='auth') or exists(select 1 from pg_roles where rolname in('anon','authenticated','service_role','alliance_avatar_owner','alliance_avatar_executor')) then raise exception 'Fixture not empty';end if;end $$;`);
  ownedScratch=mkdtempSync(join(tmpdir(),'fed-alliance-server-tls-'));chmodSync(ownedScratch,0o700);
  exec('openssl',['req','-new','-x509','-days','1','-nodes','-newkey','rsa:2048','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost','-keyout',join(ownedScratch,'server.key'),'-out',join(ownedScratch,'server.crt')]);
  chmodSync(join(ownedScratch,'server.key'),0o600);certificate=readFileSync(join(ownedScratch,'server.crt'),'utf8');
  for(const file of ['server.crt','server.key'])exec('docker',['cp',join(ownedScratch,file),container+':/tmp/federation-'+file]);
  exec('docker',['exec','-u','root',container,'chown','postgres:postgres','/tmp/federation-server.key','/tmp/federation-server.crt']);
  exec('docker',['exec','-u','root',container,'chmod','600','/tmp/federation-server.key']);
  admin("alter system set ssl='on';alter system set ssl_cert_file='/tmp/federation-server.crt';alter system set ssl_key_file='/tmp/federation-server.key';");
  // Do not stop the container's PID1 PostgreSQL process. SSL is reloadable;
  // confirm the new setting before starting the real-driver checks.
  admin('select pg_reload_conf();select pg_sleep(0.2);');
  assert.match(admin('show ssl;'),/\bon\b/);
}
const root=new URL('../../',import.meta.url),rolePassword='synthetic-executor-fixture-password-only';
// Only the disposable admission test uses this fixed alternate administrator to
// model the provider's bootstrap name without changing any hosted role.
admin.as=(name,sql)=>{
  if(name!=='fixture_admission_admin')throw Error('Wrong alternate fixture role');
  return local?exec('/usr/lib/postgresql/18/bin/psql',['-h',process.env.ALLIANCE_AVATAR_SERVER_TEST_SCRATCH+'/socket','-p',String(port),'-U',name,'-d','postgres','-X','-v','ON_ERROR_STOP=1'],sql):
    exec('docker',['exec','-i','-u','postgres',process.env.ALLIANCE_AVATAR_SERVER_TEST_CONTAINER,'psql','-X','-v','ON_ERROR_STOP=1','-U',name,'-d','postgres'],sql);
};
const raw=exec(process.execPath,[fileURLToPath(new URL('tests/alliance-profile-native.mjs',root)),'--print-sql']);
const bootstrap=raw.slice(0,raw.indexOf('create function public.fixture_assert')).replaceAll('federation_alliance_profile_test','postgres').replaceAll('170011',String(version));
const avatar=readFileSync(new URL('sql/alliance-avatar-ledger-candidate.sql',root),'utf8');
const actor='11111111-1111-4111-8111-111111111111',operation='22222222-2222-4222-8222-222222222222';
const connection={host:'db.abcdefghijklmnopqrst.supabase.co',password:rolePassword,ca:certificate};
const pools=[];
// Trusted fixture-only transport remap. Production code has no local-host mode.
const openPool=config=>{const pool=new Pool({...config,host:'127.0.0.1',port,ssl:{...config.ssl,servername:'localhost'}});pools.push(pool);return pool;};
let ledger;
if(!process.argv.includes('--profile-revision-only')){
try{
  admin(bootstrap+'\n'+avatar+`\nupdate alliance_avatar.control set enabled=true;alter role alliance_avatar_executor login password '${rolePassword}';
    insert into auth.users values('${actor}');select set_config('request.jwt.claim.sub','${actor}',true),set_config('request.jwt.claim.is_anonymous','false',true);
    set local role authenticated;select public.alliance_save_profile('Driver Fixture','','Synthetic driver and TLS integration fixture.','builder',false);reset role;commit;`);
  ledger=await createAvatarLedger({enabled:true,connection,openPool});
  const first=await ledger.reserve(actor,operation,0);assert.equal(first.dispatch,true);
  console.log('PASS real driver validates TLS, restricted login identity and committed reservation');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWMQjG34DwADXwHuQa7szAAAAABJRU5ErkJggg==','base64');
  const descriptor={bytes:png.length,sha256:createHash('sha256').update(png).digest('hex'),width:1,height:1,mime:'image/png'};
  const claim=await ledger.claimUpload(actor,operation,descriptor);assert.equal(claim.dispatch,true);
  assert.equal((await ledger.claimUpload(actor,operation,descriptor)).dispatch,false);
  console.log('PASS real parameterized claim binds descriptor and refuses duplicate dispatch');
  const profileId=claim.key.split('/')[1],providerId='33333333-3333-4333-8333-333333333333';
  let removing=false,calls=0;const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
  const storage=createAllianceAvatarStorage({enabled:true,origin:'https://abcdefghijklmnopqrst.supabase.co',apiKey:'sb_publishable_synthetic_fixture_only_12345',bearerToken:'syntheticHeader.syntheticClaims.syntheticSignature',fetcher:async(_url,init)=>{calls++;
    if(init.method==='POST')return json({Key:'alliance-member-images-v1/'+claim.key,Id:providerId});
    if(init.method==='DELETE')return json([{id:providerId,name:claim.key}]);
    return removing?json({code:'NoSuchKey'},404):new Response(png,{headers:{'Content-Type':'image/png'}});
  }});
  const upload=await storage.upload({profileId,objectId:claim.objectId,derivative:{bytes:png,width:1,height:1,mime:'image/png'}});
  const committed=await ledger.commitUpload(actor,operation,upload);assert.equal(committed.version,1);
  assert.equal((await ledger.commitUpload(actor,operation,upload)).version,1);
  console.log('PASS actual gateway result commits through TLS driver and matching replay remains version-idempotent');
  await ledger.close();ledger=await createAvatarLedger({enabled:true,connection,openPool});
  const recovered=await ledger.operationReceipt(actor,operation);assert.deepEqual(recovered.receipt,upload.receipt);assert.equal((await ledger.mine(actor)).version,1);
  console.log('PASS fresh driver/pool recovers canonical durable receipt without re-upload');
  await assert.rejects(ledger.reserve('44444444-4444-4444-8444-444444444444',operation,0),e=>e.outcome==='rejected');
  console.log('PASS real SQL ownership rejection is sanitized and preserves the original operation');
  await ledger.removeImage(actor,'55555555-5555-4555-8555-555555555555',1);
  const cleanup=await ledger.cleanupBatch(1);assert.equal(cleanup.length,1);assert.deepEqual(cleanup[0].receipt,upload.receipt);
  removing=true;const deletion=await storage.remove(upload.receipt,{writeSettled:true,authorize:async()=>true});
  await ledger.ackDeleted(claim.objectId,deletion);await ledger.ackDeleted(claim.objectId,deletion);
  assert.deepEqual((await ledger.operationReceipt(actor,operation)).deletionReceipt,deletion);assert.equal((await ledger.cleanupBatch(20)).length,0);assert.equal(calls,4);
  console.log('PASS exact gateway deletion proof persists through driver, releases cleanup and replays safely');
  // Composition exercises the real TLS ledger and real gateway against in-memory
  // provider responses. The decoder is a validated fixture derivative here;
  // flow.native.mjs separately exercises the actual native child decoder.
  let flowCalls=0,lateRemoval=false;
  const flowOperation='66666666-6666-4666-8666-666666666666',lateOperation='77777777-7777-4777-8777-777777777777';
  const flowStorage=createAllianceAvatarStorage({enabled:true,origin:'https://abcdefghijklmnopqrst.supabase.co',apiKey:'sb_publishable_synthetic_fixture_only_12345',bearerToken:'syntheticHeader.syntheticClaims.syntheticSignature',fetcher:async(url,init)=>{
    flowCalls++;
    if(init.method==='POST'){
      assert.match(admin("select count(*) from pg_stat_activity where usename='alliance_avatar_executor' and state='idle in transaction';"),/\b0\b/);
      if(lateRemoval)await ledger.removeImage(actor,'88888888-8888-4888-8888-888888888888',3);
      return json({Key:'alliance-member-images-v1/'+new URL(url).pathname.split('/alliance-member-images-v1/')[1],Id:lateRemoval?'99999999-9999-4999-8999-999999999999':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'});
    }
    return new Response(png,{headers:{'Content-Type':'image/png'}});
  }});
  const flow=createAvatarFlow({enabled:true,ledger,processor:{process:async()=>({bytes:png,width:1,height:1,mime:'image/png'})},storage:flowStorage});
  const flowInput={actorId:actor,operationId:flowOperation,version:2,bytes:png,mime:'image/png'};
  assert.deepEqual(await flow.replace(flowInput),{state:'committed',version:3});assert.equal(flowCalls,2);
  assert.deepEqual(await flow.replace(flowInput),{state:'committed',version:3});assert.equal(flowCalls,2);
  assert.deepEqual(await flow.status(actor,flowOperation),{state:'committed'});
  console.log('PASS composed flow commits through TLS without network work inside a transaction; replay sends no provider request');
  lateRemoval=true;
  assert.deepEqual(await flow.replace({...flowInput,operationId:lateOperation,version:3}),{state:'cleanup_pending'});
  assert.equal((await ledger.mine(actor)).objectId,null);assert.equal((await ledger.mine(actor)).version,4);
  const late=await ledger.operationReceipt(actor,lateOperation);assert.equal(late.state,'stale');assert.equal(late.writeSettled,true);assert.equal(late.verified,true);
  assert.deepEqual((await ledger.cleanupBatch(20)).map(x=>x.objectId).sort(),[(await ledger.operationReceipt(actor,flowOperation)).objectId,late.objectId].sort());
  flow.close();
  console.log('PASS removal during provider delivery fences publication and preserves exact settled evidence for later cleanup');
  assert.equal(await ledger.expireBatch(20),0);
  await memberNative({admin,ledger,actor,png});
  await cleanupNative({admin,ledger,actor,png});
  await recoveryNative({admin,ledger,actor,png,openLedger:()=>createAvatarLedger({enabled:true,connection,openPool})});
  await restoreReviewNative({admin,ledger});
  await deletionJournalNative({admin,ledger});
  await removalNative({admin,ledger,png});
  const wrongHost=await createAvatarLedger({enabled:true,connection,openPool:c=>new Pool({...c,host:'127.0.0.1',port,ssl:{...c.ssl,servername:'wrong.example.invalid'}})});
  await assert.rejects(wrongHost.mine(actor),e=>e.outcome==='not_started');await wrongHost.close();
  console.log('PASS real TLS hostname mismatch fails before a ledger operation');
  // pg makes its stored password non-enumerable; a spread of pool.options must
  // not be relied on to populate this separate synthetic permission-test pool.
  const direct=new Pool({...pools[0].options,password:rolePassword,host:'127.0.0.1',port,ssl:{ca:certificate,rejectUnauthorized:true,servername:'localhost'}});
  try{await assert.rejects(direct.query('select * from alliance_avatar.objects'),e=>e.code==='42501');}finally{await direct.end();}
  console.log('PASS real restricted driver cannot bypass functions to read object rows');
}finally{
  await ledger?.close();for(const pool of pools){try{await pool.end();}catch{}}
  admin(`do $$ begin if current_database()<>'postgres' or current_setting('server_version_num')::integer<>${version} then raise exception 'Wrong fixture cleanup';end if;end $$;
    begin;alter role alliance_avatar_executor nologin password null;drop owned by alliance_avatar_owner,alliance_avatar_executor,anon,authenticated,service_role cascade;
    drop schema if exists alliance_avatar cascade;drop table if exists public.alliance_profiles,public.alliance_member_owners cascade;drop schema if exists auth cascade;
    drop function if exists public.alliance_member_eligible(),public.alliance_profile_stamp(),public.alliance_save_profile(text,text,text,text,boolean),public.alliance_my_profile(),public.alliance_remove_profile();
    drop role alliance_avatar_owner,alliance_avatar_executor,anon,authenticated,service_role;commit;
    do $$ begin if exists(select 1 from pg_roles where rolname in('alliance_avatar_owner','alliance_avatar_executor','authenticated')) or to_regclass('public.alliance_profiles') is not null then raise exception 'Fixture teardown failed';end if;end $$;`);
  console.log('PASS exact synthetic roles and records removed; no hosted database or provider call');
}
await journalStoreNative({admin,connection,openPool});
await creationNative({admin,bootstrap,avatar,connection,openPool,secondOptions:{local,scratch:process.env.ALLIANCE_AVATAR_SERVER_TEST_SCRATCH,tlsDirectory:ownedScratch,certificate,container:process.env.ALLIANCE_AVATAR_SERVER_TEST_CONTAINER}});
await accountStoreNative({secondOptions:{local,scratch:process.env.ALLIANCE_AVATAR_SERVER_TEST_SCRATCH,tlsDirectory:ownedScratch,certificate,container:process.env.ALLIANCE_AVATAR_SERVER_TEST_CONTAINER}});
await accountManagedNative({secondOptions:{local,scratch:process.env.ALLIANCE_AVATAR_SERVER_TEST_SCRATCH,tlsDirectory:ownedScratch,certificate,container:process.env.ALLIANCE_AVATAR_SERVER_TEST_CONTAINER}});
await controlManagedNative({secondOptions:{local,scratch:process.env.ALLIANCE_AVATAR_SERVER_TEST_SCRATCH,tlsDirectory:ownedScratch,certificate,container:process.env.ALLIANCE_AVATAR_SERVER_TEST_CONTAINER}});
await memberManagedNative({secondOptions:{local,scratch:process.env.ALLIANCE_AVATAR_SERVER_TEST_SCRATCH,tlsDirectory:ownedScratch,certificate,container:process.env.ALLIANCE_AVATAR_SERVER_TEST_CONTAINER}});
await journalManagedNative({secondOptions:{local,scratch:process.env.ALLIANCE_AVATAR_SERVER_TEST_SCRATCH,tlsDirectory:ownedScratch,certificate,container:process.env.ALLIANCE_AVATAR_SERVER_TEST_CONTAINER}});
await memberApplicationNative({secondOptions:{local,scratch:process.env.ALLIANCE_AVATAR_SERVER_TEST_SCRATCH,tlsDirectory:ownedScratch,certificate,container:process.env.ALLIANCE_AVATAR_SERVER_TEST_CONTAINER}});
await communityNative({secondOptions:{local,scratch:process.env.ALLIANCE_AVATAR_SERVER_TEST_SCRATCH,tlsDirectory:ownedScratch,certificate,container:process.env.ALLIANCE_AVATAR_SERVER_TEST_CONTAINER}});
}
await profileRevisionNative({admin,bootstrap,avatar,connection,openPool,secondOptions:{local,scratch:process.env.ALLIANCE_AVATAR_SERVER_TEST_SCRATCH,tlsDirectory:ownedScratch,certificate,container:process.env.ALLIANCE_AVATAR_SERVER_TEST_CONTAINER}});
}finally{
  // This runs even if certificate generation, TLS setup or SQL teardown fails.
  if(ownedScratch){const target=realpathSync(ownedScratch);if(target!==resolve(ownedScratch)||dirname(target)!==resolve(tmpdir())||!basename(target).startsWith('fed-alliance-server-tls-'))throw Error('Wrong TLS scratch cleanup');rmSync(target,{recursive:true});}
}
