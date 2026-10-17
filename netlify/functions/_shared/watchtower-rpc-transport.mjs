import {base58Bytes} from '../../../lib/watchtower-batch-core.mjs';
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
function permitted(request){
 if(!exact(request,['jsonrpc','id','method','params'])||request.jsonrpc!=='2.0'||!Array.isArray(request.params)||request.params.length!==2)return false;
 const [target,config]=request.params;
 if(request.method==='getTransaction')return request.id===1&&base58Bytes(target,64)&&exact(config,['commitment','encoding','maxSupportedTransactionVersion'])&&config.commitment==='finalized'&&config.encoding==='json'&&config.maxSupportedTransactionVersion===0;
 if(request.method==='getMultipleAccounts')return request.id===2&&Array.isArray(target)&&target.length>=1&&target.length<=20&&
  new Set(target).size===target.length&&target.every(a=>base58Bytes(a,32))&&exact(config,['commitment','encoding','minContextSlot'])&&
  config.commitment==='finalized'&&config.encoding==='base64'&&Number.isSafeInteger(config.minContextSlot)&&config.minContextSlot>0;
 return false;
}
export function createWatchtowerRpcTransport({enabled=false,apiKey,fetcher=fetch,timeoutMs=8000}={}){
 if(typeof enabled!=='boolean'||typeof fetcher!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>8000)throw Error('Invalid RPC transport configuration');
 const configured=typeof apiKey==='string'&&apiKey.length>=16&&apiKey.length<=512&&/^[!-~]+$/.test(apiKey);
 // Fixed provider origin; no arbitrary endpoint or caller query parameters.
 const endpoint=configured?new URL('https://mainnet.helius-rpc.com/'):null;
 if(endpoint)endpoint.searchParams.set('api-key',apiKey);
 return async(request,{signal}={})=>{
  if(!enabled||!configured)throw Error('RPC transport disabled');
  if(!permitted(request)||(signal!==undefined&&!(signal instanceof AbortSignal)))throw Error('RPC request refused');
  if(signal?.aborted)throw Error('RPC unavailable');
  const expectedId=request.id,body=JSON.stringify(request),controller=new AbortController();let timer,reader;
  const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  const stopped=new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Error('deadline')),{once:true}));
  timer=setTimeout(abort,timeoutMs);
  try{
   const work=(async()=>{
    controller.signal.throwIfAborted();
    const response=await fetcher(endpoint.href,{method:'POST',headers:{'content-type':'application/json'},body,redirect:'error',credentials:'omit',cache:'no-store',signal:controller.signal});
    controller.signal.throwIfAborted();
    if(!response.ok||response.redirected||!response.body||!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||''))throw Error('provider');
    reader=response.body.getReader();const chunks=[];let bytes=0;
    for(;;){const part=await reader.read();controller.signal.throwIfAborted();if(part.done)break;bytes+=part.value.byteLength;if(bytes>1048576)throw Error('limit');chunks.push(Buffer.from(part.value));}
    const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
    if(!value||value.jsonrpc!=='2.0'||value.id!==expectedId||Object.hasOwn(value,'error')||!Object.hasOwn(value,'result'))throw Error('provider');
    // Do not return arbitrary top-level provider fields.
    return {jsonrpc:'2.0',id:expectedId,result:value.result};
   })();
   return await Promise.race([work,stopped]);
  }catch{throw Error('RPC unavailable');}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.abort();try{if(reader)Promise.resolve(reader.cancel()).catch(()=>{});}catch{}}
 };
}
