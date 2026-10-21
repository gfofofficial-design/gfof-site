// Closed by default. The signing capability is injected; no key/env lookup,
// network route, storage installation, retry or permission to serve an image.
import {createPublicKey,verify} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {deletionRecord,deletionWitnessBytes} from './deletion-journal.mjs';
const ZERO='0'.repeat(64),HASH=/^[0-9a-f]{64}$/;
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const hash=v=>typeof v==='string'&&HASH.test(v);
const fail=()=>Error('alliance_journal_witness_unavailable');
function point(v){
  if(!exact(v,['sequence','sha256'])||!Number.isSafeInteger(v.sequence)||v.sequence<0||v.sequence>256||!hash(v.sha256)||v.sequence===0&&v.sha256!==ZERO)throw fail();
  return {sequence:v.sequence,sha256:v.sha256};
}
export function createJournalWitness({enabled=false,projectRef,epoch,verificationKey,minimum,store,signBytes,timeoutMs=3500}={}){
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>3500)throw fail();
  let publicKey,floor;
  if(enabled===true){
    if(typeof projectRef!=='string'||!/^[a-z0-9]{20}$/.test(projectRef)||typeof epoch!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(epoch)||!hash(verificationKey)||typeof store?.tip!=='function'||typeof store?.records!=='function'||typeof signBytes!=='function')throw fail();
    floor=point(minimum);
    try{publicKey=createPublicKey({format:'jwk',key:{kty:'OKP',crv:'Ed25519',x:Buffer.from(verificationKey,'hex').toString('base64url')}});}catch{throw fail();}
  }
  function tip(v){
    if(!exact(v,['projectRef','epoch','sequence','sha256','enabled'])||v.projectRef!==projectRef||v.epoch!==epoch||typeof v.enabled!=='boolean')throw fail();
    return point({sequence:v.sequence,sha256:v.sha256});
  }
  function history(rows,end){
    if(!Array.isArray(rows)||rows.length!==end.sequence||rows.length>256||Buffer.byteLength(JSON.stringify(rows))>262144)throw fail();
    let previous=ZERO;const ids=new Set();
    for(let i=0;i<rows.length;i++){
      const r=rows[i];
      if(!exact(r,['format','projectRef','epoch','sequence','previous','event','sha256'])||r.format!==1||r.projectRef!==projectRef||r.epoch!==epoch||r.sequence!==i+1||r.previous!==previous||!hash(r.sha256))throw fail();
      const copy=deletionRecord({projectRef,epoch,sequence:r.sequence,previous:r.previous,event:r.event});
      if(copy.sha256!==r.sha256||ids.has(copy.event.id)||copy.sequence===floor.sequence&&copy.sha256!==floor.sha256)throw fail();
      ids.add(copy.event.id);previous=copy.sha256;
    }
    if(previous!==end.sha256)throw fail();
  }
  let closed=false,active=false,faulted=false,controller;
  return Object.freeze({
    async issue(input,{signal}={}){
      if(enabled!==true||closed||faulted)return {state:'unavailable'};
      if(!exact(input,['challenge'])||!hash(input.challenge))return {state:'invalid'};
      const challenge=input.challenge;
      if(signal?.aborted)return {state:'cancelled'};
      if(active)return {state:'busy'};
      active=true;const c=new AbortController(),started=performance.now();controller=c;
      const abort=()=>c.abort();let onAbort;
      signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});});
      const timer=setTimeout(abort,timeoutMs);
      const check=()=>{if(closed||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
      const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn();}),stopped]);
      try{
        const current=tip(await phase(()=>store.tip({signal:c.signal})));check();
        if(current.sequence<floor.sequence||current.sequence===floor.sequence&&current.sha256!==floor.sha256)throw fail();
        // Complete history proves that this tip extends the configured/observed
        // floor. A tip alone cannot establish continuity at a higher sequence.
        history(await phase(()=>store.records({...current},{signal:c.signal})),current);check();
        floor={...current}; // Retain observation even if signing/final read fails.
        const anchor={format:1,projectRef,epoch,...current,challenge,issuedAt:new Date().toISOString()},message=deletionWitnessBytes(anchor);
        const raw=await phase(()=>signBytes(Buffer.from(message),{signal:c.signal}));check();
        if(!(raw instanceof Uint8Array)||raw.byteLength!==64)throw fail();
        const signature=Buffer.from(raw);
        if(!verify(null,message,publicKey,signature))throw fail();
        const final=tip(await phase(()=>store.tip({signal:c.signal})));check();
        if(final.sequence!==current.sequence||final.sha256!==current.sha256)throw fail();
        const age=Date.now()-Date.parse(anchor.issuedAt);if(age< -1000||age>=30000)throw fail();
        return {state:'signed',bytes:Buffer.from(JSON.stringify({anchor,signature:signature.toString('hex')}))};
      }catch{
        // Unknown/late signer completion cannot overlap another attempt through
        // this instance. Reconciliation and a new instance are explicit decisions.
        faulted=true;return {state:'unavailable'};
      }finally{
        clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();active=false;controller=undefined;
      }
    },close(){closed=true;controller?.abort();}
  });
}
