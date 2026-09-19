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
$('seal').src='assets/gf-seal.png';$('art').src='assets/first-contact.png';
missions.forEach((m,i)=>{const card=document.createElement('article');card.className='card';const guide=document.createElement('div');guide.className='guide';guide.textContent=m[0];const h=document.createElement('h3');h.textContent=m[1];const p=document.createElement('p');p.textContent=m[2];const status=document.createElement('small');status.className='status';status.textContent=completed.includes(i)?'Completed in this tab':'Mission '+(i+1)+' · About 3 minutes';const link=document.createElement('a');link.className='button';link.href=m[3]+'.html';link.textContent=completed.includes(i)?'Play again →':'Begin mission →';card.append(guide,h,p,status,link);$('cards').append(card)});
$('count').textContent=available?completed.length+' of 5 missions completed':'Progress saving is unavailable in this browser';$('fill').style.width=completed.length*20+'%';$('allDone').hidden=completed.length!==5;
$('begin').onclick=()=>{location.href=missions[0][3]+'.html'};$('browse').onclick=()=>{$('guidesTitle').focus();$('guidesTitle').scrollIntoView({block:'start'})};
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload()});

try{if(sessionStorage.getItem("gf-journey-long-way-home-v1")==="complete")$("long-way-status").textContent="Chapter explored in this tab · Play again to find another ending."}catch{}
