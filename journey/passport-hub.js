"use strict";
(() => {
 const p=FederationPassport,$=id=>document.getElementById(id);let replay=0;
 function render(){const state=p.read(),done=[...new Set([...state.done,...p.session()])];
 $("passport-count").textContent=done.length+" of 11 mission badges collected";
 $("passport-enable").hidden=state.enabled;$("passport-forget").hidden=!state.enabled;
 $("passport-storage").textContent=state.enabled?"Your passport is remembered in this browser on this device. It does not sync across devices. Mission choices restart when you reopen a story.":"Session preview. Choose Remember my progress to keep these badges when you return. No account needed.";
 if(!state.available)$("passport-storage").textContent="Saved progress is unavailable in this browser. You can still play every mission.";
 $("passport-badges").replaceChildren();
 for(const [id,title,guide,badge] of p.missions){const card=document.createElement("li");card.className="passport-badge"+(done.includes(id)?" earned":"");const icon=document.createElement("span");icon.className="badge-symbol";icon.textContent=done.includes(id)?"✦":"◇";icon.setAttribute("aria-hidden","true");const name=document.createElement("strong");name.textContent=badge;const detail=document.createElement("span");detail.textContent=guide+" · "+(done.includes(id)?"Collected":"Ready to discover");const link=document.createElement("a");link.href=id+".html";link.textContent=(done.includes(id)?"Replay ":"Play ")+title+" →";card.append(icon,name,detail,link);$("passport-badges").append(card);}
 const next=p.missions.find(m=>!done.includes(m[0]));const chosen=next||p.missions[replay%p.missions.length];
 $("passport-next-title").textContent=next?"Your next discovery":"Your collection is complete. Try another approach.";
 $("passport-next-text").textContent=chosen[4];$("passport-next-link").href=chosen[0]+".html";$("passport-next-link").textContent=(next?"Explore ":"Replay ")+chosen[1]+" →";
 const challenge=p.missions[replay%p.missions.length];$("replay-prompt").textContent=challenge[4];$("replay-link").href=challenge[0]+".html";$("replay-link").textContent="Play "+challenge[1]+" →";
 }
 $("passport-enable").addEventListener("click",()=>{const ok=p.enable();render();$("passport-message").textContent=ok?"Passport saved. Future completed missions will join your collection on this device.":"This browser could not save your passport. Your session progress is still available.";});
 $("passport-forget").addEventListener("click",()=>{$("passport-confirm").hidden=false;});
 $("passport-cancel").addEventListener("click",()=>{$("passport-confirm").hidden=true;});
 $("passport-remove").addEventListener("click",()=>{const ok=p.forget();$("passport-confirm").hidden=true;render();$("passport-message").textContent=ok?"Remembered passport removed. Current session badges and your avatar are unchanged.":"This browser could not remove the passport.";});
 $("replay-another").addEventListener("click",()=>{replay=(replay+1)%p.missions.length;render();});
 p.sync();render();window.addEventListener("pageshow",()=>{p.sync();render();});window.addEventListener("storage",event=>{if(event.key===p.key||event.key===null)render();});
})();
