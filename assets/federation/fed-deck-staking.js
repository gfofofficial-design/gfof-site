'use strict';
(()=>{
 const input=document.getElementById('deck-stake-amount'),message=document.getElementById('deck-stake-message');
 const terms=[{months:1,percent:1},{months:3,percent:3},{months:6,percent:8},{months:12,percent:12}];let selected=terms[2];const unit=1000000n;
 function format(raw){const whole=(raw/unit).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',');const fraction=(raw%unit).toString().padStart(6,'0').replace(/0+$/,'');return whole+(fraction?'.'+fraction:'')+' GFOF';}
 function render(){
  for(const term of terms)document.getElementById('deck-term-'+term.months).setAttribute('aria-pressed',String(selected===term));
  document.getElementById('deck-stake-term').textContent=selected.months+' '+(selected.months===1?'month':'months')+' · '+selected.percent+'% proposed total-term reward';
  const raw=input.value.trim(),value=raw.replace(/,/g,'');
  if(raw.length>25||(!/^\d+(?:\.\d{0,6})?$/.test(raw)&&!/^\d{1,3}(?:,\d{3})+(?:\.\d{0,6})?$/.test(raw))||!/[1-9]/.test(value)){
   input.setAttribute('aria-invalid','true');message.textContent='Enter a positive example amount with up to six decimal places.';for(const id of ['deck-stake-principal','deck-stake-reward','deck-stake-total'])document.getElementById(id).textContent='—';document.getElementById('deck-stake-share').hidden=true;return;
  }
  input.removeAttribute('aria-invalid');message.textContent='Planning illustration only. No pool is open and no reward is promised.';
  const [whole,fraction='']=value.split('.');const principal=BigInt(whole)*unit+BigInt(fraction.padEnd(6,'0'));const reward=principal*BigInt(selected.percent)/100n;
  document.getElementById('deck-stake-principal').textContent=format(principal);document.getElementById('deck-stake-reward').textContent=format(reward);document.getElementById('deck-stake-total').textContent=format(principal+reward);
  const share=document.getElementById('deck-stake-share');share.hidden=false;share.value=Number(reward)/Number(principal+reward);document.getElementById('deck-stake-share-label').textContent='Reward share of illustrated principal + reward: '+(100*share.value).toFixed(2)+'%';
 }
 input.addEventListener('input',render);for(const term of terms)document.getElementById('deck-term-'+term.months).addEventListener('click',()=>{selected=term;render();});render();
})();
