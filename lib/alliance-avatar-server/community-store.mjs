// Explicit private PG adapter. No Auth credential, environment lookup or mount.
import {createAvatarLedger,avatarLedgerIdentitySql} from './ledger.mjs';
import {COMMUNITY_BOUNDARY_SQL} from './community-boundary.mjs';
import {collaborationCommand,collaborationId,collaborationSnapshot,collaborationResult,collaborationPage,collaborationInventory} from '../../assets/federation/fed-alliance-collaboration-contract.mjs';
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const fail=(outcome='not_started')=>Object.assign(Error('community_store_unavailable'),{outcome});
export async function createAllianceCommunityStore({enabled=false,deploymentProfile='strict',connection,openPool,timeoutMs=4500}={}){
 if(typeof enabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>4500)throw fail();
 const identitySql=avatarLedgerIdentitySql(deploymentProfile);let pool,checked;
 // Reuse the existing connection validation and pool construction; this wrapper
 // captures only its independently built restricted-role pool, never an admin.
 checked=await createAvatarLedger({enabled,deploymentProfile,connection,openPool:enabled?config=>{
  pool=openPool?openPool(config):null;
  if(!pool)throw fail();return pool;
 }:undefined,timeoutMs});
 // Real production construction still needs a reviewed pool factory. There is
 // no dynamic pg fallback, global pool, credential chain or hidden admin path.
 let closed=false,faulted=false,active=false,current;
 async function call(name,values,types,decode,{signal}={},mutation=false){
  if(!enabled||closed||faulted||active||signal?.aborted)throw fail();active=true;
  const c=new AbortController(),abort=()=>c.abort();current=c;signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  let client,released=false,done=false,dispatched=false,commitSent=false,committed=false,onAbort;
  const release=destroy=>{if(client&&!released){released=true;try{client.release(destroy);}catch{}}};
  const check=()=>{if(done||closed||c.signal.aborted)throw fail();};
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
  const identity=async()=>{
   const r=await client.query({text:identitySql,values:[]});check();const who=r?.rows?.[0];
   if(r?.rows?.length!==1||who.database!=='postgres'||who.actor!=='alliance_avatar_executor'||who.login!==who.actor||!['tls','restricted','isolated','limited'].every(k=>who[k]===true))throw fail();
   const boundary=await client.query({text:COMMUNITY_BOUNDARY_SQL,values:[]});check();if(boundary?.rows?.length!==1||boundary.rows[0].community_boundary!==true)throw fail();
  };
  try{return await Promise.race([(async()=>{
   check();const acquired=await pool.connect();if(done||c.signal.aborted){acquired.release(true);throw fail();}client=acquired;check();
   await client.query({text:'BEGIN',values:[]});check();await client.query({text:"SET LOCAL synchronous_commit='on'; SET LOCAL statement_timeout='2000ms'; SET LOCAL lock_timeout='750ms'; SET LOCAL idle_in_transaction_session_timeout='3000ms'; SET LOCAL search_path='pg_catalog'",values:[]});check();await identity();
   dispatched=true;const r=await client.query({text:`SELECT alliance_community.${name}(${types.map((t,i)=>'$'+(i+1)+'::'+t).join(',')}) AS result`,values});check();
   if(r?.rows?.length!==1||!Object.hasOwn(r.rows[0],'result')||Buffer.byteLength(JSON.stringify(r.rows[0].result))>262144)throw fail();const out=decode(r.rows[0].result);check();
   commitSent=true;const commit=await client.query({text:'COMMIT',values:[]});check();if(commit?.command!=='COMMIT')throw fail();await identity();committed=true;return out;
  })(),stopped]);}catch(e){
   const rejected=!commitSent&&['42501','23505','23514','22023','22P02','22003'].includes(e?.code);
   if(!rejected)faulted=true;
   throw fail(mutation&&dispatched?(rejected?'rejected':'unknown'):'not_started');
  }
  finally{done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();release(!committed);current=undefined;active=false;}
 }
 const context=(a,s)=>{if(!collaborationId(a)||!collaborationId(s))throw fail();};
 return Object.freeze({
  read(a,s,id,options){context(a,s);if(!collaborationId(id))throw fail();return call('read_session',[a,s,id],['uuid','uuid','uuid'],collaborationSnapshot,options);},
  list(a,s,{after=null,limit=5}={},options){context(a,s);if(after!==null&&!collaborationId(after)||!Number.isSafeInteger(limit)||limit<1||limit>5)throw fail();return call('list_session',[a,s,after,limit],['uuid','uuid','uuid','integer'],v=>collaborationPage(v,{after,limit}),options);},
  change(a,s,input,options){context(a,s);const v=collaborationCommand(input);return call('change_session',[a,s,JSON.stringify(v)],['uuid','uuid','jsonb'],collaborationResult,options,true);},
  block(a,s,input,options){context(a,s);if(!exact(input,['target','hidden'])||!collaborationId(input.target)||typeof input.hidden!=='boolean')throw fail();return call('block_session',[a,s,input.target,input.hidden],['uuid','uuid','uuid','boolean'],v=>{if(!exact(v,['target','hidden'])||v.target!==input.target||v.hidden!==input.hidden)throw fail();return {...v};},options,true);},
  inventory:options=>call('recovery_inventory',[],[],collaborationInventory,options),
  async close(){closed=true;current?.abort();await checked.close();},
 });
}
