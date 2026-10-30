// Offline wire-envelope checks only. No wallet, network, signing or submission API.
// This does NOT decode swap programs, resolve lookup accounts or authorize a trade.
import {createHash,createPublicKey,verify} from 'node:crypto';
const MAX_PACKET=1232,MAX_SIGNATURES=16;
const fail=()=>Error('swap_transaction_envelope_invalid');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function packet(value){
 if(typeof value!=='string'||value.length<4||value.length>1644||value.length%4||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw fail();
 const bytes=Buffer.from(value,'base64');if(bytes.length>MAX_PACKET||bytes.toString('base64')!==value)throw fail();return bytes;
}
function cursor(bytes){
 let offset=0;
 return {get offset(){return offset;},byte(){if(offset>=bytes.length)throw fail();return bytes[offset++];},take(n){if(!Number.isInteger(n)||n<0||offset+n>bytes.length)throw fail();const out=bytes.subarray(offset,offset+n);offset+=n;return out;},short(){let value=0;for(let i=0;i<3;i++){const b=this.byte();if(i===2&&b>3)throw fail();value|=(b&127)<<(i*7);if(!(b&128)){if(i&&b===0)throw fail();return value;}}throw fail();}};
}
function decode(value){
 const bytes=packet(value),c=cursor(bytes),signatureCount=c.short();
 if(signatureCount<1||signatureCount>MAX_SIGNATURES)throw fail();
 const signatures=[];for(let i=0;i<signatureCount;i++)signatures.push(c.take(64));
 const messageOffset=c.offset,message=bytes.subarray(messageOffset),m=cursor(message);
 // A deliberately bounded v0 candidate; v1 and legacy need separate acceptance.
 if(m.byte()!==128)throw fail();
 const requiredSignatures=m.byte(),readonlySigned=m.byte(),readonlyUnsigned=m.byte();
 const keyCount=m.short();if(requiredSignatures!==signatureCount||readonlySigned>=requiredSignatures||keyCount<requiredSignatures||keyCount>256||readonlyUnsigned>keyCount-requiredSignatures)throw fail();
 const keys=[];for(let i=0;i<keyCount;i++)keys.push(m.take(32));
 if(new Set(keys.map(k=>k.toString('hex'))).size!==keys.length)throw fail();
 const blockhash=m.take(32),instructions=[],instructionCount=m.short();if(!instructionCount||instructionCount>64)throw fail();
 for(let i=0;i<instructionCount;i++){
  const programIndex=m.byte(),accounts=[...m.take(m.short())],data=m.take(m.short());
  instructions.push({programIndex,accounts,data});
 }
 const lookups=[],lookupCount=m.short();if(lookupCount>16)throw fail();let loaded=0;
 for(let i=0;i<lookupCount;i++){
  const key=m.take(32),writable=[...m.take(m.short())],readonly=[...m.take(m.short())];
  if(!writable.length&&!readonly.length||new Set([...writable,...readonly]).size!==writable.length+readonly.length)throw fail();
  loaded+=writable.length+readonly.length;lookups.push({key,writable,readonly});
 }
 if(m.offset!==message.length||keyCount+loaded>256||new Set(lookups.map(l=>l.key.toString('hex'))).size!==lookups.length)throw fail();
 for(const ix of instructions)if(ix.programIndex>=keyCount||ix.accounts.some(i=>i>=keyCount+loaded))throw fail();
 return {bytes,signatures,message,keys,blockhash,instructions,lookups,requiredSignatures};
}
function validSignature(signature,message,key){
 return verify(null,message,createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),key]),format:'der',type:'spki'}),signature);
}
const zero=s=>s.every(v=>v===0);
export function inspectTransactionEnvelope(base64){
 const tx=decode(base64);
 for(let i=0;i<tx.signatures.length;i++)if(!zero(tx.signatures[i])&&!validSignature(tx.signatures[i],tx.message,tx.keys[i]))throw fail();
 return Object.freeze({state:'requires-instruction-review',tradeAllowed:false,transactionVersion:0,
  messageSha256:hash(tx.message),packetBytes:tx.bytes.length,
  signerPublicKeys:Object.freeze(tx.keys.slice(0,tx.requiredSignatures).map(k=>k.toString('hex'))),
  feePayerPublicKey:tx.keys[0].toString('hex'),recentBlockhash:tx.blockhash.toString('hex'),
  instructions:Object.freeze(tx.instructions.map(ix=>Object.freeze({programPublicKey:tx.keys[ix.programIndex].toString('hex'),accountIndices:Object.freeze([...ix.accounts]),dataHex:ix.data.toString('hex')}))),
  unresolvedLookupTables:tx.lookups.length,
  limitation:'Requires resolved accounts, instruction and intent/fee/expiry validation, simulation and explicit owner acceptance. Envelope checks alone never permit signing.'});
}
export function compareWalletSignedEnvelope(originalBase64,signedBase64,expectedSignerHex){
 const before=decode(originalBase64),after=decode(signedBase64);
 if(typeof expectedSignerHex!=='string'||! /^[0-9a-f]{64}$/.test(expectedSignerHex)||!before.message.equals(after.message))throw fail();
 const index=before.keys.slice(0,before.requiredSignatures).findIndex(k=>k.toString('hex')===expectedSignerHex);
 if(index<0||!zero(before.signatures[index])||zero(after.signatures[index]))throw fail();
 for(let i=0;i<before.signatures.length;i++){
  if(i!==index&&!before.signatures[i].equals(after.signatures[i]))throw fail();
  if(!zero(after.signatures[i])&&!validSignature(after.signatures[i],after.message,after.keys[i]))throw fail();
 }
 return Object.freeze({state:'signature-matches-message',tradeAllowed:false,messageSha256:hash(after.message),
  limitation:'Does not attest swap instructions, output, fee accounts, expiry or execution; never submit from this result alone.'});
}
