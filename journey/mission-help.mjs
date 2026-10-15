import {missionHint} from '../lib/mission-coach-core.mjs';

// Reviewed educational help only. No storage, progress or service operations.
export function mountMissionHelp(document,missionId){
 if(!missionHint(missionId,0))return false;
 const main=document.querySelector('main');
 if(!main||document.getElementById('mission-help'))return false;
 const panel=document.createElement('details');panel.id='mission-help';panel.className='panel';
 const summary=document.createElement('summary');summary.textContent='Need a hint?';
 const note=document.createElement('p');note.textContent='Reveal help one step at a time. These reviewed hints are for this fictional mission. They do not grade answers or change your badges.';
 const output=document.createElement('p');output.id='mission-help-output';output.setAttribute('role','status');output.setAttribute('aria-live','polite');output.setAttribute('aria-atomic','true');
 const next=document.createElement('button');next.type='button';next.textContent='Show first hint';next.setAttribute('aria-controls',output.id);
 const reset=document.createElement('button');reset.type='button';reset.textContent='Reset hints';reset.hidden=true;
 let level=0;
 next.addEventListener('click',()=>{
  const hint=missionHint(missionId,level);if(!hint)return;
  output.textContent='Hint '+(level+1)+' of 3: '+hint.hint;level++;
  next.textContent=level===3?'All three hints shown':'Show next hint';next.disabled=level===3;reset.hidden=false;
 });
 reset.addEventListener('click',()=>{level=0;output.textContent='Hints reset. You can reveal the first hint again.';next.disabled=false;next.textContent='Show first hint';reset.hidden=true;next.focus();});
 panel.append(summary,note,output,next,reset);
 const header=main.querySelector('header');if(header)header.after(panel);else main.prepend(panel);
 return true;
}
