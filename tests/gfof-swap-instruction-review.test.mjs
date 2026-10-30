import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {reviewSupportingInstructions} from '../tools/swap-review/instruction-review.mjs';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const key=address=>{let n=0n;for(const c of address)n=n*58n+BigInt(alphabet.indexOf(c));return Buffer.from(n.toString(16).padStart(64,'0'),'hex');};
const owner=Buffer.alloc(32,1),recipient=Buffer.alloc(32,2),system=Buffer.alloc(32),compute=key('ComputeBudget111111111111111111111111111111'),token=key('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),source=Buffer.alloc(32,3),destination=Buffer.alloc(32,4),mint=Buffer.alloc(32,5);
// Writable unsigned keys precede readonly keys; owner is the only signer.
const keys=[owner,recipient,source,destination,system,compute,token,mint];
const limit=()=>{const b=Buffer.alloc(5);b[0]=2;b.writeUInt32LE(100000,1);return {p:5,a:[],d:b};};
const price=(n=10n)=>{const b=Buffer.alloc(9);b[0]=3;b.writeBigUInt64LE(n,1);return {p:5,a:[],d:b};};
const sol=(n=100n)=>{const b=Buffer.alloc(12);b.writeUInt32LE(2);b.writeBigUInt64LE(n,4);return {p:4,a:[0,1],d:b};};
const spl=(n=100n)=>{const b=Buffer.alloc(10);b[0]=12;b.writeBigUInt64LE(n,1);b[9]=6;return {p:6,a:[2,7,3,0],d:b};};
function packet(ixs,accountKeys=keys){return Buffer.concat([Buffer.from([1]),Buffer.alloc(64),Buffer.from([128,1,0,accountKeys.length-4,accountKeys.length]),...accountKeys,Buffer.alloc(32,8),Buffer.from([ixs.length]),...ixs.map(ix=>Buffer.concat([Buffer.from([ix.p,ix.a.length,...ix.a,ix.d.length]),ix.d])),Buffer.from([0])]).toString('base64');}
const policy={ownerHex:owner.toString('hex'),maxSolTransferLamports:'100',maxPriorityFeeLamports:'1',maxComputeUnits:100000,solRecipients:[{publicKeyHex:recipient.toString('hex'),maximumLamports:'100'}],tokenTransfers:[{sourceHex:source.toString('hex'),destinationHex:destination.toString('hex'),mintHex:mint.toString('hex'),maximumUnits:'100',decimals:6}]};
const review=(ixs,p=policy)=>reviewSupportingInstructions(packet(ixs),[],{currentSlot:'100',maxSlotLag:0},p);
test('known supporting effects bind explicit recipients, units and rounded priority fee but never allow a trade',()=>{const r=review([limit(),price(),sol(),spl()]);assert.equal(r.tradeAllowed,false);assert.equal(r.solTransferLamports,'100');assert.equal(r.priorityFeeLamports,'1');assert.equal(r.effects.length,4);});
test('split transfers cannot exceed aggregate SOL or token caps',()=>{assert.throws(()=>review([limit(),price(),sol(60n),sol(60n)]));assert.throws(()=>review([limit(),price(),spl(60n),spl(60n)]));});
test('unknown program, changed recipient, changed decimals and excess amount refuse',()=>{const unknown={p:7,a:[],d:Buffer.from([1])};const changed=sol();changed.a=[0,3];const decimals=spl();decimals.d[9]=9;for(const ix of [unknown,changed,decimals,sol(101n),spl(101n)])assert.throws(()=>review([limit(),price(),ix]));});
test('approval, authority change and unchecked token instructions refuse',()=>{for(const op of [3,4,6,9,13,17]){const d=Buffer.alloc(10);d[0]=op;assert.throws(()=>review([limit(),price(),{p:6,a:[2,7,3,0],d}]));}});
test('implicit, duplicate, oversized and excessive-fee compute settings refuse',()=>{for(const ixs of [[limit(),sol()],[price(),sol()],[limit(),limit(),price()],[limit(),price(),price()],[limit(),price(11n)]])assert.throws(()=>review(ixs));assert.throws(()=>review([limit(),price()],{...policy,maxComputeUnits:99999}));});
test('extra account or trailing instruction bytes refuse',()=>{const a=sol();a.a.push(2);const b=spl();b.d=Buffer.concat([b.d,Buffer.from([0])]);for(const ix of [a,b])assert.throws(()=>review([limit(),price(),ix]));});

test('recognized Jupiter program and plausible route discriminators never bypass unsupported-router refusal',()=>{
 const router=key('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
 for(const name of ['route','shared_accounts_route','route_with_token_ledger','shared_accounts_exact_out_route','shared_accounts_route_v2']){
  // Synthetic discriminator plus placeholder body; this is NOT a valid swap fixture.
  const discriminator=createHash('sha256').update(`global:${name}`).digest().subarray(0,8);
  const d=Buffer.concat([discriminator,Buffer.alloc(32)]);
  const base64=packet([limit(),price(),{p:8,a:[0,2,3,7],d}],[...keys,router]);
  assert.throws(()=>reviewSupportingInstructions(base64,[],{currentSlot:'100',maxSlotLag:0},policy),/swap_instruction_review_refused/);
 }
});
