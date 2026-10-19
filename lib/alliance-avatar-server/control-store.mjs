// Disabled, fixed READ-ONLY third-domain PG adapter. No write/key/env/route/retry.
import {X509Certificate} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {controlPolicy,controlExact as exact,controlRef as ref,controlUuid as uuid,controlFailure as fail} from './control-policy.mjs';
import {controlPoint} from './control-policy.mjs';
import {removalAnchor,removalChain} from './removal-anchor.mjs';
import {controlDeploymentProfile,MANAGED_CONTROL_ISOLATION} from './control-managed.mjs';
const IDENTITY=`select current_database()::text as database,current_user::text as actor,session_user::text as login,
 (select ssl and version in ('TLSv1.2','TLSv1.3') from pg_catalog.pg_stat_ssl where pid=pg_backend_pid()) as tls,
 (select rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication and not rolinherit and (rolvaliduntil is null or rolvaliduntil>clock_timestamp()) from pg_catalog.pg_roles where rolname=current_user) as restricted,
 not exists(select 1 from pg_catalog.pg_auth_members where roleid=(select oid from pg_catalog.pg_roles where rolname=current_user) or member=(select oid from pg_catalog.pg_roles where rolname=current_user)) as isolated,
 not has_table_privilege(current_user,'alliance_control.policy','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and not has_any_column_privilege(current_user,'alliance_control.policy','SELECT,INSERT,UPDATE,REFERENCES') and not has_schema_privilege(current_user,'public','CREATE') and not has_schema_privilege(current_user,'alliance_control','CREATE')
 and not has_function_privilege(current_user,'alliance_control.bootstrap(text,text,uuid,uuid)','EXECUTE') and not has_function_privilege(current_user,'alliance_control.transition(text,text,uuid,integer,text,uuid,jsonb,jsonb)','EXECUTE') as limited,
 current_setting('fsync')='on' and current_setting('full_page_writes')='on' and current_setting('synchronous_commit')='on' as durable,
 to_regnamespace('alliance_avatar') is null and to_regnamespace('alliance_journal') is null and to_regclass('public.alliance_member_owners') is null as dedicated`;
async function createControlStore({enabled=false,writeEnabled=false,deploymentProfile='strict',memberProjectRef,journalProjectRef,controlProjectRef,epoch,connection,openPool,timeoutMs=1500}={},mode='policy'){
 const managed=controlDeploymentProfile(deploymentProfile)==='supabase-managed';
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>1500)throw fail();let pool;
 const writer=mode==='anchor'&&writeEnabled===true,role=writer?'alliance_control_anchor_writer':'alliance_control_reader',scope={memberProjectRef,journalProjectRef,epoch};
 if(mode==='anchor'&&typeof writeEnabled!=='boolean')throw fail();
 let identitySql=mode==='policy'?IDENTITY:IDENTITY.replace(' as limited,',` and not has_table_privilege(current_user,'alliance_control.removal_anchor','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and not has_any_column_privilege(current_user,'alliance_control.removal_anchor','SELECT,INSERT,UPDATE,REFERENCES') and has_function_privilege(current_user,'alliance_control.advance_anchor(text,text,uuid,integer,text,integer,text,jsonb)','EXECUTE')=${writer?'true':'false'} as limited,`);
 if(managed)identitySql=identitySql.replace("not exists(select 1 from pg_catalog.pg_auth_members where roleid=(select oid from pg_catalog.pg_roles where rolname=current_user) or member=(select oid from pg_catalog.pg_roles where rolname=current_user)) as isolated,",MANAGED_CONTROL_ISOLATION+' as isolated,');
 const validIdentity=result=>{const who=result?.rows?.[0];return result?.rows?.length===1&&who.database==='postgres'&&who.actor===role&&who.login===role&&['tls','restricted','isolated','limited','durable','dedicated'].every(k=>who[k]===true);};
 if(enabled===true){
  if(![memberProjectRef,journalProjectRef,controlProjectRef].every(ref)||new Set([memberProjectRef,journalProjectRef,controlProjectRef]).size!==3||!uuid(epoch)||!exact(connection,['host','password','ca'])||connection.host!==`db.${controlProjectRef}.supabase.co`||typeof connection.password!=='string'||connection.password.length<24||connection.password.length>128||typeof connection.ca!=='string'||connection.ca.length>65536)throw fail();
  const pem=/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,blocks=connection.ca.match(pem);if(!blocks?.length||connection.ca.replace(pem,'').trim())throw fail();try{for(const b of blocks)new X509Certificate(b);}catch{throw fail();}
  const config={host:connection.host,port:5432,database:'postgres',user:role,password:connection.password,ssl:{ca:connection.ca,rejectUnauthorized:true,minVersion:'TLSv1.2',servername:connection.host},sslnegotiation:'postgres',enableChannelBinding:true,application_name:'alliance-control-candidate',options:'-c search_path=pg_catalog',connectionTimeoutMillis:1000,statement_timeout:750,lock_timeout:250,idle_in_transaction_session_timeout:1500,max:2,min:0,idleTimeoutMillis:1000,maxLifetimeSeconds:60,allowExitOnIdle:true};
  try{pool=openPool?openPool(config):new(await import('pg')).Pool(config);if(!pool||typeof pool.connect!=='function'||typeof pool.end!=='function'||typeof pool.on!=='function')throw fail();pool.on('error',()=>{});}catch{throw fail();}
 }
 let closed=false,active=0;const running=new Set();
 async function call(input,{signal}={},mutation=false){
   if(mutation&&!writer)throw fail();let expected,through,records,values=[memberProjectRef,journalProjectRef,epoch];
   if(mutation){if(!exact(input,['expected','through','records']))throw fail();expected=controlPoint(input.expected);through=controlPoint(input.through);records=removalChain(input.records,through,scope,expected);values.push(expected.sequence,expected.sha256,through.sequence,through.sha256,JSON.stringify(records));}
   if(enabled!==true||closed||signal?.aborted||active>=2)throw fail();active++;
   const c=new AbortController(),abort=()=>c.abort(),started=performance.now();running.add(c);let client,released=false,finished=false,committed=false,onAbort,dispatched=false,commitSent=false;
   const release=destroy=>{if(client&&!released){released=true;client.removeListener?.('error',abort);try{client.release(destroy);}catch{}}};
   signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
   const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
   const check=()=>{if(closed||finished||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
   try{return await Promise.race([(async()=>{
    check();const acquired=await pool.connect();if(finished||c.signal.aborted){try{acquired.release(true);}catch{}throw fail();}client=acquired;client.once?.('error',abort);check();
    await client.query({text:mutation?'BEGIN':'BEGIN READ ONLY',values:[]});check();
    await client.query({text:"SET LOCAL synchronous_commit='on'; SET LOCAL statement_timeout='750ms'; SET LOCAL lock_timeout='250ms'; SET LOCAL idle_in_transaction_session_timeout='1500ms'; SET LOCAL search_path='pg_catalog'",values:[]});check();
    const identity=await client.query({text:identitySql,values:[]});check();
    if(!validIdentity(identity))throw fail();
    dispatched=true;const text=mutation?'SELECT alliance_control.advance_anchor($1::text,$2::text,$3::uuid,$4::integer,$5::text,$6::integer,$7::text,$8::jsonb) AS result':mode==='anchor'?'SELECT alliance_control.read_anchor($1::text,$2::text,$3::uuid) AS result':'SELECT alliance_control.read_policy($1::text,$2::text,$3::uuid) AS result';
    const raw=await client.query({text,values});check();
    if(raw?.rows?.length!==1||!Object.hasOwn(raw.rows[0],'result')||Buffer.byteLength(JSON.stringify(raw.rows[0].result))>8192)throw fail();let value;
    if(mutation){const v=raw.rows[0].result;if(!exact(v,['state','anchor'])||!['anchored','conflict'].includes(v.state))throw fail();const a=removalAnchor(v.anchor,scope);if(v.state==='anchored'&&(a.sequence!==through.sequence||a.sha256!==through.sha256))throw fail();value={state:v.state,anchor:a};}
    else value=mode==='anchor'?removalAnchor(raw.rows[0].result,scope):controlPolicy(raw.rows[0].result);
    if(!mutation&&(value.memberProjectRef!==memberProjectRef||value.journalProjectRef!==journalProjectRef||value.epoch!==epoch))throw fail();
    commitSent=true;const committedResult=await client.query({text:'COMMIT',values:[]});check();if(committedResult?.command!=='COMMIT')throw fail();
    if(managed){const final=await client.query({text:identitySql,values:[]});check();if(!validIdentity(final))throw fail();}
    committed=true;return value;
   })(),stopped]);}catch(e){const error=fail();if(mutation)error.outcome=dispatched&&!commitSent&&['42501','23505','23514','22023'].includes(e?.code)?'rejected':dispatched?'unknown':'not_started';throw error;}
   finally{finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();release(!committed);running.delete(c);active--;}
 }
 const api={read:options=>call(null,options)};
 if(mode==='anchor')api.advance=(input,options)=>call(input,options,true);
 api.close=async()=>{closed=true;for(const c of running)c.abort();let timer;try{await Promise.race([Promise.resolve(pool?.end()).catch(()=>{}),new Promise(r=>{timer=setTimeout(r,1000);})]);}catch{}finally{clearTimeout(timer);}};
 return Object.freeze(api);
}
export const createAllianceControlStore=options=>createControlStore(options,'policy');
export const createAllianceAnchorStore=options=>createControlStore(options,'anchor');
