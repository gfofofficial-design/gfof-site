'use strict';
// Runtime-only secrets; upstream destinations are fixed and never user supplied.
function runtimeKey(name){
 const value=globalThis.Netlify?.env?.get ? globalThis.Netlify.env.get(name) : process.env[name];
 if(value===undefined||value==='')return null;
 if(typeof value!=='string'||!/^[-A-Za-z0-9_.]{8,256}$/.test(value))throw Error('Provider configuration unavailable');
 return value;
}
function solanaProvider(){
 const key=runtimeKey('HELIUS_API_KEY');
 return key?{url:'https://mainnet.helius-rpc.com/?api-key='+encodeURIComponent(key),source:'Helius Solana RPC'}:{url:'https://api.mainnet-beta.solana.com',source:'Solana public RPC'};
}
function jupiterOptions(){
 const key=runtimeKey('JUPITER_API_KEY');
 return key?{headers:{'x-api-key':key}}:{};
}
module.exports={solanaProvider,jupiterOptions};
