'use strict';
// Pure aggregation only: no endpoint, database, network, files or publication.
// Inputs MUST come from a trusted server-owned eligibility/event ledger. This
// function does not authenticate a caller or verify a human, mission or consent.
const DAY=86400000;
const exact=(value,keys)=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const opaque=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{16,80}$/.test(value);
function time(value) {
  if(typeof value!=='string'||!/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value))return NaN;
  const result=Date.parse(value);
  return Number.isFinite(result)&&new Date(result).toISOString()===value?result:NaN;
}
function invalid(){throw new TypeError('Invalid community league input');}
function buildCommunityStandings(input) {
  if(!exact(input,['season','stationIds','accounts','enrollments','actions','asOfUtc']))invalid();
  const {season,stationIds,accounts,enrollments,actions,asOfUtc}=input;
  if(!exact(season,['id','title','startsAtUtc','endsAtUtc'])||typeof season.id!=='string'||!/^[a-z][a-z0-9-]{1,31}$/.test(season.id)||
    typeof season.title!=='string'||!/^[A-Za-z0-9 ,.-]{1,60}$/.test(season.title))invalid();
  const start=time(season.startsAtUtc),end=time(season.endsAtUtc),asOf=time(asOfUtc);
  if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(asOf)||end-start<DAY||end-start>31*DAY||asOf<start||asOf>end)invalid();
  if(!Array.isArray(stationIds)||stationIds.length<1||stationIds.length>25||new Set(stationIds).size!==stationIds.length||
    !stationIds.includes('gfof')||stationIds.some(id=>typeof id!=='string'||!/^[a-z][a-z0-9-]{1,31}$/.test(id)))invalid();
  if(!Array.isArray(accounts)||accounts.length>100000||!Array.isArray(enrollments)||enrollments.length>100000||!Array.isArray(actions)||actions.length>500000)invalid();
  const stations=new Set(stationIds), people=new Map(), eventIds=new Map();
  for(const account of accounts) {
    if(!exact(account,['accountId','createdAtUtc','eligible'])||!opaque(account.accountId)||!Number.isFinite(time(account.createdAtUtc))||typeof account.eligible!=='boolean')invalid();
    const previous=people.get(account.accountId);
    if(previous&&(previous.createdAtUtc!==account.createdAtUtc||previous.eligible!==account.eligible))invalid();
    people.set(account.accountId,account);
  }
  function unique(event,kind,keys) {
    const signature=JSON.stringify([kind,...keys.map(key=>event[key])]);
    if(eventIds.has(event.eventId)) {
      if(eventIds.get(event.eventId)!==signature)invalid();
      return false;
    }
    eventIds.set(event.eventId,signature);return true;
  }
  const candidates=new Map();
  for(const entry of enrollments) {
    if(!exact(entry,['eventId','accountId','stationId','atUtc'])||!opaque(entry.eventId)||!people.has(entry.accountId)||!stations.has(entry.stationId)||!Number.isFinite(time(entry.atUtc)))invalid();
    if(!unique(entry,'enrollment',['accountId','stationId','atUtc']))continue;
    const at=time(entry.atUtc),account=people.get(entry.accountId),created=time(account.createdAtUtc);
    if(!account.eligible||created<start||created>at||at<start||at>=end||at>asOf)continue;
    const current=candidates.get(entry.accountId);
    if(!current||at<current.at)candidates.set(entry.accountId,{at,stations:new Set([entry.stationId])});
    else if(at===current.at)current.stations.add(entry.stationId);
  }
  const members=new Map();
  for(const [accountId,entry] of candidates)if(entry.stations.size===1)members.set(accountId,{stationId:[...entry.stations][0],at:entry.at,onboard:Infinity,returns:[]});
  for(const action of actions) {
    if(!exact(action,['eventId','accountId','type','atUtc'])||!opaque(action.eventId)||!people.has(action.accountId)||
      !['onboarding_completed','return_completed'].includes(action.type)||!Number.isFinite(time(action.atUtc)))invalid();
    if(!unique(action,'action',['accountId','type','atUtc']))continue;
    const member=members.get(action.accountId),at=time(action.atUtc);
    if(!member||at<member.at||at>=end||at>asOf)continue;
    if(action.type==='onboarding_completed')member.onboard=Math.min(member.onboard,at);
    else member.returns.push(at);
  }
  const rows=new Map(stationIds.map(stationId=>[stationId,{stationId,joined:0,activated:0,returned:0}]));
  for(const member of members.values()) {
    const row=rows.get(member.stationId);row.joined++;
    if(Number.isFinite(member.onboard)) {
      row.activated++;
      if(member.returns.some(at=>at>=member.onboard&&at-member.at>=7*DAY))row.returned++;
    }
  }
  return {schema:1,state:'published',methodology:'community-joins-v1',season:{...season},asOfUtc,rows:[...rows.values()]};
}
module.exports={buildCommunityStandings};
