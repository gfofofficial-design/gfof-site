"use strict";
(() => {
const {key,clean,svg}=FederationAvatar;
const $=id=>document.getElementById(id);
function refresh(){
 const card=$("mission-avatar"),portrait=$("mission-avatar-portrait");
 card.hidden=true;portrait.hidden=true;portrait.innerHTML="";$("mission-avatar-name").textContent="";
 try{
  const raw=localStorage.getItem(key);if(!raw)return;
  const stored=JSON.parse(raw);if(!stored||typeof stored!=="object"||Array.isArray(stored))return;
  const avatar=clean(stored);$("mission-avatar-name").textContent=avatar.callsign;
  if(avatar.mode!=="character"){
   if(avatar.photo){const img=document.createElement("img");img.alt="";img.addEventListener("error",()=>{portrait.hidden=true;});img.src=avatar.photo;portrait.append(img);portrait.hidden=false;}
  }else{portrait.innerHTML=svg(avatar);portrait.hidden=false;}
  card.hidden=false;
 }catch{/* Identity is optional; story controls and state are untouched. */}
}
refresh();window.addEventListener("pageshow",refresh);window.addEventListener("storage",event=>{if(event.key===key||event.key===null)refresh();});
})();
