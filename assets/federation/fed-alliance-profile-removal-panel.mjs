// Explicitly mounted, profile-only confirmation panel. Not imported by a page.
// Host must supply a fresh account-bound removal version, not an edit revision.
export function mountProfileRemovalPanel(root,{enabled=false,profileBinding=false,collaborationEnabled=false,version,readVersion,createClient,beforeConfirm=()=>true}={}){
 if(!root||!root.ownerDocument||typeof collaborationEnabled!=='boolean'||typeof enabled!=='boolean'||typeof profileBinding!=='boolean'||profileBinding&&typeof readVersion!=='function'||readVersion!==undefined&&typeof readVersion!=='function'||enabled&&(typeof createClient!=='function'||typeof readVersion!=='function'&&(!Number.isSafeInteger(version)||version<0||version>=Number.MAX_SAFE_INTEGER)))throw Error('profile_removal_panel_configuration');
 const doc=root.ownerDocument,make=(tag,text)=>{const node=doc.createElement(tag);if(text)node.textContent=text;return node;};
 const title=make('h2','Remove your Alliance profile'),scope=make('p','This removes your Alliance profile and detaches its image access. '+(collaborationEnabled?'It also removes its private invitations, contributions and acknowledgements for both participants. ':'')+'It does not delete your sign-in account or erase stored backups. Provider objects and backups may remain; this action does not confirm physical erasure.'),status=make('p',enabled?'Review the scope before continuing.':'Profile removal is not available yet. No request has been started.');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');status.setAttribute('tabindex','-1');
 const review=make('button','Review profile removal');review.type='button';review.disabled=!enabled;
 const confirmation=make('div'),label=make('label'),check=make('input');check.type='checkbox';label.append(check,make('span',collaborationEnabled?'I understand this removes my profile and its private collaboration records for both participants, not my sign-in account or backups.':'I understand this removes my Alliance profile, not my sign-in account or backups.'));
 const confirm=make('button','Remove my Alliance profile'),back=make('button','Keep my profile');confirm.type=back.type='button';confirm.disabled=true;confirmation.append(label,confirm,back);confirmation.hidden=true;
 const reconcile=make('button','Check the same removal request'),cancel=make('button','Stop waiting');reconcile.type=cancel.type='button';reconcile.hidden=cancel.hidden=true;
 root.replaceChildren(title,scope,review,confirmation,status,reconcile,cancel);
 let disposed=false,busy=false,started=false,client,versionRead,selectedVersion=version,selectedProfileId;
 const onState=s=>{if(disposed)return;status.textContent=s.message;busy=s.status==='removing';cancel.hidden=!busy;
  if(s.status==='removed'){started=true;confirmation.hidden=true;review.hidden=true;reconcile.hidden=true;}
  else if(['unknown','removal_pending','sign_in_required','unavailable'].includes(s.status)&&started){reconcile.hidden=false;confirmation.hidden=true;review.hidden=true;}
  reconcile.disabled=busy;confirm.disabled=busy||!check.checked;back.disabled=busy;
 };
 if(enabled)client=createClient(onState);
 if(enabled&&!['confirm','reconcile','cancel','dispose'].every(k=>typeof client?.[k]==='function'))throw Error('profile_removal_panel_configuration');
 const handlers=[];const listen=(node,event,fn)=>{node.addEventListener(event,fn);handlers.push(()=>node.removeEventListener(event,fn));};
 const run=async fn=>{if(disposed||busy)return;busy=true;confirm.disabled=true;back.disabled=true;reconcile.disabled=true;cancel.hidden=false;try{await fn();}catch{if(!disposed){status.textContent='The removal outcome could not be confirmed. Keep this page open and contact support if checking remains unavailable.';if(started)reconcile.hidden=false;}}finally{if(!disposed){busy=false;cancel.hidden=true;reconcile.disabled=false;back.disabled=false;if(!started)confirm.disabled=!check.checked;}}};
 if(enabled){
  listen(review,'click',async()=>{
   if(disposed||started||busy)return;check.checked=false;confirm.disabled=true;
   if(readVersion){
    busy=true;review.disabled=true;selectedVersion=undefined;versionRead=new AbortController();status.textContent='Checking your current profile removal status…';
    try{const value=await readVersion({signal:versionRead.signal});if(disposed||versionRead.signal.aborted)return;
     if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==(profileBinding?2:1)||profileBinding&&(typeof value.profileId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.profileId))||!Number.isSafeInteger(value.version)||value.version<0||value.version>=Number.MAX_SAFE_INTEGER)throw Error('unavailable');selectedVersion=value.version;selectedProfileId=profileBinding?value.profileId:undefined;
    }catch{if(!disposed)status.textContent='Your removal status could not be confirmed. No removal was started. Try Review again or contact support.';return;}
    finally{busy=false;if(!disposed)review.disabled=false;versionRead=undefined;}
   }
   if(disposed)return;status.textContent='Review the removal scope, then confirm if you wish to continue.';confirmation.hidden=false;review.hidden=true;check.focus();
  });
  listen(check,'change',()=>{confirm.disabled=busy||!check.checked;});
  listen(back,'click',()=>{if(disposed||busy||started)return;confirmation.hidden=true;check.checked=false;review.hidden=false;if(readVersion){selectedVersion=undefined;selectedProfileId=undefined;}review.focus();});
  listen(confirm,'click',()=>{if(disposed||busy||started||!check.checked||!Number.isSafeInteger(selectedVersion))return;try{if(beforeConfirm()!==true){status.textContent='Finish the current profile request before confirming removal. No removal was started.';return;}}catch{status.textContent='Removal could not start. No removal was started.';return;}started=true;review.hidden=true;confirmation.hidden=true;status.textContent='Removing your Alliance profile…';status.focus();return run(()=>client.confirm({version:selectedVersion,confirm:'remove_my_profile',...(profileBinding?{profileId:selectedProfileId}:{})}));});
  listen(reconcile,'click',()=>{if(disposed||!started||busy)return;return run(()=>client.reconcile());});
  listen(cancel,'click',()=>{if(disposed||!busy)return;client.cancel();});
 }
 return Object.freeze({dispose(){if(disposed)return;disposed=true;versionRead?.abort();selectedVersion=undefined;selectedProfileId=undefined;client?.dispose();for(const off of handlers)off();root.replaceChildren();}});
}
