// Explicit private adapter. No credential discovery, admin pool or direct table API.
import {createAvatarLedger,avatarLedgerIdentitySql} from './ledger.mjs';
import {reportReviewBoundarySql} from './report-review-install.mjs';
import {reportReviewId,reportReviewPage,reportReviewCommand,reportReviewInventory} from '../../assets/federation/fed-alliance-report-review-contract.mjs';
import {reportReviewEvidence,reportReviewEvidencePage} from './report-review-evidence.mjs';
const fail=(outcome='not_started')=>Object.assign(Error('report_review_unavailable'),{outcome});
export async function createAllianceReportReviewStore({enabled=false,deploymentProfile='strict',connection,openPool,timeoutMs=4500}={}){
 if(typeof enabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>4500)throw fail();
 const identitySql=avatarLedgerIdentitySql(deploymentProfile),boundarySql=reportReviewBoundarySql();let pool;
 const ledger=await createAvatarLedger({enabled,deploymentProfile,connection,openPool:enabled?config=>{pool=openPool?.(config);if(!pool)throw fail();return pool;}:undefined,timeoutMs});
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
   const b=await client.query({text:boundarySql,values:[]});check();if(b?.rows?.length!==1||b.rows[0].report_review_boundary!==true)throw fail();
  };
  try{return await Promise.race([(async()=>{
   check();const acquired=await pool.connect();if(done||c.signal.aborted){acquired.release(true);throw fail();}client=acquired;
   await client.query({text:'BEGIN',values:[]});check();
   await client.query({text:"SET LOCAL synchronous_commit='on'; SET LOCAL statement_timeout='2000ms'; SET LOCAL lock_timeout='750ms'; SET LOCAL idle_in_transaction_session_timeout='3000ms'; SET LOCAL search_path='pg_catalog'",values:[]});check();await identity();
   dispatched=true;const r=await client.query({text:`SELECT alliance_report_review.${name}(${types.map((t,i)=>'$'+(i+1)+'::'+t).join(',')}) AS result`,values});check();
   if(r?.rows?.length!==1||!Object.hasOwn(r.rows[0],'result')||Buffer.byteLength(JSON.stringify(r.rows[0].result))>16384)throw fail();const out=decode(r.rows[0].result);check();
   commitSent=true;const commit=await client.query({text:'COMMIT',values:[]});check();if(commit?.command!=='COMMIT')throw fail();await identity();committed=true;return out;
  })(),stopped]);}catch(e){
   const rejected=!commitSent&&['42501','23505','23514','22023','22P02','22003'].includes(e?.code);if(!rejected)faulted=true;
   throw fail(mutation&&dispatched?(rejected?'rejected':'unknown'):'not_started');
  }finally{done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();release(!committed);current=undefined;active=false;}
 }
 const context=(a,s)=>{if(!reportReviewId(a)||!reportReviewId(s))throw fail();};
 function listEvidence(a,s,{after=null,limit=5}={},options){context(a,s);if(after!==null&&!reportReviewId(after)||!Number.isInteger(limit)||limit<1||limit>5)throw fail();return call('queue_session',[a,s,after,limit],['uuid','uuid','uuid','integer'],v=>reportReviewEvidencePage(v,{after,limit}),options);}
 function readEvidence(a,s,id,options){context(a,s);if(!reportReviewId(id))throw fail();return call('read_session',[a,s,id],['uuid','uuid','uuid'],reportReviewEvidence,options);}
 function reviewEvidence(a,s,input,options){context(a,s);const v=reportReviewCommand(input);return call('review_session',[a,s,v.id,v.expected,v.disposition],['uuid','uuid','uuid','text','text'],out=>{const e=reportReviewEvidence(out);if(e.record.id!==v.id||e.record.disposition!==v.disposition)throw fail();return e;},options,true);}
 return Object.freeze({
  listEvidence,readEvidence,reviewEvidence,
  async list(a,s,input,options){const v=await listEvidence(a,s,input,options);return reportReviewPage({items:v.items.map(x=>x.record),next:v.next},input);},
  async read(a,s,id,options){return (await readEvidence(a,s,id,options)).record;},
  async review(a,s,input,options){return (await reviewEvidence(a,s,input,options)).record;},
  inventory:options=>call('recovery_inventory',[],[],reportReviewInventory,options),
  async close(){closed=true;current?.abort();await ledger.close();},
 });
}
