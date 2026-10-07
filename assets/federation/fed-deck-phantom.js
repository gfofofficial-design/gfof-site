'use strict';
(()=>{
 const input=document.getElementById('wallet-address'),form=document.getElementById('wallet-form'),connect=document.getElementById('phantom-connect'),disconnect=document.getElementById('phantom-disconnect'),message=document.getElementById('phantom-message');
 let provider,connectedAddress='',bound=false,busy=false,epoch=0,internal=false;
 function address(key){const s=key?.toString?.();if(typeof s!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s))throw Error('invalid-address');return s;}
 function setAddress(s){internal=true;try{input.value=s;input.dispatchEvent(new Event('input',{bubbles:true}));}finally{internal=false;}}
 function detached(){epoch++;if(input.value.trim()===connectedAddress)setAddress('');connectedAddress='';disconnect.hidden=true;message.textContent='Phantom disconnected. You can still enter a public address.';}
 function bind(){if(bound)return;bound=true;provider.on('disconnect',detached);provider.on('accountChanged',key=>{epoch++;const previous=connectedAddress;try{const next=address(key);connectedAddress=next;if(input.value.trim()===previous)setAddress(next);message.textContent='Phantom account changed. Press Read / refresh balances to view the selected address.';}catch{detached();}});}
 input.addEventListener('input',()=>{if(!internal){epoch++;message.textContent=connectedAddress?'Address edited. Phantom connection remains open; use Disconnect Phantom to end it.':'Public address entry is available without Phantom.';}});
 document.getElementById('wallet-clear').addEventListener('click',()=>{epoch++;message.textContent=connectedAddress?'Displayed data cleared. Use Disconnect Phantom to end the wallet connection.':'Wallet display cleared.';});
 connect.addEventListener('click',async()=>{
  if(busy)return;provider=globalThis.phantom?.solana;
  if(!provider?.isPhantom||typeof provider.connect!=='function'||typeof provider.disconnect!=='function'||typeof provider.on!=='function'){message.textContent='Phantom is not detected here. Use a browser with the Phantom extension or open this page in Phantom’s in-app browser. You can also enter a public address.';return;}
  busy=true;connect.disabled=true;const request=++epoch;message.textContent='Opening Phantom to request your public address. This preview does not request signatures or transactions.';
  try{bind();const result=await provider.connect();if(request!==epoch){try{await provider.disconnect();}catch{}return;}connectedAddress=address(result.publicKey);setAddress(connectedAddress);disconnect.hidden=false;message.textContent='Phantom address loaded. Reading public balances. Ownership is not linked to your Federation account.';form.requestSubmit();}
  catch(e){message.textContent=e?.code===4001?'Connection cancelled. You can still enter a public address.':'Phantom connection could not be completed. You can still enter a public address.';}
  finally{busy=false;connect.disabled=false;}
 });
 disconnect.addEventListener('click',async()=>{if(busy||!provider)return;busy=true;disconnect.disabled=true;try{await provider.disconnect();detached();}catch{if(input.value.trim()===connectedAddress)setAddress('');message.textContent='The displayed address was cleared, but Phantom disconnection could not be confirmed. Disconnect this site in Phantom or try again.';}finally{busy=false;disconnect.disabled=false;}});
})();
