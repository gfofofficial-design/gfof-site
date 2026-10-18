// Disabled, fixed READ-ONLY third-domain PG adapter. No write/key/env/route/retry.
import {X509Certificate} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {controlPolicy,controlExact as exact,controlRef as ref,controlUuid as uuid,controlFailure as fail} from './control-policy.mjs';
const IDENTITY=`select current_database()::text as database,current_user::text as actor,session_user::text as login,
 (select ssl and version in ('TLSv1.2','TLSv1.3') from pg_catalog.pg_stat_ssl where pid=pg_backend_pid()) as tls,
 (select rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication and not rolinherit and (rolvaliduntil is null or rolvaliduntil>clock_timestamp()) from pg_catalog.pg_roles where rolname=current_user) as restricted,
 not exists(select 1 from pg_catalog.pg_auth_members where roleid=(select oid from pg_catalog.pg_roles where rolname=current_user) or member=(select oid from pg_catalog.pg_roles where rolname=current_user)) as isolated,
 not has_table_privilege(current_user,'alliance_control.policy','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and not has_any_column_privilege(current_user,'alliance_control.policy','SELECT,INSERT,UPDATE,REFERENCES') and not has_schema_privilege(current_user,'public','CREATE') and not has_schema_privilege(current_user,'alliance_control','CREATE')
 and not has_function_privilege(current_user,'alliance_control.bootstrap(text,text,uuid,uuid)','EXECUTE') and not has_function_privilege(current_user,'alliance_control.transition(text,text,uuid,integer,text,uuid,jsonb,jsonb)','EXECUTE') as limited,
 current_setting('fsync')='on' and current_setting('full_page_writes')='on' and current_setting('synchronous_commit')='on' as durable,
 to_regnamespace('alliance_avatar') is null and to_regnamespace('alliance_journal') is null and to_regclass('public.alliance_member_owners') is null as dedicated`;
export async function createAllianceControlStore({enabled=false,memberProjectRef,journalProjectRef,controlProjectRef,epoch,connection,openPool,timeoutMs=1500}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>1500)throw fail();let pool;
 if(enabled===true){
  if(![memberProjectRef,journalProjectRef,controlProjectRef].every(ref)||new Set([memberProjectRef,journalProjectRef,controlProjectRef]).size!==3||!uuid(epoch)||!exact(connection,['host','password','ca'])||connection.host!==`db.${controlProjectRef}.supabase.co`||typeof connection.password!=='string'||connection.password.length<24||connection.password.length>128||typeof connection.ca!=='string'||connection.ca.length>65536)throw fail();
  const pem=/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,blocks=connection.ca.match(pem);if(!blocks?.length||connection.ca.replace(pem,'').trim())throw fail();try{for(const b of blocks)new X509Certificate(b);}catch{throw fail();}
  const config={host:connection.host,port:5432,database:'postgres',user:'alliance_control_reader',password:connection.password,ssl:{ca:connection.ca,rejectUnauthorized:true,minVersion:'TLSv1.2',servername:connection.host},sslnegotiation:'postgres',enableChannelBinding:true,application_name:'alliance-control-candidate',options:'-c search_path=pg_catalog',connectionTimeoutMillis:1000,statement_timeout:750,lock_timeout:250,idle_in_transaction_session_timeout:1500,max:2,min:0,idleTimeoutMillis:1000,maxLifetimeSeconds:60,allowExitOnIdle:true};
  try{pool=openPool?openPool(config):new(await import('pg')).Pool(config);if(!pool||typeof pool.connect!=='function'||typeof pool.end!=='function'||typeof pool.on!=='function')throw fail();pool.on('error',()=>{});}catch{throw fail();}
 }
 let closed=false,active=0;const running=new Set();
 return Object.freeze({
  async read({signal}={}){
   if(enabled!==true||closed||signal?.aborted||active>=2)throw fail();active++;
   const c=new AbortController(),abort=()=>c.abort(),started=performance.now();running.add(c);let client,released=false,finished=false,committed=false,onAbort;
   const release=destroy=>{if(client&&!released){released=true;client.removeListener?.('error',abort);try{client.release(destroy);}catch{}}};
   signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
   const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
   const check=()=>{if(closed||finished||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
   try{return await Promise.race([(async()=>{
    check();const acquired=await pool.connect();if(finished||c.signal.aborted){try{acquired.release(true);}catch{}throw fail();}client=acquired;client.once?.('error',abort);check();
    await client.query({text:'BEGIN READ ONLY',values:[]});check();
    await client.query({text:"SET LOCAL synchronous_commit='on'; SET LOCAL statement_timeout='750ms'; SET LOCAL lock_timeout='250ms'; SET LOCAL idle_in_transaction_session_timeout='1500ms'; SET LOCAL search_path='pg_catalog'",values:[]});check();
    const identity=await client.query({text:IDENTITY,values:[]});check();const who=identity?.rows?.[0];
    if(identity?.rows?.length!==1||who.database!=='postgres'||who.actor!=='alliance_control_reader'||who.login!=='alliance_control_reader'||!['tls','restricted','isolated','limited','durable','dedicated'].every(k=>who[k]===true))throw fail();
    const raw=await client.query({text:'SELECT alliance_control.read_policy($1::text,$2::text,$3::uuid) AS result',values:[memberProjectRef,journalProjectRef,epoch]});check();
    if(raw?.rows?.length!==1||!Object.hasOwn(raw.rows[0],'result')||Buffer.byteLength(JSON.stringify(raw.rows[0].result))>8192)throw fail();const value=controlPolicy(raw.rows[0].result);
    if(value.memberProjectRef!==memberProjectRef||value.journalProjectRef!==journalProjectRef||value.epoch!==epoch)throw fail();
    const committedResult=await client.query({text:'COMMIT',values:[]});check();if(committedResult?.command!=='COMMIT')throw fail();committed=true;return value;
   })(),stopped]);}catch{throw fail();}
   finally{finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();release(!committed);running.delete(c);active--;}
  },
  async close(){closed=true;for(const c of running)c.abort();let timer;try{await Promise.race([Promise.resolve(pool?.end()).catch(()=>{}),new Promise(r=>{timer=setTimeout(r,1000);})]);}catch{}finally{clearTimeout(timer);}}
 });
}
