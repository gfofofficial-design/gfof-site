import {createHash,X509Certificate} from 'node:crypto';
import {checkServerIdentity} from 'node:tls';
import {Pool as PostgresPool} from 'pg';
import {WATCHTOWER_ALLOWANCE_SQL} from './watchtower-rpc-allowance.mjs';

const ROLES={intake:{login:'watchtower_intake_login',capability:'watchtower_intake'},
 worker:{login:'watchtower_worker_login',capability:'watchtower_worker'}};
const STATEMENTS={intake:new Map([['SELECT watchtower_private.enqueue_watchtower_candidates($1::jsonb) AS accepted',1]]),
 worker:new Map([['SELECT * FROM watchtower_private.claim_watchtower_candidate()',0],
 ['SELECT watchtower_private.finish_watchtower_candidate($1,$2,$3::jsonb) AS finished',3],[WATCHTOWER_ALLOWANCE_SQL,3]])};
const IDENTITY=`SELECT current_user AS runtime_role, session_user AS login_role, current_database() AS database,
 (SELECT bool_and(NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AND NOT rolinherit
  AND (rolname<>current_user OR NOT rolcanlogin) AND (rolname<>session_user OR rolcanlogin))
  FROM pg_roles WHERE rolname IN (current_user,session_user)) AS restricted,
 (SELECT count(*) FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=session_user)) AS membership_count,
 (SELECT count(*) FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS capability_memberships,
 EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles l ON l.oid=m.member
  WHERE r.rolname=current_user AND l.rolname=session_user AND NOT m.admin_option AND NOT m.inherit_option AND m.set_option) AS binding_matches`;
const unavailable=()=>Error('Watchtower database unavailable; completion may be uncertain');
const password=value=>typeof value==='string'&&value.length>=24&&value.length<=1024&&!/[\x00-\x1f\x7f]/.test(value);

// All inputs belong to private operator configuration, never request/browser input.
// Structured driver options avoid URL parsing overriding our TLS settings.
export function watchtowerPgConfigs({projectRef,host,ca,caSha256,intakePassword,workerPassword}={}){
 try{
  if(typeof projectRef!=='string'||!/^[a-z]{20}$/.test(projectRef)||typeof host!=='string'||
   !/^aws-\d+-[a-z]{2}-[a-z]+-\d\.pooler\.supabase\.com$/.test(host)||typeof ca!=='string'||ca.length>16384||
   !/^[a-f0-9]{64}$/.test(caSha256)||createHash('sha256').update(ca,'utf8').digest('hex')!==caSha256||
   !new X509Certificate(ca).ca||!password(intakePassword)||!password(workerPassword)||intakePassword===workerPassword)throw Error();
  const common={host,port:6543,database:'postgres',max:1,connectionTimeoutMillis:2000,idleTimeoutMillis:1000,
   allowExitOnIdle:true,ssl:{ca,rejectUnauthorized:true,minVersion:'TLSv1.2',servername:host,
    checkServerIdentity:(_,certificate)=>checkServerIdentity(host,certificate)}};
  return {intake:{...common,user:ROLES.intake.login+'.'+projectRef,password:intakePassword,application_name:'watchtower-intake'},
   worker:{...common,ssl:{...common.ssl},user:ROLES.worker.login+'.'+projectRef,password:workerPassword,application_name:'watchtower-worker'}};
 }catch{throw Error('Invalid Watchtower database configuration');}
}

export function createWatchtowerDatabaseBindings({enabled=false,connection,Pool=PostgresPool,timeoutMs=4000}={}){
 if(typeof enabled!=='boolean'||typeof Pool!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>4000)
  throw Error('Invalid Watchtower database binding');
 if(!enabled)return Object.freeze({status:'disabled',intakeQuery:async()=>{throw unavailable();},workerQuery:async()=>{throw unavailable();},close:async()=>{}});
 const configs=watchtowerPgConfigs(connection),pools={};let closed=false;
 try{for(const kind of ['intake','worker']){pools[kind]=new Pool(configs[kind]);pools[kind].on('error',()=>{});}}
 catch{for(const pool of Object.values(pools))Promise.resolve(pool.end()).catch(()=>{});throw unavailable();}
 const bind=kind=>async(statement,args,{signal}={})=>{
  if(closed||!STATEMENTS[kind].has(statement)||!Array.isArray(args)||args.length!==STATEMENTS[kind].get(statement)||
   args.some(v=>v!==null&&!['string','number','boolean'].includes(typeof v))||
   (signal!==undefined&&!(signal instanceof AbortSignal))||signal?.aborted)throw unavailable();
  let client,released=false,stopped=false,timer;
  const release=destroy=>{if(client&&!released){released=true;try{client.release(destroy);}catch{}}};
  let rejectStopped;const stopPromise=new Promise((_,reject)=>{rejectStopped=reject;});
  const stop=()=>{stopped=true;release(true);rejectStopped(unavailable());};
  const active=()=>{if(stopped||signal?.aborted||closed)throw unavailable();};
  signal?.addEventListener('abort',stop,{once:true});timer=setTimeout(stop,timeoutMs);
  try{
   const work=(async()=>{
    client=await pools[kind].connect();if(stopped||closed){release(true);throw unavailable();}
    const stream=client.connection?.stream;
    if(stream?.encrypted!==true||stream.authorized!==true||typeof stream.getPeerCertificate!=='function'||
     checkServerIdentity(configs[kind].host,stream.getPeerCertificate()))throw unavailable();
    active();await client.query('BEGIN');active();
    await client.query('SET LOCAL ROLE '+ROLES[kind].capability);active();
    await client.query("SET LOCAL statement_timeout='4s'");active();
    await client.query("SET LOCAL lock_timeout='1s'");active();
    const identity=await client.query(IDENTITY);active();const row=identity.rows?.[0];
    if(identity.rowCount!==1||row?.runtime_role!==ROLES[kind].capability||row.login_role!==ROLES[kind].login||row.database!=='postgres'||
     row.restricted!==true||String(row.membership_count)!=='1'||String(row.capability_memberships)!=='0'||row.binding_matches!==true)throw unavailable();
    const result=await client.query(statement,args);active();await client.query('COMMIT');active();release(false);return result;
   })();
   return await Promise.race([work,stopPromise]);
  }catch{release(true);throw unavailable();}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);}
 };
 return Object.freeze({status:'configured_not_hosted_verified',intakeQuery:bind('intake'),workerQuery:bind('worker'),
  close:async()=>{closed=true;await Promise.allSettled(Object.values(pools).map(pool=>pool.end()));}});
}
