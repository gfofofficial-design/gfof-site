// Explicit private workspace transport. No token, identity, storage, polling,
// automatic startup or retry. A lost write stays paused until an explicit choice.
import {feedbackId,feedbackCommand,feedbackPublicMutation,feedbackIdea,feedbackPublicPage} from './fed-alliance-feedback-contract.mjs';
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const messages={closed:'Member ideas are not open here.',busy:'The earlier request is still ending. Wait before another request.',reading:'Reading member ideas…',saving:'Saving this action…',ready:'Ideas read. Results describe this read only.',saved:'Action confirmed.',unknown:'The earlier action may have completed. New changes are paused. You can explicitly check or finish that same action.',sign_in_required:'Sign in again before using member ideas.',refused:'This action is unavailable to your current session.',unavailable:'The request could not be confirmed. No automatic retry will start.',cancelled:'Stopped waiting for this read. No automatic follow-up will start.',invalid:'Check the idea title, category and detail.'};
const error=code=>Object.assign(Error(messages[code]||messages.unavailable),{code});
export function createAllianceFeedbackClient({enabled=false,origin,fetcher=globalThis.fetch,onState=()=>{},timeoutMs=35000}={}){
 if(typeof enabled!=='boolean'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>35000||enabled&&(!/^https:\/\/(?:galacticfederation\.co|deploy-preview-[1-9][0-9]*--gfof\.netlify\.app)$/.test(origin)||typeof fetcher!=='function'))throw error('invalid');
 let disposed=false,active=null,pending=null,epoch=0;
 const emit=(status,data={})=>{if(!disposed)try{onState(Object.freeze({status,message:messages[status],...data}));}catch{}};
 function cancel(){if(disposed)return;epoch++;const f=active;if(f){if(f.write)pending=structuredClone(f.intent);f.controller.abort();emit(f.write?'unknown':'cancelled');}}
 async function run(kind,input,{retry=false}={}){
  if(disposed||!enabled)throw error('closed');if(active)throw error('busy');
  const write=kind==='change';if(write&&pending&&!retry){emit('unknown');throw error('unknown');}
  const c=new AbortController(),turn=++epoch,intent={kind,input:structuredClone(input)},flight={controller:c,write,intent};active=flight;let reader,response,onAbort;
  const check=()=>{if(disposed||turn!==epoch||c.signal.aborted)throw error(write?'unknown':'cancelled');};
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(error(write?'unknown':'cancelled'));c.signal.addEventListener('abort',onAbort,{once:true});});
  const timer=setTimeout(()=>c.abort(),timeoutMs);emit(write?'saving':'reading');
  const work=(async()=>{
   check();let path='/'+({list:'ideas',read:'idea',change:'change'})[kind];
   if(kind==='read')path+='?id='+encodeURIComponent(input);if(kind==='list'){const q=new URLSearchParams({limit:String(input.limit)});if(input.after!==null)q.set('after',input.after);path+='?'+q;}
   const endpoint=origin+'/api/alliance-members/feedback'+path;
   response=await fetcher(endpoint,{method:write?'POST':'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:c.signal,headers:{Accept:'application/json',...(write?{'Content-Type':'application/json'}:{})},...(write?{body:JSON.stringify(input)}:{})});
   if(c.signal.aborted||disposed||turn!==epoch){void response.body?.cancel().catch(()=>{});check();}
   if(response.redirected||response.url&&response.url!==endpoint)throw error(write?'unknown':'unavailable');
   if(response.status===401)throw error('sign_in_required');
   if(!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||'')||!/(?:^|,)\s*no-store\s*(?:,|$)/i.test(response.headers.get('cache-control')||'')||!response.body)throw error(write?'unknown':'unavailable');
   const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>262144))throw error(write?'unknown':'unavailable');
   reader=response.body.getReader();const parts=[];let size=0;
   for(;;){const p=await reader.read();check();if(p.done)break;if(!(p.value instanceof Uint8Array)||(size+=p.value.byteLength)>262144)throw error(write?'unknown':'unavailable');parts.push(p.value);}
   if(length!==null&&Number(length)!==size)throw error(write?'unknown':'unavailable');const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.byteLength;}const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));check();
   // Only exact refusals explicitly before a confirmed mutation clear a hold.
   if(!response.ok){if([400,403].includes(response.status)&&exact(data,['state'])&&['invalid','refused'].includes(data.state))throw error(data.state);throw error(write?'unknown':'unavailable');}
   if(exact(data,['state'])&&data.state==='unknown')throw error('unknown');
   if(kind==='change')return feedbackPublicMutation(data,input);
   if(data?.state!=='ready'||!exact(data,kind==='read'?['state','idea']:['state','page']))throw error('unavailable');
   if(kind==='read'){const r=feedbackIdea(data.idea);if(r.id!==input)throw error('unavailable');return {state:'ready',idea:r};}
   return {state:'ready',page:feedbackPublicPage(data.page,input)};
  })();
  // Reads/saves that ignore cancellation cannot release the actual flight latch.
  void work.finally(()=>{if(active===flight)active=null;}).catch(()=>{});
  try{
   const r=await Promise.race([work,stopped]);check();
   if(write){pending=null;emit('saved',r);}else emit('ready',r);return r;
  }catch(e){
   const code=['sign_in_required','refused','invalid'].includes(e?.code)?e.code:write?'unknown':c.signal.aborted||e?.code==='cancelled'?'cancelled':'unavailable';
   if(write){if(retry||code==='unknown'||code==='sign_in_required')pending=intent;else pending=null;}
   if(turn===epoch&&!disposed)emit(code);throw error(code);
  }finally{
   clearTimeout(timer);c.signal.removeEventListener('abort',onAbort);c.abort();try{void Promise.resolve(reader?reader.cancel():response?.body?.cancel()).catch(()=>{});}catch{}
  }
 }
 return Object.freeze({
  list(input={after:null,limit:5}){if(!exact(input,['after','limit'])||input.after!==null&&!feedbackId(input.after)||!Number.isSafeInteger(input.limit)||input.limit<1||input.limit>5)throw error('invalid');return run('list',{...input});},
  read(id){if(!feedbackId(id))throw error('invalid');return run('read',id);},
  change(input){let value;try{value=feedbackCommand(input);}catch{throw error('invalid');}return run('change',value);},
  checkOrFinishPrevious(){if(!pending)throw error('invalid');const copy=structuredClone(pending);return run(copy.kind,copy.input,{retry:true});},
  cancel,dispose(){if(disposed)return;cancel();disposed=true;pending=null;},
 });
}
