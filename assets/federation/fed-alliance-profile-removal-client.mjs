// Unmounted profile-only removal transport. No Auth erasure, startup call,
// storage, actor selector, credentials, retry or automatic reconciliation.
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const version=v=>Number.isSafeInteger(v)&&v>=0&&v<Number.MAX_SAFE_INTEGER;
const messages={closed:'Profile removal is not available.',confirmation_required:'Confirm removal of your Alliance profile and image access. Your sign-in account and retained backups are not erased.',ready:'Review profile removal before confirming.',removing:'Removing your Alliance profile…',removed:'Your Alliance profile was removed. Your sign-in account and retained backups were not erased.',unknown:'Removal may have completed. Keep this page open and explicitly check the same request; no automatic retry will occur.',removal_pending:'Removal is pending. Explicitly check the same request; no automatic retry will occur.',sign_in_required:'Sign in again before checking the same removal request.',unavailable:'Removal could not be confirmed. The same request is retained.',busy:'Wait for or cancel the current request.'};
const fail=code=>Object.assign(Error(messages[code]),{code});
export function createProfileRemovalClient({enabled=false,origin,fetcher=globalThis.fetch,onState=()=>{},newOperationId=()=>globalThis.crypto.randomUUID(),timeoutMs=35000}={}){
 if(typeof enabled!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>35000)throw fail('closed');
 if(enabled&&(!/^https:\/\/(?:galacticfederation\.co|deploy-preview-[1-9][0-9]*--gfof\.netlify\.app)$/.test(origin)||typeof fetcher!=='function'||typeof newOperationId!=='function'))throw fail('closed');
 let disposed=false,pending=null,intention=null,committed=false,sequence=0;
 const emit=status=>{if(!disposed)try{onState(Object.freeze({status,message:messages[status]}));}catch{}};
 const available=()=>{if(disposed||!enabled)throw fail('closed');if(pending)throw fail('busy');};
 async function dispatch(){
  available();if(!intention||committed)throw fail('confirmation_required');
  const request={...intention},controller=new AbortController(),id=++sequence;pending={controller,id};emit('removing');
  let reader,response,onAbort;const aborted=new Promise((_,reject)=>{onAbort=()=>reject(fail('unknown'));controller.signal.addEventListener('abort',onAbort,{once:true});});
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  const check=()=>{if(disposed||sequence!==id||controller.signal.aborted)throw fail('unknown');};
  try{
   const value=await Promise.race([(async()=>{
    check();response=await fetcher(origin+'/api/alliance-members/me/profile',{method:'DELETE',credentials:'same-origin',redirect:'error',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(request)});
    check();if(response.status===401)throw fail('sign_in_required');
    if(response.status!==200||!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||'')||!response.body)throw fail('unknown');
    reader=response.body.getReader();const chunks=[];let size=0;
    for(;;){const part=await reader.read();check();if(part.done)break;if(!(part.value instanceof Uint8Array)||(size+=part.value.byteLength)>1024)throw fail('unknown');chunks.push(part.value);}
    const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}const data=JSON.parse(new TextDecoder().decode(bytes));
    if(exact(data,['state','version'])&&data.state==='committed'&&data.version===request.version+1)return data;
    if(exact(data,['state'])&&['unknown','removal_pending','sign_in_required','busy','unavailable','request_ended','account_unavailable'].includes(data.state))return data;
    throw fail('unknown');
   })(),aborted]);
   check();if(value.state==='committed'){committed=true;emit('removed');return Object.freeze({...value});}
   const status=['removal_pending','sign_in_required','unknown'].includes(value.state)?value.state:'unavailable';emit(status);return Object.freeze({state:status});
  }catch(e){const status=e?.code==='sign_in_required'?'sign_in_required':'unknown';if(!disposed&&sequence===id)emit(status);return Object.freeze({state:status});}
  finally{clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);controller.abort();try{void Promise.resolve(reader?reader.cancel():response?.body?.cancel()).catch(()=>{});}catch{}if(pending?.id===id)pending=null;}
 }
 return Object.freeze({
  // Host supplies a freshly authorized REMOVAL version, never profile edit revision.
  // No operation is created before the explicit confirmation action.
  confirm(input){available();if(intention||committed||!exact(input,['version','confirm'])||!version(input.version)||input.confirm!=='remove_my_profile')throw fail('confirmation_required');const operationId=newOperationId();if(!uuid(operationId))throw fail('confirmation_required');intention=Object.freeze({operationId,version:input.version,confirm:'remove_my_profile'});return dispatch();},
  reconcile(){return dispatch();},
  pendingOperation:()=>!disposed&&intention&&!committed?{operationId:intention.operationId,version:intention.version}:null,
  cancel(){if(pending){sequence++;pending.controller.abort();pending=null;emit('unknown');}},
  dispose(){if(disposed)return;disposed=true;sequence++;pending?.controller.abort();pending=null;intention=null;},
 });
}
