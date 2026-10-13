import {missionHint} from '/lib/mission-coach-core.mjs';
import {replayWatchtower} from '/lib/watchtower-core.mjs';
import {inspectAgentRecord} from '/lib/agent-record-core.mjs';
const missions=["repair-the-shuttle","the-signal","starport-market","observatory-journey","docking-request","long-way-home","borrowed-voice","after-the-crowd","changing-course","keys-to-the-gate","meridian-relay"];
const mission=document.getElementById('mission'),level=document.getElementById('level');
for(const id of missions){const option=document.createElement('option');option.value=id;option.textContent=id.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join(' ');mission.append(option);}
function hint(){document.getElementById('hint').textContent=missionHint(mission.value,Number(level.value))?.hint||'Choose an existing mission and hint depth.';}
mission.addEventListener('change',hint);level.addEventListener('change',hint);hint();
function output(id,paragraphs){const container=document.getElementById(id);container.replaceChildren();for(const text of paragraphs){const p=document.createElement('p');p.textContent=text;container.append(p);}}
const event={schema:1,chain:'solana-mainnet',type:'transfer',slot:100,eventIndex:0,signature:'2'.repeat(64),account:'1'.repeat(32),commitment:'finalized'};
document.getElementById('replay').addEventListener('click',()=>{
 const result=replayWatchtower([event,{...event},{...event,signature:'3'.repeat(64),slot:101,commitment:'confirmed'}]);
 output('watch-output',['Fictional replay: '+result.observations.length+' finalized observation; '+result.duplicates+' duplicate; '+result.pending+' awaiting finality.',...result.observations.map(x=>x.text),'Source authenticity is not verified. Event coverage is not established.']);
});
document.getElementById('audit').addEventListener('click',()=>{
 const result=inspectAgentRecord({schema:1,agentId:'fictional-reader',permissions:[{action:'read_public',resource:'federation/dashboard'}],attempts:[{action:'read_public',resource:'federation/dashboard',reportedOutcome:'completed'},{action:'sign_transaction',resource:'wallet/example',reportedOutcome:'unknown'}]});
 output('audit-output',['Fictional record: '+result.permissionViolations+' attempt outside declared permission.',...result.attempts.map(x=>x.action+': '+(x.permittedByDeclaredRecord?'within declared scope':'outside declared scope')+'; reported outcome '+x.reportedOutcome+'; not independently verified.'),result.limitation]);
});