'use strict';
const missions=[
['Sera · Sirian','Repair the Shuttle','Plan for an unexpected expense.','repair-the-shuttle'],
['Oryn · Arcturian','The Signal That Looked Too Good','Investigate before trusting a promise.','the-signal'],
['Kael · Lyran','The Starport Market','Find out what remains after costs.','starport-market'],
['Aela · Pleiadian','The Observatory Journey','Balance today with a future goal.','observatory-journey'],
['Eno · Andromedan','The Docking Request','Check what you are authorizing.','docking-request']];
const $=id=>document.getElementById(id);let completed=[],available=true;
try{const s=sessionStorage;s.setItem('gf-journey-test','1');s.removeItem('gf-journey-test');const v=JSON.parse(s.getItem('gf-journey-v1')||'[]');if(Array.isArray(v))completed=v.filter(x=>Number.isInteger(x)&&x>=0&&x<5)}catch(e){available=false}
completed=[...new Set(completed)];
missions.forEach((m,i)=>{const card=document.createElement('article');card.className='card';const guide=document.createElement('div');guide.className='guide';guide.textContent=m[0];const h=document.createElement('h3');h.textContent=m[1];const p=document.createElement('p');p.textContent=m[2];const status=document.createElement('small');status.className='status';status.textContent=completed.includes(i)?'Completed in this tab':'Mission '+(i+1)+' · About 3 minutes';const link=document.createElement('a');link.className='button';link.href=m[3]+'.html';link.textContent=completed.includes(i)?'Play again →':'Begin mission →';card.append(guide,h,p,status,link);$('cards').append(card)});
$('count').textContent=available?completed.length+' of 5 missions completed':'Progress saving is unavailable in this browser';$('fill').style.width=completed.length*20+'%';$('allDone').hidden=completed.length!==5;
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload()});

const deeperMissions=['long-way-home','borrowed-voice','after-the-crowd','changing-course','keys-to-the-gate'];
let deeperCompleted=0;
try{
 for(const slug of deeperMissions){
  if(sessionStorage.getItem('gf-journey-'+slug+'-v1')==='complete'){
   deeperCompleted++;$(slug+'-status').textContent='Explored in this tab · Replay any time';
  }
 }
 $('chapter-count').textContent=deeperCompleted+' of 5 deeper missions explored';
 $('chapter-fill').style.width=deeperCompleted*20+'%';
 $('chapter-done').hidden=deeperCompleted!==5;
}catch{$('chapter-count').textContent='Chapter progress saving is unavailable in this browser';}

try{if(sessionStorage.getItem("gf-journey-meridian-relay-v1")==="complete")$("crew-status").textContent="Crew mission explored in this tab · Replay any time";}catch{$("crew-status").textContent="Progress saving is unavailable; you can still play."}
