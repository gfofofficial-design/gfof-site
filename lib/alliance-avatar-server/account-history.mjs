// Pure account-history candidate. No storage, authentication, signatures, network,
// deletion, admission writer or authority to serve. Inputs described as trusted
// must come from independently authenticated current control outside a restore.
import {createHash} from 'node:crypto';

const ZERO='0'.repeat(64),MAX_RECORDS=256,MAX_ACCOUNTS=128,MAX_BYTES=262144;
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const hash=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const ref=v=>typeof v==='string'&&/^[a-z0-9]{20}$/.test(v);
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const fail=()=>Error('alliance_account_history_unavailable');
const digest=(domain,value)=>createHash('sha256').update(domain+'\0'+JSON.stringify(value)).digest('hex');
function scope(value){
  if(!exact(value,['memberProjectRef','journalProjectRef','epoch'])||!ref(value.memberProjectRef)||!ref(value.journalProjectRef)||value.memberProjectRef===value.journalProjectRef||!uuid(value.epoch))throw fail();
  return {memberProjectRef:value.memberProjectRef,journalProjectRef:value.journalProjectRef,epoch:value.epoch};
}
function point(value){
  if(!exact(value,['sequence','sha256'])||!Number.isSafeInteger(value.sequence)||value.sequence<0||value.sequence>MAX_RECORDS||!hash(value.sha256)||value.sequence===0&&value.sha256!==ZERO)throw fail();
  return {sequence:value.sequence,sha256:value.sha256};
}

// This is a scoped, potentially linkable tag, NOT anonymization or proof of an
// authenticated owner. Never take authUserId from an unverified browser claim.
export function accountSubject(value){
  if(!exact(value,['memberProjectRef','epoch','authUserId'])||!ref(value.memberProjectRef)||!uuid(value.epoch)||!uuid(value.authUserId))throw fail();
  return digest('GF-ALLIANCE-ACCOUNT-SUBJECT-V1',{memberProjectRef:value.memberProjectRef,epoch:value.epoch,authUserId:value.authUserId});
}

export function accountEvent(value){
  if(!exact(value,['kind','subject'])||!['account_admitted','account_remove_requested'].includes(value.kind)||!hash(value.subject))throw fail();
  const body={kind:value.kind,subject:value.subject};
  return {id:digest('GF-ALLIANCE-ACCOUNT-EVENT-V1',body),...body};
}

export function accountRecord(value){
  if(!exact(value,['scope','sequence','previous','event'])||!Number.isSafeInteger(value.sequence)||value.sequence<1||value.sequence>MAX_RECORDS||!hash(value.previous)||value.sequence===1&&value.previous!==ZERO||!exact(value.event,['id','kind','subject']))throw fail();
  const s=scope(value.scope),event=accountEvent({kind:value.event.kind,subject:value.event.subject});
  if(value.event.id!==event.id)throw fail();
  const body={format:1,scope:s,sequence:value.sequence,previous:value.previous,event};
  return {...body,sha256:digest('GF-ALLIANCE-ACCOUNT-RECORD-V1',body)};
}

// Verifies bounded canonical history against THREE external points: current
// head, current acknowledged floor, and a separately protected minimum. Checksums
// alone cannot establish their provenance/freshness. All points are mandatory.
export function reviewAccountHistory(value){
  if(!exact(value,['scope','records','head','acknowledged','minimum']))throw fail();
  const s=scope(value.scope),head=point(value.head),ack=point(value.acknowledged),minimum=point(value.minimum);
  if(minimum.sequence>ack.sequence||ack.sequence>head.sequence||!Array.isArray(value.records)||value.records.length!==head.sequence)throw fail();
  // Bound input structure before serialization; each record has a fixed schema.
  if(value.records.length>MAX_RECORDS)throw fail();
  let previous=ZERO;const admitted=new Map(),removed=new Map();
  for(let i=0;i<value.records.length;i++){
    const row=value.records[i];
    if(!exact(row,['format','scope','sequence','previous','event','sha256'])||row.format!==1||!hash(row.sha256))throw fail();
    const record=accountRecord({scope:row.scope,sequence:row.sequence,previous:row.previous,event:row.event});
    if(JSON.stringify(record.scope)!==JSON.stringify(s)||record.sequence!==i+1||record.previous!==previous||record.sha256!==row.sha256)throw fail();
    if(record.sequence===minimum.sequence&&record.sha256!==minimum.sha256||record.sequence===ack.sequence&&record.sha256!==ack.sha256)throw fail();
    const {kind,subject}=record.event;
    if(kind==='account_admitted'){
      // Each admission reserves its own later removal slot. Re-admission of an
      // old identity is forbidden, including after its removal was acknowledged.
      if(admitted.has(subject)||admitted.size>=MAX_ACCOUNTS)throw fail();
      admitted.set(subject,record.sequence);
    }else{
      if(!admitted.has(subject)||removed.has(subject))throw fail();
      removed.set(subject,record.sequence);
    }
    previous=record.sha256;
  }
  if(previous!==head.sha256||Buffer.byteLength(JSON.stringify(value.records),'utf8')>MAX_BYTES)throw fail();
  // Return only evidence. Even an acknowledged admission is not permission to
  // read/write; pending removals already deny and erasure is never inferred.
  return Object.freeze({
    state:'verified_structure',
    check(subject){
      if(!hash(subject))throw fail();
      let state='not_admitted';
      if(removed.has(subject))state=removed.get(subject)<=ack.sequence?'removal_acknowledged':'removal_pending';
      else if(admitted.has(subject))state=admitted.get(subject)<=ack.sequence?'admission_acknowledged':'admission_pending';
      return Object.freeze({state,authorization:'not_established',erasure:'not_established'});
    },
    capacity:Object.freeze({accounts:admitted.size,remainingAdmissions:MAX_ACCOUNTS-admitted.size,reservedRemovals:admitted.size-removed.size}),
    head:Object.freeze({...head}),acknowledged:Object.freeze({...ack})
  });
}
