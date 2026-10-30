import test from 'node:test';import assert from 'node:assert/strict';
import {reviewOrderPreflight} from '../tools/swap-review/order-preflight.mjs';
import {SOL,GFOF} from '../assets/federation/swap/token-registry.mjs';
const taker='11111111111111111111111111111111';
const transaction=Buffer.concat([Buffer.from([1]),Buffer.alloc(64),Buffer.from([128,1,0,1,2]),Buffer.alloc(32),Buffer.alloc(32,7),Buffer.alloc(32,3),Buffer.from([1,1,1,0,1,1,0])]).toString('base64');
const intent={pairId:'SOL:GFOF',amount:'0.01',taker,minimumOutput:'900',maxNetworkLamports:'10000',feeBps:50,referralAccount:SOL.mint,referralTokenAccount:GFOF.mint,feeMint:SOL.mint};
// All addresses are syntax fixtures, not fee-account ownership or setup evidence.
const order={inputMint:SOL.mint,outputMint:GFOF.mint,inAmount:'10000000',outAmount:'1000',otherAmountThreshold:'950',swapMode:'ExactIn',taker,router:'metis',transactionVersion:0,gasless:false,transaction,lastValidBlockHeight:'101',requestId:'fictional-order',feeBps:50,feeMint:SOL.mint,referralAccount:SOL.mint,signatureFeeLamports:5000,signatureFeePayer:taker,prioritizationFeeLamports:1000,prioritizationFeePayer:taker,rentFeeLamports:0,rentFeePayer:taker};
const context={currentBlockHeight:'100',currentSlot:'200',maxSlotLag:2,blockhashValidity:{blockhashHex:'03'.repeat(32),contextSlot:'199',commitment:'confirmed',value:true}};
test('matching metadata/envelope stays closed pending independent instruction review',()=>{const r=reviewOrderPreflight(order,intent,context);assert.equal(r.tradeAllowed,false);assert.equal(r.collectionConfirmed,false);assert.equal(r.state,'requires-instruction-review');assert.equal(r.networkLamports,'6000');});
test('pair, amount, wallet, receiver, signer, version and gasless changes refuse',()=>{for(const change of [{inputMint:GFOF.mint},{inAmount:'1'},{taker:SOL.mint},{receiver:GFOF.mint},{transactionVersion:1},{gasless:true},{router:'jupiterz'},{swapMode:'ExactOut'},{transaction:''}])assert.throws(()=>reviewOrderPreflight({...order,...change},intent,context));});
test('fee fallback, unexpected payer and excess costs refuse',()=>{for(const change of [{feeBps:10},{feeBps:51},{referralAccount:GFOF.mint},{feeMint:GFOF.mint},{signatureFeePayer:SOL.mint},{rentFeeLamports:10001},{signatureFeeLamports:1.5}])assert.throws(()=>reviewOrderPreflight({...order,...change},intent,context));});
test('minimum-output weakening, overflow and expired blockheight refuse',()=>{for(const change of [{otherAmountThreshold:'899'},{otherAmountThreshold:'1001'},{lastValidBlockHeight:'100'},{lastValidBlockHeight:'99'},{lastValidBlockHeight:'18446744073709551616'},{outAmount:'1e9'},{requestId:'../execute'}])assert.throws(()=>reviewOrderPreflight({...order,...change},intent,context));});
test('missing explicit limits and unreviewed fee intent refuse',()=>{for(const change of [{minimumOutput:'0'},{minimumOutput:undefined},{maxNetworkLamports:undefined},{feeBps:100},{referralTokenAccount:'secret'},{taker:SOL.mint}])assert.throws(()=>reviewOrderPreflight(order,{...intent,...change},context));});
test('unavailable provider object never leaks provider details',()=>{try{reviewOrderPreflight({...order,error:'private provider text'},intent,context);assert.fail();}catch(e){assert.equal(e.message,'swap_order_preflight_refused');}});

test('validity evidence must bind the actual message hash with a bounded nonfuture context slot',()=>{
 for(const change of [{blockhashHex:'04'.repeat(32)},{value:false},{value:'true'},{contextSlot:'197'},{contextSlot:'201'},{contextSlot:'1e2'},{commitment:'processed'}]){
  assert.throws(()=>reviewOrderPreflight(order,intent,{...context,blockhashValidity:{...context.blockhashValidity,...change}}),/swap_order_preflight_refused/);
 }
 for(const change of [{blockhashValidity:undefined},{currentSlot:undefined},{maxSlotLag:33},{maxSlotLag:-1},{maxSlotLag:1.5}])assert.throws(()=>reviewOrderPreflight(order,intent,{...context,...change}));
 const r=reviewOrderPreflight(order,intent,{...context,blockhashValidity:{...context.blockhashValidity,commitment:'finalized',contextSlot:'200'}});
 assert.equal(r.blockhashHex,'03'.repeat(32));assert.equal(r.blockhashObservationSlot,'200');assert.equal(r.tradeAllowed,false);
});
