import {pathToFileURL} from 'node:url';
import {TOOL_PAGE_TARGETS,TOOL_PAGE_SCOPE} from '../lib/tool-page-brief-core.mjs';
const MAX_BYTES=1048576;
function pageTitle(html){
 const title=html.match(/<title\b[^>]*>([^<]*)<\/title\s*>/i)?.[1];
 if(typeof title!=='string')return null;
 return title.replace(/&(?:amp|apos|quot|#39|#x27);/gi,value=>({
  '&amp;':'&','&apos;':"'",'&quot;':'"','&#39;':"'",'&#x27;':"'"
 }[value.toLowerCase()])).replace(/\s+/g,' ').trim();
}
export async function checkFederationTools({fetcher=fetch,timeoutMs=10000,now=Date.now}={}){
 if(typeof fetcher!=='function'||typeof now!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw Error('Invalid tool-page checker options');
 const checkedAt=now();if(!Number.isSafeInteger(checkedAt)||checkedAt<0||!Number.isFinite(new Date(checkedAt).getTime()))throw Error('Invalid clock');
 const results=new Array(TOOL_PAGE_TARGETS.length);let next=0;
 async function probe(target){
  const controller=new AbortController();let response,reader,onAbort,status=null,titleMatches=false,reason='unavailable';
  function cancelBody(){try{if(response?.body)Promise.resolve(response.body.cancel()).catch(()=>{});}catch{}}
  const aborted=new Promise((_,reject)=>{onAbort=()=>reject(Object.assign(Error('timeout'),{name:'AbortError'}));controller.signal.addEventListener('abort',onAbort,{once:true});});
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{await Promise.race([(async()=>{
   response=await fetcher(target.url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal:controller.signal});
   if(controller.signal.aborted)cancelBody();
   controller.signal.throwIfAborted();status=response.status;
   if(status!==200){reason='unexpected_status';return;}
   if(!/^text\/html(?:;|$)/i.test(response.headers.get('content-type')||'')){reason='unexpected_content_type';return;}
   if(!response.body){reason='missing_body';return;}
   reader=response.body.getReader();const chunks=[];let size=0;
   for(;;){const part=await reader.read();controller.signal.throwIfAborted();if(part.done)break;size+=part.value.byteLength;if(size>MAX_BYTES){reason='response_too_large';return;}chunks.push(Buffer.from(part.value));}
   let html;try{html=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));}catch{reason='unexpected_encoding';return;}
   titleMatches=pageTitle(html)===target.title;reason=titleMatches?'ok':'page_identity_missing';
  })(),aborted]);}catch(error){if(error?.name==='AbortError')reason='timeout';}
  finally{clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);controller.abort();try{if(reader)Promise.resolve(reader.cancel()).catch(()=>{});else cancelBody();}catch{}}
  return {id:target.id,site:target.site,url:target.url,status,titleMatches,reason,healthy:reason==='ok'};
 }
 async function worker(){while(next<TOOL_PAGE_TARGETS.length){const index=next++;results[index]=await probe(TOOL_PAGE_TARGETS[index]);}}
 // Two bounded probes at a time, with no retry. A transport that ignores abort
 // may outlive its probe; this cannot guarantee physical request cancellation.
 await Promise.all([worker(),worker()]);
 return {schema:1,checkedAt:new Date(checkedAt).toISOString(),scope:TOOL_PAGE_SCOPE,healthy:results.every(r=>r.healthy),securityVerdict:'not_assessed',accountAcceptance:'not_assessed',results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2){process.stderr.write('Usage: node scripts/check-federation-tools.mjs\n');process.exitCode=2;}
 else try{const result=await checkFederationTools();process.stdout.write(JSON.stringify(result,null,2)+'\n');process.exitCode=result.healthy?0:1;}
 catch{process.stderr.write('Tool-page check unavailable.\n');process.exitCode=2;}
}
