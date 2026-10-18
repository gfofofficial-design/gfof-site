// Disabled, read-only protocol candidate. No journal storage/writer, signing key,
// network endpoint, environment, database, retry or permission to reopen service.
import {createHash,createPublicKey,randomBytes,verify} from 'node:crypto';
import {performance} from 'node:perf_hooks';
const ZERO='0'.repeat(64),MAX=256,BYTES=262144;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HASH=/^[0-9a-f]{64}$/;
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const fail=()=>Error('avatar_deletion_journal_unavailable');
const hash=v=>typeof v==='string'&&HASH.test(v);
const uuid=v=>typeof v==='string'&&UUID.test(v);
const ref=v=>typeof v==='string'&&/^[a-z0-9]{20}$/.test(v);
const sequence=v=>Number.isSafeInteger(v)&&v>=0&&v<=MAX;
const date=v=>typeof v==='string'&&v.length===24&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v&&Date.parse(v)>=0;
function payload(value){
  if(!exact(value,['projectRef','epoch','sequence','previous','event'])||!ref(value.projectRef)||!uuid(value.epoch)||!sequence(value.sequence)||value.sequence<1||!hash(value.previous))throw fail();
  const e=value.event;
  if(!exact(e,['id','kind','profileId','objectId'])||!uuid(e.id)||!uuid(e.profileId)||!['profile_remove_requested','image_remove_requested'].includes(e.kind)||
    (e.kind==='profile_remove_requested'?e.objectId!==null:!uuid(e.objectId)))throw fail();
  return {projectRef:value.projectRef,epoch:value.epoch,sequence:value.sequence,previous:value.previous,
    event:{id:e.id,kind:e.kind,profileId:e.profileId,objectId:e.objectId}};
}
// Fixed ASCII field schema/order, not a general JSON canonicalization scheme.
export function deletionRecord(value){
  const p=payload(value),body={format:1,...p};
  return {...body,sha256:createHash('sha256').update('GF-ALLIANCE-DELETION-RECORD-V1\0'+JSON.stringify(body)).digest('hex')};
}
export function deletionWitnessBytes(value){
  if(!exact(value,['format','projectRef','epoch','sequence','sha256','challenge','issuedAt'])||value.format!==1||!ref(value.projectRef)||!uuid(value.epoch)||!sequence(value.sequence)||!hash(value.sha256)||!hash(value.challenge)||!date(value.issuedAt)||value.sequence===0&&value.sha256!==ZERO)throw fail();
  return Buffer.from('GF-ALLIANCE-DELETION-WITNESS-V1\0'+JSON.stringify({format:1,projectRef:value.projectRef,epoch:value.epoch,
    sequence:value.sequence,sha256:value.sha256,challenge:value.challenge,issuedAt:value.issuedAt}));
}
function parse(bytes,max){
  if(!(bytes instanceof Uint8Array)||bytes.byteLength>max)throw fail();
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(bytes)));
}
function records(value,anchor,floor){
  if(!Array.isArray(value)||value.length!==anchor.sequence)throw fail();
  let previous=ZERO;const ids=new Set(),profiles=new Set(),objects=new Set();
  for(let i=0;i<value.length;i++){
    const r=value[i];
    if(!exact(r,['format','projectRef','epoch','sequence','previous','event','sha256'])||r.format!==1||!hash(r.sha256))throw fail();
    const p=payload({projectRef:r.projectRef,epoch:r.epoch,sequence:r.sequence,previous:r.previous,event:r.event}),copy=deletionRecord(p);
    if(copy.projectRef!==anchor.projectRef||copy.epoch!==anchor.epoch||copy.sequence!==i+1||copy.previous!==previous||copy.sha256!==r.sha256||ids.has(copy.event.id))throw fail();
    if(copy.sequence===floor.sequence&&copy.sha256!==floor.sha256)throw fail();
    ids.add(copy.event.id);previous=copy.sha256;
    if(copy.event.kind==='profile_remove_requested')profiles.add(copy.event.profileId);else objects.add(copy.event.objectId);
  }
  if(previous!==anchor.sha256)throw fail();return {profiles,objects};
}
export function createAvatarDeletionJournal({enabled=false,projectRef,epoch,verificationKey,minimum,readWitness,readRecords,timeoutMs=8000}={}){
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>8000)throw fail();
  let publicKey,floor;
  if(enabled===true){
    if(!ref(projectRef)||!uuid(epoch)||!hash(verificationKey)||!exact(minimum,['sequence','sha256'])||!sequence(minimum.sequence)||!hash(minimum.sha256)||minimum.sequence===0&&minimum.sha256!==ZERO||typeof readWitness!=='function'||typeof readRecords!=='function')throw fail();
    try{publicKey=createPublicKey({format:'jwk',key:{kty:'OKP',crv:'Ed25519',x:Buffer.from(verificationKey,'hex').toString('base64url')}});}catch{throw fail();}
    floor={sequence:minimum.sequence,sha256:minimum.sha256};
  }
  let active=false,closed=false,faulted=false,generation=0;const controllers=new Set();
  return Object.freeze({
    async review({signal}={}){
      if(enabled!==true||closed||faulted)return {state:'unavailable'};
      if(signal?.aborted)return {state:'cancelled'};if(active)return {state:'busy'};
      let challenge;try{challenge=randomBytes(32).toString('hex');}catch{return {state:'unavailable'};}
      active=true;const mine=++generation,started=performance.now();
      const c=new AbortController(),abort=()=>c.abort();let onAbort;
      controllers.add(c);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});});
      const timer=setTimeout(abort,timeoutMs),check=()=>{if(c.signal.aborted||closed||generation!==mine)throw fail();};
      const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn();}),stopped]);
      try{
        const witness=parse(await phase(()=>readWitness({projectRef,epoch,challenge,signal:c.signal})),2048);check();
        if(!exact(witness,['anchor','signature'])||typeof witness.signature!=='string'||!/^[0-9a-f]{128}$/.test(witness.signature))throw fail();
        const a=witness.anchor,message=deletionWitnessBytes(a);
        if(a.projectRef!==projectRef||a.epoch!==epoch||a.challenge!==challenge||Date.now()-Date.parse(a.issuedAt)<-1000||Date.now()-Date.parse(a.issuedAt)>30000||!verify(null,message,publicKey,Buffer.from(witness.signature,'hex')))throw fail();
        // A signed rollback/fork is a trust fault, not a reason to try again.
        if(a.sequence<floor.sequence||a.sequence===floor.sequence&&a.sha256!==floor.sha256){faulted=true;throw fail();}
        const prior={...floor};floor={sequence:a.sequence,sha256:a.sha256};
        // Remember a newly witnessed tip even if its record fetch fails later.
        const anchor={format:1,projectRef,epoch,sequence:a.sequence,sha256:a.sha256,challenge,issuedAt:a.issuedAt};
        const raw=await phase(()=>readRecords({projectRef,epoch,through:anchor.sequence,sha256:anchor.sha256,maxBytes:BYTES,signal:c.signal}));check();
        const denied=records(parse(raw,BYTES),anchor,prior),issued=Date.parse(anchor.issuedAt);let ended=false;
        const alive=()=>{
          const valid=!ended&&!closed&&!faulted&&generation===mine&&performance.now()-started<30000&&Date.now()-issued>=-1000&&Date.now()-issued<30000;
          if(!valid){ended=true;denied.profiles.clear();denied.objects.clear();}return valid;
        };
        if(!alive())throw fail();
        return Object.freeze({get state(){return !ended&&alive()?'verified_evidence':'unavailable';},
          check(value){
            if(ended||!alive())return {state:'unavailable'};
            if(!exact(value,['profileId','objectId'])||!uuid(value.profileId)||!uuid(value.objectId))return {state:'invalid'};
            if(denied.profiles.has(value.profileId))return {state:'blocked',scope:'profile'};
            if(denied.objects.has(value.objectId))return {state:'blocked',scope:'image'};
            return {state:'not_listed'}; // Never an authorization or erasure proof.
          },close(){ended=true;denied.profiles.clear();denied.objects.clear();}});
      }catch{return {state:'unavailable'};}
      finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();controllers.delete(c);active=false;}
    },close(){closed=true;generation++;for(const c of controllers)c.abort();}
  });
}
