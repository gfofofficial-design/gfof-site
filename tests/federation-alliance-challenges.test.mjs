import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {PUBLISHED_CHALLENGES,publishedChallenges,mountChallengeBoard} from '../assets/federation/fed-alliance-challenges.mjs';
import {captionLines, mountMoonEditor} from '../assets/federation/fed-alliance-wrong-moon.mjs';

test('the meme caption wraps words and preserves joined emoji in long captions', () => {
  const glyphs = new Intl.Segmenter(undefined, {granularity: 'grapheme'});
  const measure = value => Array.from(glyphs.segment(value)).length;
  assert.deepEqual(captionLines('   It followed us home.  ', measure, 10), ['It', 'followed', 'us home.']);
  assert.deepEqual(captionLines('🚀👩‍🚀🌕🛰️', measure, 2), ['🚀👩‍🚀', '🌕🛰️']);
  assert.deepEqual(captionLines('     ', measure, 10), []);
});

const moonPage = 'https://galacticfederation.co/alliance-wrong-moon';
const makerAddress = 'GalacticFederation.co/moon';

test('the printed meme address has a public route to the canonical guest editor', () => {
  const html = readFileSync(new URL('../alliance-wrong-moon.html', import.meta.url), 'utf8');
  const config = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
  const choice = html.match(/<input\b[^>]*\bid="moon-address"[^>]*>/)?.[0] ?? '';
  assert.match(choice, /\btype="checkbox"/);
  assert.match(choice, /\bchecked\b/);
  assert.ok(choice.includes(`value="${makerAddress}"`));
  const short = new URL('https://' + makerAddress);
  assert.equal(short.origin, new URL(moonPage).origin);
  const routes = config.split('[[redirects]]');
  const firstMatch = routes.find(rule => rule.includes(`from = "${short.pathname}"`) || rule.includes('from = "/*"'));
  assert.ok(firstMatch?.includes(`to = "${new URL(moonPage).pathname}"`));
  assert.match(firstMatch, /status = 302\b/);
});

test('the community directory opens the guest meme and its return link focuses the same entry', () => {
  const deck = readFileSync(new URL('../command-deck.html', import.meta.url), 'utf8');
  const meme = readFileSync(new URL('../alliance-wrong-moon.html', import.meta.url), 'utf8');
  const community = deck.match(/<section aria-labelledby="deck-tools-community">([\s\S]*?)<\/section>/)?.[1] ?? '';
  const link = community.match(/<a\b[^>]*href="\/alliance-wrong-moon"[^>]*>/)?.[0] ?? '';
  const id = link.match(/\bid="([^"]+)"/)?.[1];
  assert.ok(id, 'the direct guest link needs a return anchor');
  assert.ok(meme.includes(`href="/command-deck#${id}"`));
});

function moonFixture() {
  const elements = new Map();
  const document = {querySelector(selector) {
    assert.equal(selector, 'link[rel="canonical"]');
    return {href: moonPage};
  }, getElementById(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '', setAttribute(key, value) { this[key] = value; },
      removeAttribute(key) { delete this[key]; },
      focus() { document.activeElement = this; }, select() { this.selected = true; },
      addEventListener(type, fn) { this[type] = fn; }
    });
    return elements.get(id);
  }};
  const get = document.getElementById.bind(document);
  const encoded = [];
  const drawn = [];
  const canvas = get('moon-preview');
  canvas.getContext = () => ({
    measureText: text => ({width: text.length * 25}),
    drawImage() { drawn.length = 0; }, fillRect() {}, fillText(line) { drawn.push(line); }
  });
  canvas.toBlob = (callback, type) => { assert.equal(type, 'image/jpeg'); encoded.push(callback); };
  Object.assign(get('moon-art'), {complete: true, naturalHeight: 1024, naturalWidth: 1536, alt: 'Two space tugs.'});
  Object.assign(get('moon-address'), {checked: true, value: makerAddress});
  document.defaultView = {getComputedStyle: () => ({direction: 'ltr'}), navigator: {}};
  return {document, get, encoded, drawn, canvas};
}

test('the meme download tracks the latest caption when encodes finish out of order or the visitor clears it', () => {
  const {document, get, encoded, drawn, canvas} = moonFixture();
  const caption = get('moon-caption');
  const save = get('moon-save');
  mountMoonEditor(document);
  assert.equal(get('moon-controls').hidden, false);
  assert.equal(save['aria-disabled'], 'true');
  caption.value = 'Wrong address.'; caption.input();
  caption.value = 'It followed us home.'; caption.input();
  const file = new Blob(['image']);
  encoded[1](file);
  const currentUrl = save.href;
  assert.match(currentUrl, /^blob:/);
  assert.equal(drawn[0], caption.value);
  assert.match(canvas['aria-label'], /It followed us home/);
  encoded[0](file);
  assert.equal(save.href, currentUrl);
  caption.value = 'Another draft.'; caption.input();
  caption.value = ''; caption.input();
  encoded[2](file);
  assert.equal(save.href, undefined);
  assert.equal(canvas.hidden, true);
  assert.equal(get('moon-art').hidden, false);
});

test('the image address can be removed and restored while an earlier JPEG is still encoding', () => {
  const {document, get, encoded, drawn, canvas} = moonFixture();
  const choice = get('moon-address');
  const caption = get('moon-caption');
  const save = get('moon-save');
  mountMoonEditor(document);
  assert.equal(get('moon-address-option').hidden, true);
  caption.value = 'It followed us home.'; caption.input();
  assert.equal(get('moon-address-option').hidden, false);
  const linkedHeight = canvas.height;
  const plainShare = get('moon-share-text').value;
  assert.deepEqual(drawn, [caption.value, makerAddress]);
  assert.ok(canvas['aria-label'].includes(makerAddress));
  choice.checked = false; choice.change();
  assert.deepEqual(drawn, [caption.value]);
  assert.ok(canvas.height < linkedHeight);
  assert.ok(!canvas['aria-label'].includes(makerAddress));
  const jpeg = new Blob(['fixture'], {type:'image/jpeg'});
  encoded[0](jpeg);
  assert.equal(save.href, undefined);
  encoded[1](jpeg);
  assert.match(save.href, /^blob:/);
  choice.checked = true; choice.change();
  assert.deepEqual(drawn, [caption.value, makerAddress]);
  assert.equal(canvas.height, linkedHeight);
  assert.equal(save.href, undefined);
  assert.equal(get('moon-share-text').value, plainShare);
  caption.value = ''; caption.input();
  encoded[2](jpeg);
  assert.equal(save.href, undefined);
  assert.equal(get('moon-address-option').hidden, true);
});

test('guests can share in plain text without waiting for art or posting their caption', async () => {
  const {document, get, encoded} = moonFixture();
  const art = get('moon-art');
  art.complete = false;
  const copies = [];
  document.defaultView.navigator.clipboard = {writeText(text) { copies.push(text); }};
  mountMoonEditor(document);
  assert.equal(get('moon-controls').hidden, false);
  assert.equal(get('moon-share').hidden, true);
  const input = get('moon-caption');
  input.value = '  Voss ordered the 🌕 & signed for it.  ';
  input.input();
  const expected = input.value.trim() + '\n\nThe Wrong Moon · Federation Alliance\n' + moonPage;
  assert.equal(get('moon-share-text').value, expected);
  assert.equal(get('moon-share').hidden, false);
  assert.equal(get('moon-save')['aria-disabled'], 'true');
  assert.equal(get('moon-address-option').hidden, true);
  assert.equal(encoded.length, 0);
  assert.deepEqual(copies, []);
  await get('moon-copy').click();
  assert.deepEqual(copies, [expected]);
  assert.match(get('moon-copy-status').textContent, /Copied/);
  art.complete = true;
  art.load();
  assert.equal(encoded.length, 1);
  encoded[0](null);
  assert.equal(get('moon-share-text').value, expected);
  assert.match(get('moon-status').textContent, /as text/);
  input.value = ' ';
  input.input();
  assert.equal(get('moon-share-text').value, '');
  assert.equal(get('moon-share').hidden, true);
  assert.equal(get('moon-share').open, false);
});

test('a cached editor page without the address choice still exports its caption', () => {
  const {document, get, encoded, drawn} = moonFixture();
  document.getElementById = id => ['moon-address-option', 'moon-address'].includes(id) ? null : get(id);
  mountMoonEditor(document);
  const caption = get('moon-caption');
  caption.value = 'Old chart, new orbit.'; caption.input();
  assert.deepEqual(drawn, [caption.value]);
  encoded[0](new Blob(['fixture'], {type:'image/jpeg'}));
  assert.match(get('moon-save').href, /^blob:/);
});

test('manual copy works without canvas or clipboard and a late rejection cannot select stale text', async () => {
  const {document, get, canvas} = moonFixture();
  canvas.getContext = () => null;
  mountMoonEditor(document);
  const input = get('moon-caption'), button = get('moon-copy'), text = get('moon-share-text');
  input.value = 'Wrong orbit.';
  input.input();
  get('moon-share').open = true;
  button.focus();
  await button.click();
  assert.equal(document.activeElement, text);
  assert.equal(text.selected, true);
  assert.match(get('moon-copy-status').textContent, /Copy command/);
  let rejectWrite;
  document.defaultView.navigator.clipboard = {writeText: () => new Promise((_, reject) => { rejectWrite = reject; })};
  const pending = button.click();
  input.value = 'New orbit.'; input.focus(); input.input();
  rejectWrite(new Error('Clipboard denied'));
  await pending;
  assert.equal(document.activeElement, input);
  assert.equal(get('moon-copy-status').textContent, '');
  assert.ok(text.value.startsWith('New orbit.'));
});
const partner=()=>({id:'example',name:'Synthetic test community',symbol:'EX',badge:'EX',relationship:'partner',summary:'Synthetic fixture, not an actual partner.',mint:'So11111111111111111111111111111111111111112',website:'https://example.com/',evidence:'https://example.com/evidence',review:{consent:'confirmed',identity:'confirmed',publication:'approved',date:'2026-10-21',reference:'ALLIANCE-FIXTURE-0001'}});
const record=()=>({id:'ARENA-0001',title:'Synthetic competition fixture',format:'creative',teams:['gfof','example'],status:'announced',startsAt:'2026-11-01T12:00:00.000Z',closesAt:'2026-11-15T12:00:00.000Z',updatedAt:'2026-10-21T18:00:00.000Z',rulesPath:'/arena/arena-0001-rules',resultsPath:null,review:{bothTeamsAccepted:true,publication:'approved',reviewedAt:'2026-10-21T17:00:00.000Z',publicReference:'ARENA-REVIEW-FIXTURE-0001'}});
const pub=r=>publishedChallenges([r],[partner()]);
test('shipping board has no invented matches and actual published paths must exist',()=>{
 assert.deepEqual(PUBLISHED_CHALLENGES,[]);assert.deepEqual(publishedChallenges(),[]);
 for(const r of publishedChallenges())for(const path of [r.rulesPath,r.resultsPath].filter(Boolean))assert.ok(existsSync(new URL('..'+path+'.html',import.meta.url)));
});
test('legacy acceptance applies only to two distinct published stations',()=>{
 assert.equal(pub(record()).length,1);
 for(const teams of [['gfof','gfof'],['gfof','unknown'],['gfof'],['gfof','example','other']])assert.equal(pub({...record(),teams}).length,0);
 for(const review of [{...record().review,bothTeamsAccepted:false},{...record().review,publication:'pending'},{...record().review,reviewedAt:'2026-11-02T12:00:00.000Z'}])assert.equal(pub({...record(),review}).length,0);
 assert.equal(publishedChallenges([record()],[{...partner(),review:{...partner().review,consent:'pending'}}]).length,0);
});
test('malformed records, duplicates and private extra fields never render',()=>{
 for(const r of [null,{}, {...record(),email:'private@example.com'},{...record(),format:'__proto__'},{...record(),status:'active'},{...record(),title:'Hidden\u202e text'},{...record(),rulesPath:'https://example.com/private?token=x'}])assert.equal(pub(r).length,0);
 assert.deepEqual(publishedChallenges([record(),record()],[partner()]),[]);assert.deepEqual(publishedChallenges(null),[]);assert.deepEqual(publishedChallenges(Array(49).fill(record()),[partner()]),[]);
});
test('UTC dates, ordering and results publication are explicit and coherent',()=>{
 for(const patch of [{startsAt:'2026-02-30T12:00:00.000Z'},{closesAt:record().startsAt},{updatedAt:'2026-10-21T18:00:00+00:00'},{status:'results'},{status:'judging'}])assert.equal(pub({...record(),...patch}).length,0);
 const result={...record(),status:'results',updatedAt:'2026-11-16T12:00:00.000Z',resultsPath:'/arena/arena-0001-results'};assert.equal(pub(result).length,1);
 assert.equal(pub({...result,resultsPath:'/arena/other-results'}).length,0);assert.equal(pub({...record(),status:'cancelled'}).length,1);
});
test('public projections are immutable copies and omit review metadata',()=>{
 const r=record(),out=pub(r)[0];r.title='Changed';r.teams[0]='unknown';assert.equal(out.title,'Synthetic competition fixture');assert.equal(out.teams[0].id,'gfof');assert.ok(Object.isFrozen(out)&&Object.isFrozen(out.teams)&&Object.isFrozen(out.teams[0]));assert.equal(Object.hasOwn(out,'review'),false);
});
function fixture(){class E{constructor(){this.children=[];this._text='';}set textContent(t){this._text=t;}get textContent(){return this._text+this.children.map(c=>c.textContent).join(' ');}append(...c){this.children.push(...c);}replaceChildren(...c){this.children=c;this._text='';}set innerHTML(_){throw Error('Unsafe interpolation');}}
 const board=new E(),status=new E();return {board,status,doc:{getElementById:id=>id==='arena-matches'?board:id==='arena-match-status'?status:null,createElement:()=>new E()}};
}
test('empty board is honest and performs no member/provider lookup',()=>{const f=fixture();mountChallengeBoard(f.doc);assert.match(f.board.textContent,/No project matches/);assert.match(f.status.textContent,/No announced matches, live scores/);});
test('published cards show stable identity, teams, UTC dates and only reviewed local links',()=>{const f=fixture();mountChallengeBoard(f.doc,[record()],[partner()]);assert.match(f.board.textContent,/ARENA-0001 · Announced/);assert.match(f.board.textContent,/Galactic Federation of Finance vs Synthetic test community/);assert.equal(f.board.children[0].children.at(-1).href,'/arena/arena-0001-rules');assert.match(f.status.textContent,/not inferred from a running clock/);});

const groupPartners=()=>['example','second','third','fourth'].map(id=>({...partner(),id,name:'Synthetic '+id+' community'}));
function groupRecord(size=4){const r=record();r.teams=['gfof','example','second','third','fourth'].slice(0,size);r.review={publication:'approved',reviewedAt:r.review.reviewedAt,publicReference:r.review.publicReference,acceptedTeams:[...r.teams]};return r;}
const groupPub=r=>publishedChallenges([r],groupPartners());
test('two to four teams require an exact acceptance set; order is not consent identity',()=>{
 for(const size of [2,3,4]){const r=groupRecord(size);r.review.acceptedTeams.reverse();assert.equal(groupPub(r).length,1);assert.deepEqual(groupPub(r)[0].teams.map(t=>t.id),r.teams);}
 for(const size of [1,5])assert.equal(groupPub(groupRecord(size)).length,0);
 for(const teams of [['gfof','example','second','unknown'],['gfof','example','example','third']]){const r=groupRecord();r.teams=teams;r.review.acceptedTeams=[...teams];assert.equal(groupPub(r).length,0);}
 const r=groupRecord();r.review=record().review;assert.equal(groupPub(r).length,0);
});
test('partial, duplicate, extra or malformed group attestations are withheld',()=>{
 for(const acceptedTeams of [null,true,'all',[],['gfof','example','second'],['gfof','example','second','second'],['gfof','example','second','unknown'],['gfof','example','second','third','fourth']]){
  const r=groupRecord();r.review.acceptedTeams=acceptedTeams;assert.equal(groupPub(r).length,0);
 }
 for(const patch of [{bothTeamsAccepted:true},{email:'private@example.com'},{publication:'pending'},{reviewedAt:'2026-11-02T12:00:00.000Z'}]){const r=groupRecord();Object.assign(r.review,patch);assert.equal(groupPub(r).length,0);}
 const partners=groupPartners();partners[2].review={...partners[2].review,consent:'pending'};assert.equal(publishedChallenges([groupRecord()],partners).length,0);
 const sparseAcceptance=groupRecord();delete sparseAcceptance.review.acceptedTeams[2];assert.equal(groupPub(sparseAcceptance).length,0);
 const sparseTeams=groupRecord();delete sparseTeams.teams[2];delete sparseTeams.review.acceptedTeams[2];assert.equal(groupPub(sparseTeams).length,0);
});
test('group projections omit acceptance metadata and preserve explicit result gates',()=>{
 const r=groupRecord(),out=groupPub(r)[0];r.review.acceptedTeams.pop();r.teams.pop();assert.equal(out.teams.length,4);assert.ok(Object.isFrozen(out.teams)&&out.teams.every(Object.isFrozen));assert.equal(Object.hasOwn(out,'review'),false);
 const result={...groupRecord(),status:'results',updatedAt:'2026-11-16T12:00:00.000Z',resultsPath:'/arena/arena-0001-results'};
 assert.equal(groupPub(result).length,1);assert.equal(groupPub({...result,resultsPath:null}).length,0);assert.equal(groupPub({...result,updatedAt:record().updatedAt}).length,0);
});
test('a group renders one match with every approved team and the same agreed rules',()=>{
 const f=fixture();mountChallengeBoard(f.doc,[groupRecord()],groupPartners());assert.equal(f.board.children.length,1);
 assert.match(f.board.textContent,/Galactic Federation of Finance vs Synthetic example community vs Synthetic second community vs Synthetic third community/);
 assert.equal(f.board.children[0].children.at(-1).href,'/arena/arena-0001-rules');assert.match(f.status.textContent,/1 published match record/);
});
