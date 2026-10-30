import {parseDecimalUnits} from './decimal-units.mjs';
export const SOLANA_CHAIN_ID='solana-mainnet';
export const SOLANA_MAX_UNITS=18446744073709551615n;
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function address(v){if(typeof v!=='string'||! /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v))return false;let n=0n;for(const c of v)n=n*58n+BigInt(alphabet.indexOf(c));let size=0;while(n){size++;n>>=8n;}for(const c of v){if(c!=='1')break;size++;}return size===32;}
export const SOLANA_CHAIN_ADAPTER=Object.freeze({chainId:SOLANA_CHAIN_ID,
 validateAsset:t=>t.kind==='native'?t.reference==='native'&&t.decimals===9:address(t.reference),
 canonicalReference:t=>t.kind==='native'?'native':t.reference});
export const JUPITER_QUOTE_ADAPTER=Object.freeze({chainIds:Object.freeze([SOLANA_CHAIN_ID]),
 buildQuoteRequest({input,output,amount}){
  if(input.chainId!==SOLANA_CHAIN_ID||output.chainId!==SOLANA_CHAIN_ID||input.id===output.id||!SOLANA_CHAIN_ADAPTER.validateAsset(input)||!SOLANA_CHAIN_ADAPTER.validateAsset(output))throw Error('swap_adapter_invalid');
  const atomic=parseDecimalUnits(amount,input.decimals,SOLANA_MAX_UNITS),mint=t=>t.kind==='native'?'So11111111111111111111111111111111111111112':t.reference;
  if(mint(input)===mint(output))throw Error('swap_adapter_invalid');
  const url=new URL('https://api.jup.ag/swap/v2/order');url.search=new URLSearchParams({inputMint:mint(input),outputMint:mint(output),amount:atomic}).toString();
  return Object.freeze({atomic,url:url.href});
 }});
