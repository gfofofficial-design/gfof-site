// Default-off HTTP body boundary for the existing authenticated member facade.
// The injected service owns cookie verification and journal-first removal.
// No mount, env/secret lookup, direct SQL fallback or Auth account deletion.
const PATH='/api/alliance-members/me/profile';
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const reply=(status,state)=>new Response(JSON.stringify(state),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
export function createProfileRemovalApi({enabled=false,profileBinding=false,origin,service,timeoutMs=34000}={}){
 if(typeof enabled!=='boolean'||typeof profileBinding!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>34000)throw Error('profile_removal_configuration');
 if(enabled&&(!/^https:\/\/(?:galacticfederation\.co|deploy-preview-[1-9][0-9]*--gfof\.netlify\.app)$/.test(origin)||typeof service?.handle!=='function'))throw Error('profile_removal_configuration');
 let active=null,closed=false;
 async function api(request){
  if(!enabled)return reply(404,{state:'unavailable'});if(closed||active)return reply(503,{state:'unavailable'});
  let target;try{target=new URL(request.url);}catch{return reply(400,{state:'invalid'});}
  if(target.origin!==origin||target.pathname!==PATH||target.search||target.hash||target.username||target.password||request.method!=='DELETE')return reply(404,{state:'unavailable'});
  if(request.headers.get('origin')!==origin||request.headers.has('authorization')||request.headers.has('sec-fetch-site')&&request.headers.get('sec-fetch-site')!=='same-origin')return reply(403,{state:'forbidden'});
  const length=request.headers.get('content-length');if(request.headers.get('content-type')!=='application/json'||length!==null&&(!/^\d+$/.test(length)||Number(length)>512))return reply(400,{state:'invalid'});
  if(request.signal.aborted)return reply(408,{state:'request_ended'});
  const controller=new AbortController(),abort=()=>controller.abort();let dispatched=false,reader,onAbort;
  active=controller;request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted)abort();
  const stopped=new Promise(resolve=>{onAbort=()=>{closed=true;resolve(reply(dispatched?200:408,{state:dispatched?'unknown':'request_ended'}));};controller.signal.addEventListener('abort',onAbort,{once:true});if(controller.signal.aborted)onAbort();});
  const timer=setTimeout(abort,timeoutMs),check=()=>{if(controller.signal.aborted||closed)throw Error('profile_removal_ended');};
  try{return await Promise.race([(async()=>{
   check();if(!request.body)return reply(400,{state:'invalid'});reader=request.body.getReader();const chunks=[];let size=0;
   for(;;){const p=await reader.read();check();if(p.done)break;if(!(p.value instanceof Uint8Array)||(size+=p.value.byteLength)>512)return reply(400,{state:'invalid'});chunks.push(p.value);}
   if(length!==null&&Number(length)!==size)return reply(400,{state:'invalid'});
   const bytes=new Uint8Array(size);let at=0;for(const p of chunks){bytes.set(p,at);at+=p.byteLength;}
   let input;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{return reply(400,{state:'invalid'});}
   if(!exact(input,['operationId','version','confirm',...(profileBinding?['profileId']:[])])||!uuid(input.operationId)||profileBinding&&!uuid(input.profileId)||!Number.isSafeInteger(input.version)||input.version<0||input.version>=Number.MAX_SAFE_INTEGER||input.confirm!=='remove_my_profile')return reply(400,{state:'invalid'});
   check();const forwarded=new Request(origin+PATH,{method:'DELETE',headers:request.headers,signal:controller.signal});dispatched=true;
   const result=await service.handle(forwarded,{...input});check();
   if(exact(result,['state','version'])&&result.state==='committed'&&result.version===input.version+1)return reply(200,{state:'committed',version:result.version});
   if(exact(result,['state'])&&['unknown','removal_pending','request_ended','sign_in_required','busy','unavailable','account_unavailable','forbidden','invalid'].includes(result.state))return reply(result.state==='sign_in_required'?401:200,{state:result.state});
   return reply(200,{state:'unknown'});
  })(),stopped]);}catch{return reply(dispatched?200:400,{state:dispatched?'unknown':'invalid'});}
  finally{clearTimeout(timer);request.signal.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',onAbort);controller.abort();try{void reader?.cancel().catch(()=>{});}catch{}if(active===controller)active=null;}
 }
 return Object.freeze(Object.assign(api,{close(){closed=true;active?.abort();}}));
}
