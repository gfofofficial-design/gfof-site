// Disabled server-only candidate. No environment reads, route, scheduler or SQL.
// Call only after committed ledger dispatch/cleanup authorization. The caller
// must persist receipts; an injected policy callback is NOT authentication.
import {createHash} from 'node:crypto';
import {AVATAR_LIMITS,validatedDerivative} from './alliance-avatar-runtime/limits.mjs';

const BUCKET='alliance-member-images-v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const HASH=/^[0-9a-f]{64}$/;
const fail=()=>new Error('avatar_storage_unavailable');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function identity(value){
  if(!value||!UUID.test(value.profileId)||!UUID.test(value.objectId))throw fail();
  const {profileId,objectId}=value;
  return {profileId,objectId,key:`v1/${profileId}/${objectId}.png`};
}
function storedRecord(value){
  const id=identity(value);
  if(value.key!==id.key||!UUID.test(value.providerId)||!HASH.test(value.sha256)||
    !Number.isSafeInteger(value.bytes)||value.bytes<45||value.bytes>AVATAR_LIMITS.outputBytes||
    !Number.isSafeInteger(value.width)||!Number.isSafeInteger(value.height)||
    value.width<1||value.height<1||value.width>256||value.height>256||value.mime!=='image/png')throw fail();
  return Object.freeze({...id,providerId:value.providerId,sha256:value.sha256,bytes:value.bytes,
    width:value.width,height:value.height,mime:'image/png'});
}
function cancel(body){try{void Promise.resolve(body?.cancel()).catch(()=>{});}catch{/* No raw errors. */}}

// Independent deadline, including a non-cooperative fetch, stream or policy
// callback. Late fetches are cancelled and cannot start a follow-up request.
async function boundedRun(signal,timeoutMs,work){
  const controller=new AbortController();let reader;
  const abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted)abort();
  let rejectAbort;
  const ended=new Promise((_,reject)=>{rejectAbort=()=>reject(fail());controller.signal.addEventListener('abort',rejectAbort,{once:true});});
  const timer=setTimeout(abort,timeoutMs);
  const check=()=>{if(controller.signal.aborted)throw fail();};
  const ctx={signal:controller.signal,check,async bytes(response,maxBytes){
    check();
    const length=response.headers.get('content-length');
    if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxBytes))throw fail();
    if(!response.body)throw fail();
    reader=response.body.getReader();const chunks=[];let size=0;
    for(;;){const part=await reader.read();check();if(part.done)break;
      if(!(part.value instanceof Uint8Array))throw fail();
      size+=part.value.byteLength;if(size>maxBytes)throw fail();chunks.push(Buffer.from(part.value));}
    if(length!==null&&Number(length)!==size)throw fail();
    reader.releaseLock();reader=null;return Buffer.concat(chunks,size);
  }};
  try{check();return await Promise.race([work(ctx),ended]);}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);
    controller.signal.removeEventListener('abort',rejectAbort);controller.abort();
    try{void Promise.resolve(reader?.cancel()).catch(()=>{});}catch{}}
}

export function createAllianceAvatarStorage({enabled=false,origin,apiKey,bearerToken,fetcher=globalThis.fetch,timeoutMs=8000}={}){
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>8000)throw fail();
  if(enabled===true){
    if(typeof origin!=='string'||!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(origin)||
      typeof apiKey!=='string'||apiKey.length<24||apiKey.length>8192||!(/^(?:sb_publishable_|sb_secret_)[A-Za-z0-9_-]+$/.test(apiKey)||TOKEN.test(apiKey))||
      typeof bearerToken!=='string'||bearerToken.length>8192||!TOKEN.test(bearerToken)||typeof fetcher!=='function')throw fail();
  }
  const headers={apikey:apiKey,Authorization:`Bearer ${bearerToken}`};
  const unavailable=()=>({state:'unavailable'});
  async function send(ctx,path,options={}){
    ctx.check();
    const response=await fetcher(origin+'/storage/v1/object/'+path,{...options,
      headers:{...headers,...options.headers},signal:ctx.signal,redirect:'error',credentials:'omit',cache:'no-store'});
    if(ctx.signal.aborted){cancel(response.body);throw fail();}
    if(response.redirected||response.status>=300&&response.status<400){cancel(response.body);throw fail();}
    return response;
  }
  async function json(ctx,response){
    try{if(!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||''))throw fail();
      return JSON.parse((await ctx.bytes(response,16384)).toString('utf8'));
    }finally{cancel(response.body);}
  }
  async function download(ctx,record){
    const response=await send(ctx,BUCKET+'/'+record.key,{method:'GET'});
    try{
      if(response.status!==200||!/^image\/png(?:;|$)/i.test(response.headers.get('content-type')||''))throw fail();
      const bytes=await ctx.bytes(response,record.bytes);
      if(bytes.length!==record.bytes||digest(bytes)!==record.sha256)throw fail();
      validatedDerivative({ok:true,bytes,width:record.width,height:record.height});
      return bytes;
    }finally{cancel(response.body);}
  }
  return Object.freeze({
    async upload(input,{signal}={}){
      if(enabled!==true)return unavailable();
      let id,derivative;
      try{id=identity(input);if(input.derivative?.mime!=='image/png')throw fail();
        derivative=validatedDerivative({...input.derivative,ok:true});
      }catch{return {state:'not_started'};}
      // Copy and fingerprint before the first await; caller mutation cannot
      // change the file dispatched after the reservation was made.
      const expected={...id,sha256:digest(derivative.bytes),bytes:derivative.bytes.length,
        width:derivative.width,height:derivative.height,mime:'image/png'};
      let dispatched=false,receipt=null;
      try{return await boundedRun(signal,timeoutMs,async ctx=>{
        ctx.check();dispatched=true;
        const response=await send(ctx,BUCKET+'/'+id.key,{method:'POST',
          headers:{'Content-Type':'image/png','Cache-Control':'max-age=0','x-upsert':'false'},body:derivative.bytes});
        if(![200,201].includes(response.status)){cancel(response.body);throw fail();}
        const ack=await json(ctx,response);ctx.check();
        if(!ack||ack.Key!==BUCKET+'/'+id.key||!UUID.test(ack.Id))throw fail();
        receipt=storedRecord({...expected,providerId:ack.Id});
        await download(ctx,receipt);ctx.check();
        return {state:'stored',writeSettled:true,verified:true,receipt};
      });}catch{
        // Only a matching successful provider acknowledgement proves that the
        // write finished. A timeout/abort/HTTP error/404 never does so.
        return receipt?{state:'stored_unverified',writeSettled:true,verified:false,receipt}:
          {state:dispatched?'unknown':'not_started',writeSettled:false};
      }
    },
    async read(value,{authorize,signal}={}){
      if(enabled!==true)return unavailable();
      let record;try{record=storedRecord(value);if(typeof authorize!=='function')throw fail();}catch{return unavailable();}
      try{return await boundedRun(signal,timeoutMs,async ctx=>{
        if(await authorize(record)!==true)throw fail();ctx.check();
        const bytes=await download(ctx,record);ctx.check();
        // Recheck listing/moderation/membership/current pointer after the read.
        // Do not hand a response to the browser if visibility changed in flight.
        if(await authorize(record)!==true)throw fail();ctx.check();
        return {state:'readable',response:new Response(bytes,{headers:{
          'Content-Type':'image/png','Cache-Control':'private, no-store',
          'Netlify-CDN-Cache-Control':'no-store','Vary':'Cookie','Referrer-Policy':'no-referrer',
          'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}})};
      });}catch{return unavailable();}
    },
    async remove(value,{writeSettled=false,authorize,signal}={}){
      if(enabled!==true)return unavailable();
      let record;try{record=storedRecord(value);if(writeSettled!==true||typeof authorize!=='function')throw fail();}catch{return {state:'not_started'};}
      let dispatched=false;
      try{return await boundedRun(signal,timeoutMs,async ctx=>{
        // Must read the durable irreversible cleanup state, no active pointer,
        // and no unsettled writer. Never authorize from a browser boolean.
        if(await authorize(record)!==true)throw fail();ctx.check();
        dispatched=true;
        const response=await send(ctx,BUCKET,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[record.key]})});
        if(response.status!==200){cancel(response.body);throw fail();}
        const deleted=await json(ctx,response);ctx.check();
        if(!Array.isArray(deleted)||deleted.length!==1||deleted.some(row=>row?.name!==record.key||row.id!==record.providerId))throw fail();
        const absent=await send(ctx,BUCKET+'/'+record.key,{method:'GET'});
        const absence=await json(ctx,absent);ctx.check();
        // Only the documented exact-object missing code is absence evidence;
        // HTML 404, NoSuchBucket, access refusal and generic errors are not.
        if(absent.status!==404||absence?.code!=='NoSuchKey')throw fail();
        return {state:'deleted',writeSettled:true,receipt:record};
      });}catch{return {state:dispatched?'unknown':'not_started'};}
    },
  });
}
