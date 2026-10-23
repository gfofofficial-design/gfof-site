// Future member-page transport. Not imported or mounted by the tab-only preview.
// No tokens, actor selectors, storage, retries, OAuth or automatic startup reads.
import {validateProfileInput,ownProfile,directoryPage,profileDirectoryOptions,profileRecord} from './fed-alliance-profile-contract.mjs';
import {profileRevisionRequest,profileRevisionSnapshot,profileRevisionResult} from './fed-alliance-profile-revision-contract.mjs';
const MESSAGES={closed:'Member profiles are not available yet.',busy:'Finish or cancel the current profile request first.',checking:'Checking your member profile…',saving:'Saving your member profile…',removing:'Removing your member profile…',directory:'Loading listed members…',ready:'Your member profile is ready.',empty:'You have not created a member profile.',saved:'Your member profile was saved.',removed:'Your member profile was removed.',listed:'The member directory is ready.',sign_in_required:'Sign in again before using your member profile.',unavailable:'Your profile could not be confirmed.',unknown:'The save or removal may have completed. Read your profile again; further changes are paused.',review_pending:'Your profile changes are held for review. Further changes are paused.',review_required:'Your profile was read, but the earlier change is still uncertain. Further changes remain paused.',cancelled:'Profile request cancelled.',invalid:'Check your profile fields.'};
const error=code=>Object.assign(new Error(MESSAGES[code]??MESSAGES.unavailable),{code});
MESSAGES.removal_unavailable='Profile removal is not available through this form yet. No removal was started.';
Object.assign(MESSAGES,{read_required:'Read your current profile before saving.',conflict:'Your profile changed since this draft began. Your draft is kept; read the current profile to compare.',comparison_ready:'Current profile loaded for comparison. Your draft is kept. Confirm this version before making another change.',current_accepted:'Current version confirmed. Your draft is kept; nothing has been saved.'});
export function createMemberProfileClient({enabled=false,profileRevisions=false,origin,fetcher=globalThis.fetch,onState=()=>{},timeoutMs=19000,newOperationId=()=>globalThis.crypto.randomUUID()}={}){
  if(typeof profileRevisions!=='boolean')throw error('invalid');
  if(enabled===true&&(typeof origin!=='string'||!/^https:\/\/(?:galacticfederation\.co|deploy-preview-[1-9][0-9]*--gfof\.netlify\.app)$/.test(origin)))throw error('closed');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>19000)throw error('invalid');
  let epoch=0,pending=null,disposed=false,uncertain=false,reviewPending=false,needsComparison=false,baseline=null,comparison=null,lastIntention=null;
  const emit=(status,data={})=>{if(!disposed){try{onState(Object.freeze({status,message:MESSAGES[status]??MESSAGES.unavailable,...data}));}catch{}}};
  function cancel(){
    epoch++;const old=pending;pending=null;
    if(old){if(old.write){uncertain=true;comparison=null;}old.controller.abort();emit(old.write?'unknown':'cancelled');}
  }
  async function run(kind,path,method,body,decode){
    if(disposed||enabled!==true){emit('closed');throw error('closed');}
    if(pending)throw error('busy');
    const write=method!=='GET';if(write&&uncertain){emit('unknown');throw error('unknown');}
    if(write&&reviewPending){emit('review_pending');throw error('review_pending');}
    if(write&&needsComparison){emit('conflict');throw error('conflict');}
    if(profileRevisions&&kind==='checking')comparison=null;
    if(profileRevisions&&write)lastIntention={operationId:body.operationId,revision:body.revision};
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
        if(!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||'')||!response.body)throw error(write?'unknown':'unavailable');
        reader=response.body.getReader();const chunks=[];let bytes=0;
        for(;;){const part=await reader.read();controller.signal.throwIfAborted();if(part.done)break;bytes+=part.value.byteLength;if(bytes>32768)throw error(write?'unknown':'unavailable');chunks.push(part.value);}
        const bytesOut=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){bytesOut.set(chunk,offset);offset+=chunk.byteLength;}
        const data=JSON.parse(new TextDecoder().decode(bytesOut));
        if(!response.ok){
          if(profileRevisions&&write&&response.status===409){const result=profileRevisionResult(data);if(result.state!=='conflict')throw error('unknown');return result;}
          // Only the explicit no-mutation refusal is a known review hold.
          if(write&&response.status===503&&profileRecord(data)&&!Object.hasOwn(data,'mutation')&&profileRecord(data.error)&&data.error.code==='profile_changes_paused')throw error('review_pending');
          throw error(write?'unknown':'unavailable');
        }
        return decode(data);
      })(),aborted]);
      if(sequence!==epoch||disposed||controller.signal.aborted)throw error(write?'unknown':'cancelled');
      if(profileRevisions&&(kind==='checking'||kind==='saving')){
        let status;
        if(kind==='saving'&&result.state==='conflict'){needsComparison=true;comparison=null;status='conflict';}
        else if(kind==='checking'&&(uncertain||needsComparison)){comparison=structuredClone(result);status='comparison_ready';}
        else{baseline={profile:result.profile,revision:result.revision};if(kind==='saving')lastIntention=null;status=kind==='saving'?'saved':result.profile?'ready':'empty';}
        emit(status,result);return result;
      }
      // A later read cannot prove an uncertain earlier server mutation stopped.
      // Keep uncertainty paused for this client instance. A known durable hold
      // can clear on an explicit read after independent owner review.
      if(kind==='checking'||kind==='saving')reviewPending=result.writeState==='review_required';
      const status=uncertain&&(kind==='checking')?'review_required':reviewPending&&(kind==='checking'||kind==='saving')?'review_pending':kind==='checking'?(result.profile?'ready':'empty'):kind==='saving'?'saved':kind==='removing'?'removed':'listed';emit(status,result);return result;
    }catch(reason){
      const code=reason?.code==='sign_in_required'?'sign_in_required':write&&reason?.code==='review_pending'?'review_pending':write?'unknown':controller.signal.aborted||reason?.code==='cancelled'?'cancelled':'unavailable';
      if(write&&code==='unknown'){uncertain=true;comparison=null;}
      if(code==='review_pending')reviewPending=true;
      if(sequence===epoch&&!disposed)emit(code);throw error(code);
    }finally{
      clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);controller.abort();
      try{if(reader)void reader.cancel().catch(()=>{});else void responseBody?.cancel().catch(()=>{});}catch{}
      if(pending?.sequence===sequence)pending=null;
    }
  }
  function profileBody(data){if(!profileRecord(data)||!Object.hasOwn(data,'profile')||!Object.hasOwn(data,'writeState')||!['available','review_required'].includes(data.writeState))throw error('unavailable');return {profile:ownProfile(data.profile),writeState:data.writeState};}
  return Object.freeze({
    load:()=>run('checking','/me','GET',undefined,profileRevisions?profileRevisionSnapshot:profileBody),
    compare(){
      if(disposed||enabled!==true||!profileRevisions)throw error('closed');if(pending)throw error('busy');
      needsComparison=true;return run('checking','/me','GET',undefined,profileRevisionSnapshot);
    },
    save(input){
      const fields=validateProfileInput(input);
      if(!profileRevisions)return run('saving','/me','POST',fields,data=>{const result=profileBody(data);if(!result.profile)throw error('unknown');return result;});
      if(disposed||enabled!==true){emit('closed');throw error('closed');}
      if(!baseline){emit('read_required');throw error('read_required');}
      const request=profileRevisionRequest({operationId:newOperationId(),revision:baseline.revision,profile:fields});
      return run('saving','/me','POST',request,data=>{const result=profileRevisionResult(data);if(result.state==='conflict'||result.operationId!==request.operationId||result.revision!==request.revision+1)throw error('unknown');return result;});
    },
    acceptCurrent(revision){
      if(disposed||enabled!==true||!profileRevisions)throw error('closed');if(pending)throw error('busy');
      if(!comparison||comparison.revision!==revision)throw error('read_required');
      baseline=structuredClone(comparison);comparison=null;uncertain=false;needsComparison=false;lastIntention=null;
      const result=structuredClone(baseline);emit('current_accepted',result);return result;
    },
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
    unconfirmedSave:()=>!disposed&&profileRevisions&&uncertain&&lastIntention?{...lastIntention}:null,
    dispose(){cancel();disposed=true;lastIntention=null;},
  });
}
