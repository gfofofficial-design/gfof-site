import {ACTIVITIES, ROUTES, PREP_CHECKS, COMPETITION_FORMATS, COMPETITION_STARTERS, matchingActivities, updateSelection, crewPlan, prepareProjectBrief} from './fed-alliance-launchpad-core.mjs';
import {createArtworkSelection, artworkBrief} from './fed-alliance-artwork.mjs';

export function mountAllianceLaunchpad(document, options={}) {
  const byId=id=>document.getElementById(id);
  const role=byId('activity-role'), time=byId('activity-time');
  const schedule=options.setTimeout || globalThis.setTimeout;
  const unschedule=options.clearTimeout || globalThis.clearTimeout;
  const copy=options.copy || (text=>{
    if(typeof globalThis.navigator?.clipboard?.writeText !== 'function') throw Error('Clipboard unavailable');
    return globalThis.navigator.clipboard.writeText(text);
  });
  const createFile=options.createFile || (text=>{
    if(typeof globalThis.URL?.createObjectURL !== 'function' || typeof globalThis.Blob !== 'function') return null;
    return globalThis.URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
  });
  const revokeFile=options.revokeFile || (url=>globalThis.URL?.revokeObjectURL?.(url));
  const files=new Map(), copies=new Map();
  let selected=[...ROUTES.welcome.ids],disposed=false;

  function invalidateCopy(key) {
    copies.get(key)?.cancel(); copies.delete(key);
    byId(key+'-copy-status').textContent='';
  }
  function download(key,text) {
    const link=byId(key+'-download');
    if(files.has(key)) { try {revokeFile(files.get(key));} catch {} files.delete(key); }
    link.hidden=true; link.removeAttribute('href');
    if(!text) return;
    try { const url=createFile(text); if(url) {files.set(key,url);link.href=url;link.hidden=false;} } catch {}
  }
  function bindCopy(key) {
    byId(key+'-copy').addEventListener('click',async()=>{
      const area=byId(key+'-brief'), text=area.value;
      if(!text || byId(key+'-output').hidden) return;
      invalidateCopy(key);
      const token={}; copies.set(key,token);
      const current=()=>copies.get(key) === token && area.value === text && !byId(key+'-output').hidden;
      byId(key+'-copy-status').textContent='Copying… The text remains available below.';
      try {
        const interrupted=new Promise((_,reject)=>{
          token.cancel=()=>{unschedule(token.timer);reject(Error('Copy superseded'));};
          token.timer=schedule(()=>reject(Error('Copy wait exceeded')),5000);
        });
        // Start under the click. An OS clipboard write cannot be physically cancelled.
        await Promise.race([copy(text),interrupted]);
        if(current()) byId(key+'-copy-status').textContent='Copied. Review the draft before you choose to share it.';
      } catch {
        if(!current()) return;
        byId(key+'-copy-status').textContent='Select and copy the text below. Nothing has been sent.';
        area.focus(); area.select();
      } finally {
        unschedule(token.timer);
        if(copies.get(key) === token) copies.delete(key);
      }
    });
  }
  function element(tag,className,text) {
    const node=document.createElement(tag); if(className) node.className=className;
    if(text !== undefined) node.textContent=text; return node;
  }
  function activityLink(activity) {
    const link=element('a','text-link',activity.link+' ↗'); link.href=activity.href;
    if(activity.href.startsWith('https://')) {
      link.setAttribute('target','_blank'); link.setAttribute('rel','noopener noreferrer');
      link.append(element('span','sr-only',', opens a new tab'));
    }
    return link;
  }
  function renderActivities() {
    const activities=matchingActivities(role.value,time.value);
    const cards=activities.map(activity=>{
      const chosen=selected.includes(activity.id);
      const card=element('article','activity-card'); card.dataset.selected=String(chosen);
      const top=element('div','activity-top');
      top.append(element('span','eyebrow',activity.kind),element('span','activity-time','~'+activity.minutes+' MIN'));
      const details=element('details','activity-brief');
      const steps=element('ol'); activity.steps.forEach(step=>steps.append(element('li','',step)));
      details.append(element('summary','','Open the activity brief'),steps,element('p','small',activity.limit));
      const button=element('button','activity-toggle',chosen ? 'Remove from plan −' : 'Add to crew plan +');
      button.type='button'; button.id='activity-toggle-'+activity.id;
      button.setAttribute('aria-pressed',String(chosen));
      button.setAttribute('aria-label',(chosen ? 'Remove ' : 'Add ')+activity.title+(chosen ? ' from' : ' to')+' your crew plan');
      button.addEventListener('click',()=>{
        const next=updateSelection(selected,activity.id);
        if(!chosen && next.length === selected.length) {
          byId('crew-status').textContent='Your three plan slots are full. Remove an activity before adding another.'; return;
        }
        selected=next; renderActivities(); renderPlan();
        byId('crew-status').textContent=chosen ? 'Activity removed from your plan.' : 'Activity added to your plan. This is not a completion record.';
        byId('activity-toggle-'+activity.id)?.focus();
      });
      card.append(top,element('h3','',activity.title),element('p','',activity.summary),details,activityLink(activity),button);
      return card;
    });
    byId('activity-list').replaceChildren(...cards);
    byId('activity-status').textContent=activities.length ? activities.length+' of '+ACTIVITIES.length+' activity briefs shown. Estimated times; no points or membership awarded.' : 'No activities match both choices. Choose Show all paths to reset the filters.';
  }
  function renderPlan() {
    invalidateCopy('crew');
    const plan=crewPlan(selected,byId('crew-pace').value);
    byId('crew-count').textContent=selected.length+' / 3';
    byId('crew-duration').textContent=selected.length ? plan.minutes+' estimated activity minutes, plus discussion.' : 'Choose up to three activities, or load a route.';
    const rows=plan.activities.map((activity,index)=>{
      const row=element('li'); row.append(element('strong','',activity.title));
      const controls=element('div','selected-actions');
      if(index > 0) {
        const earlier=element('button','','Move earlier ↑'); earlier.type='button';
        earlier.setAttribute('aria-label','Move '+activity.title+' earlier in the plan');
        earlier.addEventListener('click',()=>{
          [selected[index-1],selected[index]]=[selected[index],selected[index-1]];
          renderPlan(); byId('crew-status').textContent='Activity order updated.'; byId('crew-plan-title').focus();
        }); controls.append(earlier);
      }
      const remove=element('button','','Remove'); remove.type='button';
      remove.setAttribute('aria-label','Remove '+activity.title+' from the plan');
      remove.addEventListener('click',()=>{selected=selected.filter(id=>id !== activity.id);renderActivities();renderPlan();byId('crew-status').textContent='Activity removed from your plan.';byId('crew-plan-title').focus();});
      controls.append(remove); row.append(controls); return row;
    });
    byId('crew-selected').replaceChildren(...rows);
    byId('crew-brief').value=plan.text;
    byId('crew-copy').disabled=!plan.text;
    download('crew',plan.text);
  }
  function prepCount() {
    const checks=Object.keys(PREP_CHECKS).filter(key=>byId('prep-'+key).checked);
    byId('prep-count').textContent=checks.length+' of 4 preparation items marked · self-reported';
    return checks;
  }
  function clearProjectOutput() {
    invalidateCopy('project'); byId('project-output').hidden=true;
    byId('project-brief').value=''; download('project','');
    for(const id of ['project-name','project-website','project-mint','project-interest','project-format','project-goal']) byId(id).removeAttribute('aria-invalid');
  }
  function syncCompetition(){
    const active=byId('project-interest').value==='competition';
    byId('project-competition').hidden=!active;
    for(const id of ['project-format','project-goal'])byId(id).disabled=!active;
    const known=Object.hasOwn(COMPETITION_STARTERS,byId('project-format').value);
    byId('project-starter-preview').textContent=active&&known?'Suggested starting point: '+COMPETITION_STARTERS[byId('project-format').value]:'';
    byId('project-use-starter').disabled=!active||!known;
  }
  function changedProject() {
    clearProjectOutput(); prepCount();
    byId('project-prep-status').textContent='Worksheet changed. Prepare a fresh discussion draft when ready. Nothing has been submitted.';
  }
  const artwork=createArtworkSelection({
    ...options.artwork,
    update(state) {
      clearProjectOutput();
      const input=byId('project-artwork'), image=byId('project-artwork-image');
      image.hidden=true; image.removeAttribute('src');
      byId('project-artwork-placeholder').hidden=state.status==='ready';
      byId('project-artwork-remove').hidden=!['ready','pending'].includes(state.status);
      input.removeAttribute('aria-invalid');
      if(state.status==='ready') {
        image.src=state.image.url;image.hidden=false;
        byId('project-artwork-status').textContent=state.image.name+' · '+state.image.width+' × '+state.image.height+' · '+Math.ceil(state.image.bytes/1024)+' KB. Selected on this device; attach the original when you share your draft.';
      } else if(state.status==='pending') {
        byId('project-artwork-status').textContent='Checking your image… You can remove it to cancel.';
      } else if(state.status==='error') {
        input.value='';input.setAttribute('aria-invalid','true');
        byId('project-artwork-status').textContent=state.message;
      } else {
        input.value='';
        byId('project-artwork-status').textContent='No image selected. You can prepare your introduction with or without artwork.';
      }
      byId('project-prep-status').textContent='Artwork changed. Prepare a fresh discussion draft when ready. Nothing has been submitted.';
    },
  });
  byId('project-artwork').addEventListener('change',()=>artwork.select(byId('project-artwork').files?.[0]));
  byId('project-artwork-remove').addEventListener('click',()=>{artwork.clear();byId('project-artwork').focus();});

  role.addEventListener('change',renderActivities); time.addEventListener('change',renderActivities);
  byId('activity-reset').addEventListener('click',()=>{role.value='all';time.value='all';renderActivities();role.focus();});
  byId('crew-load-route').addEventListener('click',()=>{
    const choice=byId('crew-route').value;
    const route=Object.hasOwn(ROUTES,choice) ? ROUTES[choice] : ROUTES.welcome;
    selected=[...route.ids];renderActivities();renderPlan();
    byId('crew-status').textContent=route.title+' loaded into your plan. No event or enrollment has been created.';
  });
  byId('crew-pace').addEventListener('change',renderPlan);
  byId('crew-clear').addEventListener('click',()=>{selected=[];renderActivities();renderPlan();byId('crew-status').textContent='Plan cleared from this tab. Any copy or downloaded file remains under your control.';});
  byId('project-form').addEventListener('submit',event=>{
    event.preventDefault(); clearProjectOutput();
    if(artwork.pending) {
      byId('project-prep-status').textContent='Finish checking the image, or remove it to continue without one.';byId('project-artwork').focus();return;
    }
    const result=prepareProjectBrief({name:byId('project-name').value,website:byId('project-website').value,mint:byId('project-mint').value,interest:byId('project-interest').value,format:byId('project-format').value,goal:byId('project-goal').value},prepCount());
    if(!result.ok) {
      byId('project-prep-status').textContent=result.message;
      const field=byId(result.field);field.setAttribute('aria-invalid','true');field.focus();return;
    }
    const text=result.text+artworkBrief(artwork.current);
    byId('project-brief').value=text;byId('project-output').hidden=false;
    download('project',text);
    byId('project-prep-status').textContent='Discussion draft prepared. '+result.prepared+' of 4 items self-reported; identity, consent and sources still need review. Nothing has been sent.';
  });
  for(const id of ['project-name','project-website','project-mint','project-goal']) byId(id).addEventListener('input',changedProject);
  byId('project-interest').addEventListener('change',()=>{syncCompetition();changedProject();});
  byId('project-format').addEventListener('change',()=>{syncCompetition();changedProject();});
  const useStarter=()=>{
    if(disposed||byId('project-interest').value!=='competition'||!Object.hasOwn(COMPETITION_STARTERS,byId('project-format').value))return;
    if(byId('project-goal').value.trim()){byId('project-prep-status').textContent='Your draft was kept. Clear the deliverable field first if you want to use the suggested brief.';byId('project-goal').focus();return;}
    byId('project-goal').value=COMPETITION_STARTERS[byId('project-format').value];changedProject();byId('project-prep-status').textContent='Starting brief added to your local draft. Adapt it for both teams before preparing a proposal. Nothing has been sent.';byId('project-goal').focus();
  };
  byId('project-use-starter').addEventListener('click',useStarter);
  const prepareArena=()=>{if(disposed)return;byId('project-interest').value='competition';if(!Object.hasOwn(COMPETITION_FORMATS,byId('project-format').value))byId('project-format').value='creative';syncCompetition();changedProject();byId('project-format').focus();};
  byId('arena-prepare').addEventListener('click',prepareArena);byId('arena-prepare').hidden=false;
  for(const key of Object.keys(PREP_CHECKS)) byId('prep-'+key).addEventListener('change',changedProject);
  byId('project-clear').addEventListener('click',()=>{
    artwork.clear();
    for(const id of ['project-name','project-website','project-mint']) byId(id).value='';
    byId('project-interest').value='education';byId('project-format').value='creative';byId('project-goal').value='';syncCompetition();for(const key of Object.keys(PREP_CHECKS))byId('prep-'+key).checked=false;
    clearProjectOutput();prepCount();byId('project-prep-status').textContent='Worksheet cleared from this tab. Copies or downloaded files are not deleted.';byId('project-name').focus();
  });
  bindCopy('crew'); bindCopy('project');
  renderActivities();renderPlan();prepCount();syncCompetition();
  byId('crew-plan-title').setAttribute('tabindex','-1');
  for(const id of ['activity-controls','crew-controls','crew-output'])byId(id).hidden=false;
  byId('project-fields').disabled=false;
  byId('project-prep-status').textContent='Use public project details only. The draft stays in this tab until you choose to copy or download it.';
  return {getSelection:()=>[...selected],dispose(){disposed=true;byId('project-use-starter').removeEventListener?.('click',useStarter);byId('project-use-starter').disabled=true;byId('arena-prepare').removeEventListener?.('click',prepareArena);byId('arena-prepare').disabled=true;artwork.dispose();for(const key of ['crew','project']){invalidateCopy(key);download(key,'');}}};
}

if(typeof document !== 'undefined') {
  try {mountAllianceLaunchpad(document);}
  catch {
    const status=document.getElementById('activity-status');
    if(status) status.textContent='The interactive console is unavailable. The public tool and station links still work.';
    const prep=document.getElementById('project-prep-status');
    if(prep) prep.textContent='The worksheet is unavailable. You can still discuss a station using public project details through the link below.';
  }
}
