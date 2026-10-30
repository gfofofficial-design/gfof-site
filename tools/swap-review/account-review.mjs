// Offline raw-account snapshots. Caller must independently establish RPC provenance,
// cluster, coherent observation and freshness. No lookup is fetched or trusted here.
import {inspectTransactionEnvelope} from './transaction-envelope.mjs';
const ALT_PROGRAM='AddressLookupTab1e1111111111111111111111111';
const TOKEN_PROGRAM='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const WSOL_HEX='069b8857feab8184fb687f634618c035dac439dc1aeb3b5598a0f00000000001';
const maxU64=18446744073709551615n;
const uint=v=>typeof v==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(v)&&BigInt(v)<=maxU64;
const key=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const fail=()=>Error('swap_account_review_refused');
function raw(snapshot,publicKeyHex,program,context,maxBytes){
 if(!key(publicKeyHex)||!snapshot||snapshot.publicKeyHex!==publicKeyHex||snapshot.ownerProgram!==program||snapshot.executable!==false||!uint(snapshot.contextSlot)||!uint(context.currentSlot)||!Number.isInteger(context.maxSlotLag)||context.maxSlotLag<0||context.maxSlotLag>32)throw fail();
 const lag=BigInt(context.currentSlot)-BigInt(snapshot.contextSlot);if(lag<0n||lag>BigInt(context.maxSlotLag))throw fail();
 const value=snapshot.dataBase64;if(typeof value!=='string'||value.length>Math.ceil(maxBytes/3)*4||value.length%4||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw fail();
 const b=Buffer.from(value,'base64');if(b.length>maxBytes||b.toString('base64')!==value)throw fail();return b;
}
export function resolveEnvelopeAccounts(base64,snapshots,context){
 try{
  const envelope=inspectTransactionEnvelope(base64);
  if(!Array.isArray(snapshots)||snapshots.length!==envelope.lookupTables.length||new Set(snapshots.map(s=>s.publicKeyHex)).size!==snapshots.length)throw fail();
  const writable=[],readonly=[];let slot;
  for(const lookup of envelope.lookupTables){
   const snapshot=snapshots.find(s=>s.publicKeyHex===lookup.publicKeyHex),b=raw(snapshot,lookup.publicKeyHex,ALT_PROGRAM,context,8248);
   if(slot!==undefined&&slot!==snapshot.contextSlot)throw fail();slot=snapshot.contextSlot;
   if(b.length<56||(b.length-56)%32||b.readUInt32LE(0)!==1||b.readBigUInt64LE(4)!==maxU64||b[21]>1)throw fail();
   const count=(b.length-56)/32;
   // Conservative pilot: require a fully warmed observation, not partial same-slot use.
   if(count>256||b[20]>count||b.readBigUInt64LE(12)>=BigInt(snapshot.contextSlot))throw fail();
   const address=i=>{if(i>=count)throw fail();return b.subarray(56+32*i,88+32*i).toString('hex');};
   for(const i of lookup.writableIndices)writable.push(Object.freeze({publicKeyHex:address(i),signer:false,writable:true}));
   for(const i of lookup.readonlyIndices)readonly.push(Object.freeze({publicKeyHex:address(i),signer:false,writable:false}));
  }
  const accounts=[...envelope.staticAccounts,...writable,...readonly];
  if(new Set(accounts.map(a=>a.publicKeyHex)).size!==accounts.length)throw fail();
  const instructions=envelope.instructions.map(ix=>Object.freeze({programPublicKeyHex:ix.programPublicKey,accounts:Object.freeze(ix.accountIndices.map(i=>accounts[i])),dataHex:ix.dataHex}));
  return Object.freeze({state:'requires-instruction-review',tradeAllowed:false,messageSha256:envelope.messageSha256,accounts:Object.freeze(accounts),instructions:Object.freeze(instructions),observationSlot:slot??null,
   limitation:'Snapshot consistency only; not RPC provenance, program semantics, simulation, fee ownership or permission to sign.'});
 }catch{throw fail();}
}
export function reviewTokenAccount(snapshot,expected,context){
 try{
  if(!key(expected.mintHex)||!key(expected.ownerHex)||!uint(expected.minimumUnits))throw fail();
  const b=raw(snapshot,expected.publicKeyHex,TOKEN_PROGRAM,context,165);
  if(b.length!==165||b.subarray(0,32).toString('hex')!==expected.mintHex||b.subarray(32,64).toString('hex')!==expected.ownerHex||b[108]!==1||b.readUInt32LE(72)!==0||b.readBigUInt64LE(121)!==0n||![0,1].includes(b.readUInt32LE(109)))throw fail();
  if(b.readUInt32LE(109)===1&&expected.mintHex!==WSOL_HEX)throw fail();
  const close=b.readUInt32LE(129);if(close!==0&&(close!==1||b.subarray(133,165).toString('hex')!==expected.ownerHex))throw fail();
  const amount=b.readBigUInt64LE(64);if(amount<BigInt(expected.minimumUnits))throw fail();
  return Object.freeze({state:'token-account-matches-snapshot',tradeAllowed:false,publicKeyHex:expected.publicKeyHex,mintHex:expected.mintHex,ownerHex:expected.ownerHex,amountUnits:amount.toString(),native:b.readUInt32LE(109)===1,observationSlot:snapshot.contextSlot,
   limitation:'Standard SPL layout only; no Token2022 extensions, ATA derivation, mint/decimal attestation, referral ownership or permission to spend.'});
 }catch{throw fail();}
}
