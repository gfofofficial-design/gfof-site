import {createSwapCatalog} from './catalog-core.mjs';
import {SOLANA_CHAIN_ID,SOLANA_CHAIN_ADAPTER,JUPITER_QUOTE_ADAPTER} from './solana-quote-adapter.mjs';
// Reviewed Solana quote metadata, not a safety rating or a live route guarantee.
// Adding a project requires an explicit source review; Alliance membership is not
// an input. Never populate this list from a URL, wallet or remote token feed.
export const SOL = Object.freeze({id: 'SOL', symbol: 'SOL', name: 'Solana', mint: 'So11111111111111111111111111111111111111112', decimals: 9});
export const GFOF = Object.freeze({id: 'GFOF', symbol: 'GFOF', name: 'Galactic Federation', mint: 'Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV', decimals: 6});
// Native USDC on Solana: https://developers.circle.com/stablecoins/usdc-contract-addresses
export const USDC = Object.freeze({id: 'USDC', symbol: 'USDC', name: 'USDC on Solana', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6});
export const QUOTE_TOKENS = Object.freeze([SOL, GFOF, USDC]);

// Pairs are explicit: a later token entry alone does not enable every pairing.
export const QUOTE_PAIRS = Object.freeze([
  [SOL, GFOF], [GFOF, SOL], [SOL, USDC], [USDC, SOL], [GFOF, USDC], [USDC, GFOF]
].map(([input, output]) => Object.freeze({id: input.id + ':' + output.id, input, output})));

// Versioned local chain/provider registrations. No other chain is active.
export const SWAP_CATALOG=createSwapCatalog({
 chains:[{id:SOLANA_CHAIN_ID,name:'Solana mainnet',adapterId:'solana-v0'}],
 tokens:QUOTE_TOKENS.map(t=>({id:SOLANA_CHAIN_ID+'/'+t.id,chainId:SOLANA_CHAIN_ID,kind:t===SOL?'native':'token',reference:t===SOL?'native':t.mint,symbol:t.symbol,name:t.name,decimals:t.decimals,capabilities:{research:true,quote:true,trade:false}})),
 routes:QUOTE_PAIRS.map(p=>({id:p.id,inputId:SOLANA_CHAIN_ID+'/'+p.input.id,outputId:SOLANA_CHAIN_ID+'/'+p.output.id,providerId:'jupiter-v2-quote',capabilities:{research:true,quote:true,trade:false}}))
},{chainAdapters:{'solana-v0':SOLANA_CHAIN_ADAPTER},providerAdapters:{'jupiter-v2-quote':JUPITER_QUOTE_ADAPTER}});
