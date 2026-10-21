// Trusted-server composition candidate. Not a Netlify function or mounted route.
// No environment lookup, credential discovery, login, refresh or background work.
import {createAllianceProfileApi} from './alliance-profile-api.mjs';
import {createProfileRemovalApi} from './alliance-profile-removal-api.mjs';
import {createProfileRemovalStatusApi} from './alliance-profile-removal-status-api.mjs';
import {createAllianceAvatarMemberService} from './alliance-avatar-server/member.mjs';

const ROOT='/api/alliance-members';
const ORIGIN=/^https:\/\/(?:galacticfederation\.co|deploy-preview-[1-9][0-9]*--gfof\.netlify\.app)$/;
const reply=(status,value)=>new Response(JSON.stringify(value),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
  'Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow',
}});
const unavailable=()=>reply(503,{error:{code:'profile_unavailable',message:'The member service is unavailable. No automatic retry will start.'}});

export function createAllianceMemberHttp({enabled=false,origin,url,key,ledger,journal,serving,
  creation,removal,processor,storage,fetcher=globalThis.fetch,timeoutMs=40000}={}){
  if(typeof enabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>40000)throw Error('member_http_configuration');
  let closed=false,active=null;
  const owned=[];
  const shutdown=()=>{closed=true;for(const component of owned)component.close();active?.controller.abort();};
  let profiles,remove,status;
  if(enabled){
    if(!ORIGIN.test(origin)||typeof creation?.profile!=='function'||typeof removal?.run!=='function'||
      !['authorizeAccountSession','profileRevisionReadSession','mineSession'].every(k=>typeof ledger?.[k]==='function')||
      typeof journal?.review!=='function'||typeof serving?.authorize!=='function')throw Error('member_http_configuration');
    try{
      profiles=createAllianceProfileApi({enabled:true,profileRevisions:true,origin,url,key,ledger,journal,serving,creation,fetcher});owned.push(profiles);
      // Reuse the existing verified-cookie facade. Image routes are not admitted
      // by this composition, even though the caller-owned ledger has that API.
      const member=createAllianceAvatarMemberService({enabled:true,removalVersionEnabled:true,profileBindingEnabled:true,
        origin,url,key,ledger,journal,serving,removal,processor,storage,fetcher});owned.push(member);
      remove=createProfileRemovalApi({enabled:true,profileBinding:true,origin,service:member});owned.push(remove);
      status=createProfileRemovalStatusApi({enabled:true,origin,service:member});owned.push(status);
    }catch{shutdown();throw Error('member_http_configuration');}
  }
  const ended=(method,sourceAborted)=>method==='DELETE'?reply(200,{state:'unknown'}):
    reply(sourceAborted?408:503,{error:{code:sourceAborted?'request_ended':'profile_unavailable',message:'The request ended. Read your current profile before submitting again.'},...(method==='POST'?{mutation:'unknown'}:{})});
  const handle=async request=>{
    if(!enabled)return reply(404,{state:'unavailable'});
    if(closed)return unavailable();
    if(!(request instanceof Request))return reply(400,{state:'invalid'});
    const target=new URL(request.url),path=target.pathname,method=request.method;
    if(target.origin!==origin||target.username||target.password||target.hash)return reply(404,{state:'unavailable'});
    let route;
    if(path===ROOT+'/me'&&['GET','POST'].includes(method)||path===ROOT+'/directory'&&method==='GET')route=profiles;
    else if(path===ROOT+'/me/profile'&&method==='DELETE')route=remove;
    else if(path===ROOT+'/me/profile/removal-status'&&method==='GET')route=status;
    else return reply(404,{state:'unavailable'});
    // Never let a request choose an alternative host via proxy headers. The
    // reviewed exact origin and each inner boundary remain authoritative.
    if(active)return unavailable();
    if(request.signal.aborted)return reply(408,{state:'request_ended'});
    const controller=new AbortController(),flight={controller};active=flight;
    let forwarded,bodyReader,bodyController,bodyClosed=false;
    const cancelBody=()=>{
      if(bodyClosed||!bodyReader)return;bodyClosed=true;
      try{bodyController?.error(Error('member_request_ended'));}catch{}
      try{void Promise.resolve(bodyReader.cancel()).catch(()=>{});}catch{}
    };
    try{
      let body;
      if(request.body){
        bodyReader=request.body.getReader();
        body=new ReadableStream({
          start(c){bodyController=c;},
          async pull(c){
            try{const part=await bodyReader.read();if(bodyClosed)return;
              if(part.done){bodyClosed=true;c.close();}else c.enqueue(part.value);
            }catch{if(!bodyClosed){bodyClosed=true;c.error(Error('member_request_ended'));}}
          },
          cancel(){bodyClosed=true;return bodyReader.cancel().catch(()=>{});},
        });
      }
      forwarded=new Request(request.url,{method,headers:request.headers,signal:controller.signal,...(body?{body,duplex:'half'}:{})});
    }
    catch{cancelBody();active=null;return reply(400,{state:'invalid'});}
    controller.signal.addEventListener('abort',cancelBody,{once:true});
    const abort=()=>shutdown();
    request.signal.addEventListener('abort',abort,{once:true});if(request.signal.aborted)abort();
    let onAbort;
    const stopped=new Promise(resolve=>{onAbort=()=>resolve(ended(method,request.signal.aborted));controller.signal.addEventListener('abort',onAbort,{once:true});if(controller.signal.aborted)onAbort();});
    const timer=setTimeout(shutdown,timeoutMs);
    // The latch is released by the actual adapter promise, not Promise.race.
    // Closing owns only these adapters; injected authority/admission/removal
    // services remain the caller's responsibility and receive cancellation.
    const job=Promise.resolve().then(()=>controller.signal.aborted?ended(method,request.signal.aborted):route(forwarded));
    void job.finally(()=>{if(active===flight)active=null;}).catch(()=>{});
    try{
      const response=await Promise.race([job,stopped]);
      if(controller.signal.aborted)return ended(method,request.signal.aborted);
      if(!(response instanceof Response))throw Error('member_http_response');
      // Function responses carry their own cache/privacy headers; static-site
      // header rules cannot provide this protection at a future runtime mount.
      const headers=new Headers(response.headers);
      for(const [k,v]of Object.entries({'Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}))headers.set(k,v);
      return new Response(response.body,{status:response.status,headers});
    }catch{shutdown();return ended(method,request.signal.aborted);}
    finally{clearTimeout(timer);request.signal.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',onAbort);controller.signal.removeEventListener('abort',cancelBody);cancelBody();}
  };
  return Object.freeze({handle,close:shutdown});
}
