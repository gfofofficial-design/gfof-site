import {publishedStations,PARTNER_STATIONS} from './fed-alliance-registry.mjs';
import {COMPETITION_FORMATS} from './fed-alliance-launchpad-core.mjs';
// This source is public. Never add private intake, prospects, emails or agreements.
export const PUBLISHED_CHALLENGES=Object.freeze([]);
const states=Object.freeze({announced:'Announced',judging:'Judging',results:'Results published',cancelled:'Cancelled'});
const text=(v,n)=>typeof v==='string'&&v===v.trim()&&v.length>0&&v.length<=n&&!/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069<>]/.test(v);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const utc=v=>typeof v==='string'&&/^20\d{2}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
function teamsAccepted(review,teams){
 const common=['publication','reviewedAt','publicReference'];
 // Preserve the original two-team record, but never extend its attestation to a group.
 if(exact(review,[...common,'bothTeamsAccepted']))return teams.length===2&&review.bothTeamsAccepted===true;
 return exact(review,[...common,'acceptedTeams'])&&Array.isArray(review.acceptedTeams)&&
  review.acceptedTeams.length===teams.length&&new Set(review.acceptedTeams).size===teams.length&&
  Array.from(review.acceptedTeams).every(id=>teams.includes(id));
}
export function publishedChallenges(records=PUBLISHED_CHALLENGES,partners=PARTNER_STATIONS){
 if(!Array.isArray(records)||records.length>48)return [];
 const stations=new Map(publishedStations(partners).map(s=>[s.id,s])),counts=new Map();
 for(const r of records)if(typeof r?.id==='string')counts.set(r.id,(counts.get(r.id)||0)+1);
 return records.filter(r=>{
  if(!exact(r,['id','title','format','teams','status','startsAt','closesAt','updatedAt','rulesPath','resultsPath','review']))return false;
  if(typeof r.id!=='string'||!/^ARENA-[0-9]{4}$/.test(r.id)||counts.get(r.id)!==1||!text(r.title,90)||!Object.hasOwn(COMPETITION_FORMATS,r.format)||!Object.hasOwn(states,r.status))return false;
  if(!Array.isArray(r.teams)||r.teams.length<2||r.teams.length>4||new Set(r.teams).size!==r.teams.length||Array.from(r.teams).some(id=>!stations.has(id)))return false;
  if(!utc(r.startsAt)||!utc(r.closesAt)||!utc(r.updatedAt)||r.startsAt>=r.closesAt)return false;
  if(['judging','results'].includes(r.status)&&r.updatedAt<r.closesAt)return false;
  const prefix='/arena/'+r.id.toLowerCase();
  if(r.rulesPath!==prefix+'-rules'||r.resultsPath!==(r.status==='results'?prefix+'-results':null))return false;
  const v=r.review;
  return teamsAccepted(v,r.teams)&&v.publication==='approved'&&utc(v.reviewedAt)&&v.reviewedAt<=r.updatedAt&&v.reviewedAt<=r.startsAt&&typeof v.publicReference==='string'&&/^ARENA-REVIEW-[A-Z0-9-]{6,40}$/.test(v.publicReference);
 }).map(r=>Object.freeze({id:r.id,title:r.title,format:COMPETITION_FORMATS[r.format],teams:Object.freeze(r.teams.map(id=>Object.freeze({id,name:stations.get(id).name}))),status:states[r.status],startsAt:r.startsAt,closesAt:r.closesAt,updatedAt:r.updatedAt,rulesPath:r.rulesPath,resultsPath:r.resultsPath}));
}
export function mountChallengeBoard(document,records=PUBLISHED_CHALLENGES,partners=PARTNER_STATIONS){
 const board=document.getElementById('arena-matches'),status=document.getElementById('arena-match-status');
 if(!board||!status)throw Error('challenge_board_configuration');
 const rows=publishedChallenges(records,partners),node=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;return n;};
 if(!rows.length){board.replaceChildren(node('p','No project matches are published yet. Explore the formats or send a project request to start a discussion.'));status.textContent='No announced matches, live scores or results.';return;}
 board.replaceChildren(...rows.map(r=>{const card=document.createElement('article');card.className='activity-card';card.id=r.id.toLowerCase();
  card.append(node('p',r.id+' · '+r.status),node('h3',r.title),node('p',r.teams.map(t=>t.name).join(' vs ')),node('p',r.format),node('p','Published window (UTC): '+r.startsAt+' to '+r.closesAt),node('p','Record updated (UTC): '+r.updatedAt));
  const rules=node('a','Read agreed rules →');rules.href=r.rulesPath;card.append(rules);
  if(r.resultsPath){const results=node('a','Read reviewed results →');results.href=r.resultsPath;card.append(results);}
  return card;}));status.textContent=rows.length+' published match record'+(rows.length===1?'':'s')+'. Status is reviewed, not inferred from a running clock. Follow the rules for participation availability.';
}
if(typeof document!=='undefined'){try{mountChallengeBoard(document);}catch{const n=document.getElementById('arena-match-status');if(n)n.textContent='Match board unavailable. No participation or score is established by this page.';}}
