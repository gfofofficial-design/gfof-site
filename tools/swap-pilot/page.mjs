import {createManagedSwap,loadJupiter} from './provider.mjs';
const status=document.getElementById('status'),button=document.getElementById('open-provider'),direction=document.getElementById('direction'),receipt=document.getElementById('receipt');
const messages={loading:'Loading Jupiter’s swap interface…',ready:'Jupiter is ready. Connect your wallet inside the swap panel when you choose to proceed.',reported:'Jupiter reported a transaction result. Open the explorer to check its status; this page has not independently confirmed settlement.',unverified:'Jupiter returned a result without a usable transaction link. Check your wallet activity before attempting another trade.',error:'The swap did not return a successful result here. Check your wallet activity before trying again; submission status may be uncertain.',unavailable:'Jupiter could not load. No swap was started by this page. Reload to try again; do not bypass browser security warnings.'};
const swap=createManagedSwap({loadPlugin:()=>loadJupiter(document,window),onState:s=>{
 status.textContent=messages[s.phase];receipt.replaceChildren();
 if(s.phase==='loading')document.getElementById('jupiter-plugin').replaceChildren();
 if(s.phase==='ready')document.getElementById('start-controls').hidden=true;
 if(s.phase==='reported'){const link=document.createElement('a');link.href='https://solscan.io/tx/'+s.txid;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Check transaction on Solscan ↗';receipt.append(link);}
 if(s.phase==='unavailable')button.textContent='Reload page to retry';
}});
button.addEventListener('click',()=>{button.disabled=true;direction.disabled=true;void swap.start(direction.value);});
