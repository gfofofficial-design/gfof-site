// Explicit read only. Never chooses an actor, creates an operation or removes.
export function createProfileRemovalStatusClient({enabled=false,origin,fetcher=globalThis.fetch,timeoutMs=19000}={}){
 if(typeof enabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>19000||enabled&&(!/^https:\/\/(?:galacticfederation\.co|deploy-preview-[1-9][0-9]*--gfof\.netlify\.app)$/.test(origin)||typeof fetcher!=='function'))throw Error('profile_removal_status_configuration');
 let disposed=false,active=null;
 return Object.freeze({async read({signal}={}){
  if(!enabled||disposed||active||signal?.aborted)throw Error('profile_removal_status_unavailable');
  const c=new AbortController(),abort=()=>c.abort();let reader,response,onAbort;active=c;
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(Error('profile_removal_status_unavailable'));c.signal.addEventListener('abort',onAbort,{once:true});if(c.signal.aborted)onAbort();});
  const timer=setTimeout(abort,timeoutMs),check=()=>{if(disposed||c.signal.aborted)throw Error('profile_removal_status_unavailable');};
  try{return await Promise.race([(async()=>{
   check();response=await fetcher(origin+'/api/alliance-members/me/profile/removal-status',{method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json'},signal:c.signal});check();
   if(response.status!==200||!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||'')||!response.body)throw Error('profile_removal_status_unavailable');
   reader=response.body.getReader();const chunks=[];let size=0;
   for(;;){const p=await reader.read();check();if(p.done)break;if(!(p.value instanceof Uint8Array)||(size+=p.value.byteLength)>1024)throw Error('profile_removal_status_unavailable');chunks.push(p.value);}
   const bytes=new Uint8Array(size);let at=0;for(const p of chunks){bytes.set(p,at);at+=p.byteLength;}const v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));check();
   if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==2||v.state!=='ready'||!Object.hasOwn(v,'version')||!Number.isSafeInteger(v.version)||v.version<0||v.version>=Number.MAX_SAFE_INTEGER)throw Error('profile_removal_status_unavailable');
   return Object.freeze({version:v.version});
  })(),stopped]);}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();try{void Promise.resolve(reader?reader.cancel():response?.body?.cancel()).catch(()=>{});}catch{}if(active===c)active=null;}
 },dispose(){disposed=true;active?.abort();}});
}
