// Disabled, unmounted startup interlock. The independent control authority is
// injected, NOT implemented or persisted here. No key, environment or network I/O.
import {createHash,createPublicKey,randomBytes,verify} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createAllianceRecoveryPair,recoveryInventory} from './recovery-pair.mjs';
import {communityCheckpoint,communityCheckpointSha256,createAllianceCommunityRecoveryReview} from './community-recovery.mjs';
import {feedbackCheckpoint,feedbackCheckpointSha256,createAllianceFeedbackRecoveryReview} from './feedback-recovery.mjs';
const HASH=/^[0-9a-f]{64}$/,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,ZERO='0'.repeat(64);
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const hash=v=>typeof v==='string'&&HASH.test(v),uuid=v=>typeof v==='string'&&UUID.test(v),ref=v=>typeof v==='string'&&/^[a-z0-9]{20}$/.test(v);
const date=v=>typeof v==='string'&&v.length===24&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v&&Date.parse(v)>=0;
const fail=()=>Error('alliance_startup_unavailable');
function point(v){if(!exact(v,['sequence','sha256'])||!Number.isSafeInteger(v.sequence)||v.sequence<0||v.sequence>256||!hash(v.sha256)||v.sequence===0&&v.sha256!==ZERO)throw fail();return {sequence:v.sequence,sha256:v.sha256};}
const samePoint=(a,b)=>a.sequence===b.sequence&&a.sha256===b.sha256;
function checkpoint(value){
  if(!exact(value,['format','memberProjectRef','journalProjectRef','epoch','freezeId','capturedAt','member','journal'])||value.format!==2||!ref(value.memberProjectRef)||!ref(value.journalProjectRef)||value.memberProjectRef===value.journalProjectRef||!uuid(value.epoch)||!uuid(value.freezeId)||!date(value.capturedAt))throw fail();
  const inventory=domain=>{const v=recoveryInventory(value[domain],domain);return {...v,tables:v.tables.map(t=>({table:t.table,rows:t.rows,sha256:t.sha256}))};};
  return {format:2,memberProjectRef:value.memberProjectRef,journalProjectRef:value.journalProjectRef,epoch:value.epoch,freezeId:value.freezeId,capturedAt:value.capturedAt,member:inventory('member'),journal:inventory('journal')};
}
export function startupCheckpointSha256(value){return createHash('sha256').update('GF-ALLIANCE-STARTUP-CHECKPOINT-V1\0'+JSON.stringify(checkpoint(value))).digest('hex');}
// Fixed schema/order with a separate signature domain; not arbitrary JSON signing.
export function startupDecisionBytes(value){
  if(!exact(value,['format','memberProjectRef','journalProjectRef','epoch','bootId','challenge','revision','state','freezeId','frozenAt','checkpointSha256','floor','issuedAt'])||value.format!==1||!ref(value.memberProjectRef)||!ref(value.journalProjectRef)||value.memberProjectRef===value.journalProjectRef||!uuid(value.epoch)||!hash(value.bootId)||!hash(value.challenge)||!Number.isSafeInteger(value.revision)||value.revision<1||!['review','serve','closed'].includes(value.state)||!uuid(value.freezeId)||!date(value.frozenAt)||!hash(value.checkpointSha256)||!date(value.issuedAt))throw fail();
  return Buffer.from('GF-ALLIANCE-STARTUP-DECISION-V1\0'+JSON.stringify({format:1,memberProjectRef:value.memberProjectRef,journalProjectRef:value.journalProjectRef,epoch:value.epoch,bootId:value.bootId,challenge:value.challenge,revision:value.revision,state:value.state,freezeId:value.freezeId,frozenAt:value.frozenAt,checkpointSha256:value.checkpointSha256,floor:point(value.floor),issuedAt:value.issuedAt}));
}
export function createAllianceStartupGate(options={}){return startupGate(options,false);}
export function createAllianceCommunityStartupGate(options={}){return startupGate(options,true);}
export function createAllianceFeedbackStartupGate(options={}){return startupGate(options,'feedback');}
function startupGate({enabled=false,memberProjectRef,journalProjectRef,epoch,verificationKey,minimumRevision,minimum,readDecision,ledger,journal,community,feedback,timeoutMs=25000,decisionTimeoutMs=3500}={},withCommunity){
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>25000||!Number.isInteger(decisionTimeoutMs)||decisionTimeoutMs<1||decisionTimeoutMs>3500)throw fail();
  let key,bootId,floor;
  if(enabled===true){
    if(!ref(memberProjectRef)||!ref(journalProjectRef)||memberProjectRef===journalProjectRef||!uuid(epoch)||!hash(verificationKey)||!Number.isSafeInteger(minimumRevision)||minimumRevision<1||typeof readDecision!=='function'||typeof ledger?.recoveryInventory!=='function'||!['recoveryInventory','records'].every(k=>typeof journal?.[k]==='function'))throw fail();
    floor=point(minimum);bootId=randomBytes(32).toString('hex');key=createPublicKey({format:'jwk',key:{kty:'OKP',crv:'Ed25519',x:Buffer.from(verificationKey,'hex').toString('base64url')}});
    if(withCommunity&&typeof community?.inventory!=='function'||withCommunity==='feedback'&&typeof feedback?.inventory!=='function')throw fail();
  }
  let closed=false,faulted=false,active=false,prepared,attempted=false,revision=minimumRevision,controller;
  const unavailable=()=>({state:'quarantine',access:'closed'});
  async function run(signal,ms,fn,fallback){
    if(enabled!==true||closed||faulted||signal?.aborted||active)return fallback;
    active=true;const c=new AbortController(),abort=()=>c.abort(),started=performance.now();let onAbort;controller=c;
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,ms);
    const check=()=>{if(closed||faulted||c.signal.aborted||performance.now()-started>=ms)throw fail();};
    const phase=fn=>Promise.race([Promise.resolve().then(()=>{check();return fn(c.signal);}),stopped]);
    try{const result=await fn({phase,check,abort,signal:c.signal});check();return result;}catch{faulted=true;prepared=undefined;return fallback;}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();controller=undefined;active=false;}
  }
  async function decision(context){
    const challenge=randomBytes(32).toString('hex'),started=performance.now();
    const timer=setTimeout(context.abort,decisionTimeoutMs);let raw;
    try{raw=await context.phase(signal=>readDecision({format:1,memberProjectRef,journalProjectRef,epoch,bootId,challenge},{signal}));context.check();}finally{clearTimeout(timer);}
    if(performance.now()-started>=decisionTimeoutMs||!(raw instanceof Uint8Array)||raw.byteLength>8192)throw fail();
    const envelope=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(raw)));
    if(!exact(envelope,['decision','signature'])||typeof envelope.signature!=='string'||!/^[0-9a-f]{128}$/.test(envelope.signature))throw fail();
    const d=envelope.decision,message=startupDecisionBytes(d),age=Date.now()-Date.parse(d.issuedAt);
    if(d.memberProjectRef!==memberProjectRef||d.journalProjectRef!==journalProjectRef||d.epoch!==epoch||d.bootId!==bootId||d.challenge!==challenge||age< -1000||age>=30000||!verify(null,message,key,Buffer.from(envelope.signature,'hex'))||d.revision<revision||d.floor.sequence<floor.sequence||d.floor.sequence===floor.sequence&&d.floor.sha256!==floor.sha256)throw fail();
    // Copy and retain an authenticated observation even when a later phase fails.
    revision=d.revision;floor=point(d.floor);
    if(d.state==='closed')throw fail();
    return {...d,floor:point(d.floor)};
  }
  const binding=d=>JSON.stringify({revision:d.revision,state:d.state,freezeId:d.freezeId,frozenAt:d.frozenAt,checkpointSha256:d.checkpointSha256,floor:d.floor});
  return Object.freeze({
    async prepare(input,{signal}={}){
      // Preparation is one-shot per boot. A failure requires explicit new startup,
      // never automatic repair, resetting a floor or retrying an unknown authority.
      if(enabled!==true||closed||faulted||attempted||active||signal?.aborted)return unavailable();
      attempted=true;
      return run(signal,timeoutMs,async context=>{
        const expected=withCommunity==='feedback'?feedbackCheckpoint(input):withCommunity?communityCheckpoint(input):checkpoint(input),digest=withCommunity==='feedback'?feedbackCheckpointSha256(expected):withCommunity?communityCheckpointSha256(expected):startupCheckpointSha256(expected),first=await decision(context);
        if(first.state!=='review'||first.checkpointSha256!==digest||first.freezeId!==expected.freezeId||!samePoint(first.floor,{sequence:expected.journal.sequence,sha256:expected.journal.sha256}))throw fail();
        const inspector=(withCommunity==='feedback'?createAllianceFeedbackRecoveryReview:withCommunity?createAllianceCommunityRecoveryReview:createAllianceRecoveryPair)({enabled:true,memberProjectRef,journalProjectRef,epoch,minimum:first.floor,ledger,journal,community,feedback,timeoutMs});
        try{const result=await context.phase(signal=>inspector.inspect({freezeId:first.freezeId,frozenAt:first.frozenAt,checkpoint:expected},{signal}));context.check();if(result?.state!=='matches_checkpoint'||result.access!=='closed')throw fail();}finally{inspector.close();}
        const second=await decision(context);if(binding(first)!==binding(second))throw fail();
        prepared={digest,revision:first.revision,floor:point(first.floor),freezeId:first.freezeId,frozenAt:first.frozenAt};
        return {state:'prepared',access:'closed'};
      },unavailable());
    },
    async [withCommunity==='feedback'?'authorizeFeedback':withCommunity?'authorizeCommunity':'authorize']({signal}={}){
      if(!prepared)return false;
      return run(signal,decisionTimeoutMs,async context=>{
        const d=await decision(context);context.check();
        if(d.state!=='serve'||d.revision<=prepared.revision||d.checkpointSha256!==prepared.digest||d.freezeId!==prepared.freezeId||d.frozenAt!==prepared.frozenAt||!samePoint(d.floor,prepared.floor))throw fail();
        return true;
      },false);
    },
    close(){closed=true;prepared=undefined;controller?.abort();}
  });
}
