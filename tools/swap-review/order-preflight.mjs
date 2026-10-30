// Offline metadata + envelope binding. No transaction instruction attestation.
import {makeQuoteRequest} from '../../assets/federation/swap/quote-core.mjs';
import {inspectTransactionEnvelope} from './transaction-envelope.mjs';
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const deny=()=>Error('swap_order_preflight_refused');
const uint=v=>typeof v==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(v)&&BigInt(v)<=18446744073709551615n;
function keyHex(value){
 if(typeof value!=='string'||! /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value))throw deny();
 let n=0n;for(const c of value)n=n*58n+BigInt(alphabet.indexOf(c));
 const bytes=[];while(n){bytes.unshift(Number(n&255n));n>>=8n;}for(const c of value){if(c!=='1')break;bytes.unshift(0);}if(bytes.length!==32)throw deny();return Buffer.from(bytes).toString('hex');
}
export function reviewOrderPreflight(order,intent,context){
 try{
  const request=makeQuoteRequest(intent.pairId,intent.amount),taker=keyHex(intent.taker);
  if(!uint(intent.minimumOutput)||BigInt(intent.minimumOutput)<1n||!uint(intent.maxNetworkLamports)||!Number.isInteger(intent.feeBps)||intent.feeBps!==50||!uint(context.currentBlockHeight))throw deny();
  keyHex(intent.referralAccount);keyHex(intent.referralTokenAccount);
  if(![request.pair.input.mint,request.pair.output.mint].includes(intent.feeMint))throw deny();
  if(!order||typeof order!=='object'||Array.isArray(order)||order.error||order.errorCode!=null||order.swapMode!=='ExactIn'||order.inputMint!==request.pair.input.mint||order.outputMint!==request.pair.output.mint||order.inAmount!==request.atomic||order.taker!==intent.taker||order.receiver!=null||!['metis','dflow','okx'].includes(order.router)||order.transactionVersion!==0||order.gasless!==false)throw deny();
  if(!uint(order.outAmount)||!uint(order.otherAmountThreshold)||BigInt(order.otherAmountThreshold)<BigInt(intent.minimumOutput)||BigInt(order.otherAmountThreshold)>BigInt(order.outAmount)||!uint(order.lastValidBlockHeight)||BigInt(order.lastValidBlockHeight)<=BigInt(context.currentBlockHeight))throw deny();
  if(typeof order.requestId!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(order.requestId)||order.feeBps!==intent.feeBps||order.feeMint!==intent.feeMint||order.referralAccount!==intent.referralAccount)throw deny();
  let fees=0n;for(const kind of ['signature','prioritization','rent']){
   const amount=order[kind+'FeeLamports'];if(!Number.isSafeInteger(amount)||amount<0||order[kind+'FeePayer']!==intent.taker)throw deny();fees+=BigInt(amount);
  }
  if(fees>BigInt(intent.maxNetworkLamports))throw deny();
  const envelope=inspectTransactionEnvelope(order.transaction);
  // Caller supplies an independently obtained RPC observation for THIS hash.
  // This pure checker binds evidence; it cannot authenticate its provenance.
  const validity=context.blockhashValidity;
  if(!validity||validity.value!==true||!['confirmed','finalized'].includes(validity.commitment)||validity.blockhashHex!==envelope.recentBlockhash||!uint(validity.contextSlot)||!uint(context.currentSlot)||!Number.isInteger(context.maxSlotLag)||context.maxSlotLag<0||context.maxSlotLag>32)throw deny();
  const lag=BigInt(context.currentSlot)-BigInt(validity.contextSlot);
  if(lag<0n||lag>BigInt(context.maxSlotLag))throw deny();
  if(envelope.signerPublicKeys.length!==1||envelope.signerPublicKeys[0]!==taker||envelope.feePayerPublicKey!==taker)throw deny();
  return Object.freeze({state:'requires-instruction-review',tradeAllowed:false,collectionConfirmed:false,
   messageSha256:envelope.messageSha256,requestId:order.requestId,minimumOutput:intent.minimumOutput,
   blockhashHex:envelope.recentBlockhash,blockhashObservationSlot:validity.contextSlot,
   inputMint:request.pair.input.mint,outputMint:request.pair.output.mint,inputUnits:request.atomic,
   referralTokenAccount:intent.referralTokenAccount,networkLamports:fees.toString(),
   unresolvedLookupTables:envelope.unresolvedLookupTables,
   limitation:'Metadata, wire envelope and caller-supplied blockhash observation only; RPC provenance is unverified. Independently resolve accounts and decode/verify instructions, minimum output, fees, recipient, blockhash, simulation and current expiry before any signing. Referral ownership and collection are unproved.'});
 }catch{throw deny();}
}
