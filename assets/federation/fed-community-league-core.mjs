// Presentation contract for reviewed, aggregate-only standings. Structural checks
// cannot authenticate accounts, establish unique humans or verify source events.
export const METHODOLOGY = 'community-joins-v1';
export const METRICS = Object.freeze({
  joined: Object.freeze({label:'Members joined', description:'New eligible Federation accounts that explicitly choose one community for the season.'}),
  activated: Object.freeze({label:'Activated members', description:'Those recruits who complete their first server-verified onboarding mission during the season.'}),
  returned: Object.freeze({label:'Returned after 7 days', description:'Activated recruits who complete a verified return action at least seven days after joining, within the season.'}),
});
const day = 86400000;
const exact = (value, keys) => !!value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000000;
function timestamp(value) {
  if(typeof value !== 'string' || !/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) return NaN;
  const time=Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value ? time : NaN;
}
export function metricChoice(value) { return Object.hasOwn(METRICS,value) ? value : 'joined'; }

export function readLeagueSnapshot(snapshot, stations, now = Date.now()) {
  const empty = kind => ({kind, title:'Founding season', asOfUtc:null, stale:false,
    rows:stations.map(station => ({station,joined:null,activated:null,returned:null}))});
  if(!exact(snapshot,['schema','state','methodology','season','asOfUtc','rows']) ||
    snapshot.schema !== 1 || snapshot.methodology !== METHODOLOGY ||
    !exact(snapshot.season,['id','title','startsAtUtc','endsAtUtc']) ||
    !/^[a-z][a-z0-9-]{1,31}$/.test(snapshot.season.id) ||
    typeof snapshot.season.title !== 'string' || !/^[A-Za-z0-9 ,.-]{1,60}$/.test(snapshot.season.title) ||
    !Array.isArray(snapshot.rows) || !Number.isFinite(now)) return empty('unavailable');
  if(snapshot.state === 'prelaunch') {
    return snapshot.asOfUtc === null && snapshot.season.startsAtUtc === null &&
      snapshot.season.endsAtUtc === null && snapshot.rows.length === 0 ? empty('prelaunch') : empty('unavailable');
  }
  const start=timestamp(snapshot.season.startsAtUtc), end=timestamp(snapshot.season.endsAtUtc), asOf=timestamp(snapshot.asOfUtc);
  if(snapshot.state !== 'published' || !Number.isFinite(start) || !Number.isFinite(end) ||
    !Number.isFinite(asOf) || end-start < day || end-start > 31*day ||
    asOf < start || asOf > end || asOf > now || snapshot.rows.length !== stations.length ||
    stations.length > 25) return empty('unavailable');
  const byId=new Map(stations.map(station => [station.id,station])), seen=new Set(), rows=[];
  if(byId.size !== stations.length) return empty('unavailable');
  for(const row of snapshot.rows) {
    if(!exact(row,['stationId','joined','activated','returned']) || !byId.has(row.stationId) || seen.has(row.stationId) ||
      !count(row.joined) || !count(row.activated) || !count(row.returned) ||
      row.activated > row.joined || row.returned > row.activated ||
      (asOf-start < 7*day && row.returned > 0)) return empty('unavailable');
    seen.add(row.stationId);
    rows.push({station:byId.get(row.stationId),joined:row.joined,activated:row.activated,returned:row.returned});
  }
  return {kind:'published',title:snapshot.season.title,asOfUtc:snapshot.asOfUtc,stale:now-asOf > 2*day,rows};
}

// Equal positive scores share a place (1, 2, 2, 4). Zero and unknown are unranked.
export function rankLeagueRows(rows, requestedMetric) {
  const metric=metricChoice(requestedMetric);
  const value=row => count(row[metric]) ? row[metric] : -1;
  const ordered=[...rows].sort((a,b) => value(b)-value(a) || (a.station.id < b.station.id ? -1 : a.station.id > b.station.id ? 1 : 0));
  let previous=-1, rank=null;
  return ordered.map((row,index) => {
    const score=value(row);
    if(score <= 0) return {...row,rank:null};
    if(score !== previous) {rank=index+1; previous=score;}
    return {...row,rank};
  });
}

// Deliberately fictional teams, outside the approved project registry. Never
// combine these with published totals or treat them as forecasts or partners.
export function exampleLeague() {
  return {kind:'example',title:'Example season',asOfUtc:null,stale:false,rows:[
    {station:{id:'example-orion',name:'Orion Crew',symbol:'EXAMPLE'},joined:128,activated:91,returned:63},
    {station:{id:'example-lyra',name:'Lyra Fleet',symbol:'EXAMPLE'},joined:96,activated:80,returned:62},
    {station:{id:'example-vela',name:'Vela Guild',symbol:'EXAMPLE'},joined:96,activated:64,returned:49},
    {station:{id:'example-aster',name:'Aster Crew',symbol:'EXAMPLE'},joined:42,activated:36,returned:21},
  ]};
}
