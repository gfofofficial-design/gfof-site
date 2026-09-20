"use strict";
(() => {
const {key,options,defaults,validPhoto,clean}=FederationAvatar, $=id=>document.getElementById(id);
const svg=()=>FederationAvatar.svg(state);
let state={...defaults,mode:"character",photo:null};
let pngUrl=null,pngGeneration=0;
function clearPng(){pngGeneration++;if(pngUrl)URL.revokeObjectURL(pngUrl);pngUrl=null;$("png-result").hidden=true;$("png-preview").removeAttribute("src");$("png-save").removeAttribute("href");$("png-open").removeAttribute("href");}
$("png-clear").addEventListener("click",()=>{clearPng();$("avatar-status").textContent="Exported preview cleared. Your saved avatar is unchanged.";});
let presetGeneration=0,presetLoading=false;
async function loadPreset(){
 const generation=++presetGeneration;const mode=state.mode;
 if(!["cinematic","stylized"].includes(mode)){presetLoading=false;return;}
 const species=$("portrait-species").value;state.species=species;presetLoading=true;state.photo=null;render();
 $("avatar-status").textContent="Preparing your explorer portrait…";
 try{const image=new Image();image.src="assets/avatar-style-concepts-v1.png";await image.decode();if(generation!==presetGeneration)return;
 const canvas=document.createElement("canvas");canvas.width=canvas.height=512;const ctx=canvas.getContext("2d");if(!ctx)throw Error("Canvas unavailable");
 const col=["voyager","luminary","leonine"].indexOf(species),row=mode==="cinematic"?0:1;
 const cellW=image.naturalWidth/3,cellH=image.naturalHeight/2;const crop=cellH*0.91;
 ctx.drawImage(image,col*cellW+(cellW-crop)/2,row*cellH+cellH*0.09,crop,crop,0,0,512,512);
 const photo=canvas.toDataURL("image/jpeg",0.94);if(!validPhoto(photo))throw Error("Portrait unavailable");state.photo=photo;render();$("avatar-status").textContent="Portrait ready. Choose a callsign, then save or download.";
 }catch{if(generation===presetGeneration)$("avatar-status").textContent="This portrait could not load. Try another style or use Classic.";}
 finally{if(generation===presetGeneration)presetLoading=false;}
}
let originalImage=null, photoGeneration=0, photoLoading=false;
function crop(image=originalImage){if(!image)return state.photo;const canvas=document.createElement("canvas");canvas.width=canvas.height=512;const ctx=canvas.getContext("2d");if(!ctx)throw Error("Canvas unavailable");const size=Math.min(image.naturalWidth,image.naturalHeight)/Number($("photo-zoom").value);const x=(image.naturalWidth-size)*Number($("photo-x").value)/100,y=(image.naturalHeight-size)*Number($("photo-y").value)/100;ctx.fillStyle="#0b1830";ctx.fillRect(0,0,512,512);ctx.drawImage(image,x,y,size,size,0,0,512,512);const photo=canvas.toDataURL("image/jpeg",0.9);if(!validPhoto(photo))throw Error("Image too large");return photo;}

function render(){const personal=state.mode!=="character";const preset=["cinematic","stylized"].includes(state.mode);$("portrait-presets").hidden=!preset;$("portrait-species").value=state.species||"voyager";$("character-controls").hidden=personal;$("photo-controls").hidden=state.mode!=="photo";$("shuffle").hidden=personal;$("portrait-mode").value=state.mode||"character";$("portrait").innerHTML=personal?(state.photo?`<img src="${state.photo}" alt="Your chosen personal portrait">`:'<p>Choose a portrait or image to preview it here.</p>'):svg();$("preview-name").textContent=state.callsign;$("preview-description").textContent=preset?`${state.mode==="cinematic"?"Cinematic":"Stylized 3D"} · ${state.species||"voyager"}`:personal?"Your image · Your Journey":`${state.form.charAt(0).toUpperCase()+state.form.slice(1)} · ${state.accent} suit accent`; }
function fill(){for(const k of Object.keys(defaults))$(k).value=state[k];render();}
try{const raw=localStorage.getItem(key);if(raw){state=clean(JSON.parse(raw));$("avatar-status").textContent="Your saved avatar is loaded from this browser.";}}catch{$("avatar-status").textContent="Saved choices could not be loaded. You can still create and download a portrait.";}
fill();
$("avatar-form").addEventListener("input",event=>{if(event.target&&event.target.id==="photo-file")return;if(event.target&&event.target.id==="portrait-mode"){photoGeneration++;photoLoading=false;presetGeneration++;presetLoading=false;originalImage=null;$("crop-controls").disabled=true;state.photo=null;}state=clean({...state,...Object.fromEntries(Object.keys(defaults).map(k=>[k,$(k).value])),mode:$("portrait-mode").value,species:$("portrait-species").value});if(event.target&&["photo-zoom","photo-x","photo-y"].includes(event.target.id)){try{state.photo=crop();}catch{$("avatar-status").textContent="This crop could not be created. Try another image.";return;}}render();if(event.target&&["portrait-mode","portrait-species"].includes(event.target.id)){return loadPreset();}$("avatar-status").textContent="Preview updated. Save to keep these choices on this device.";});
$("avatar-form").addEventListener("submit",event=>{event.preventDefault();if(photoLoading||presetLoading||state.mode!=="character"&&!state.photo){$("avatar-status").textContent="Choose an image and wait for its preview before saving.";return;}try{localStorage.setItem(key,JSON.stringify({...state,photo:state.mode!=="character"?state.photo:null}));$("avatar-status").textContent="Saved on this device. Return here to edit your avatar.";}catch{$("avatar-status").textContent="This browser could not save your avatar. You can still download the portrait.";}});
$("shuffle").addEventListener("click",()=>{for(const [k,v]of Object.entries(options))state[k]=v[Math.floor(Math.random()*v.length)];fill();$("avatar-status").textContent="A new look to try. Your callsign is unchanged. Save if you want to keep it.";});
$("forget").addEventListener("click",()=>{try{localStorage.removeItem(key);presetGeneration++;presetLoading=false;clearPng();photoGeneration++;photoLoading=false;originalImage=null;$("crop-controls").disabled=true;$("photo-file").value="";state={...defaults,mode:"character",photo:null};fill();$("avatar-status").textContent="Saved avatar removed from this browser. Mission badges are unchanged.";}catch{$("avatar-status").textContent="This browser could not remove the saved avatar. Use its site-data settings to remove it.";}});
$("photo-file").addEventListener("change",async()=>{const generation=++photoGeneration;photoLoading=false;const file=$("photo-file").files[0];if(!file)return;
if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5*1024*1024){$("avatar-status").textContent="Choose a JPG, PNG or WebP image no larger than 5 MB. Your current portrait is unchanged.";return;}
photoLoading=true;$("avatar-status").textContent="Opening your image on this device…";const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();if(generation!==photoGeneration)return;if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>20_000_000)throw Error("dimensions");$("photo-zoom").value="1";$("photo-x").value=$("photo-y").value="50";const photo=crop(img);originalImage=img;state.photo=photo;state.mode="photo";$("crop-controls").disabled=false;render();$("avatar-status").textContent="Image ready. Adjust the crop, then save on this device or download.";}catch{if(generation===photoGeneration)$("avatar-status").textContent="This image could not be opened. Try a smaller JPG, PNG or WebP.";}finally{URL.revokeObjectURL(url);if(generation===photoGeneration)photoLoading=false;}});
$("download-png").addEventListener("click",async()=>{
 if(photoLoading||presetLoading||state.mode!=="character"&&!state.photo){$("avatar-status").textContent="Choose an image and wait for its preview before downloading.";return;}
 const button=$("download-png");if(button.disabled)return;button.disabled=true;
 const generation=++pngGeneration;let sourceUrl=null;
 try{
  // Capture this click's portrait; later control changes do not alter this export.
  const source=state.mode!=="character"?state.photo:(sourceUrl=URL.createObjectURL(new Blob([svg()],{type:"image/svg+xml"})));
  $("avatar-status").textContent="Preparing your PNG on this device…";
  const image=new Image();image.src=source;await image.decode();if(generation!==pngGeneration)return;
  if(!image.naturalWidth||!image.naturalHeight)throw Error("Invalid image");
  const canvas=document.createElement("canvas");canvas.width=canvas.height=1024;
  const context=canvas.getContext("2d");if(!context)throw Error("Canvas unavailable");
  context.fillStyle="#0b1830";context.fillRect(0,0,1024,1024);
  const scale=Math.min(1024/image.naturalWidth,1024/image.naturalHeight);
  const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
  context.drawImage(image,(1024-width)/2,(1024-height)/2,width,height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
  if(generation!==pngGeneration)return;if(!blob)throw Error("PNG unavailable");
  const url=URL.createObjectURL(blob);if(pngUrl)URL.revokeObjectURL(pngUrl);pngUrl=url;
  $("png-preview").src=url;$("png-save").href=url;$("png-open").href=url;$("png-result").hidden=false;
  const link=document.createElement("a");link.href=url;link.download="federation-avatar.png";
  try{document.body.append(link);link.click();}catch{/* Persistent links remain available. */}finally{link.remove();}
  $("avatar-status").textContent="PNG ready below. A download was requested; use Save PNG again or Open full-size image if needed.";
 }catch{if(generation===pngGeneration)$("avatar-status").textContent="This browser could not create the PNG. Try Download original format instead.";}
 finally{if(sourceUrl)URL.revokeObjectURL(sourceUrl);button.disabled=false;}
});
$("download").addEventListener("click",()=>{if(photoLoading||presetLoading||state.mode!=="character"&&!state.photo){$("avatar-status").textContent="Choose an image and wait for its preview before downloading.";return;}if(state.mode!=="character"){const a=document.createElement("a");a.href=state.photo;a.download="federation-portrait.jpg";document.body.append(a);a.click();a.remove();$("avatar-status").textContent="Portrait download requested. Your callsign is not included in the image.";return;}const url=URL.createObjectURL(new Blob([svg()],{type:"image/svg+xml"}));const a=document.createElement("a");a.href=url;a.download="federation-explorer.svg";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$("avatar-status").textContent="Portrait download requested. Your callsign is not included in the image.";});
})();
