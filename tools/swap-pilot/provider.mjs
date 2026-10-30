// Jupiter owns wallet, order construction, signing prompts and submission.
// This isolated pilot is excluded from the production site's static artifact.
export const GFOF_MINT='Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV';
export const SOL_MINT='So11111111111111111111111111111111111111112';
export const PLUGIN_URL='https://plugin.jup.ag/plugin-v1.js';
export function createManagedSwap({loadPlugin,onState}){
 let started=false;
 const emit=(phase,details={})=>onState(Object.freeze({phase,...details}));
 return Object.freeze({async start(direction='buy'){
  if(started)return false;
  if(!['buy','sell'].includes(direction))throw Error('swap_direction_invalid');
  started=true;emit('loading');
  try{
   const plugin=await loadPlugin();
   if(typeof plugin?.init!=='function')throw Error('swap_provider_unavailable');
   await plugin.init({displayMode:'integrated',integratedTargetId:'jupiter-plugin',autoConnect:false,
    enableWalletPassthrough:false,localStoragePrefix:'galactic-swap-pilot',
    containerStyles:{width:'100%',height:'580px'},branding:{name:'Galactic Swap'},
    formProps:{swapMode:'ExactIn',fixedMint:GFOF_MINT,
     initialInputMint:direction==='buy'?SOL_MINT:GFOF_MINT,
     initialOutputMint:direction==='buy'?GFOF_MINT:SOL_MINT},
    onSuccess:({txid}={})=>{
     // A provider callback is not independent confirmation or revenue evidence.
     if(typeof txid==='string'&&/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(txid))emit('reported',{txid});
     else emit('unverified');
    },onSwapError:()=>emit('error')});
   emit('ready');return true;
  }catch{emit('unavailable');return false;}
 }});
}
export function loadJupiter(doc,win){
 return new Promise((resolve,reject)=>{
  const script=doc.createElement('script');script.src=PLUGIN_URL;script.async=true;
  script.referrerPolicy='no-referrer';
  script.onload=()=>typeof win.Jupiter?.init==='function'?resolve(win.Jupiter):reject(Error('swap_provider_unavailable'));
  script.onerror=()=>reject(Error('swap_provider_unavailable'));
  doc.head.append(script);
 });
}
