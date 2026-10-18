// Disabled, unmounted account history/ack adapters. No credential lookup, Auth,
// bootstrap, mode switch, signing or retry. Caller must supply protected current
// scope/minima; these adapters do not establish independently trusted freshness.
import {X509Certificate} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {isDeepStrictEqual} from 'node:util';
import {accountEvent,accountRecord,reviewAccountHistory} from './account-history.mjs';
import {controlExact as exact,controlRef as ref,controlUuid as uuid,controlPoint as point} from './control-policy.mjs';
const genesis={sequence:0,sha256:'0'.repeat(64)};
const fail=(outcome='not_started')=>Object.assign(Error('alliance_account_store_unavailable'),{outcome});
function canonicalRows(scope,records,head,minimum=genesis){
 reviewAccountHistory({scope,records,head,acknowledged:head,minimum});
 return records.map(r=>accountRecord({scope:r.scope,sequence:r.sequence,previous:r.previous,event:r.event}));
}
function snapshot(value,scope){
 if(!exact(value,['scope','enabled','admissionsOpen','head','records'])||!isDeepStrictEqual(value.scope,scope)||typeof value.enabled!=='boolean'||typeof value.admissionsOpen!=='boolean'||value.admissionsOpen&&!value.enabled)throw fail();
 const head=point(value.head),records=canonicalRows(scope,value.records,head);return {scope:{...scope},enabled:value.enabled,admissionsOpen:value.admissionsOpen,head,records};
}
async function createStore(options={},domain){
 const {enabled=false,writeEnabled=false,memberProjectRef,journalProjectRef,controlProjectRef,epoch,connection,openPool,timeoutMs=4500}=options;
 if(typeof writeEnabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>4500)throw fail();
 const scope={memberProjectRef,journalProjectRef,epoch},writer=writeEnabled===true,role=writer?'alliance_account_writer':'alliance_account_reader';let pool;
 if(enabled===true){
  if(![memberProjectRef,journalProjectRef,controlProjectRef].every(ref)||new Set([memberProjectRef,journalProjectRef,controlProjectRef]).size!==3||!uuid(epoch)||!exact(connection,['host','password','ca'])||connection.host!==`db.${domain==='history'?journalProjectRef:controlProjectRef}.supabase.co`||typeof connection.password!=='string'||connection.password.length<24||connection.password.length>128||typeof connection.ca!=='string'||connection.ca.length>65536)throw fail();
  const pem=/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,blocks=connection.ca.match(pem);
  if(!blocks?.length||connection.ca.replace(pem,'').trim())throw fail();try{for(const b of blocks)new X509Certificate(b);}catch{throw fail();}
  const config={host:connection.host,port:5432,database:'postgres',user:role,password:connection.password,ssl:{ca:connection.ca,rejectUnauthorized:true,minVersion:'TLSv1.2',servername:connection.host},sslnegotiation:'postgres',enableChannelBinding:true,application_name:'alliance-account-candidate',connectionTimeoutMillis:1000,statement_timeout:2500,lock_timeout:750,idle_in_transaction_session_timeout:4500,max:2,min:0,idleTimeoutMillis:1000,maxLifetimeSeconds:60,allowExitOnIdle:true};
  try{pool=openPool?openPool(config):new(await import('pg')).Pool(config);if(!pool||typeof pool.connect!=='function'||typeof pool.end!=='function'||typeof pool.on!=='function')throw fail();pool.on('error',()=>{});}catch{throw fail();}
 }
 const table=domain==='history'?'history_control':'ack_control',other=domain==='history'?'ack_control':'history_control';
 const readFunction=domain==='history'?'snapshot(jsonb)':'ack_read(jsonb)',writeFunction=domain==='history'?'append(jsonb,integer,text,jsonb)':'ack_advance(jsonb,integer,text,jsonb)';
 const identity=`select current_database()::text as database,current_user::text as actor,session_user::text as login,
 (select ssl and version in('TLSv1.2','TLSv1.3') from pg_catalog.pg_stat_ssl where pid=pg_backend_pid()) as tls,
 (select rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication and not rolinherit and (rolvaliduntil is null or rolvaliduntil>clock_timestamp()) from pg_catalog.pg_roles where rolname=current_user) as restricted,
 not exists(select 1 from pg_catalog.pg_auth_members where roleid=(select oid from pg_catalog.pg_roles where rolname=current_user) or member=(select oid from pg_catalog.pg_roles where rolname=current_user)) as isolated,
 not has_schema_privilege(current_user,'public','CREATE') and not has_schema_privilege(current_user,'alliance_account','CREATE')
 and not exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='alliance_account' and c.relkind in('r','p','v','m','f') and (has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
 and has_function_privilege(current_user,'alliance_account.${readFunction}','EXECUTE') and has_function_privilege(current_user,'alliance_account.${writeFunction}','EXECUTE')=${writer?'true':'false'}
 and not exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='alliance_account' and p.proname not in('${readFunction.split('(')[0]}'${writer?",'"+writeFunction.split('(')[0]+"'":''}) and has_function_privilege(current_user,p.oid,'EXECUTE')) as limited,
 current_setting('fsync')='on' and current_setting('full_page_writes')='on' and current_setting('synchronous_commit')='on' as durable,
 to_regclass('alliance_account.${table}') is not null and to_regclass('alliance_account.${other}') is null and to_regnamespace('auth') is null and to_regnamespace('alliance_avatar') is null and to_regnamespace('alliance_journal') is null and to_regnamespace('alliance_control') is null as dedicated`;
 let active=0,closed=false;const running=new Set();
 async function call(name,input,{signal}={}){
  const mutation=['append','advance'].includes(name);if(mutation&&!writer)throw fail();
  let event,expected,records,head,values=[JSON.stringify(scope)];
  try{
   if(name==='append'){
    if(!exact(input,['event','expected'])||!exact(input.event,['id','kind','subject']))throw fail();event=accountEvent({kind:input.event.kind,subject:input.event.subject});if(!isDeepStrictEqual(event,input.event))throw fail();expected=point(input.expected);values.push(expected.sequence,expected.sha256,JSON.stringify(event));
   }else if(name==='advance'){
    if(!exact(input,['records','head','expected']))throw fail();head=point(input.head);expected=point(input.expected);records=canonicalRows(scope,input.records,head,expected);values.push(expected.sequence,expected.sha256,JSON.stringify(records));
   }
  }catch{throw fail();}
  if(enabled!==true||closed||signal?.aborted||active>=2)throw fail();active++;
  let client,released=false,finished=false,committed=false,dispatched=false,commitSent=false,onAbort;
  const c=new AbortController(),started=performance.now(),abort=()=>c.abort();running.add(c);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const check=()=>{if(finished||closed||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
  const release=destroy=>{if(client&&!released){released=true;client.removeListener?.('error',abort);try{client.release(destroy);}catch{}}};
  try{return await Promise.race([(async()=>{
   check();const acquired=await pool.connect();if(finished||c.signal.aborted){try{acquired.release(true);}catch{}throw fail();}client=acquired;client.once?.('error',abort);check();
   await client.query({text:mutation?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',values:[]});check();
   await client.query({text:"SET LOCAL synchronous_commit='on';SET LOCAL statement_timeout='2500ms';SET LOCAL lock_timeout='750ms'",values:[]});check();
   const identityResult=await client.query({text:identity,values:[]});check();const who=identityResult?.rows?.[0];
   if(identityResult?.rows?.length!==1||who.database!=='postgres'||who.actor!==role||who.login!==role||!['tls','restricted','isolated','limited','durable','dedicated'].every(k=>who[k]===true))throw fail();
   const functionName={snapshot:'snapshot',append:'append',read:'ack_read',advance:'ack_advance'}[name];
   dispatched=true;const raw=await client.query({text:`SELECT alliance_account.${functionName}(${mutation?'$1::jsonb,$2::integer,$3::text,$4::jsonb':'$1::jsonb'}) AS result`,values});check();
   if(raw?.rows?.length!==1||!Object.hasOwn(raw.rows[0],'result')||Buffer.byteLength(JSON.stringify(raw.rows[0].result))>262144)throw fail();const v=raw.rows[0].result;let result;
   if(name==='snapshot')result=snapshot(v,scope);
   else if(name==='read')result=point(v);
   else if(name==='advance'){
    if(!exact(v,['state','point'])||!['acknowledged','paused','conflict'].includes(v.state))throw fail();const p=point(v.point);
    if(v.state==='acknowledged'&&!isDeepStrictEqual(p,head))throw fail();result={state:v.state,point:p};
   }else{
    if(v?.state==='recorded'){
     if(!exact(v,['state','record','head'])||!exact(v.record,['format','scope','sequence','previous','event','sha256']))throw fail();const r=accountRecord({scope:v.record.scope,sequence:v.record.sequence,previous:v.record.previous,event:v.record.event}),p=point(v.head);
     if(!isDeepStrictEqual(r,v.record)||!isDeepStrictEqual(r.scope,scope)||!isDeepStrictEqual(r.event,event)||r.sequence>p.sequence||r.sequence===p.sequence&&r.sha256!==p.sha256)throw fail();result={state:'recorded',record:r,head:p};
    }else{if(!exact(v,['state','head'])||!['paused','removed','conflict','admissions_closed','full','not_admitted'].includes(v.state))throw fail();result={state:v.state,head:point(v.head)};}
   }
   commitSent=true;const ack=await client.query({text:'COMMIT',values:[]});check();if(ack?.command!=='COMMIT')throw fail();committed=true;return result;
  })(),stopped]);}catch(e){throw fail(mutation&&dispatched?(commitSent?'unknown':['42501','23514','22023','40001','40P01','55P03'].includes(e?.code)?'rejected':'unknown'):'not_started');}
  finally{finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();release(!committed);running.delete(c);active--;}
 }
 const api=domain==='history'?{snapshot:options=>call('snapshot',null,options),append:(input,options)=>call('append',input,options)}:{read:options=>call('read',null,options),advance:(input,options)=>call('advance',input,options)};
 api.close=async()=>{closed=true;for(const c of running)c.abort();let timer;try{await Promise.race([Promise.resolve(pool?.end()).catch(()=>{}),new Promise(r=>{timer=setTimeout(r,1000);})]);}finally{clearTimeout(timer);}};
 return Object.freeze(api);
}
export const createAccountHistoryStore=options=>createStore(options,'history');
export const createAccountAckStore=options=>createStore(options,'ack');
