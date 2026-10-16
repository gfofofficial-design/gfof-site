import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HOST_STATION, PARTNER_STATIONS, validMint, safeWebsite, approvedPartner, publishedStations, stationLinks, stationChoice, matchingStations} from '../assets/federation/fed-alliance-registry.mjs';
import {mountAlliance} from '../assets/federation/fed-alliance.mjs';

// Synthetic fixture only. This is not a real project, endorsement or agreement.
const partner = () => ({
  id:'example', name:'Example Community', symbol:'EXAMPLE', badge:'EX', relationship:'partner',
  summary:'Synthetic fixture for station publication checks.', mint:'So11111111111111111111111111111111111111112',
  website:'https://example.com/', evidence:'https://example.com/disclosures',
  review:{consent:'confirmed',identity:'confirmed',publication:'approved',date:'2026-10-16',reference:'ALLIANCE-FIXTURE-0001'},
});

function fixture(href='https://preview.example/alliance') {
  const nodes = new Map(), visits = [];
  class Element {
    constructor(tag='div') { this.tag=tag; this.children=[]; this.events={}; this.attributes={}; this.dataset={}; this.value=''; this.hidden=false; this._text=''; }
    set textContent(value) { this._text=String(value); this.children=[]; }
    get textContent() { return this._text; }
    set innerHTML(_) { throw Error('HTML interpolation is not allowed'); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children=[...children]; this._text=''; }
    setAttribute(key,value) { this.attributes[key]=String(value); }
    removeAttribute(key) { delete this.attributes[key]; }
    addEventListener(name,callback) { this.events[name]=callback; }
    focus() { document.activeElement=this; }
  }
  const html=readFileSync(new URL('../alliance.html',import.meta.url),'utf8');
  for(const match of html.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)) {
    assert.equal(nodes.has(match[2]),false,'Duplicate HTML ID: '+match[2]);
    const node=new Element(match[1]); node.hidden=/\shidden(?:\s|>)/.test(match[0]); nodes.set(match[2],node);
  }
  const document = {getElementById(id) { return nodes.get(id)||null; }, createElement(tag) { return new Element(tag); }};
  const history={replaceState(...args) {visits.push(args);}};
  return {document,nodes,history,location:{href},visits,get:id=>document.getElementById(id)};
}

test('shipping directory contains the host and no external partner or prospect', () => {
  assert.deepEqual(PARTNER_STATIONS,[]);
  assert.deepEqual(publishedStations(),[HOST_STATION]);
  assert.equal(validMint(HOST_STATION.mint),true);
  assert.equal(HOST_STATION.relationship,'host');
});

test('partner publication needs all three recorded reviews', () => {
  assert.equal(approvedPartner(partner()),true);
  for(const key of ['consent','identity','publication']) {
    const entry=partner(); delete entry.review[key];
    assert.equal(approvedPartner(entry),false,key);
    assert.deepEqual(publishedStations([entry]),[HOST_STATION]);
  }
  const pending=partner(); pending.review.consent='pending';
  assert.equal(approvedPartner(pending),false);
});

test('invalid identity, token, review date and URLs stay unpublished', () => {
  const changes=[['id','gfof'],['id','../other'],['name','<img src=x>'],['symbol',' BAD'],['mint','111111111111111111111111111111111'],['website','javascript:alert(1)'],['evidence','https://user:pass@example.com/']];
  for(const [key,value] of changes) {
    const entry={...partner(),[key]:value};
    assert.equal(approvedPartner(entry),false,key);
  }
  const entry=partner(); entry.review.date='2026-02-30';
  assert.equal(approvedPartner(entry),false);
});

test('duplicate partner slugs fail closed rather than selecting an arbitrary identity', () => {
  const second={...partner(),name:'Different synthetic project'};
  assert.deepEqual(publishedStations([partner(),second]),[HOST_STATION]);
});

test('malformed or excessive registries preserve only the host', () => {
  for(const input of [null,{},'partner',Array.from({length:25},()=>partner())]) assert.deepEqual(publishedStations(input),[HOST_STATION]);
});

test('a public-key-shaped string must decode to exactly 32 bytes', () => {
  assert.equal(validMint('11111111111111111111111111111111'),true);
  for(const value of ['0'.repeat(44),'1'.repeat(33),'z'.repeat(44),null,'short']) assert.equal(validMint(value),false);
});

test('external links require unambiguous HTTPS URLs without credentials or ports', () => {
  assert.equal(safeWebsite('https://example.com/disclosures#source'),true);
  for(const value of ['//example.com/','https:example.com','http://example.com/','https://user@example.com/','https://example.com:444/','https://example.com/has space','https://example.com\\@other.com/']) assert.equal(safeWebsite(value),false,value);
});

test('Lens and explorer URLs derive from the selected reviewed mint', () => {
  const entry=partner(), links=stationLinks(entry);
  assert.equal(new URL(links.lens).origin,'https://dossiertrack.co');
  assert.equal(new URL(links.lens).searchParams.get('mint'),entry.mint);
  assert.equal(links.explorer,'https://solscan.io/token/'+entry.mint);
  entry.review.publication='pending';
  assert.throws(()=>stationLinks(entry),/Unpublished/);
});

test('a URL cannot introduce a new station or expose its raw value in the UI', () => {
  const stations=publishedStations([partner()]);
  assert.equal(stationChoice('example',stations).station.id,'example');
  assert.equal(stationChoice('https://unlisted.example',stations).station,HOST_STATION);
  const app=fixture('https://preview.example/alliance?station=%3Cscript%3Ebad%3C%2Fscript%3E');
  mountAlliance(app.document,app.location,app.history,stations);
  assert.equal(app.get('station-name').textContent,HOST_STATION.name);
  assert.match(app.get('station-message').textContent,/not published/);
  assert.doesNotMatch(app.get('station-message').textContent,/script|bad/);
  assert.equal(app.visits.length,0);
});

test('directory filtering matches published names or symbols only', () => {
  const stations=publishedStations([partner()]);
  assert.equal(matchingStations(' example ',stations)[0].id,'example');
  assert.equal(matchingStations('not listed',stations).length,0);
  assert.equal(matchingStations('',stations).length,2);
});

test('station changes update the mint, source links and pressed state together', () => {
  const stations=publishedStations([partner()]), app=fixture('https://preview.example/alliance?station=gfof&address=not-for-sharing');
  mountAlliance(app.document,app.location,app.history,stations);
  assert.equal(app.get('partner-count').textContent,'1');
  assert.equal(app.get('station-controls').hidden,false);
  assert.equal(app.get('station-empty-note').hidden,true);
  app.get('station-picker').value='example'; app.get('station-picker').events.change();
  assert.equal(app.get('station-name').textContent,'Example Community');
  assert.equal(app.get('station-mint').textContent,partner().mint);
  assert.equal(app.get('station-evidence').href,partner().evidence);
  assert.equal(app.get('station-explorer-link').href,'https://solscan.io/token/'+partner().mint);
  assert.equal(app.get('station-evidence-label').textContent,'Project-published evidence');
  assert.equal(app.get('station-website').attributes.target,'_blank');
  assert.equal(app.get('station-directory').children.find(card=>card.dataset.station==='example').attributes['aria-pressed'],'true');
  assert.equal(app.visits.at(-1)[2],'/alliance?station=example#station-explorer');
  assert.doesNotMatch(app.visits.at(-1)[2],/address|not-for-sharing/);
  app.get('station-picker').value='gfof'; app.get('station-picker').events.change();
  assert.equal(app.get('station-mint').textContent,HOST_STATION.mint);
  assert.equal(app.get('station-website').attributes.target,undefined);
});

test('selecting a station card moves focus to its updated details', () => {
  const app=fixture(), stations=publishedStations([partner()]);
  mountAlliance(app.document,app.location,app.history,stations);
  app.get('station-directory').children[1].events.click();
  assert.equal(app.get('station-name').textContent,'Example Community');
  assert.equal(app.document.activeElement,app.get('station-detail'));
});

test('empty search results recover with the Clear button', () => {
  const app=fixture(); mountAlliance(app.document,app.location,app.history);
  app.get('station-search').value='unpublished'; app.get('station-search').events.input();
  assert.equal(app.get('station-directory').children.length,0);
  assert.match(app.get('station-filter-status').textContent,/No published station/);
  app.get('station-search-clear').events.click();
  assert.equal(app.get('station-directory').children.length,1);
  assert.equal(app.document.activeElement,app.get('station-search'));
});

test('host-only initialization performs no fetch and no storage access', () => {
  const originalFetch=globalThis.fetch, storage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  let calls=0;
  globalThis.fetch=()=>{calls++; throw Error('network prohibited');};
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('storage prohibited');}});
  try {
    const app=fixture(); mountAlliance(app.document,app.location,app.history);
    assert.equal(calls,0);
    assert.equal(app.get('partner-count').textContent,'0');
    assert.equal(app.get('station-empty-note').hidden,false);
  } finally {
    globalThis.fetch=originalFetch;
    if(storage)Object.defineProperty(globalThis,'localStorage',storage); else delete globalThis.localStorage;
  }
});
