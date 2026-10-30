import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {inspectTransactionEnvelope,compareWalletSignedEnvelope} from '../tools/swap-review/transaction-envelope.mjs';
// Ephemeral cryptographic fixtures only. No wallet, funds, network or retained key.
const first=generateKeyPairSync('ed25519'),second=generateKeyPairSync('ed25519');
const pub=k=>k.publicKey.export({format:'der',type:'spki'}).subarray(-32);
function fixture({version=128,instructionData=1,extra=Buffer.alloc(0),lookup=false,twoSigners=false}={}){
 const keys=[pub(first),...(twoSigners?[pub(second)]:[]),Buffer.alloc(32,7)];
 const n=twoSigners?2:1;
 const message=Buffer.concat([Buffer.from([version,n,0,1,keys.length]),...keys,Buffer.alloc(32,3),Buffer.from([1,keys.length-1,1,0,1,instructionData]),lookup?Buffer.concat([Buffer.from([1]),Buffer.alloc(32,9),Buffer.from([1,0,0])]):Buffer.from([0]),extra]);
 const signatures=Array.from({length:n},()=>Buffer.alloc(64));
 const encode=()=>Buffer.concat([Buffer.from([n]),...signatures,message]).toString('base64');
 return {message,signatures,encode,keys};
}
test('v0 envelope exposes bounded public structure without trade authorization',()=>{const f=fixture(),r=inspectTransactionEnvelope(f.encode());assert.equal(r.transactionVersion,0);assert.equal(r.tradeAllowed,false);assert.equal(r.state,'requires-instruction-review');assert.equal(r.instructions[0].dataHex,'01');assert.equal(r.feePayerPublicKey,pub(first).toString('hex'));});
test('lookup-bearing envelope remains explicitly unresolved and cannot authorize a trade',()=>{const r=inspectTransactionEnvelope(fixture({lookup:true}).encode());assert.equal(r.unresolvedLookupTables,1);assert.equal(r.tradeAllowed,false);});
test('noncanonical, oversized, truncated, unsupported version and trailing bytes refuse',()=>{const good=fixture().encode();for(const v of ['',good+'\n',good.slice(0,-4),Buffer.alloc(1233).toString('base64'),fixture({version:129}).encode(),fixture({version:1}).encode(),fixture({extra:Buffer.from([0])}).encode()])assert.throws(()=>inspectTransactionEnvelope(v));});
test('invalid header, signature count and instruction index refuse',()=>{for(const mutate of [b=>b[0]=2,b=>b[66]=2,b=>b[69]=0,b=>b[166]=255]){const b=Buffer.from(fixture().encode(),'base64');mutate(b);assert.throws(()=>inspectTransactionEnvelope(b.toString('base64')));}});
test('wallet may fill only its required signature slot over unchanged message bytes',()=>{const f=fixture(),original=f.encode();f.signatures[0]=sign(null,f.message,first.privateKey);const r=compareWalletSignedEnvelope(original,f.encode(),pub(first).toString('hex'));assert.equal(r.state,'signature-matches-message');assert.equal(r.tradeAllowed,false);});
test('changed message, wrong signer, absent or invalid signature cannot pass comparison',()=>{const f=fixture(),original=f.encode();assert.throws(()=>compareWalletSignedEnvelope(original,original,pub(first).toString('hex')));f.signatures[0]=sign(null,f.message,second.privateKey);assert.throws(()=>compareWalletSignedEnvelope(original,f.encode(),pub(first).toString('hex')));f.signatures[0]=sign(null,f.message,first.privateKey);assert.throws(()=>compareWalletSignedEnvelope(original,f.encode(),pub(second).toString('hex')));assert.throws(()=>compareWalletSignedEnvelope(original,fixture({instructionData:2}).encode(),pub(first).toString('hex')));});
test('other signer slots are preserved and verified',()=>{const f=fixture({twoSigners:true});f.signatures[1]=sign(null,f.message,second.privateKey);const original=f.encode();f.signatures[0]=sign(null,f.message,first.privateKey);assert.equal(compareWalletSignedEnvelope(original,f.encode(),pub(first).toString('hex')).tradeAllowed,false);f.signatures[1]=Buffer.alloc(64);assert.throws(()=>compareWalletSignedEnvelope(original,f.encode(),pub(first).toString('hex')));});
