import {pathToFileURL} from 'node:url';
const TARGETS=Object.freeze([
 {id:'command',url:'https://galacticfederation.co/',relativeDeck:true},
 {id:'dossier',url:'https://dossiertrack.co/'},
 {id:'fcc',url:'https://fcc.galacticfederation.co/'}
]);
const DECK='https://galacticfederation.co/command-deck';
export async function checkFederationPages({fetcher=fetch,timeoutMs=10000,now=Date.now}={}){
 if(typeof fetcher!=='function'||typeof now!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)throw Error('Invalid checker options');
 const checkedAt=now();if(!Number.isSafeInteger(checkedAt)||checkedAt<0)throw Error('Invalid clock');
 const results=await Promise.all(TARGETS.map(async target=>{
  const controller=new AbortController();let reader,status=null;
  let onAbort;const aborted=new Promise((_,reject)=>{onAbort=()=>reject(Object.assign(Error('timeout'),{name:'AbortError'}));controller.signal.addEventListener('abort',onAbort,{once:true});});
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  let reason='unavailable',dashboardLink=false;
  try{await Promise.race([(async()=>{
   const response=await fetcher(target.url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal:controller.signal});
   controller.signal.throwIfAborted();status=response.status;
   if(status!==200){reason='unexpected_status';return;}
   if(!/^text\/html(?:;|$)/i.test(response.headers.get('content-type')||'')){reason='unexpected_content_type';return;}
   if(!response.body){reason='missing_body';return;}
   reader=response.body.getReader();let bytes=0;const chunks=[];
   for(;;){const part=await reader.read();controller.signal.throwIfAborted();if(part.done)break;bytes+=part.value.byteLength;if(bytes>1048576){reason='response_too_large';return;}chunks.push(Buffer.from(part.value));}
   const html=Buffer.concat(chunks).toString('utf8');
   const hrefs=[...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1]);
   dashboardLink=hrefs.some(h=>h===DECK||(target.relativeDeck&&h==='/command-deck'));
   reason=dashboardLink?'ok':'dashboard_link_missing';
  })(),aborted]);}catch(error){if(error?.name==='AbortError')reason='timeout';}
  finally{clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);controller.abort();try{if(reader)Promise.resolve(reader.cancel()).catch(()=>{});}catch{}}
  return {id:target.id,url:target.url,status,dashboardLink,reason,healthy:reason==='ok'};
 }));
 return {schema:1,checkedAt:new Date(checkedAt).toISOString(),scope:'public_homepage_availability_and_command_deck_links',
  healthy:results.every(r=>r.healthy),securityVerdict:'not_assessed',accountAcceptance:'not_assessed',results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2){process.stderr.write('Usage: node scripts/check-federation-pages.mjs\n');process.exitCode=2;}
 else{const result=await checkFederationPages();process.stdout.write(JSON.stringify(result,null,2)+'\n');process.exitCode=result.healthy?0:1;}
}
