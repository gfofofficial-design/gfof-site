// Unmounted, default-closed self-image read. Trusted Auth context comes from
// member.mjs; neither a browser-supplied ID nor journal absence authorizes access.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {performance} from 'node:perf_hooks';
import {validatedDerivative} from '../alliance-avatar-runtime/limits.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const fail=()=>Error('avatar_private_view_unavailable');
const unavailable=()=>({state:'unavailable'});
function current(v){
  if(!exact(v,['version','objectId','pending'])||!Number.isSafeInteger(v.version)||v.version<1||typeof v.objectId!=='string'||!UUID.test(v.objectId)||!Array.isArray(v.pending)||v.pending.length>2)throw fail();
  return {version:v.version,objectId:v.objectId};
}
function receipt(v,context,head){
  if(!exact(v,['state','profileId','objectId','key','writeSettled','verified','receipt','descriptor','deletionReceipt'])||v.state!=='committed'||v.profileId!==context.profileId||v.objectId!==head.objectId||v.writeSettled!==true||v.verified!==true||v.deletionReceipt!==null)throw fail();
  const r=v.receipt,d=v.descriptor;
  if(!exact(r,['profileId','objectId','key','providerId','bytes','width','height','mime','sha256'])||r.profileId!==context.profileId||r.objectId!==head.objectId||r.key!==`v1/${context.profileId}/${head.objectId}.png`||v.key!==r.key||!UUID.test(r.providerId)||r.mime!=='image/png'||!Number.isSafeInteger(r.bytes)||r.bytes<45||r.bytes>307200||!Number.isSafeInteger(r.width)||r.width<1||r.width>256||!Number.isSafeInteger(r.height)||r.height<1||r.height>256||typeof r.sha256!=='string'||!/^[0-9a-f]{64}$/.test(r.sha256)||!isDeepStrictEqual(d,{bytes:r.bytes,width:r.width,height:r.height,mime:r.mime,sha256:r.sha256}))throw fail();
  return Object.freeze({...r});
}
export function createAlliancePrivateView({enabled=false,ledger,storage,journal,serving,timeoutMs=30000}={}){
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw fail();
  if(enabled===true&&(!['authorizeSession','mineSession','operationReceiptSession'].every(k=>typeof ledger?.[k]==='function')||typeof storage?.read!=='function'||typeof journal?.review!=='function'||typeof serving?.authorize!=='function'))throw fail();
  let closed=false,active=0;const running=new Set();
  return Object.freeze({
    async read(input,{signal}={}){
      if(enabled!==true||closed)return unavailable();
      if(!exact(input,['actorId','sessionId','profileId','operationId','expiresAt'])||!['actorId','sessionId','profileId','operationId'].every(k=>typeof input[k]==='string'&&UUID.test(input[k]))||!Number.isSafeInteger(input.expiresAt)||input.expiresAt<=Date.now()||signal?.aborted||active>=2)return unavailable();
      const context={...input},c=new AbortController(),abort=()=>c.abort(),started=performance.now();let onAbort,view,response,reader,checks=0,accepted=0,authorizationFailed=false;
      active++;running.add(c);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});});
      const timer=setTimeout(abort,Math.min(timeoutMs,context.expiresAt-Date.now()));
      const check=()=>{if(closed||c.signal.aborted||Date.now()>=context.expiresAt||performance.now()-started>=timeoutMs)throw fail();};
      const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn();}),stopped]);
      const permit=async()=>{if(await phase(()=>serving.authorize({signal:c.signal}))!==true)throw fail();check();};
      try{
        await permit();
        const head=current(await phase(()=>ledger.mineSession(context.actorId,context.sessionId,{signal:c.signal})));check();
        const r=receipt(await phase(()=>ledger.operationReceiptSession(context.actorId,context.sessionId,context.operationId,{signal:c.signal})),context,head);check();
        const authorize=async record=>{
          try{
            check();if(!isDeepStrictEqual(record,r)||checks>=2)throw fail();checks++;
            view?.close();view=undefined;await permit();
            const fresh=await phase(async()=>{
              const value=await journal.review({signal:c.signal});
              if(c.signal.aborted||closed){value?.close?.();throw fail();}return value;
            });
            if(c.signal.aborted||closed){fresh?.close?.();throw fail();}
            view=fresh;check();if(view?.state!=='verified_evidence'||typeof view.check!=='function'||typeof view.close!=='function')throw fail();
            const auth=await phase(()=>ledger.authorizeSession(context.actorId,context.sessionId,{signal:c.signal}));check();
            if(!isDeepStrictEqual(auth,{actorId:context.actorId,sessionId:context.sessionId,profileId:context.profileId}))throw fail();
            if(!isDeepStrictEqual(current(await phase(()=>ledger.mineSession(context.actorId,context.sessionId,{signal:c.signal}))),head))throw fail();check();
            if(view.state!=='verified_evidence'||!isDeepStrictEqual(view.check({profileId:context.profileId,objectId:r.objectId}),{state:'not_listed'}))throw fail();
            accepted++;return true;
          }catch{authorizationFailed=true;return false;}
        };
        const delivered=await phase(async()=>{
          const value=await storage.read(r,{authorize,signal:c.signal});
          if(c.signal.aborted||closed){try{void value?.response?.body?.cancel().catch(()=>{});}catch{}throw fail();}return value;
        });check();
        response=delivered?.response;
        if(delivered?.state!=='readable'||checks!==2||accepted!==2||authorizationFailed||!(response instanceof Response)||response.status!==200||response.redirected||!response.body||!/^image\/png(?:;|$)/i.test(response.headers.get('content-type')||'')||view?.state!=='verified_evidence')throw fail();
        const length=response.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)!==r.bytes))throw fail();
        reader=response.body.getReader();const chunks=[];let size=0;
        for(;;){const part=await phase(()=>reader.read());check();if(part.done)break;if(!(part.value instanceof Uint8Array)||(size+=part.value.byteLength)>r.bytes)throw fail();chunks.push(Buffer.from(part.value));}
        const bytes=Buffer.concat(chunks,size);
        if(bytes.length!==r.bytes||createHash('sha256').update(bytes).digest('hex')!==r.sha256)throw fail();
        validatedDerivative({ok:true,bytes,width:r.width,height:r.height});await permit();check();
        if(view?.state!=='verified_evidence'||!isDeepStrictEqual(view.check({profileId:context.profileId,objectId:r.objectId}),{state:'not_listed'}))throw fail();
        return {state:'readable',response:new Response(bytes,{headers:{'Content-Type':'image/png','Content-Length':String(bytes.length),'Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; sandbox"}})};
      }catch{return unavailable();}
      finally{
        clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();running.delete(c);active--;try{view?.close?.();}catch{}try{void Promise.resolve(reader?reader.cancel():response?.body?.cancel()).catch(()=>{});}catch{}
      }
    },close(){closed=true;for(const c of running)c.abort();}
  });
}
