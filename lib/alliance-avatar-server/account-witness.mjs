// Disabled source-only account status evidence. No Auth, credential/key lookup,
// persistent pin installation, retry, route or permission to serve/delete.
import {createPublicKey,randomBytes,verify} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {isDeepStrictEqual} from 'node:util';
import {reviewAccountHistory} from './account-history.mjs';
import {controlExact as exact,controlRef as ref,controlUuid as uuid,controlHash as hash,controlPoint as point} from './control-policy.mjs';
const MAX_AGE=5000,ZERO='0'.repeat(64),states=['not_admitted','admission_pending','admission_acknowledged','removal_pending','removal_acknowledged'];
const fail=()=>Error('alliance_account_witness_unavailable');
const date=v=>typeof v==='string'&&v.length===24&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v&&Date.parse(v)>=0;
function scope(v){
 if(!exact(v,['memberProjectRef','journalProjectRef','controlProjectRef','epoch'])||![v.memberProjectRef,v.journalProjectRef,v.controlProjectRef].every(ref)||new Set([v.memberProjectRef,v.journalProjectRef,v.controlProjectRef]).size!==3||!uuid(v.epoch))throw fail();
 return {memberProjectRef:v.memberProjectRef,journalProjectRef:v.journalProjectRef,controlProjectRef:v.controlProjectRef,epoch:v.epoch};
}
const historyScope=s=>({memberProjectRef:s.memberProjectRef,journalProjectRef:s.journalProjectRef,epoch:s.epoch});
function pins(v){
 if(!exact(v,['head','acknowledged']))throw fail();const head=point(v.head),acknowledged=point(v.acknowledged);
 if(acknowledged.sequence>head.sequence||acknowledged.sequence===head.sequence&&acknowledged.sha256!==head.sha256)throw fail();return {head,acknowledged};
}
function pub(value){if(!hash(value)||value===ZERO)throw fail();try{return createPublicKey({format:'jwk',key:{kty:'OKP',crv:'Ed25519',x:Buffer.from(value,'hex').toString('base64url')}});}catch{throw fail();}}
function request(v,s){
 if(!exact(v,['format','scope','bootId','challenge','subject'])||v.format!==1||!isDeepStrictEqual(scope(v.scope),s)||![v.bootId,v.challenge,v.subject].every(hash))throw fail();return {format:1,scope:{...s},bootId:v.bootId,challenge:v.challenge,subject:v.subject};
}
export function accountWitnessBytes(v){
 if(!exact(v,['format','scope','bootId','challenge','subject','head','acknowledged','accountState','issuedAt'])||!states.includes(v.accountState)||!date(v.issuedAt))throw fail();
 const r=request({format:v.format,scope:v.scope,bootId:v.bootId,challenge:v.challenge,subject:v.subject},scope(v.scope)),p=pins({head:v.head,acknowledged:v.acknowledged});
 return Buffer.from('GF-ALLIANCE-ACCOUNT-WITNESS-V1\0'+JSON.stringify({...r,...p,accountState:v.accountState,issuedAt:v.issuedAt}));
}
function evidence(s,snapshot,ack,minimum){
 const hs=historyScope(s);
 if(!exact(snapshot,['scope','enabled','admissionsOpen','head','records'])||!isDeepStrictEqual(snapshot.scope,hs)||typeof snapshot.enabled!=='boolean'||typeof snapshot.admissionsOpen!=='boolean'||snapshot.admissionsOpen&&!snapshot.enabled)throw fail();
 const p=pins({head:snapshot.head,acknowledged:ack});
 // Pin BOTH observed head (including unacknowledged intents) and ack prefix.
 reviewAccountHistory({scope:hs,records:snapshot.records,head:p.head,acknowledged:p.head,minimum:minimum.head});
 const result=reviewAccountHistory({scope:hs,records:snapshot.records,head:p.head,acknowledged:p.acknowledged,minimum:minimum.acknowledged});return {result,p};
}
function task({timeoutMs,signal,alive}){
 const c=new AbortController(),started=performance.now(),abort=()=>c.abort();let onAbort;
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 const stopped=new Promise((_,reject)=>{onAbort=()=>reject(fail());c.signal.addEventListener('abort',onAbort,{once:true});}),timer=setTimeout(abort,timeoutMs);
 const check=()=>{if(!alive()||c.signal.aborted||performance.now()-started>=timeoutMs)throw fail();};
 return {c,started,check,phase:fn=>Promise.race([Promise.resolve().then(()=>{check();return fn({signal:c.signal});}),stopped]),close(){clearTimeout(timer);signal?.removeEventListener('abort',abort);c.signal.removeEventListener('abort',onAbort);c.abort();}};
}
export function createAccountAuthority({enabled=false,scope:rawScope,verificationKey,minimum,history,acknowledgements,signBytes,timeoutMs=3500}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>3500)throw fail();let s,key,pin;
 if(enabled===true){s=scope(rawScope);key=pub(verificationKey);pin=pins(minimum);if(typeof history?.snapshot!=='function'||typeof acknowledgements?.read!=='function'||typeof signBytes!=='function')throw fail();}
 let active=false,closed=false,faulted=false,current;
 return Object.freeze({
  async issue(input,{signal}={}){
   if(enabled!==true||closed||faulted)return {state:'unavailable'};let r;try{r=request(input,s);}catch{return {state:'invalid'};}
   if(signal?.aborted)return {state:'cancelled'};if(active)return {state:'busy'};active=true;
   const t=task({timeoutMs,signal,alive:()=>!closed});current=t;
   const read=async()=>{const snap=await t.phase(o=>history.snapshot(o));t.check();const ack=point(await t.phase(o=>acknowledgements.read(o)));t.check();const e=evidence(s,snap,ack,pin);pin=e.p;return e;};
   try{
    const first=await read(),decision={...r,...first.p,accountState:first.result.check(r.subject).state,issuedAt:new Date().toISOString()},message=accountWitnessBytes(decision);
    const raw=await t.phase(o=>signBytes(Buffer.from(message),o));t.check();if(!(raw instanceof Uint8Array)||raw.byteLength!==64||!verify(null,message,key,Buffer.from(raw)))throw fail();
    const after=await read();t.check();if(!isDeepStrictEqual(after.p,first.p))throw fail();const age=Date.now()-Date.parse(decision.issuedAt);if(age< -1000||age>=MAX_AGE)throw fail();
    return {state:'signed',bytes:Buffer.from(JSON.stringify({decision,signature:Buffer.from(raw).toString('hex')}))};
   }catch{faulted=true;return {state:'unavailable'};}
   finally{t.close();current=undefined;active=false;}
  },close(){closed=true;current?.c.abort();}
 });
}
export function createAccountStatusReader({enabled=false,scope:rawScope,verificationKey,minimum,readWitness,readHistory,timeoutMs=3500}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>3500)throw fail();let s,key,pin,bootId;
 if(enabled===true){s=scope(rawScope);key=pub(verificationKey);pin=pins(minimum);if(typeof readWitness!=='function'||typeof readHistory!=='function')throw fail();bootId=randomBytes(32).toString('hex');}
 let active=false,closed=false,faulted=false,generation=0,current;
 return Object.freeze({
  async review(subject,{signal}={}){
   if(enabled!==true||closed||faulted)return {state:'unavailable'};if(!hash(subject))return {state:'invalid'};
   if(signal?.aborted)return {state:'cancelled'};if(active)return {state:'busy'};active=true;const mine=++generation;
   const t=task({timeoutMs,signal,alive:()=>!closed&&generation===mine});current=t;
   try{
    const r={format:1,scope:{...s},bootId,challenge:randomBytes(32).toString('hex'),subject};
    const raw=await t.phase(o=>readWitness({...r,scope:{...r.scope}},o));t.check();if(!(raw instanceof Uint8Array)||raw.byteLength<1||raw.byteLength>8192)throw fail();
    const envelope=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(raw)));
    if(!exact(envelope,['decision','signature'])||typeof envelope.signature!=='string'||!/^[0-9a-f]{128}$/.test(envelope.signature))throw fail();
    const d=envelope.decision,message=accountWitnessBytes(d);
    if(!isDeepStrictEqual(request({format:d.format,scope:d.scope,bootId:d.bootId,challenge:d.challenge,subject:d.subject},s),r)||!verify(null,message,key,Buffer.from(envelope.signature,'hex')))throw fail();
    const age=Date.now()-Date.parse(d.issuedAt);if(age< -1000||age>=MAX_AGE)throw fail();
    const next=pins({head:d.head,acknowledged:d.acknowledged});
    if(next.head.sequence<pin.head.sequence||next.head.sequence===pin.head.sequence&&next.head.sha256!==pin.head.sha256||next.acknowledged.sequence<pin.acknowledged.sequence||next.acknowledged.sequence===pin.acknowledged.sequence&&next.acknowledged.sha256!==pin.acknowledged.sha256)throw fail();
    const old=pin;pin=next; // Remember signed observations even if fetch fails.
    const snap=await t.phase(o=>readHistory(o));t.check();const checked=evidence(s,snap,next.acknowledged,old);
    if(!isDeepStrictEqual(checked.p,next)||checked.result.check(subject).state!==d.accountState)throw fail();
    let ended=false;const alive=()=>!ended&&!closed&&!faulted&&generation===mine&&!signal?.aborted&&performance.now()-t.started<MAX_AGE&&Date.now()-Date.parse(d.issuedAt)>=-1000&&Date.now()-Date.parse(d.issuedAt)<MAX_AGE;
    const unavailable=()=>({state:'unavailable'});
    return Object.freeze({get state(){return alive()?'verified_account_evidence':'unavailable';},check(value){if(!alive())return unavailable();if(value!==subject)return {state:'invalid'};return Object.freeze({state:d.accountState,authorization:'not_established',erasure:'not_established'});},close(){ended=true;}});
   }catch{faulted=true;return {state:'unavailable'};}
   finally{t.close();current=undefined;active=false;}
  },close(){closed=true;generation++;current?.c.abort();}
 });
}
