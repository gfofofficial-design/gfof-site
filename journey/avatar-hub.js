"use strict";
(() => {
const {key,clean,svg}=FederationAvatar;
const $=id=>document.getElementById(id);
function show(){
 const portrait=$("saved-avatar-portrait");portrait.hidden=true;portrait.innerHTML="";
 $("avatarTitle").textContent="A new face aboard.";
 $("avatar-link").textContent="Create your avatar →";
 $("saved-avatar-description").textContent="Create your own Federation explorer, or choose an image from your device.";
 $("saved-avatar-note").textContent="Optional. No wallet or account needed. Avatar choices can be saved on this device.";
 try{
  const raw=localStorage.getItem(key);if(!raw)return;
  const stored=JSON.parse(raw);if(!stored||typeof stored!=="object"||Array.isArray(stored))throw Error("invalid avatar");
  const avatar=clean(stored);
  $("avatarTitle").textContent=`Welcome aboard, ${avatar.callsign}.`;
  $("avatar-link").textContent="Edit your avatar →";
  $("saved-avatar-description").textContent="Your next story is waiting. Choose any mission and explore at your own pace.";
  $("saved-avatar-note").textContent="Avatar saved in this browser. Mission badges are separate and stay in this tab.";
  if(avatar.mode!=="character"){
   if(!avatar.photo){$("saved-avatar-note").textContent="Your saved image is unavailable. Edit your avatar to choose another; every mission is still open.";return;}
   const img=document.createElement("img");img.alt="Your saved Journey portrait";img.addEventListener("error",()=>{portrait.hidden=true;$("saved-avatar-note").textContent="Your saved image could not be displayed. Edit your avatar to choose another.";});img.src=avatar.photo;portrait.append(img);
  }else portrait.innerHTML=svg(avatar);
  portrait.hidden=false;
 }catch{$("saved-avatar-note").textContent="Your saved avatar could not be loaded. You can still create one or choose any mission.";}
}
show();window.addEventListener("pageshow",show);window.addEventListener("storage",event=>{if(event.key===key||event.key===null)show();});
})();
