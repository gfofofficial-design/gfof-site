// Default-off GET boundary. No body, browser identity or mutation path.
const PATH='/api/alliance-members/me/profile/removal-status';
const reply=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
export function createProfileRemovalStatusApi({enabled=false,origin,service,timeoutMs=17000}={}){
 if(typeof enabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>17000||enabled&&(!/^https:\/\/(?:galacticfederation\.co|deploy-preview-[1-9][0-9]*--gfof\.netlify\.app)$/.test(origin)||typeof service?.handle!=='function'))throw Error('profile_removal_status_configuration');
 let active=null,closed=false;
 const api=async request=>{
  if(!enabled)return reply(404,{state:'unavailable'});if(closed||active)return reply(503,{state:'unavailable'});
  let target;try{target=new URL(request.url);}catch{return reply(400,{state:'invalid'});}
  if(request.method!=='GET'||target.origin!==origin||target.pathname!==PATH||target.search||target.hash||target.username||target.password)return reply(404,{state:'unavailable'});
  const from=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
  if(request.headers.has('authorization')||from!==null&&from!==origin||site!==null&&site!=='same-origin'||from!==origin&&site!=='same-origin')return reply(403,{state:'forbidden'});
  if(request.body!==null||request.headers.has('content-length')&&request.headers.get('content-length')!=='0'||request.headers.has('transfer-encoding'))return reply(400,{state:'invalid'});
  if(request.signal.aborted)return reply(408,{state:'request_ended'});
  const c=new AbortController(),abort=()=>c.abort();let onAbort;active=c;
  request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted)abort();
  const stopped=new Promise(resolve=>{onAbort=()=>{closed=true;resolve(reply(408,{state:'request_ended'}));};c.signal.addEventListener('abort',onAbort,{once:true});if(c.signal.aborted)onAbort();});
  const timer=setTimeout(abort,timeoutMs);
  try{return await Promise.race([Promise.resolve().then(async()=>{
   if(c.signal.aborted||closed)return reply(408,{state:'request_ended'});
   const value=await service.handle(new Request(origin+PATH,{method:'GET',headers:request.headers,signal:c.signal}),{});
   if(c.signal.aborted||closed)return reply(408,{state:'request_ended'});
   if(value&&Object.keys(value).length===2&&value.state==='ready'&&Object.hasOwn(value,'version')&&Number.isSafeInteger(value.version)&&value.version>=0&&value.version<Number.MAX_SAFE_INTEGER)return reply(200,{state:'ready',version:value.version});
   return reply(value?.state==='sign_in_required'?401:503,{state:value?.state==='sign_in_required'?'sign_in_required':'unavailable'});
  }),stopped]);}catch{return reply(503,{state:'unavailable'});}
  finally{clearTimeout(timer);request.signal.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();if(active===c)active=null;}
 };
 return Object.freeze(Object.assign(api,{close(){closed=true;active?.abort();}}));
}
