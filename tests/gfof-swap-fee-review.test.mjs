import test from 'node:test';
import assert from 'node:assert/strict';
import {FEE_POLICY,createFeeMetadataReview} from '../lib/galactic-swap/fee-review.mjs';
const SOL='So11111111111111111111111111111111111111112';
const GFOF='Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV';
// Syntax-only fixtures, never endorsed receiving accounts or on-chain setup.
const config={ownerWallet:GFOF,referralAccount:SOL,feeMint:SOL,referralTokenAccount:GFOF};
const order={inputMint:SOL,outputMint:GFOF,feeBps:50,feeMint:SOL,referralAccount:SOL};
test('recommended economics stay fixed and cannot enable collection or trading',()=>{
 assert.deepEqual(FEE_POLICY,{integratorBps:50,jupiterShareBps:2000,expectedFederationRateBps:40,tradingEnabled:false,collectionEnabled:false});
 assert.ok(Object.isFrozen(FEE_POLICY));
});
test('missing, private, malformed and unsupported bindings cannot create a review',()=>{
 for(const value of [undefined,{},[],{...config,privateKey:'never'},{...config,ownerWallet:'1'.repeat(31)},{...config,feeMint:'11111111111111111111111111111111'}])assert.throws(()=>createFeeMetadataReview(value),/public account bindings/);
});
test('review copies account bindings so later caller mutation cannot redirect the fee',()=>{
 const input={...config};const review=createFeeMetadataReview(input);input.referralAccount=GFOF;
 assert.equal(review.binding.referralAccount,SOL);assert.ok(Object.isFrozen(review.binding));
});
test('matching metadata in either direction remains non-executable and proves no receipt',()=>{
 const review=createFeeMetadataReview(config);
 for(const value of [order,{...order,inputMint:GFOF,outputMint:SOL}]){
  const result=review.review(value);assert.equal(result.status,'metadata-matches');assert.equal(result.tradeAllowed,false);assert.equal(result.collectionConfirmed,false);
 }
});
test('wrong recipient, fee mint, pair and silent fallback or extra rate are refused',()=>{
 const review=createFeeMetadataReview(config);
 for(const change of [{referralAccount:GFOF},{referralAccount:undefined},{feeMint:GFOF},{inputMint:GFOF},{feeBps:10},{feeBps:51},{feeBps:500},{feeBps:'50'},{feeBps:undefined}])assert.equal(review.review({...order,...change}).status,'blocked');
});
test('unavailable orders never copy provider text or create a collection claim',()=>{
 const review=createFeeMetadataReview(config);
 for(const value of [undefined,[],{...order,error:'private detail'},{...order,errorCode:1},new Proxy({},{get(){throw Error('private detail');}})]){
  const result=review.review(value);assert.equal(result.status,'blocked');assert.equal(result.tradeAllowed,false);assert.equal(JSON.stringify(result).includes('private detail'),false);
 }
});
