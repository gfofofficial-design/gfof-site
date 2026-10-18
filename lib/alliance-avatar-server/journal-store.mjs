// Disabled direct-PG candidate for a separately approved independent journal host.
// No credential lookup, installation, signing, retry, member Auth or browser route.
import {X509Certificate,createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {deletionRecord} from './deletion-journal.mjs';
const ZERO='0'.repeat(64),UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const hash=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const seq=v=>Number.isSafeInteger(v)&&v>=0&&v<=256;
const failure=(outcome='not_started')=>Object.assign(Error('alliance_journal_unavailable'),{outcome});
function point(v){if(!exact(v,['sequence','sha256'])||!seq(v.sequence)||!hash(v.sha256)||v.sequence===0&&v.sha256!==ZERO)throw failure();return {sequence:v.sequence,sha256:v.sha256};}
function admissionEvent(input,scope){
  const e=deletionRecord({projectRef:scope.projectRef,epoch:scope.epoch,sequence:1,previous:ZERO,event:input}).event;
  const kind=e.kind==='profile_remove_requested'?'profile':'image',subject=e.objectId||e.profileId;
  const h=createHash('sha256').update('GF-ALLIANCE-REMOVAL-ID-V1\0'+kind+'\0'+e.profileId+'\0'+subject).digest('hex').slice(0,32);
  if(e.id!==`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`)throw failure();return e;
}
function record(v,scope){
  if(!exact(v,['format','projectRef','epoch','sequence','previous','event','sha256'])||v.format!==1||v.projectRef!==scope.projectRef||v.epoch!==scope.epoch)throw failure();
  const copy=deletionRecord({projectRef:v.projectRef,epoch:v.epoch,sequence:v.sequence,previous:v.previous,event:v.event});
  if(copy.sha256!==v.sha256)throw failure();return copy;
}
function tip(v,scope){
  if(!exact(v,['projectRef','epoch','sequence','sha256','enabled'])||v.projectRef!==scope.projectRef||v.epoch!==scope.epoch||typeof v.enabled!=='boolean')throw failure();
  return {projectRef:v.projectRef,epoch:v.epoch,...point({sequence:v.sequence,sha256:v.sha256}),enabled:v.enabled};
}
function result(name,raw,scope,context){
  let json;try{json=JSON.stringify(raw);}catch{throw failure();}if(typeof json!=='string'||Buffer.byteLength(json)>262144)throw failure();
  if(name==='tip')return tip(raw,scope);
  if(['admit','admission'].includes(name)){
    if(exact(raw,['state'])&&(name==='admit'?['paused','full','removed','profile_required','history_full']:['missing','removed']).includes(raw.state))return {state:raw.state};
    if(!exact(raw,['state','event'])||raw.state!=='admitted'||!isDeepStrictEqual(admissionEvent(raw.event,scope),context.event))throw failure();
    return {state:'admitted',event:{...context.event}};
  }
  if(name==='records'){
    if(!Array.isArray(raw)||raw.length!==context.sequence)throw failure();let previous=ZERO;const ids=new Set();
    const rows=raw.map((v,i)=>{const r=record(v,scope);if(r.sequence!==i+1||r.previous!==previous||ids.has(r.event.id))throw failure();ids.add(r.event.id);previous=r.sha256;return r;});
    if(previous!==context.sha256)throw failure();return rows;
  }
  if(name==='lookup'&&exact(raw,['state'])&&raw.state==='missing')return {state:'missing'};
  if(name==='append'&&exact(raw,['state','tip'])&&['conflict','full','paused'].includes(raw.state)){
    const t=tip(raw.tip,scope);if(raw.state==='full'&&t.sequence!==256||raw.state==='paused'&&t.enabled)throw failure();return {state:raw.state,tip:t};
  }
  if(!exact(raw,['state','record','tip'])||raw.state!=='recorded')throw failure();
  const r=record(raw.record,scope),t=tip(raw.tip,scope);
  if(r.event.id!==context.id||r.sequence>t.sequence||r.sequence===t.sequence&&r.sha256!==t.sha256||context.event&&!isDeepStrictEqual(r.event,context.event))throw failure();
  return {state:'recorded',record:r,tip:t};
}
const IDENTITY=`select current_database()::text as database,current_user::text as actor,session_user::text as login,
 (select ssl and version in ('TLSv1.2','TLSv1.3') from pg_catalog.pg_stat_ssl where pid=pg_backend_pid()) as tls,
 (select rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication and not rolinherit
  and (rolvaliduntil is null or rolvaliduntil>clock_timestamp()) from pg_catalog.pg_roles where rolname=current_user) as restricted,
 not exists(select 1 from pg_catalog.pg_auth_members m join pg_catalog.pg_roles g on g.oid=m.grantor join pg_catalog.pg_roles recipient on recipient.oid=m.member
  where (m.roleid=(select oid from pg_catalog.pg_roles where rolname=current_user) or m.member=(select oid from pg_catalog.pg_roles where rolname=current_user))
  and not(m.roleid=(select oid from pg_catalog.pg_roles where rolname=current_user) and recipient.rolname='postgres'
   and m.grantor=10 and g.rolname='supabase_admin' and m.admin_option and not m.inherit_option and not m.set_option)) as isolated,
 not has_table_privilege(current_user,'alliance_journal.entries','SELECT') and not has_schema_privilege(current_user,'public','CREATE') as limited,
 current_setting('fsync')='on' and current_setting('full_page_writes')='on' and current_setting('synchronous_commit')='on' as durable,
 to_regnamespace('alliance_avatar') is null and to_regclass('public.alliance_member_owners') is null as dedicated`;
const signatures={tip:['text','uuid'],lookup:['text','uuid','uuid'],append:['text','uuid','integer','text','jsonb'],records:['text','uuid','integer','text'],admit:['text','uuid','jsonb'],admission:['text','uuid','jsonb']};
export async function createDeletionJournalStore({enabled=false,projectRef,epoch,connection,openPool,timeoutMs=4500}={}){
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>4500)throw failure();let pool;
  if(enabled===true){
    if(typeof projectRef!=='string'||!/^[a-z0-9]{20}$/.test(projectRef)||typeof epoch!=='string'||!UUID.test(epoch)||!exact(connection,['host','password','ca'])||typeof connection.host!=='string'||!/^db\.[a-z0-9]{20}\.supabase\.co$/.test(connection.host)||connection.host===`db.${projectRef}.supabase.co`||typeof connection.password!=='string'||connection.password.length<24||connection.password.length>128||typeof connection.ca!=='string'||connection.ca.length>65536)throw failure();
    try{const pem=/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,blocks=connection.ca.match(pem);if(!blocks?.length||connection.ca.replace(pem,'').trim())throw failure();for(const b of blocks)new X509Certificate(b);}catch{throw failure();}
    const config={host:connection.host,port:5432,database:'postgres',user:'alliance_journal_executor',password:connection.password,
      ssl:{ca:connection.ca,rejectUnauthorized:true,minVersion:'TLSv1.2',servername:connection.host},sslnegotiation:'postgres',enableChannelBinding:true,
      application_name:'alliance-journal-candidate',options:'-c search_path=pg_catalog',connectionTimeoutMillis:2500,statement_timeout:2000,lock_timeout:750,idle_in_transaction_session_timeout:3000,
      max:2,min:0,idleTimeoutMillis:1000,maxLifetimeSeconds:60,allowExitOnIdle:true};
    try{pool=openPool?openPool(config):new (await import('pg')).Pool(config);if(!pool||typeof pool.connect!=='function'||typeof pool.end!=='function'||typeof pool.on!=='function')throw failure();pool.on('error',()=>{});}catch{throw failure();}
  }
  const scope={projectRef,epoch};let closed=false,active=0;const running=new Set();
  async function call(name,input,{signal}={}){
    if(enabled!==true||closed||signal?.aborted||active>=2)throw failure();let values,context;
    try{
      values=[projectRef,epoch];context={};
      if(['admit','admission'].includes(name)){const e=admissionEvent(input,scope);values.push(JSON.stringify(e));context={event:e};}
      if(name==='lookup'){const e=deletionRecord({projectRef,epoch,sequence:1,previous:ZERO,event:input}).event;values.push(e.id);context={id:e.id,event:e};}
      if(name==='append'){
        if(!exact(input,['expected','event']))throw failure();const p=point(input.expected),e=deletionRecord({projectRef,epoch,sequence:1,previous:ZERO,event:input.event}).event;
        values.push(p.sequence,p.sha256,JSON.stringify(e));context={id:e.id,event:e};
      }
      if(name==='records'){const p=point(input);values.push(p.sequence,p.sha256);context=p;}
    }catch{throw failure();}
    active++;const c=new AbortController();running.add(c);let client,released=false,finished=false,dispatched=false,commitSent=false,committed=false;
    const release=destroy=>{if(client&&!released){released=true;try{client.release(destroy);}catch{}}};
    const check=()=>{if(finished||c.signal.aborted)throw failure();},abort=()=>c.abort();
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();let onAbort;
    const stopped=new Promise((_,reject)=>{onAbort=()=>reject(failure());c.signal.addEventListener('abort',onAbort,{once:true});});const timer=setTimeout(abort,timeoutMs);
    try{return await Promise.race([(async()=>{
      check();const acquired=await pool.connect();if(finished||c.signal.aborted){try{acquired.release(true);}catch{}throw failure();}client=acquired;check();
      await client.query({text:'BEGIN',values:[]});check();
      await client.query({text:"SET LOCAL synchronous_commit='on'; SET LOCAL statement_timeout='2000ms'; SET LOCAL lock_timeout='750ms'; SET LOCAL idle_in_transaction_session_timeout='3000ms'; SET LOCAL search_path='pg_catalog'",values:[]});check();
      const identity=await client.query({text:IDENTITY,values:[]});check();const who=identity?.rows?.[0];
      if(identity?.rows?.length!==1||who.database!=='postgres'||who.actor!=='alliance_journal_executor'||who.login!=='alliance_journal_executor'||!['tls','restricted','isolated','limited','durable','dedicated'].every(k=>who[k]===true))throw failure();
      dispatched=true;const response=await client.query({text:`SELECT alliance_journal.${name}(${signatures[name].map((t,i)=>'$'+(i+1)+'::'+t).join(',')}) AS result`,values});check();
      if(response?.rows?.length!==1||!Object.hasOwn(response.rows[0],'result'))throw failure();const out=result(name,response.rows[0].result,scope,context);check();
      commitSent=true;const commit=await client.query({text:'COMMIT',values:[]});check();if(commit?.command!=='COMMIT')throw failure();committed=true;return out;
    })(),stopped]);}catch(e){throw failure(dispatched&&!commitSent&&['42501','23505','23514','23502','22023'].includes(e?.code)?'rejected':['append','admit'].includes(name)&&dispatched?'unknown':'not_started');}
    finally{finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();release(!committed);running.delete(c);active--;}
  }
  return Object.freeze({tip:options=>call('tip',null,options),lookup:(event,options)=>call('lookup',event,options),append:(input,options)=>call('append',input,options),records:(through,options)=>call('records',through,options),
    admit:(event,options)=>call('admit',event,options),admission:(event,options)=>call('admission',event,options),
    async close(){closed=true;for(const c of running)c.abort();let timer;try{await Promise.race([Promise.resolve(pool?.end()).catch(()=>{}),new Promise(r=>{timer=setTimeout(r,1000);})]);}catch{}finally{clearTimeout(timer);}}});
}
