export const option=(id,title,detail,disabled=false)=>`<button class="choice" data-action="${id}" ${disabled?'disabled':''}><strong>${title}</strong><span>${detail}</span><b aria-hidden="true">↗</b></button>`;
export const voice=(name,text)=>`<blockquote><span>${name.toUpperCase()} / CREW CHANNEL</span><p>“${text}”</p></blockquote>`;
export const heading=(label,title,lead='')=>`<div class="eyebrow">${label}</div><h1 id="scene-title" tabindex="-1">${title}</h1>${lead?`<p class="lead">${lead}</p>`:''}`;
export const reflection=(question,wrong,right)=>`<h2>Take one habit with you.</h2><p>${question}</p><div class="choices">${option('quiz-wrong',wrong,'')}${option('quiz-right',right,'')}</div><p id="feedback" role="status" aria-live="polite" class="feedback"></p><div id="completed" class="brief" hidden><strong>Chapter explored</strong><span id="saved"></span></div><div class="end-actions"><button data-action="restart">Replay another plan</button><a href="./#nextChapterTitle">Return to the chapter hub →</a></div>`;
export function startChapter(config){
 const $=id=>document.getElementById(id);let state=config.model.initial();
 function render(focus=true){
  $('scene').innerHTML=config.content(state);
  if(state.step==='reflect'){
   const next={ 'after-the-crowd':['changing-course.html','Continue with Aela →'], 'changing-course':['keys-to-the-gate.html','Continue with Eno →'], 'keys-to-the-gate':['meridian-relay.html','Bring the crew together →'] }[config.id];
   const link=document.createElement('a');link.href=next[0];link.textContent=next[1];$('scene').querySelector('.end-actions').prepend(link);
  }
  $('meters').replaceChildren();for(const [label,value] of config.metrics(state)){const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;div.append(dt,dd);$('meters').append(div);}
  $('position').textContent=config.status(state);
  $('notes').replaceChildren();for(const note of config.notes(state)){const li=document.createElement('li');li.textContent=note;$('notes').append(li);}
  if(focus){const target=focus==='inspect'&&$('inspection-result')?$('inspection-result'):focus==='verify'&&$('verification-result')?$('verification-result'):$('scene-title');target.focus();target.scrollIntoView({block:'start'});}
 }
 $('scene').addEventListener('click',event=>{
  const button=event.target.closest('button[data-action]');if(!button||button.disabled)return;const action=button.dataset.action;
  if(action==='quiz-wrong'){$('feedback').textContent=config.wrong;return;}
  if(action==='quiz-right'){
   $('feedback').textContent=config.right;let saved=false;try{sessionStorage.setItem(`gf-journey-${config.id}-v1`,'complete');saved=true;}catch{}
   $('completed').hidden=false;$('saved').textContent=saved?'Your chapter marker is saved in this tab. It carries no reward or rank.':'Reflection completed. This browser could not save a marker; you can still continue.';return;
  }
  state=action==='restart'?config.model.initial():config.model.step(state,action);render(action);
 });render(false);
}
