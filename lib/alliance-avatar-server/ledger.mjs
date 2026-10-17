// Disabled, unmounted server candidate. Credentials must be supplied privately
// by a reviewed host. No URL parsing, credential lookup, SQL/role installation.
import {X509Certificate} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY=/^v1\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.png$/;
const STATES=['reserved','uploading','committed','stale','cancelled'];
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const version=v=>Number.isSafeInteger(v)&&v>=0;
function failure(outcome='not_started') {return Object.assign(new Error('avatar_ledger_unavailable'),{outcome});}
function uuid(v){if(typeof v!=='string'||!UUID.test(v))throw failure();return v;}
function integer(v,max=Number.MAX_SAFE_INTEGER){if(!version(v)||v>max)throw failure();return v;}
function json(v,max=4096){
  if(!plain(v))throw failure();let raw;
  try{raw=JSON.stringify(v);}catch{throw failure();}
  if(Buffer.byteLength(raw)>max)throw failure();return raw;
}
function keyMatches(key,objectId,profileId){const match=typeof key==='string'&&KEY.exec(key);return !!match&&UUID.test(match[1])&&UUID.test(match[2])&&match[2]===objectId&&(!profileId||match[1]===profileId);}
function descriptor(d){return plain(d)&&Object.keys(d).length===5&&d.mime==='image/png'&&Number.isSafeInteger(d.bytes)&&d.bytes>=45&&d.bytes<=307200&&Number.isSafeInteger(d.width)&&d.width>=1&&d.width<=256&&Number.isSafeInteger(d.height)&&d.height>=1&&d.height<=256&&typeof d.sha256==='string'&&/^[0-9a-f]{64}$/.test(d.sha256);}
function receipt(r){return plain(r)&&UUID.test(r.profileId)&&UUID.test(r.objectId)&&UUID.test(r.providerId)&&keyMatches(r.key,r.objectId,r.profileId)&&r.mime==='image/png'&&Number.isSafeInteger(r.bytes)&&r.bytes>=45&&r.bytes<=307200&&version(r.width)&&r.width>=1&&r.width<=256&&version(r.height)&&r.height>=1&&r.height<=256&&typeof r.sha256==='string'&&/^[0-9a-f]{64}$/.test(r.sha256)&&Object.keys(r).length===9;}
function validate(name,v,limit){
  let raw;try{raw=JSON.stringify(v);}catch{throw failure();}if(typeof raw!=='string'||Buffer.byteLength(raw)>65536)throw failure();
  if(['settleUnpublished','ackDeleted'].includes(name)){if(v!==null)throw failure();return v;}
  if(name==='expireBatch'){integer(v,limit);return v;}
  if(name==='cleanupBatch'){
    if(!Array.isArray(v)||v.length>limit||new Set(v.map(r=>r?.objectId)).size!==v.length||v.some(r=>!plain(r)||Object.keys(r).length!==4||!UUID.test(r.objectId)||!keyMatches(r.key,r.objectId)||r.writeSettled!==true||!receipt(r.receipt)||r.objectId!==r.receipt.objectId||r.key!==r.receipt.key))throw failure();
    return JSON.parse(raw);
  }
  if(!plain(v))throw failure();
  const fields=name==='mine'?['version','objectId','pending']:name==='operationReceipt'?['state','profileId','objectId','key','writeSettled','verified','receipt','descriptor','deletionReceipt']:name==='reserve'?['dispatch','state','version','objectId']:name==='claimUpload'?['dispatch','state','objectId','key']:name==='cancelReserved'?['state']:['state','version','objectId'];
  if(Object.keys(v).some(k=>!fields.includes(k)))throw failure();
  if(name==='mine'){
    if(!version(v.version)||(v.objectId!==null&&!UUID.test(v.objectId))||!Array.isArray(v.pending)||v.pending.length>2||Object.keys(v).some(k=>!['version','objectId','pending'].includes(k))||v.pending.some(p=>!plain(p)||!UUID.test(p.operationId)||!STATES.includes(p.state)||typeof p.expiresAt!=='string'||!Number.isFinite(Date.parse(p.expiresAt))||Object.keys(p).length!==3))throw failure();
  }else if(name==='operationReceipt'){
    if(!STATES.includes(v.state)||!UUID.test(v.profileId)||!UUID.test(v.objectId)||!keyMatches(v.key,v.objectId,v.profileId)||typeof v.writeSettled!=='boolean'||typeof v.verified!=='boolean'||(v.receipt!==null&&(!receipt(v.receipt)||v.receipt.objectId!==v.objectId||v.receipt.profileId!==v.profileId))||v.writeSettled&&v.receipt===null||v.verified&&!v.writeSettled||v.descriptor!==null&&!plain(v.descriptor)||v.deletionReceipt!==null&&(!plain(v.deletionReceipt)||v.deletionReceipt.state!=='deleted'||v.deletionReceipt.writeSettled!==true||Object.keys(v.deletionReceipt).length!==3||!isDeepStrictEqual(v.deletionReceipt.receipt,v.receipt)))throw failure();
    if(v.writeSettled!==(v.receipt!==null)||v.descriptor!==null&&!descriptor(v.descriptor)||v.receipt!==null&&!isDeepStrictEqual(v.descriptor,{bytes:v.receipt.bytes,width:v.receipt.width,height:v.receipt.height,mime:v.receipt.mime,sha256:v.receipt.sha256}))throw failure();
  }else{
    if(v.state!==undefined&&!STATES.includes(v.state)||v.version!==undefined&&v.version!==null&&!version(v.version)||v.objectId!==undefined&&v.objectId!==null&&!UUID.test(v.objectId))throw failure();
    if(name==='reserve'&&(typeof v.dispatch!=='boolean'||!UUID.test(v.objectId)||!STATES.includes(v.state)||v.dispatch&&v.state!=='reserved'))throw failure();
    if(name==='claimUpload'&&(typeof v.dispatch!=='boolean'||v.dispatch&&(!UUID.test(v.objectId)||!keyMatches(v.key,v.objectId))||!v.dispatch&&!STATES.includes(v.state)))throw failure();
    if(['commitUpload','removeImage','cancelReserved'].includes(name)&&!STATES.includes(v.state))throw failure();
    if(['commitUpload','removeImage'].includes(name)&&v.state==='committed'&&(!version(v.version)||v.version<1))throw failure();
  }
  return JSON.parse(raw);
}
// Only fixed statements can reach query(); all caller data uses parameters.
const commands={
  mine:['mine',['uuid'],false],reserve:['reserve',['uuid','uuid','bigint'],true],
  claimUpload:['claim_upload',['uuid','uuid','jsonb'],true],commitUpload:['commit_upload',['uuid','uuid','jsonb'],true],
  cancelReserved:['cancel_reserved',['uuid','uuid'],true],removeImage:['remove_image',['uuid','uuid','bigint'],true],
  operationReceipt:['operation_receipt',['uuid','uuid'],false],settleUnpublished:['settle_unpublished',['uuid','jsonb'],true],
  cleanupBatch:['cleanup_batch',['integer'],false],ackDeleted:['ack_deleted',['uuid','jsonb'],true],expireBatch:['expire_batch',['integer'],true],
};
const IDENTITY=`select current_database()::text as database, current_user::text as actor, session_user::text as login,
 (select ssl and version in ('TLSv1.2','TLSv1.3') from pg_catalog.pg_stat_ssl where pid=pg_backend_pid()) as tls,
 (select rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication and not rolinherit
   and (rolvaliduntil is null or rolvaliduntil>clock_timestamp()) from pg_catalog.pg_roles where rolname=current_user) as restricted,
 not exists(select 1 from pg_catalog.pg_auth_members where roleid=(select oid from pg_catalog.pg_roles where rolname=current_user) or member=(select oid from pg_catalog.pg_roles where rolname=current_user)) as isolated,
 not has_table_privilege(current_user,'alliance_avatar.objects','SELECT') and not has_schema_privilege(current_user,'public','CREATE') as limited`;

export async function createAvatarLedger({enabled=false,connection,openPool,timeoutMs=4500}={}){
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>4500)throw failure();
  let pool;
  if(enabled===true){
    if(!plain(connection)||Object.keys(connection).some(k=>!['host','password','ca'].includes(k))||typeof connection.host!=='string'||!/^db\.[a-z0-9]{20}\.supabase\.co$/.test(connection.host)||typeof connection.password!=='string'||connection.password.length<24||connection.password.length>128||typeof connection.ca!=='string'||connection.ca.length>65536)throw failure();
    try{const pem=/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,blocks=connection.ca.match(pem);
      if(!blocks?.length||connection.ca.replace(pem,'').trim())throw failure();for(const block of blocks)new X509Certificate(block);
    }catch{throw failure();}
    const config={host:connection.host,port:5432,database:'postgres',user:'alliance_avatar_executor',password:connection.password,
      ssl:{ca:connection.ca,rejectUnauthorized:true,minVersion:'TLSv1.2',servername:connection.host},sslnegotiation:'postgres',enableChannelBinding:true,
      application_name:'alliance-avatar-candidate',options:'-c search_path=pg_catalog',connectionTimeoutMillis:2500,
      statement_timeout:2000,lock_timeout:750,idle_in_transaction_session_timeout:3000,
      max:2,min:0,idleTimeoutMillis:1000,maxLifetimeSeconds:60,allowExitOnIdle:true};
    try{pool=openPool?openPool(config):new (await import('pg')).Pool(config);
      if(!pool||typeof pool.connect!=='function'||typeof pool.end!=='function'||typeof pool.on!=='function')throw failure();
      pool.on('error',()=>{/* Never log raw connection errors or credentials. */});
    }catch{throw failure();}
  }
  let closed=false,active=0;const running=new Set();
  async function call(name,args,{signal}={}){
    if(enabled!==true||closed||signal?.aborted||active>=2)throw failure();
    const [fn,types,mutation]=commands[name];let values;
    try{values=types.map((type,i)=>type==='uuid'?uuid(args[i]):type==='jsonb'?json(args[i]):type==='integer'?integer(args[i],20):String(integer(args[i])));
      if(types[0]==='integer'&&values[0]<1)throw failure();
    }catch{throw failure();}
    active++;const control=new AbortController();running.add(control);let client,released=false,finished=false,dispatched=false,commitSent=false,committed=false;
    const release=destroy=>{if(client&&!released){released=true;try{client.release(destroy);}catch{/* No raw driver errors. */}}};
    const check=()=>{if(finished||control.signal.aborted)throw failure();};
    const abort=()=>control.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    let onAbort;const ended=new Promise((_,reject)=>{onAbort=()=>reject(failure());control.signal.addEventListener('abort',onAbort,{once:true});});
    const timer=setTimeout(abort,timeoutMs);
    try{return await Promise.race([(async()=>{
      check();const acquired=await pool.connect();
      if(finished||control.signal.aborted){try{acquired.release(true);}catch{}throw failure();}client=acquired;check();
      await client.query({text:'BEGIN',values:[]});check();
      await client.query({text:"SET LOCAL statement_timeout='2000ms'; SET LOCAL lock_timeout='750ms'; SET LOCAL idle_in_transaction_session_timeout='3000ms'; SET LOCAL search_path='pg_catalog'",values:[]});check();
      const identity=await client.query({text:IDENTITY,values:[]});check();
      const who=identity?.rows?.[0];
      if(identity?.rows?.length!==1||who.database!=='postgres'||who.actor!=='alliance_avatar_executor'||who.login!=='alliance_avatar_executor'||who.tls!==true||who.restricted!==true||who.isolated!==true||who.limited!==true)throw failure();
      dispatched=true;
      const response=await client.query({text:`SELECT alliance_avatar.${fn}(${types.map((type,i)=>'$'+(i+1)+'::'+type).join(',')}) AS result`,values});check();
      if(response?.rows?.length!==1||!Object.hasOwn(response.rows[0],'result'))throw failure();
      // node-postgres represents PostgreSQL void as the empty string. Normalize
      // only the two fixed void-returning functions, never arbitrary results.
      const raw=response.rows[0].result;
      const result=validate(name,['settleUnpublished','ackDeleted'].includes(name)&&raw===''?null:raw,values[0]);check();
      commitSent=true;const commit=await client.query({text:'COMMIT',values:[]});check();
      if(commit?.command!=='COMMIT')throw failure();committed=true;return result;
    })(),ended]);}catch(error){
      const rejected=dispatched&&!commitSent&&['42501','23505','23514','22023'].includes(error?.code);
      throw failure(rejected?'rejected':mutation&&dispatched?'unknown':'not_started');
    }finally{finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);control.signal.removeEventListener('abort',onAbort);control.abort();release(!committed);running.delete(control);active--;}
  }
  const api={};
  for(const [name,[,types]] of Object.entries(commands))api[name]=(...args)=>call(name,args.slice(0,types.length),args[types.length]);
  api.close=async()=>{closed=true;for(const c of running)c.abort();let timer;
    try{await Promise.race([Promise.resolve(pool?.end()).catch(()=>{}),new Promise(resolve=>{timer=setTimeout(resolve,1000);})]);}catch{}finally{clearTimeout(timer);}};
  return Object.freeze(api);
}
