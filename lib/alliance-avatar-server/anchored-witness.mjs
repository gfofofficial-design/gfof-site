// Default closed. Live anchor is a lower bound, never serving/Auth permission.
import {performance} from 'node:perf_hooks';
import {createJournalWitness} from './journal-witness.mjs';
import {removalAnchor,removalChain} from './removal-anchor.mjs';
import {controlPoint,controlRef as ref,controlUuid as uuid,controlHash as hash,controlExact as exact,controlFailure as fail} from './control-policy.mjs';
export function createAnchoredJournalWitness({enabled=false,projectRef,journalProjectRef,epoch,minimum,anchorStore,store,verificationKey,signBytes,timeoutMs=8000}={}){
 const scope={memberProjectRef:projectRef,journalProjectRef,epoch};let floor;
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>8000)throw fail();
 if(enabled===true){if(!ref(projectRef)||!ref(journalProjectRef)||projectRef===journalProjectRef||!uuid(epoch)||typeof anchorStore?.read!=='function'||typeof store?.tip!=='function'||typeof store?.records!=='function')throw fail();floor=controlPoint(minimum);}
 let active=false,closed=false,faulted=false,controller,current;
 const witness=createJournalWitness({enabled,projectRef,epoch,minimum,verificationKey,signBytes,store:{
  async tip(options){const v=await store.tip(options);if(v.sequence<current.sequence||v.sequence===current.sequence&&v.sha256!==current.sha256)throw fail();return v;},
  async records(through,options){const rows=await store.records(through,options);return removalChain(rows,through,scope,controlPoint({sequence:current.sequence,sha256:current.sha256}));}
 }});
 return Object.freeze({async issue(input,{signal}={}){
  if(enabled!==true||closed||faulted||signal?.aborted)return {state:'unavailable'};if(active)return {state:'busy'};active=true;
  if(!exact(input,['challenge'])||!hash(input.challenge)){active=false;return {state:'invalid'};}
  const c=new AbortController(),abort=()=>c.abort(),started=performance.now();let onAbort;controller=c;signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
  const check=()=>{if(closed||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
  const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn();}),stopped]);
  try{
   current=removalAnchor(await phase(()=>anchorStore.read({signal:c.signal})),scope);check();
   if(current.sequence<floor.sequence||current.sequence===floor.sequence&&current.sha256!==floor.sha256)throw fail();
   // The underlying witness also verifies its configured/observed floor prefix.
   const result=await phase(()=>witness.issue(input,{signal:c.signal}));check();if(result?.state!=='signed')throw fail();
   const after=removalAnchor(await phase(()=>anchorStore.read({signal:c.signal})),scope);check();
   if(after.sequence!==current.sequence||after.sha256!==current.sha256)throw fail();floor=controlPoint({sequence:after.sequence,sha256:after.sha256});return result;
  }catch{faulted=true;return {state:'unavailable'};}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();controller=undefined;active=false;}
 },close(){closed=true;controller?.abort();witness.close();}});
}
