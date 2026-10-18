// Future member-page transport. Not imported or mounted by the tab-only preview.
// No tokens, actor selectors, storage, retries, OAuth or automatic startup reads.
import {validateProfileInput,ownProfile,directoryPage,profileDirectoryOptions,profileRecord} from './fed-alliance-profile-contract.mjs';
const MESSAGES={closed:'Member profiles are not available yet.',busy:'Finish or cancel the current profile request first.',checking:'Checking your member profile…',saving:'Saving your member profile…',removing:'Removing your member profile…',directory:'Loading listed members…',ready:'Your member profile is ready.',empty:'You have not created a member profile.',saved:'Your member profile was saved.',removed:'Your member profile was removed.',listed:'The member directory is ready.',sign_in_required:'Sign in again before using your member profile.',unavailable:'Your profile could not be confirmed.',unknown:'The save or removal may have completed. Read your profile again; further changes are paused.',review_required:'Your profile was read, but the earlier change is still uncertain. Further changes remain paused.',cancelled:'Profile request cancelled.',invalid:'Check your profile fields.'};
const error=code=>Object.assign(new Error(MESSAGES[code]??MESSAGES.unavailable),{code});
MESSAGES.removal_unavailable='Profile removal is not available through this form yet. No removal was started.';
export function createMemberProfileClient({enabled=false,origin,fetcher=globalThis.fetch,onState=()=>{},timeoutMs=19000}={}){
  if(enabled===true&&(typeof origin!=='string'||!/^https:\/\/(?:galacticfederation\.co|deploy-preview-[1-9][0-9]*--gfof\.netlify\.app)$/.test(origin)))throw error('closed');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>19000)throw error('invalid');
  let epoch=0,pending=null,disposed=false,uncertain=false;
  const emit=(status,data={})=>{if(!disposed){try{onState(Object.freeze({status,message:MESSAGES[status]??MESSAGES.unavailable,...data}));}catch{}}};
  function cancel(){
    epoch++;const old=pending;pending=null;
    if(old){if(old.write)uncertain=true;old.controller.abort();emit(old.write?'unknown':'cancelled');}
  }
  async function run(kind,path,method,body,decode){
    if(disposed||enabled!==true){emit('closed');throw error('closed');}
    if(pending)throw error('busy');
    const write=method!=='GET';if(write&&uncertain){emit('unknown');throw error('unknown');}
    const sequence=++epoch,controller=new AbortController();pending={sequence,controller,write};
    emit(kind);let reader,responseBody,onAbort;
    const aborted=new Promise((_,reject)=>{onAbort=()=>reject(error(write?'unknown':'cancelled'));controller.signal.addEventListener('abort',onAbort,{once:true});if(controller.signal.aborted)onAbort();});
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const result=await Promise.race([(async()=>{
        controller.signal.throwIfAborted();
        const response=await fetcher(origin+'/api/alliance-members'+path,{method,credentials:'same-origin',redirect:'error',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json',...(write?{'Content-Type':'application/json'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
        if(controller.signal.aborted){void response.body?.cancel().catch(()=>{});throw error(write?'unknown':'cancelled');}
        responseBody=response.body;
        controller.signal.throwIfAborted();
        if(response.status===401)throw error('sign_in_required');
        if(!response.ok)throw error(write?'unknown':'unavailable');
        if(!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||'')||!response.body)throw error(write?'unknown':'unavailable');
        reader=response.body.getReader();const chunks=[];let bytes=0;
        for(;;){const part=await reader.read();controller.signal.throwIfAborted();if(part.done)break;bytes+=part.value.byteLength;if(bytes>32768)throw error(write?'unknown':'unavailable');chunks.push(part.value);}
        const bytesOut=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){bytesOut.set(chunk,offset);offset+=chunk.byteLength;}
        return decode(JSON.parse(new TextDecoder().decode(bytesOut)));
      })(),aborted]);
      if(sequence!==epoch||disposed||controller.signal.aborted)throw error(write?'unknown':'cancelled');
      // A later read cannot prove an uncertain earlier server mutation stopped.
      // Keep writes paused for this client instance until durable reconciliation
      // exists; do not silently turn a fresh read into permission to retry.
      const status=kind==='checking'?(uncertain?'review_required':result.profile?'ready':'empty'):kind==='saving'?'saved':kind==='removing'?'removed':'listed';emit(status,result);return result;
    }catch(reason){
      const code=reason?.code==='sign_in_required'?'sign_in_required':write?'unknown':controller.signal.aborted||reason?.code==='cancelled'?'cancelled':'unavailable';
      if(write&&code==='unknown')uncertain=true;
      if(sequence===epoch&&!disposed)emit(code);throw error(code);
    }finally{
      clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);controller.abort();
      try{if(reader)void reader.cancel().catch(()=>{});else void responseBody?.cancel().catch(()=>{});}catch{}
      if(pending?.sequence===sequence)pending=null;
    }
  }
  function profileBody(data){if(!profileRecord(data)||!Object.hasOwn(data,'profile'))throw error('unavailable');return {profile:ownProfile(data.profile)};}
  return Object.freeze({
    load:()=>run('checking','/me','GET',undefined,profileBody),
    save(input){const fields=validateProfileInput(input);return run('saving','/me','POST',fields,data=>{const result=profileBody(data);if(!result.profile)throw error('unknown');return result;});},
    async remove(){
      if(disposed||enabled!==true){emit('closed');throw error('closed');}
      if(pending)throw error('busy');
      if(uncertain){emit('unknown');throw error('unknown');}
      // Only the future journal-first operation-ID/version flow can remove a
      // profile. Do not send the obsolete bearer/RPC deletion from this form.
      emit('removal_unavailable');throw error('removal_unavailable');
    },
    directory(options={}){const {after,limit}=profileDirectoryOptions(options);const query=new URLSearchParams({limit:String(limit)});if(after)query.set('after',after);return run('directory','/directory?'+query,'GET',undefined,data=>directoryPage(data,{after,limit}));},
    cancel,
    dispose(){cancel();disposed=true;},
  });
}
