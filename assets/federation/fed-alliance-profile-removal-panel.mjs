// Explicitly mounted, profile-only confirmation panel. Not imported by a page.
// Host must supply a fresh account-bound removal version, not an edit revision.
export function mountProfileRemovalPanel(root,{enabled=false,version,createClient}={}){
 if(!root||!root.ownerDocument||typeof enabled!=='boolean'||enabled&&(!Number.isSafeInteger(version)||version<0||version>=Number.MAX_SAFE_INTEGER||typeof createClient!=='function'))throw Error('profile_removal_panel_configuration');
 const doc=root.ownerDocument,make=(tag,text)=>{const node=doc.createElement(tag);if(text)node.textContent=text;return node;};
 const title=make('h2','Remove your Alliance profile'),scope=make('p','This removes your Alliance profile and detaches its image access. It does not delete your sign-in account or erase stored backups. Provider objects and backups may remain; this action does not confirm physical erasure.'),status=make('p',enabled?'Review the scope before continuing.':'Profile removal is not available yet. No request has been started.');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');status.setAttribute('tabindex','-1');
 const review=make('button','Review profile removal');review.type='button';review.disabled=!enabled;
 const confirmation=make('div'),label=make('label'),check=make('input');check.type='checkbox';label.append(check,make('span','I understand this removes my Alliance profile, not my sign-in account or backups.'));
 const confirm=make('button','Remove my Alliance profile'),back=make('button','Keep my profile');confirm.type=back.type='button';confirm.disabled=true;confirmation.append(label,confirm,back);confirmation.hidden=true;
 const reconcile=make('button','Check the same removal request'),cancel=make('button','Stop waiting');reconcile.type=cancel.type='button';reconcile.hidden=cancel.hidden=true;
 root.replaceChildren(title,scope,review,confirmation,status,reconcile,cancel);
 let disposed=false,busy=false,started=false,client;
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
  listen(review,'click',()=>{if(disposed||started||busy)return;check.checked=false;confirm.disabled=true;confirmation.hidden=false;review.hidden=true;check.focus();});
  listen(check,'change',()=>{confirm.disabled=busy||!check.checked;});
  listen(back,'click',()=>{if(disposed||busy||started)return;confirmation.hidden=true;check.checked=false;review.hidden=false;review.focus();});
  listen(confirm,'click',()=>{if(disposed||busy||started||!check.checked)return;started=true;review.hidden=true;confirmation.hidden=true;status.textContent='Removing your Alliance profile…';status.focus();return run(()=>client.confirm({version,confirm:'remove_my_profile'}));});
  listen(reconcile,'click',()=>{if(disposed||!started||busy)return;return run(()=>client.reconcile());});
  listen(cancel,'click',()=>{if(disposed||!busy)return;client.cancel();});
 }
 return Object.freeze({dispose(){if(disposed)return;disposed=true;client?.dispose();for(const off of handlers)off();root.replaceChildren();}});
}
