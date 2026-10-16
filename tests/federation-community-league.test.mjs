import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {HOST_STATION,publishedStations} from '../assets/federation/fed-alliance-registry.mjs';
import {LEAGUE_SNAPSHOT} from '../assets/federation/fed-community-league-data.mjs';
import {readLeagueSnapshot,rankLeagueRows,metricChoice,exampleLeague} from '../assets/federation/fed-community-league-core.mjs';
import {mountCommunityLeague,LEAGUE_LINK} from '../assets/federation/fed-community-league.mjs';
const {buildCommunityStandings}=createRequire(import.meta.url)('../netlify/lib/community-league.cjs');
const clone=value=>structuredClone(value),now=Date.parse('2026-10-16T12:00:00.000Z');
const stations=[HOST_STATION,{id:'fixture',name:'Synthetic test station',symbol:'FIXTURE',relationship:'partner'}];
const published=()=>({schema:1,state:'published',methodology:'community-joins-v1',season:{id:'test-season',title:'Test season',startsAtUtc:'2026-10-01T00:00:00.000Z',endsAtUtc:'2026-10-31T00:00:00.000Z'},asOfUtc:'2026-10-16T10:00:00.000Z',rows:[{stationId:'gfof',joined:20,activated:15,returned:7},{stationId:'fixture',joined:12,activated:9,returned:4}]});

test('shipping release is prelaunch, host-only and has no invented zero totals',()=>{
  assert.equal(LEAGUE_SNAPSHOT.state,'prelaunch');assert.deepEqual(LEAGUE_SNAPSHOT.rows,[]);
  const model=readLeagueSnapshot(LEAGUE_SNAPSHOT,publishedStations(),now);
  assert.equal(model.kind,'prelaunch');assert.equal(model.rows.length,1);
  assert.equal(model.rows[0].joined,null);assert.equal(rankLeagueRows(model.rows,'joined')[0].rank,null);
});
test('prelaunch cannot carry counts or announced dates',()=>{
  for(const change of [{rows:[{stationId:'gfof',joined:0,activated:0,returned:0}]},{asOfUtc:published().asOfUtc},{season:published().season}])assert.equal(readLeagueSnapshot({...clone(LEAGUE_SNAPSHOT),...change},stations,now).kind,'unavailable');
});
test('published rows bind to the reviewed roster and remain aggregate-only',()=>{
  const model=readLeagueSnapshot(published(),stations,now);assert.equal(model.kind,'published');assert.equal(model.rows[1].station,stations[1]);
  const privateField=published();privateField.rows[0].accountId='must-never-be-published';assert.equal(readLeagueSnapshot(privateField,stations,now).kind,'unavailable');
});
test('missing, duplicate or unknown station totals fail the whole publication',()=>{
  const cases=[published(),published(),published()];cases[0].rows.pop();cases[1].rows[1].stationId='gfof';cases[2].rows[1].stationId='unapproved';
  for(const data of cases){const model=readLeagueSnapshot(data,stations,now);assert.equal(model.kind,'unavailable');assert.equal(model.rows[0].joined,null);}
});
test('negative, fractional, string, oversized and nonfinite totals are rejected',()=>{
  for(const value of [-1,1.5,'20',Infinity,NaN,1000000001,Number.MAX_SAFE_INTEGER]){const data=published();data.rows[0].joined=value;assert.equal(readLeagueSnapshot(data,stations,now).kind,'unavailable');}
});
test('activation and return counts must be subsets of the recruited cohort',()=>{
  for(const change of [{activated:21},{returned:16}]){const data=published();Object.assign(data.rows[0],change);assert.equal(readLeagueSnapshot(data,stations,now).kind,'unavailable');}
});
test('impossible, noncanonical, future and out-of-season capture times are rejected',()=>{
  for(const at of ['2026-02-30T00:00:00.000Z','2026-10-16T10:00:00Z','2026-10-16T13:00:00.000Z','2026-09-30T23:59:59.000Z','2026-11-01T00:00:00.000Z']){const data=published();data.asOfUtc=at;assert.equal(readLeagueSnapshot(data,stations,now).kind,'unavailable');}
});
test('season windows are bounded and returns cannot mature in under seven days',()=>{
  const data=published();data.season.endsAtUtc='2026-12-31T00:00:00.000Z';assert.equal(readLeagueSnapshot(data,stations,now).kind,'unavailable');
  const early=published();early.asOfUtc='2026-10-06T00:00:00.000Z';assert.equal(readLeagueSnapshot(early,stations,now).kind,'unavailable');
});
test('old dated totals are flagged rather than presented as current',()=>{
  const data=published();data.asOfUtc='2026-10-10T00:00:00.000Z';const model=readLeagueSnapshot(data,stations,now);assert.equal(model.kind,'published');assert.equal(model.stale,true);
});
test('unknown fields and methodology versions fail closed',()=>{
  for(const change of [{schema:2},{methodology:'other-rules'},{emails:[]},{state:'live'}])assert.equal(readLeagueSnapshot({...published(),...change},stations,now).kind,'unavailable');
});
test('positive ties share their place and zero or unknown has no rank',()=>{
  const rows=exampleLeague().rows;rows.push({station:{id:'z',name:'Zero'},joined:0,activated:0,returned:0},{station:{id:'u',name:'Unknown'},joined:null,activated:null,returned:null});
  assert.deepEqual(rankLeagueRows(rows,'joined').map(row=>row.rank),[1,2,2,4,null,null]);assert.equal(rows[0].rank,undefined);
});
test('each selected metric ranks independently with deterministic tie order',()=>{
  const rows=exampleLeague().rows;const a=rankLeagueRows(rows,'activated'),b=rankLeagueRows([...rows].reverse(),'joined');
  assert.deepEqual(a.map(row=>row.activated),[91,80,64,36]);assert.deepEqual(b.slice(1,3).map(row=>row.station.id),['example-lyra','example-vela']);
  assert.equal(metricChoice('constructor'),'joined');assert.equal(metricChoice('not-a-metric'),'joined');
});

function fixture(){
  const nodes=new Map();
  class Element{
    constructor(tag='div'){this.tag=tag;this.children=[];this.events={};this.attributes={};this.dataset={};this.value='';this.hidden=false;this._text='';}
    set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text;}
    set innerHTML(_){throw Error('No HTML interpolation');}
    append(...children){this.children.push(...children);}replaceChildren(...children){this.children=[...children];}
    setAttribute(key,value){this.attributes[key]=String(value);}addEventListener(name,callback){this.events[name]=callback;}
    focus(){document.activeElement=this;}select(){this.selected=true;}
  }
  const html=readFileSync(new URL('../alliance.html',import.meta.url),'utf8');
  for(const match of html.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){assert.equal(nodes.has(match[2]),false,'duplicate ID '+match[2]);const node=new Element(match[1]);node.hidden=/\shidden(?:\s|>)/.test(match[0]);nodes.set(match[2],node);}
  const document={getElementById:id=>nodes.get(id)||null,createElement:tag=>new Element(tag)};
  return {document,get:id=>document.getElementById(id)};
}
test('default UI shows actual prelaunch roster, no scores and enabled example controls',()=>{
  const app=fixture();mountCommunityLeague(app.document,{now});assert.match(app.get('league-mode').textContent,/PRELAUNCH/);assert.equal(app.get('league-total-joined').textContent,'—');assert.equal(app.get('league-rows').children.length,1);assert.equal(app.get('league-controls').hidden,false);assert.equal(app.get('league-share-controls').hidden,false);
});
test('example mode is opt-in, labelled at every data surface and reversible',()=>{
  const app=fixture();mountCommunityLeague(app.document,{now});app.get('league-example').events.click();
  assert.match(app.get('league-mode').textContent,/EXAMPLE ONLY/);assert.match(app.get('league-caption').textContent,/no real members/);assert.match(app.get('league-total-note').textContent,/Illustrative/);assert.equal(app.get('league-rows').children.length,4);
  for(const row of app.get('league-rows').children)assert.equal(row.children[1].children[1].textContent,'FICTIONAL TEAM');
  app.get('league-example').events.click();assert.equal(app.get('league-total-joined').textContent,'—');assert.equal(app.get('league-rows').children.length,1);assert.match(app.get('league-mode').textContent,/PRELAUNCH/);
});
test('changing ranking updates relative bars and labels without a data request',()=>{
  const app=fixture();mountCommunityLeague(app.document,{now});app.get('league-example').events.click();app.get('league-metric').value='activated';app.get('league-metric').events.change();
  const row=app.get('league-rows').children[0],bar=row.children[5].children[0];assert.equal(bar.max,91);assert.equal(bar.value,91);assert.match(bar.attributes['aria-label'],/activated members, fictional example/);assert.match(app.get('league-description').textContent,/server-verified/);
});
test('invalid publication never falls back to fabricated measurements',()=>{
  const app=fixture();mountCommunityLeague(app.document,{snapshot:{},now});assert.match(app.get('league-status').textContent,/could not be validated/);assert.equal(app.get('league-total-joined').textContent,'—');assert.match(app.get('league-mode').textContent,/UNAVAILABLE/);
});
test('published snapshot uses dated totals and flags stale data',()=>{
  const app=fixture(),data=published();data.asOfUtc='2026-10-10T00:00:00.000Z';mountCommunityLeague(app.document,{stations,snapshot:data,now});assert.equal(app.get('league-total-joined').textContent,'32');assert.match(app.get('league-asof').textContent,/Older than 48 hours/);assert.doesNotMatch(app.get('league-mode').textContent,/LIVE/);
});
test('sharing copies only a fixed public link, without enrollment or attribution data',async()=>{
  const app=fixture(),copies=[];mountCommunityLeague(app.document,{now,copy:async link=>copies.push(link)});await app.get('league-copy').events.click();assert.deepEqual(copies,[LEAGUE_LINK]);assert.equal(app.get('league-share-link').value,LEAGUE_LINK);assert.match(app.get('league-copy-status').textContent,/does not count a join/);
});
test('clipboard failure supplies a selectable manual link',async()=>{
  const app=fixture();mountCommunityLeague(app.document,{now,copy:async()=>{throw Error('denied');}});await app.get('league-copy').events.click();assert.equal(app.get('league-share-link').hidden,false);assert.equal(app.get('league-share-link').selected,true);assert.equal(app.document.activeElement,app.get('league-share-link'));
});
test('a late clipboard completion cannot replace a newer copy result',async()=>{
  const app=fixture();let finish,calls=0;mountCommunityLeague(app.document,{now,copy:()=>++calls===1?new Promise(resolve=>{finish=resolve;}):Promise.reject(Error('denied'))});const first=app.get('league-copy').events.click();await app.get('league-copy').events.click();finish();await first;assert.match(app.get('league-copy-status').textContent,/Select and copy/);
});
test('initialization and example interaction perform no network or storage access',()=>{
  const priorFetch=globalThis.fetch,priorStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');globalThis.fetch=()=>{throw Error('network prohibited');};Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('storage prohibited');}});
  try{const app=fixture();mountCommunityLeague(app.document,{now});app.get('league-example').events.click();app.get('league-metric').value='returned';app.get('league-metric').events.change();app.get('league-example').events.click();}finally{globalThis.fetch=priorFetch;if(priorStorage)Object.defineProperty(globalThis,'localStorage',priorStorage);else delete globalThis.localStorage;}
});
test('deck, privacy and no-script fallback describe real prelaunch status',()=>{
  const deck=readFileSync(new URL('../command-deck.html',import.meta.url),'utf8'),privacy=readFileSync(new URL('../command-deck-privacy.html',import.meta.url),'utf8'),html=readFileSync(new URL('../alliance.html',import.meta.url),'utf8');
  assert.match(deck,/href="\/alliance#community-league"/);assert.doesNotMatch(deck,/Nova Explorer|Stellar Voyager|sample rankings/);assert.match(privacy,/no member counts are collected/);assert.match(html,/<noscript><p class="league-status">/);assert.match(html,/connect-src 'none'/);assert.doesNotMatch(html,/<script[^>]+src="https:/);
});

const accountId=n=>'account_fixture_'+String(n).padStart(4,'0'),eventId=n=>'event_fixture_'+String(n).padStart(4,'0');
const ledger=()=>({season:published().season,stationIds:['gfof','fixture'],accounts:[{accountId:accountId(1),createdAtUtc:'2026-10-02T00:00:00.000Z',eligible:true}],enrollments:[{eventId:eventId(1),accountId:accountId(1),stationId:'fixture',atUtc:'2026-10-02T01:00:00.000Z'}],actions:[{eventId:eventId(2),accountId:accountId(1),type:'onboarding_completed',atUtc:'2026-10-02T02:00:00.000Z'},{eventId:eventId(3),accountId:accountId(1),type:'return_completed',atUtc:'2026-10-09T01:00:00.000Z'}],asOfUtc:published().asOfUtc});
const team=result=>result.rows.find(row=>row.stationId==='fixture');
test('trusted-ledger aggregation produces only the public snapshot contract',()=>{
  const data=ledger(),result=buildCommunityStandings(data);assert.deepEqual(team(result),{stationId:'fixture',joined:1,activated:1,returned:1});assert.equal(readLeagueSnapshot(result,stations,now).kind,'published');assert.doesNotMatch(JSON.stringify(result),/account_fixture|event_fixture|accountId|eventId/);
});
test('duplicate accounts, enrollments and actions cannot multiply a score',()=>{
  const data=ledger();data.accounts.push(clone(data.accounts[0]));data.enrollments.push(clone(data.enrollments[0]),{...data.enrollments[0],eventId:eventId(4)});data.actions.push(...clone(data.actions),{...data.actions[0],eventId:eventId(5)});assert.deepEqual(team(buildCommunityStandings(data)),{stationId:'fixture',joined:1,activated:1,returned:1});
});
test('the first valid community choice wins, regardless of input ordering',()=>{
  const data=ledger();data.enrollments.unshift({...data.enrollments[0],eventId:eventId(4),stationId:'gfof',atUtc:'2026-10-03T00:00:00.000Z'});const result=buildCommunityStandings(data);assert.equal(team(result).joined,1);assert.equal(result.rows[0].joined,0);
});
test('simultaneous conflicting community choices hold the account out of scores',()=>{
  const data=ledger();data.enrollments.push({...data.enrollments[0],eventId:eventId(4),stationId:'gfof'});assert.equal(team(buildCommunityStandings(data)).joined,0);assert.equal(buildCommunityStandings(data).rows[0].joined,0);
});
test('ineligible, pre-season and not-yet-created accounts cannot become recruits',()=>{
  for(const change of [{eligible:false},{createdAtUtc:'2026-09-30T00:00:00.000Z'},{createdAtUtc:'2026-10-03T00:00:00.000Z'}]){const data=ledger();Object.assign(data.accounts[0],change);assert.equal(team(buildCommunityStandings(data)).joined,0);}
});
test('season end is exclusive, and future events beyond capture time are excluded',()=>{
  for(const at of [published().season.endsAtUtc,'2026-10-17T00:00:00.000Z']){const data=ledger();data.enrollments[0].atUtc=at;assert.equal(team(buildCommunityStandings(data)).joined,0);}
});
test('repeat sign-in or arbitrary local badge events are not accepted event types',()=>{
  for(const type of ['signin','local_badge','page_visit']){const data=ledger();data.actions[0].type=type;assert.throws(()=>buildCommunityStandings(data),/Invalid community league input/);}
});
test('a return before seven full days, before activation or after close cannot count',()=>{
  const early=ledger();early.actions[1].atUtc='2026-10-09T00:59:59.999Z';assert.equal(team(buildCommunityStandings(early)).returned,0);
  const noActivation=ledger();noActivation.actions.shift();assert.equal(team(buildCommunityStandings(noActivation)).returned,0);
  const laterActivation=ledger();laterActivation.actions[0].atUtc='2026-10-10T00:00:00.000Z';assert.equal(team(buildCommunityStandings(laterActivation)).returned,0);
  const afterClose=ledger();afterClose.actions[1].atUtc=published().season.endsAtUtc;assert.equal(team(buildCommunityStandings(afterClose)).returned,0);
  const afterCapture=ledger();afterCapture.actions[1].atUtc='2026-10-17T00:00:00.000Z';assert.equal(team(buildCommunityStandings(afterCapture)).returned,0);
});
test('action order does not affect cohort counts or mutate the source ledger',()=>{
  const data=ledger(),before=clone(data);data.actions.reverse();const result=buildCommunityStandings(data);assert.equal(team(result).returned,1);data.actions.reverse();assert.deepEqual(data,before);
});
test('conflicting duplicate identifiers fail instead of silently overwriting evidence',()=>{
  const data=ledger();data.actions.push({...data.actions[0],type:'return_completed'});assert.throws(()=>buildCommunityStandings(data),/Invalid community league input/);
  const accounts=ledger();accounts.accounts.push({...accounts.accounts[0],eligible:false});assert.throws(()=>buildCommunityStandings(accounts),/Invalid community league input/);
});
test('unapproved stations, unknown accounts and extra private fields are refused',()=>{
  const a=ledger();a.enrollments[0].stationId='unapproved';const b=ledger();b.actions[0].accountId=accountId(99);const c=ledger();c.accounts[0].email='private@example.com';
  for(const data of [a,b,c])assert.throws(()=>buildCommunityStandings(data),/Invalid community league input/);
});
test('ledger and roster sizes are bounded with sanitized validation errors',()=>{
  const data=ledger();data.accounts=Array(100001);assert.throws(()=>buildCommunityStandings(data),{name:'TypeError',message:'Invalid community league input'});
  const roster=ledger();roster.stationIds=['fixture'];assert.throws(()=>buildCommunityStandings(roster),/Invalid community league input/);
});
test('an event identifier cannot be reused across enrollment and action streams',()=>{
  const data=ledger();data.actions[0].eventId=data.enrollments[0].eventId;assert.throws(()=>buildCommunityStandings(data),/Invalid community league input/);
});
test('a measured zero is displayed as zero but is never awarded first place',()=>{
  const data=published();for(const row of data.rows)Object.assign(row,{joined:0,activated:0,returned:0});
  const app=fixture();mountCommunityLeague(app.document,{stations,snapshot:data,now});assert.equal(app.get('league-total-joined').textContent,'0');for(const row of app.get('league-rows').children){assert.equal(row.children[0].textContent,'—');assert.equal(row.children[5].children[0].value,0);}
});
