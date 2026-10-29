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
