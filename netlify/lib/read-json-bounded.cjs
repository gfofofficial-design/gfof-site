'use strict';
// Bound response headers and streamed bytes independently of transport cancellation.
async function readJsonBounded(url,options,{timeoutMs,maxBytes,fetcher=fetch}){
 const controller=new AbortController();let reader,onAbort;
 const aborted=new Promise((_,reject)=>{onAbort=()=>reject(Object.assign(Error('Response unavailable'),{name:'AbortError'}));controller.signal.addEventListener('abort',onAbort,{once:true});});
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  return await Promise.race([(async()=>{
   const response=await fetcher(url,{...options,signal:controller.signal,redirect:'error'});
   controller.signal.throwIfAborted();
   if(!response.ok||!response.body)throw Error('Response unavailable');
   reader=response.body.getReader();const chunks=[];let size=0;
   for(;;){
    const {done,value}=await reader.read();controller.signal.throwIfAborted();
    if(done)break;
    size+=value.byteLength;if(size>maxBytes)throw Error('Response unavailable');
    chunks.push(Buffer.from(value));
   }
   return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  })(),aborted]);
 }finally{
  clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);controller.abort();
  try{if(reader)Promise.resolve(reader.cancel()).catch(()=>{});}catch{}
 }
}
module.exports={readJsonBounded};
