// Explicitly mounted form adapter. No account lookup, transport, storage or
// startup read of its own. A reviewed host supplies the enabled client factory.
import {profileFields,PROFILE_ROLES} from './fed-alliance-community-core.mjs';
const fields=['name','community','bio','role','listed'];
const same=(a,b)=>fields.every(k=>a[k]===b[k]);
const matchingDraft='Your draft matches the recorded profile shown here. No additional save is needed.';
const compareDraft='Current profile loaded for comparison. Your draft is kept. Confirm this version before making another change.';
const draftHelp='This draft stays in this page. Closing or reloading the page may lose unsaved text.';
export function mountMemberProfileForm(document,{enabled=false,createClient}={}){
 const get=id=>document.getElementById('ap-'+id),listeners=[];
 const ids=['form','fields','read','save','cancel','status','service-note','current','current-body','comparison','accept','draft-note','compare-jump',...fields,...fields.map(k=>k+'-error')];
 if(ids.some(id=>!get(id)))throw Error('member_form_unavailable');
 let disposed=false,client,busy=false,ready=false,paused=false,dirty=false,current=null,comparison=null,submitted=null,localComparison=false;
 const readFields=()=>Object.fromEntries(fields.map(k=>[k,k==='listed'?get(k).checked:get(k).value]));
 const writeFields=p=>{for(const k of fields){if(k==='listed')get(k).checked=p?.listed??false;else get(k).value=p?.[k]??(k==='role'?'explorer':'');}};
 const status=message=>{if(!disposed&&get('status').textContent!==message)get('status').textContent=message;};
 function matchesRecorded(){
  if(!current?.profile)return false;
  try{return same(profileFields(readFields()),current.profile);}catch{return false;}
 }
 const comparisonMessage=()=>matchesRecorded()?matchingDraft+' Confirm this version to keep editing.':compareDraft;
 function closeForm(message){get('fields').disabled=true;get('read').disabled=true;get('save').disabled=true;get('cancel').hidden=true;get('comparison').hidden=true;status(message);}
 if(enabled!==true){closeForm('Member profiles are not open yet. No account or profile request has started.');return Object.freeze({dispose(){disposed=true;}});}
 if(typeof createClient!=='function')throw Error('member_form_unavailable');
 const listen=(node,event,fn)=>{node.addEventListener(event,fn);listeners.push(()=>node.removeEventListener(event,fn));};
 function controls(){
  const matches=!busy&&(ready||comparison!==null)&&matchesRecorded();
  get('form').setAttribute('aria-busy',String(busy));
  get('read').setAttribute('aria-disabled',String(busy));get('save').setAttribute('aria-disabled',String(busy||!ready||paused||matches));
  get('accept').setAttribute('aria-disabled',String(busy||comparison===null));get('cancel').hidden=!busy;
  get('compare-jump').hidden=comparison===null;
  let note=draftHelp;
  if(matches)note=matchingDraft;
  else if(dirty)note='Your draft has changes. Reading or comparing keeps these fields.';
  get('draft-note').textContent=note;
 }
 function renderCurrent(){
  const target=get('current-body');target.replaceChildren();get('current').hidden=current===null;
  if(!current)return;
  const add=(label,value)=>{const term=document.createElement('dt'),detail=document.createElement('dd');term.textContent=label;detail.textContent=value;target.append(term,detail);};
  add('Profile version',String(current.revision));
  if(!current.profile){add('Profile','No profile existed at this read.');return;}
  for(const [label,key]of [['Display name','name'],['Project or community','community'],['Bio','bio']])add(label,current.profile[key]||'Not provided');
  add('Contribution role',PROFILE_ROLES[current.profile.role]);
  add('Directory visibility',current.profile.publication==='held'?'Held from publication':current.profile.listed?'Listed':'Unlisted');
  add('Recorded update',current.profile.updatedAt);
 }
 function onState(s){
  if(disposed)return;
  busy=['checking','saving','removing'].includes(s.status);
  if(s.status==='checking'){comparison=null;localComparison=false;get('comparison').hidden=true;}
  if(['ready','empty','saved'].includes(s.status)){
   current={profile:s.profile,revision:s.revision};ready=true;paused=false;
   if(s.status==='saved'){
    if(submitted&&same(readFields(),submitted)){writeFields(s.profile);dirty=false;}
    else dirty=true;
   }else if(!dirty)writeFields(s.profile);
   else{
    // Typing may begin after a clean read was dispatched. Keep that new draft
    // and require an explicit comparison even though this read was successful.
    ready=false;paused=true;comparison=s.revision;localComparison=true;
    get('comparison').hidden=false;renderCurrent();status(comparisonMessage());controls();return;
   }
   comparison=null;get('comparison').hidden=true;renderCurrent();
  }else if(s.status==='comparison_ready'){
   current={profile:s.profile,revision:s.revision};comparison=s.revision;localComparison=false;paused=true;ready=false;
   get('comparison').hidden=false;renderCurrent();
  }else if(s.status==='current_accepted'){
   ready=true;paused=false;comparison=null;get('comparison').hidden=true;
  }else if(['conflict','unknown','review_pending','review_required','sign_in_required','closed'].includes(s.status)){
   paused=true;ready=false;comparison=null;localComparison=false;get('comparison').hidden=true;
  }
  if(s.status==='comparison_ready')status(comparisonMessage());
  else if(s.status==='current_accepted'&&matchesRecorded())status(matchingDraft);
  else status(s.message);
  controls();
 }
 client=createClient(onState);
 if(!client||!['load','compare','save','acceptCurrent','cancel','dispose'].every(k=>typeof client[k]==='function')){client?.dispose?.();throw Error('member_form_unavailable');}
 get('fields').disabled=false;get('read').disabled=false;get('save').disabled=false;get('accept').disabled=false;
 get('service-note').textContent='Read your current profile before saving. Reading does not submit your draft.';
 status('Read your current profile to begin. Nothing has been submitted.');controls();
 function clearError(k){get(k).removeAttribute('aria-invalid');get(k).setAttribute('aria-describedby','ap-'+k+'-help');get(k+'-error').textContent='';get(k+'-error').hidden=true;}
 for(const k of fields)for(const event of ['input','change'])listen(get(k),event,()=>{
  dirty=true;clearError(k);
  if(!busy&&comparison!==null)status(comparisonMessage());
  else if(!busy&&ready&&!paused)status(matchesRecorded()?matchingDraft:'Draft updated. Choose Save my profile to check and submit it.');
  controls();
 });
 listen(get('read'),'click',async()=>{
  if(disposed||busy)return;
  try{await(dirty?client.compare():client.load());}catch{/* The transport emitted a bounded status; keep draft/focus. */}
 });
 listen(get('form'),'submit',async event=>{
  event.preventDefault();if(disposed||busy||!ready||paused)return;
  for(const k of fields)clearError(k);
  let input;try{input=profileFields(readFields());}catch(e){const k=fields.includes(e.field)?e.field:'name';get(k).setAttribute('aria-invalid','true');get(k).setAttribute('aria-describedby','ap-'+k+'-help ap-'+k+'-error');get(k+'-error').textContent=e.message;get(k+'-error').hidden=false;status('Check the highlighted field. Your draft is kept.');get(k).focus();return;}
  if(current?.profile&&same(input,current.profile)){status(matchingDraft);return;}
  submitted=readFields();try{await client.save(input);}catch{/* Never retry or replace a draft on unknown outcome. */}
 });
 listen(get('accept'),'click',()=>{
  if(disposed||busy||comparison===null)return;
  try{
   if(localComparison){localComparison=false;ready=true;paused=false;comparison=null;get('comparison').hidden=true;status(matchesRecorded()?matchingDraft:'Current version confirmed. Your draft is kept.');controls();}
   else client.acceptCurrent(comparison);
   get(matchesRecorded()?'name':'save').focus();
  }catch{status('Read the current profile again before confirming. Your draft is kept.');}
 });
 listen(get('cancel'),'click',()=>{if(disposed||!busy)return;client.cancel();get('read').focus();});
 return Object.freeze({dispose(){
  if(disposed)return;
  disposed=true;client.dispose();
  for(const remove of listeners)remove();
  for(const k of fields)clearError(k);
  writeFields(null);current=null;comparison=null;submitted=null;
  get('current-body').replaceChildren();get('current').hidden=true;
  get('comparison').hidden=true;get('compare-jump').hidden=true;
  get('form').setAttribute('aria-busy','false');get('draft-note').textContent=draftHelp;
  get('status').textContent='Member profile form closed. No further requests will start.';
  get('fields').disabled=true;get('read').disabled=true;get('save').disabled=true;get('accept').disabled=true;
 }});
}

