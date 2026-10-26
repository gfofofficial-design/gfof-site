// Explicit cookie transport for the accepted panel. No token/owner flag or auto retry.
import {reportReviewId,reportReviewCommand,reportReviewRecord,reportReviewPage} from './fed-alliance-report-review-contract.mjs';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const error=code=>Object.assign(Error('Private report review could not be confirmed.'),{code});
export function createAllianceReportReviewClient({enabled=false,origin,fetcher=globalThis.fetch,timeoutMs=35000}={}){
 if(typeof enabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>35000||enabled&&(!/^https:\/\/(?:galacticfederation\.co|deploy-preview-[1-9][0-9]*--gfof\.netlify\.app)$/.test(origin)||typeof fetcher!=='function'))throw error('invalid');
 let closed=false,active=null,pending=null;
 async function run(kind,input,{signal}={}){
  if(!enabled||closed)throw error('closed');if(active)throw error('busy');if(signal?.aborted)throw error('cancelled');if(kind==='review'&&pending)throw error('unknown');
  const c=new AbortController(),mutation=kind==='review',flight={c};active=flight;let reader,response,onAbort;
  const check=()=>{if(closed||c.signal.aborted)throw error(mutation?'unknown':'cancelled');};
  const abort=()=>c.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(error(mutation?'unknown':'cancelled'));c.signal.addEventListener('abort',onAbort,{once:true});if(c.signal.aborted)onAbort();});
  const timer=setTimeout(abort,timeoutMs);
  const work=(async()=>{
   check();let path=kind==='list'?'/reports':kind==='read'?'/report':'/review';
   if(kind==='read')path+='?id='+encodeURIComponent(input);
   if(kind==='list'){const q=new URLSearchParams({limit:String(input.limit)});if(input.after!==null)q.set('after',input.after);path+='?'+q;}
   const endpoint=origin+'/api/alliance-members/report-review'+path;
   response=await fetcher(endpoint,{method:mutation?'POST':'GET',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json',...(mutation?{'Content-Type':'application/json'}:{})},signal:c.signal,...(mutation?{body:JSON.stringify(input)}:{})});
   if(c.signal.aborted||closed){void response.body?.cancel().catch(()=>{});check();}
   if(response.redirected||response.url&&response.url!==endpoint)throw error(mutation?'unknown':'unavailable');
   if(response.status===401)throw error('sign_in_required');
   if(!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||'')||!/(?:^|,)\s*no-store\s*(?:,|$)/i.test(response.headers.get('cache-control')||'')||!response.body)throw error(mutation?'unknown':'unavailable');
   const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>65536))throw error(mutation?'unknown':'unavailable');
   reader=response.body.getReader();const parts=[];let total=0;
   for(;;){const p=await reader.read();check();if(p.done)break;if(!(p.value instanceof Uint8Array)||(total+=p.value.length)>65536)throw error(mutation?'unknown':'unavailable');parts.push(p.value);}
   if(length!==null&&Number(length)!==total)throw error(mutation?'unknown':'unavailable');
   const bytes=new Uint8Array(total);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));check();
   if(!response.ok){if([400,403].includes(response.status)&&exact(data,['state'])&&['invalid','refused'].includes(data.state))throw error(data.state);throw error(mutation?'unknown':'unavailable');}
   if(exact(data,['state'])&&data.state==='unknown')throw error('unknown');
   if(kind==='list'){if(!exact(data,['state','page'])||data.state!=='ready')throw error('unavailable');const page=reportReviewPage(data.page,input);if(page.items.some(x=>Date.parse(x.expiresAt)<=Date.now()))throw error('unavailable');return page;}
   if(!exact(data,['state','report'])||data.state!=='ready')throw error(mutation?'unknown':'unavailable');
   const r=reportReviewRecord(data.report);if(r.id!==(mutation?input.id:input)||!r.contextLoaded||Date.parse(r.expiresAt)<=Date.now()||mutation&&r.disposition!==input.disposition)throw error(mutation?'unknown':'unavailable');return r;
  })();
  void work.finally(()=>{if(active===flight)active=null;}).catch(()=>{});
  try{const r=await Promise.race([work,stopped]);check();if(mutation||kind==='read'&&pending?.id===input)pending=null;return r;}
  catch(e){const code=['invalid','refused','sign_in_required'].includes(e?.code)?e.code:mutation?'unknown':c.signal.aborted?'cancelled':'unavailable';if(!closed&&mutation&&['unknown','sign_in_required'].includes(code))pending={...input};throw error(code);}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();try{void Promise.resolve(reader?reader.cancel():response?.body?.cancel()).catch(()=>{});}catch{}}
 }
 return Object.freeze({
  list(input={after:null,limit:5},options){if(!exact(input,['after','limit'])||input.after!==null&&!reportReviewId(input.after)||!Number.isInteger(input.limit)||input.limit<1||input.limit>5)throw error('invalid');return run('list',{...input},options);},
  read(id,options){if(!reportReviewId(id))throw error('invalid');return run('read',id,options);},
  review(input,options){return run('review',reportReviewCommand(input),options);},
  close(){closed=true;pending=null;active?.c.abort();},
 });
}
