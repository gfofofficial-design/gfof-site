// Unmounted Node-to-Web bridge. No socket, credential lookup or startup transition.
import {persistentInstallation} from './alliance-avatar-server/persistent-installation.mjs';
import {allianceMemberRoute} from './alliance-member-http.mjs';
import {allianceCommunityRoute} from './alliance-community-http.mjs';
import {allianceFeedbackRoute} from './alliance-feedback-http.mjs';
import {allianceReportReviewRoute} from './alliance-report-review-http.mjs';
import {allianceMemberBackendHostname} from './alliance-member-closed-https.mjs';

const privacy={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Connection':'close'};
const unavailable={state:'unavailable'};
const protectedHeaders=new Set(['host','cookie','origin','sec-fetch-site','content-length','transfer-encoding','authorization','content-type']);
const forwarded=['cookie','origin','sec-fetch-site','content-type','accept'];
const failure=()=>Error('alliance_node_http_unavailable');
function send(response,status,value){
 if(response.destroyed||response.writableEnded)return;
 response.writeHead(status,privacy);response.end(Buffer.isBuffer(value)?value:JSON.stringify(value));
}
function body(request,signal,maxBytes){
 return new Promise((resolve,reject)=>{
  const chunks=[];let size=0;
  const done=(error,value)=>{request.removeListener('data',data);request.removeListener('end',end);request.removeListener('error',failed);request.removeListener('aborted',failed);signal.removeEventListener('abort',failed);error?reject(error):resolve(value);};
  const failed=()=>done(failure());
  const data=chunk=>{const b=Buffer.from(chunk);size+=b.length;if(size>maxBytes){done(Object.assign(failure(),{tooLarge:true}));request.resume();}else chunks.push(b);};
  const end=()=>done(null,Buffer.concat(chunks,size));
  request.on('data',data);request.once('end',end);request.once('error',failed);request.once('aborted',failed);signal.addEventListener('abort',failed,{once:true});
  if(signal.aborted)failed();
 });
}
function uncertain(request,origin,started){
 if(!started)return [408,unavailable];
 const simple=allianceReportReviewRoute(request,origin)||allianceFeedbackRoute(request,origin)||allianceCommunityRoute(request,origin);
 if(simple)return [503,{state:request.method==='POST'?'unknown':'unavailable'}];
 if(request.method==='DELETE')return [200,{state:'unknown'}];
 return [503,{error:{code:'profile_unavailable',message:'The member service could not confirm this request.'},...(request.method==='POST'?{mutation:'unknown'}:{})}];
}

export function createPersistentAllianceNodeHttp({enabled=false,origin,installation,applicationHost,timeoutMs=20000,maxBodyBytes=16384,maxResponseBytes=262144}={}){
 if(enabled===false)return Object.freeze({handle:async(request,response)=>{request.resume();send(response,503,unavailable);},close:async()=>{}});
 let identity;
 try{
  identity=Object.freeze(persistentInstallation(installation));
  if(enabled!==true||(identity.environment==='production'?origin!=='https://galacticfederation.co':!/^https:\/\/deploy-preview-[1-9][0-9]*--gfof\.netlify\.app$/.test(origin))||
   !['handle','close'].every(k=>typeof applicationHost?.[k]==='function')||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>20000||
   !Number.isInteger(maxBodyBytes)||maxBodyBytes<1||maxBodyBytes>16384||!Number.isInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>262144)throw failure();
 }catch{throw failure();}
 const context=Object.freeze({server:identity});let closed=false,active,closing;
 function retire(){closed=true;if(!closing){try{closing=Promise.resolve(applicationHost.close()).catch(()=>{});}catch{closing=Promise.resolve();}}return closing;}
 async function handle(request,response){
  let target;
  const refuse=(status=400)=>{request.resume();send(response,status,unavailable);};
  try{
   if(!Array.isArray(request.rawHeaders)||request.rawHeaders.length>128||request.rawHeaders.reduce((n,v)=>n+Buffer.byteLength(v)+2,0)>32768)return refuse(431);
   const seen=new Set();for(let i=0;i<request.rawHeaders.length;i+=2){const key=request.rawHeaders[i].toLowerCase();if(protectedHeaders.has(key)&&seen.has(key))return refuse();seen.add(key);}
   const host=request.headers.host;if(host!==allianceMemberBackendHostname&&host!==allianceMemberBackendHostname+':443')return refuse(421);
   if(typeof request.url!=='string'||request.url.length>4096||!request.url.startsWith('/')||request.url.startsWith('//')||/[\\\s\u0000-\u001f\u007f]/.test(request.url))return refuse();
   target=new Request(origin+request.url,{method:request.method});
   if(!allianceMemberRoute(target,origin)&&!allianceCommunityRoute(target,origin)&&!allianceFeedbackRoute(target,origin)&&!allianceReportReviewRoute(target,origin))return refuse(404);
   if(closed||active)return refuse(503);
   if(seen.has('authorization'))return refuse(403);
   const length=request.headers['content-length'];
   if(length!==undefined&&(!/^(?:0|[1-9][0-9]*)$/.test(length)||Number(length)>maxBodyBytes))return refuse(413);
   if(request.method!=='POST'&&(seen.has('transfer-encoding')||length!==undefined&&length!=='0'))return refuse();
   if(request.method==='POST'&&!/^application\/json(?:;|$)/i.test(request.headers['content-type']||''))return refuse(415);
  }catch{return refuse();}
  const controller=new AbortController(),flight={controller,started:false};active=flight;let reader;
  const abort=()=>controller.abort(),disconnected=()=>{if(!response.writableFinished)abort();};
  request.once('aborted',abort);response.once('close',disconnected);
  let stop;const interrupted=new Promise(resolve=>{stop=()=>{if(flight.started)void retire();try{void reader?.cancel().catch(()=>{});}catch{}resolve(null);};controller.signal.addEventListener('abort',stop,{once:true});});
  const timer=setTimeout(abort,timeoutMs);
  const work=(async()=>{
   try{
    const bytes=await body(request,controller.signal,maxBodyBytes);if(controller.signal.aborted)return null;
    const headers=new Headers();for(const name of forwarded)if(typeof request.headers[name]==='string')headers.set(name,request.headers[name]);
    if(request.method==='POST')headers.set('content-length',String(bytes.length));
    target=new Request(target.url,{method:request.method,headers,signal:controller.signal,...(request.method==='POST'?{body:bytes}:{})});
    flight.started=true;
    const value=await applicationHost.handle(target,context);
    if(controller.signal.aborted){try{void value?.body?.cancel().catch(()=>{});}catch{}return null;}
    if(!(value instanceof Response)||value.status<200||value.status>=600||value.status>=300&&value.status<400||!/^application\/json(?:;|$)/i.test(value.headers.get('content-type')||''))throw failure();
    const chunks=[];let size=0;reader=value.body?.getReader();
    while(reader){const v=await reader.read();if(v.done)break;size+=v.value.byteLength;if(size>maxResponseBytes)throw failure();chunks.push(Buffer.from(v.value));}
    return controller.signal.aborted?null:[value.status,Buffer.concat(chunks,size)];
   }catch(error){
    if(error?.tooLarge&&!flight.started)return [413,unavailable];
    if(flight.started)void retire();
    return null;
   }finally{try{void reader?.cancel().catch(()=>{});}catch{}}
  })();
  // Retain occupancy until ignored cancellation and response reads really settle.
  void work.finally(()=>{if(active===flight)active=undefined;}).catch(()=>{});
  try{const result=await Promise.race([work,interrupted]);send(response,...(result||uncertain(target,origin,flight.started)));}
  finally{clearTimeout(timer);request.removeListener('aborted',abort);response.removeListener('close',disconnected);controller.signal.removeEventListener('abort',stop);}
 }
 return Object.freeze({handle,close:()=>{active?.controller.abort();return retire();}});
}
