import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ACTIVITIES, ROUTES, PREP_CHECKS, matchingActivities, selectActivities, updateSelection, crewPlan, prepareProjectBrief} from '../assets/federation/fed-alliance-launchpad-core.mjs';
import {mountAllianceLaunchpad} from '../assets/federation/fed-alliance-launchpad.mjs';
import {ARTWORK_LIMITS, artworkFileProblem, artworkSignature, artworkDimensions, artworkBrief, createArtworkSelection} from '../assets/federation/fed-alliance-artwork.mjs';

const publicFields=()=>({name:'Example Community',website:'https://example.com/',mint:'',interest:'education'});
const flush=()=>new Promise(setImmediate);
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

test('activity links use reviewed tools and never start a lookup through a query',()=>{
  assert.equal(ACTIVITIES.length,10);assert.equal(new Set(ACTIVITIES.map(a=>a.id)).size,10);
  for(const activity of ACTIVITIES){
    const url=new URL(activity.href,'https://galacticfederation.co/alliance');
    assert.ok(['https://galacticfederation.co','https://dossiertrack.co'].includes(url.origin));
    assert.equal(url.search,'');assert.doesNotMatch(url.pathname,/api|account|auth|callback/);
    assert.equal(activity.steps.length,3);assert.ok(activity.minutes>=5&&activity.minutes<=15);
    assert.ok(Object.isFrozen(activity)&&Object.isFrozen(activity.steps));
  }
});
test('role and time filters combine without treating an empty match as unavailable tools',()=>{
  assert.equal(matchingActivities('all','all').length,10);
  assert.equal(matchingActivities('research','10').length,2);
  assert.equal(matchingActivities('research','5').length,0);
  assert.equal(matchingActivities('create','all').length,2);
  assert.equal(matchingActivities('__proto__','bogus').length,10);
});
test('selection is bounded, unique, reviewed and immutable to its caller',()=>{
  const ids=[...ROUTES.welcome.ids];assert.equal(updateSelection(ids,'lens-notes').length,3);
  assert.deepEqual(ids,ROUTES.welcome.ids);assert.equal(updateSelection(ids,ids[0]).length,2);
  for(const input of [null,['unknown'],['first-mission','first-mission'],ACTIVITIES.slice(0,4).map(a=>a.id)])assert.throws(()=>selectActivities(input));
  assert.throws(()=>updateSelection([], '__proto__'));
});
test('crew plans preserve chosen order and keep schedules and points explicitly uncreated',()=>{
  const ids=['lens-notes','first-mission'];const plan=crewPlan(ids,'week');
  assert.equal(plan.minutes,13);assert.ok(plan.text.indexOf('controls behind')<plan.text.indexOf('first money'));
  assert.match(plan.text,/Day 1/);assert.match(plan.text,/Day 3/);
  assert.match(plan.text,/not a scheduled event, competition entry or verified completion record/);
  assert.match(plan.text,/No membership, League points, prizes or rewards/);
  assert.doesNotMatch(plan.text,/\?station=|referral|utm_/);
  assert.equal(crewPlan([]).text,'');assert.match(crewPlan(ids,'__proto__').text,/One shared session/);
  for(const route of Object.values(ROUTES))assert.equal(selectActivities(route.ids).length,3);
});
test('project briefs use public inputs as text and keep every preparation item self-reported',()=>{
  const result=prepareProjectBrief(publicFields(),Object.keys(PREP_CHECKS));
  assert.equal(result.ok,true);assert.equal(result.prepared,4);
  assert.match(result.text,/Example Community/);assert.match(result.text,/self-reported, not independently verified/);
  assert.match(result.text,/does not approve a partner, create an account, enroll members or grant access/);
  assert.match(result.text,/Chain\/mint: not supplied/);
  const withMint=prepareProjectBrief({...publicFields(),mint:'So11111111111111111111111111111111111111112'},[]);
  assert.equal(withMint.ok,true);assert.match(withMint.text,/Solana \/ So111/);
});
test('unsafe or private-looking website forms are refused without reflecting their value',()=>{
  for(const website of ['javascript:alert(1)','http://example.com','https://user:password@example.com/','https://example.com/?token=not-public','https://example.com/#login','https://example.com:444/','https://example.com\\@other.com/']){
    const result=prepareProjectBrief({...publicFields(),website});
    assert.equal(result.ok,false,website);assert.equal(result.field,'project-website');assert.ok(!Object.hasOwn(result,'text'));assert.doesNotMatch(result.message,/password|not-public/);
  }
});
test('malformed project data and unknown checklist items cannot create an export',()=>{
  for(const name of ['', 'a', 'x'.repeat(71), '<img src=x>', 'Line\nBreak', 'Hidden\u202eName'])assert.equal(prepareProjectBrief({...publicFields(),name}).ok,false);
  assert.equal(prepareProjectBrief({...publicFields(),mint:'ticker'}).ok,false);
  assert.equal(prepareProjectBrief({...publicFields(),interest:'__proto__'}).ok,false);
  for(const checks of [['unknown'],['consent','consent'],null])assert.equal(prepareProjectBrief(publicFields(),checks).ok,false);
});

function fixture(options={}){
  const nodes=new Map(), created=[],revoked=[],copies=[],timers=new Map();let now=0,nextTimer=0;
  let document;
  class Element{
    constructor(tag='div'){this.tag=tag;this.children=[];this.events={};this.attributes={};this.dataset={};this.value='';this.hidden=false;this.checked=false;this.disabled=false;this._text='';this.focusCount=0;this.selectCount=0;}
    set id(value){this._id=value;nodes.set(value,this);}get id(){return this._id;}
    set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text;}
    set innerHTML(_){throw Error('HTML interpolation forbidden');}
    append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;this._text='';}
    setAttribute(key,value){this.attributes[key]=String(value);}removeAttribute(key){delete this.attributes[key];if(key==='href')delete this.href;}
    addEventListener(name,fn){this.events[name]=fn;}emit(name){return this.events[name]?.({preventDefault(){}});}
    focus(){document.activeElement=this;this.focusCount++;}select(){this.selectCount++;}
  }
  const html=readFileSync(new URL('../alliance.html',import.meta.url),'utf8');
  for(const match of html.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){
    assert.equal(nodes.has(match[2]),false,'duplicate HTML id: '+match[2]);
    const node=new Element(match[1]);node.id=match[2];node.hidden=/\shidden(?:\s|>)/.test(match[0]);node.disabled=/\sdisabled(?:\s|>)/.test(match[0]);
  }
  document={getElementById:id=>nodes.get(id)||null,createElement:tag=>new Element(tag)};
  const get=id=>document.getElementById(id);
  for(const [id,value] of Object.entries({'activity-role':'all','activity-time':'all','crew-route':'welcome','crew-pace':'session','project-interest':'education'}))get(id).value=value;
  const clock={timers,async advance(ms){now+=ms;for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}await flush();}};
  const api=mountAllianceLaunchpad(document,{
    artwork:options.artwork,
    copy(text){copies.push(text);return options.copy ? options.copy(text) : Promise.resolve();},
    createFile(text){if(options.files===false)return null;const url='blob:synthetic-'+(created.length+1);created.push({url,text});return url;},
    revokeFile:url=>revoked.push(url),
    setTimeout(fn,ms){assert.equal(ms,5000);const id=++nextTimer;timers.set(id,{fn,at:now+ms});return id;},
    clearTimeout:id=>timers.delete(id),
  });
  function setProject(fields=publicFields()){for(const [key,value] of Object.entries(fields))get('project-'+(key==='website'?'website':key)).value=value;}
  return {get,api,document,created,revoked,copies,clock,setProject};
}
test('the console mounts eight activities, a usable route and no enrollment state',()=>{
  const b=fixture();assert.equal(b.get('activity-list').children.length,10);assert.deepEqual(b.api.getSelection(),ROUTES.welcome.ids);
  assert.equal(b.get('crew-count').textContent,'3 / 3');assert.equal(b.get('activity-controls').hidden,false);
  assert.equal(b.get('project-fields').disabled,false);assert.equal(b.get('project-output').hidden,true);
  assert.match(b.get('crew-brief').value,/LOCAL DRAFT/);assert.equal(b.created.length,1);b.api.dispose();
});
test('filter reset recovers an empty match while preserving the crew plan',()=>{
  const b=fixture();b.get('activity-role').value='research';b.get('activity-time').value='5';b.get('activity-role').emit('change');
  assert.equal(b.get('activity-list').children.length,0);assert.match(b.get('activity-status').textContent,/No activities match/);
  b.get('activity-reset').emit('click');assert.equal(b.get('activity-list').children.length,10);assert.deepEqual(b.api.getSelection(),ROUTES.welcome.ids);
  assert.equal(b.document.activeElement,b.get('activity-role'));b.api.dispose();
});
test('adding, removing and clearing activities enforce the three-slot limit',()=>{
  const b=fixture();b.get('crew-clear').emit('click');assert.equal(b.get('crew-copy').disabled,true);assert.equal(b.get('crew-download').hidden,true);
  for(const id of ['lens-notes','lock-evidence','useful-guide'])b.get('activity-toggle-'+id).emit('click');
  b.get('activity-toggle-first-mission').emit('click');assert.equal(b.api.getSelection().length,3);assert.match(b.get('crew-status').textContent,/slots are full/);
  b.get('activity-toggle-lens-notes').emit('click');assert.equal(b.api.getSelection().length,2);
  assert.equal(b.get('activity-toggle-lens-notes').attributes['aria-pressed'],'false');assert.ok(b.revoked.length>=4);b.api.dispose();
});
test('route and pace controls regenerate a local draft and refuse inherited route keys',()=>{
  const b=fixture();b.get('crew-route').value='evidence';b.get('crew-load-route').emit('click');assert.deepEqual(b.api.getSelection(),ROUTES.evidence.ids);
  b.get('crew-pace').value='fortnight';b.get('crew-pace').emit('change');assert.match(b.get('crew-brief').value,/Day 14/);
  b.get('crew-route').value='__proto__';b.get('crew-load-route').emit('click');assert.deepEqual(b.api.getSelection(),ROUTES.welcome.ids);b.api.dispose();
});
test('keyboard reorder and removal update exported order and keep a focus target',()=>{
  const b=fixture();let row=b.get('crew-selected').children[1];row.children[1].children[0].emit('click');
  assert.equal(b.api.getSelection()[0],'lending-lab');assert.equal(b.document.activeElement,b.get('crew-plan-title'));
  row=b.get('crew-selected').children[0];row.children[1].children.at(-1).emit('click');assert.equal(b.api.getSelection().includes('lending-lab'),false);b.api.dispose();
});
test('stalled clipboard falls back after five seconds without losing the draft',async()=>{
  const slow=deferred(),b=fixture({copy:()=>slow.promise});const original=b.get('crew-brief').value;
  const copying=b.get('crew-copy').emit('click');await b.clock.advance(4999);assert.match(b.get('crew-copy-status').textContent,/Copying/);
  await b.clock.advance(1);await copying;assert.match(b.get('crew-copy-status').textContent,/Select and copy/);
  assert.equal(b.get('crew-brief').value,original);assert.equal(b.get('crew-brief').selectCount,1);assert.equal(b.clock.timers.size,0);
  slow.resolve();await flush();assert.match(b.get('crew-copy-status').textContent,/Select and copy/);b.api.dispose();
});
for(const outcome of ['resolve','reject'])test('editing a plan suppresses late clipboard '+outcome,async()=>{
  const slow=deferred(),b=fixture({copy:()=>slow.promise});const copying=b.get('crew-copy').emit('click');
  b.get('crew-clear').emit('click');await copying;assert.equal(b.clock.timers.size,0);slow[outcome](outcome==='reject'?Error('late failure'):undefined);await flush();
  assert.equal(b.get('crew-copy-status').textContent,'');assert.equal(b.get('crew-brief').selectCount,0);assert.equal(b.get('crew-brief').value,'');b.api.dispose();
});
test('refused clipboard and unavailable downloads retain the accessible manual text',async()=>{
  const b=fixture({files:false,copy:()=>{throw Error('permission refused');}});await b.get('crew-copy').emit('click');
  assert.equal(b.get('crew-download').hidden,true);assert.match(b.get('crew-copy-status').textContent,/Nothing has been sent/);assert.equal(b.document.activeElement,b.get('crew-brief'));assert.equal(b.clock.timers.size,0);b.api.dispose();
});
test('project worksheet validates a public draft before exposing an export',()=>{
  const b=fixture();b.setProject({...publicFields(),website:'https://example.com/?secret=not-public'});b.get('project-form').emit('submit');
  assert.equal(b.get('project-output').hidden,true);assert.equal(b.document.activeElement,b.get('project-website'));assert.equal(b.get('project-website').attributes['aria-invalid'],'true');
  b.setProject();b.get('prep-consent').checked=true;b.get('project-form').emit('submit');
  assert.equal(b.get('project-output').hidden,false);assert.match(b.get('project-brief').value,/Example Community/);assert.match(b.get('project-prep-status').textContent,/1 of 4 items self-reported/);assert.equal(b.get('project-website').attributes['aria-invalid'],undefined);b.api.dispose();
});
test('changing project fields invalidates the old export and pending copy',async()=>{
  const slow=deferred(),b=fixture({copy:()=>slow.promise});b.setProject();b.get('project-form').emit('submit');
  const old=b.get('project-download').href,copying=b.get('project-copy').emit('click');b.get('project-name').value='Different Community';b.get('project-name').emit('input');await copying;
  assert.equal(b.get('project-output').hidden,true);assert.equal(b.get('project-brief').value,'');assert.ok(b.revoked.includes(old));assert.equal(b.clock.timers.size,0);
  slow.resolve();await flush();assert.equal(b.get('project-copy-status').textContent,'');b.api.dispose();
});
test('clear worksheet removes tab inputs and draft without claiming to delete copies',()=>{
  const b=fixture();b.setProject();b.get('prep-identity').checked=true;b.get('project-form').emit('submit');b.get('project-clear').emit('click');
  for(const id of ['project-name','project-website','project-mint','project-brief'])assert.equal(b.get(id).value,'');
  assert.equal(b.get('prep-identity').checked,false);assert.equal(b.get('project-output').hidden,true);assert.match(b.get('project-prep-status').textContent,/not deleted/);b.api.dispose();
});
test('console interactions perform no network, storage or account work',()=>{
  const previousFetch=globalThis.fetch,storage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');let calls=0;
  globalThis.fetch=()=>{calls++;throw Error('network prohibited');};Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('storage prohibited');}});
  try{const b=fixture();b.get('crew-route').value='builders';b.get('crew-load-route').emit('click');b.setProject();b.get('project-form').emit('submit');assert.equal(calls,0);b.api.dispose();}
  finally{globalThis.fetch=previousFetch;if(storage)Object.defineProperty(globalThis,'localStorage',storage);else delete globalThis.localStorage;}
});

function pngHeader(width=512,height=512) {
  const bytes=new Uint8Array(24),view=new DataView(bytes.buffer);
  bytes.set([137,80,78,71,13,10,26,10]);view.setUint32(8,13);view.setUint32(12,0x49484452);view.setUint32(16,width);view.setUint32(20,height);return bytes;
}
function imageFile({name='example-logo.png',type='image/png',bytes=pngHeader(),read}={}) {
  return {name,type,size:bytes.length,arrayBuffer:read || (async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength))};
}
function artworkFixture(extra={}) {
  const created=[],revoked=[],updates=[],timers=new Map();let next=0;
  const options={createUrl:file=>{const url='blob:artwork-'+(created.length+1);created.push({file,url});return url;},revokeUrl:url=>revoked.push(url),
    inspect:()=>({promise:Promise.resolve({width:512,height:512}),cancel(){}}),
    setTimeout(fn,ms){assert.equal(ms,ARTWORK_LIMITS.waitMs);const id=++next;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),...extra};
  const art=createArtworkSelection({...options,update:state=>updates.push(state)});
  return {art,options,created,revoked,updates,timers};
}
test('artwork refuses unsupported types, empty and oversized files before a read',async()=>{
  const b=artworkFixture();let reads=0;
  for(const file of [{type:'image/svg+xml',size:50},{type:'image/gif',size:20},{type:'image/heic',size:100},{type:'image/png',size:0},{type:'image/png',size:ARTWORK_LIMITS.bytes+1}]){
    assert.ok(artworkFileProblem(file));await b.art.select({...file,arrayBuffer(){reads++;throw Error('not allowed');}});assert.equal(b.updates.at(-1).status,'error');
  }
  assert.equal(reads,0);assert.equal(b.created.length,0);b.art.dispose();
});
test('file signatures and bounded image headers are checked before the decoder',async()=>{
  assert.equal(artworkSignature(new Uint8Array([255,216,255])),'image/jpeg');
  const jpeg=new Uint8Array([255,216,255,192,0,8,8,1,0,2,0,3]);assert.deepEqual(artworkDimensions(jpeg,'image/jpeg'),{width:512,height:256});
  const webp=new Uint8Array(30),view=new DataView(webp.buffer);webp.set([82,73,70,70]);view.setUint32(4,22,true);webp.set([87,69,66,80,86,80,56,88],8);view.setUint32(16,10,true);webp[24]=255;webp[27]=127;
  assert.equal(artworkSignature(webp),'image/webp');assert.deepEqual(artworkDimensions(webp,'image/webp'),{width:256,height:128});
  for(const bytes of [new Uint8Array([60,115,118,103]),pngHeader(99999,512)]){
    const b=artworkFixture();await b.art.select(imageFile({bytes}));assert.equal(b.created.length,0);assert.equal(b.art.current,null);assert.equal(b.updates.at(-1).status,'error');b.art.dispose();
  }
  assert.equal(artworkDimensions(new Uint8Array([255,216,255,192,255,255]),'image/jpeg'),null);
});
test('valid artwork exports only a filename reminder, never the object URL or image data',async()=>{
  const b=artworkFixture();await b.art.select(imageFile());assert.equal(b.updates.at(-1).status,'ready');assert.equal(b.timers.size,0);
  const brief=artworkBrief(b.art.current);assert.match(brief,/example-logo.png/);assert.match(brief,/not embedded.*uploaded, saved or published/);assert.doesNotMatch(brief,/blob:|data:|base64/);
  assert.equal(artworkBrief(null),'');b.art.dispose();assert.deepEqual(b.revoked,['blob:artwork-1']);
});
test('unsafe filenames are replaced with a plain attachment name',async()=>{
  for(const name of ['<svg>.png','hidden\u202e.png','folder/private.png','Line\nBreak.png','x'.repeat(101)]){
    const b=artworkFixture();await b.art.select(imageFile({name}));assert.equal(b.art.current.name,'project-image.png');b.art.dispose();
  }
});
test('replacement and removal revoke prior URLs and cancel late decoder completion',async()=>{
  const slow=deferred();let count=0,canceled=0;const b=artworkFixture({inspect:()=>({promise:++count===1?slow.promise:Promise.resolve({width:512,height:512}),cancel(){canceled++;}})});
  const first=b.art.select(imageFile({name:'old.png'}));await flush();await b.art.select(imageFile({name:'new.png'}));await first;
  assert.equal(b.art.current.name,'new.png');assert.ok(b.revoked.includes('blob:artwork-1'));slow.resolve({width:512,height:512});await flush();assert.equal(b.art.current.name,'new.png');
  b.art.clear();assert.equal(b.art.current,null);assert.equal(b.updates.at(-1).status,'empty');assert.ok(b.revoked.includes('blob:artwork-2'));assert.ok(canceled>=2);assert.equal(b.timers.size,0);b.art.dispose();
});
test('slow image read times out and cannot create a later object URL',async()=>{
  const slow=deferred(),b=artworkFixture();const selecting=b.art.select(imageFile({read:()=>slow.promise}));await flush();[...b.timers.values()][0]();await selecting;
  assert.match(b.updates.at(-1).message,/took too long/);assert.equal(b.art.pending,false);assert.equal(b.timers.size,0);
  slow.resolve(pngHeader().buffer);await flush();assert.equal(b.created.length,0);assert.equal(b.art.current,null);b.art.dispose();
});
test('unreadable and stalled decoders release object URLs and retain no image',async()=>{
  for(const stalled of [false,true]){
    const wait=deferred(),b=artworkFixture({inspect:()=>({promise:stalled?wait.promise:Promise.reject(Error('decode')),cancel(){}})});
    const selecting=b.art.select(imageFile());await flush();if(stalled)[...b.timers.values()][0]();await selecting;
    assert.equal(b.art.current,null);assert.equal(b.art.pending,false);assert.equal(b.updates.at(-1).status,'error');assert.deepEqual(b.revoked,['blob:artwork-1']);assert.equal(b.timers.size,0);
    wait.resolve({width:512,height:512});await flush();assert.equal(b.art.current,null);b.art.dispose();
  }
});
test('changing or removing artwork invalidates a prepared draft and pending copy',async()=>{
  const a=artworkFixture(),slow=deferred(),b=fixture({artwork:a.options,copy:()=>slow.promise});b.setProject();b.get('project-form').emit('submit');
  const copying=b.get('project-copy').emit('click');b.get('project-artwork').files=[imageFile()];await b.get('project-artwork').emit('change');await copying;
  assert.equal(b.get('project-output').hidden,true);assert.equal(b.get('project-artwork-image').hidden,false);assert.match(b.get('project-artwork-status').textContent,/example-logo/);
  b.get('project-form').emit('submit');assert.match(b.get('project-brief').value,/Attach the original image separately/);assert.doesNotMatch(b.get('project-brief').value,/blob:/);
  b.get('project-artwork-remove').emit('click');assert.equal(b.get('project-output').hidden,true);assert.equal(b.get('project-artwork-image').hidden,true);assert.equal(b.get('project-artwork').value,'');assert.equal(b.document.activeElement,b.get('project-artwork'));
  slow.resolve();await flush();assert.equal(b.get('project-copy-status').textContent,'');b.api.dispose();
});
test('preparing during an image check waits; clearing the worksheet cancels it',async()=>{
  const wait=deferred(),a=artworkFixture({inspect:()=>({promise:wait.promise,cancel(){}})}),b=fixture({artwork:a.options});b.setProject();b.get('project-artwork').files=[imageFile()];const choosing=b.get('project-artwork').emit('change');await flush();
  b.get('project-form').emit('submit');assert.equal(b.get('project-output').hidden,true);assert.match(b.get('project-prep-status').textContent,/Finish checking/);
  b.get('project-clear').emit('click');await choosing;wait.resolve({width:512,height:512});await flush();assert.equal(b.get('project-artwork-image').hidden,true);assert.equal(b.get('project-artwork-remove').hidden,true);assert.equal(b.get('project-artwork').value,'');assert.equal(a.timers.size,0);assert.deepEqual(a.revoked,['blob:artwork-1']);b.api.dispose();
});
test('local artwork interaction performs no fetch or persistent storage operation',async()=>{
  const fetch=globalThis.fetch,storage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');globalThis.fetch=()=>{throw Error('network prohibited');};Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('storage prohibited');}});
  try{const a=artworkFixture(),b=fixture({artwork:a.options});b.setProject();b.get('project-artwork').files=[imageFile()];await b.get('project-artwork').emit('change');b.get('project-form').emit('submit');assert.match(b.get('project-brief').value,/example-logo/);b.api.dispose();}
  finally{globalThis.fetch=fetch;if(storage)Object.defineProperty(globalThis,'localStorage',storage);else delete globalThis.localStorage;}
});

test('competition briefs bind a reviewed format and public deliverable without creating a match',()=>{
 const fields={...publicFields(),interest:'competition',format:'creative',goal:'Create one original short video explaining a shared public topic.'};
 const result=prepareProjectBrief(fields);assert.equal(result.ok,true);assert.match(result.text,/Proposed format: Creative Clash/);
 assert.match(result.text,/Proposed shared deliverable: Create one original/);assert.match(result.text,/not an invitation, accepted match, scheduled event or prize commitment/);
 for(const format of ['builder','research','exchange','headtohead'])assert.equal(prepareProjectBrief({...fields,format}).ok,true);
 for(const format of ['',undefined,'__proto__','unknown'])assert.equal(prepareProjectBrief({...fields,format}).field,'project-format');
 for(const goal of ['', 'x'.repeat(19),'x'.repeat(241),'<img src=x> enough text here','Hidden\u202e direction with enough text','Line one with enough text\nline two'])assert.equal(prepareProjectBrief({...fields,goal}).field,'project-goal');
 assert.equal(prepareProjectBrief({...fields,goal:'x'.repeat(20)}).ok,true);assert.equal(prepareProjectBrief({...fields,goal:'x'.repeat(240)}).ok,true);
 const ordinary=prepareProjectBrief({...fields,interest:'education'});assert.equal(ordinary.ok,true);assert.doesNotMatch(ordinary.text,/Proposed shared deliverable|Create one original/);
});
test('Arena preparation opens only local worksheet fields and preserves project details',()=>{
 const b=fixture();b.setProject();assert.equal(b.get('project-competition').hidden,true);assert.equal(b.get('project-goal').disabled,true);
 b.get('arena-prepare').emit('click');assert.equal(b.get('project-interest').value,'competition');assert.equal(b.get('project-format').value,'creative');
 assert.equal(b.get('project-competition').hidden,false);assert.equal(b.get('project-goal').disabled,false);assert.equal(b.document.activeElement,b.get('project-format'));
 assert.equal(b.get('project-name').value,'Example Community');assert.equal(b.get('project-output').hidden,true);
 b.get('project-form').emit('submit');assert.equal(b.document.activeElement,b.get('project-goal'));assert.equal(b.get('project-output').hidden,true);assert.equal(b.get('project-name').value,'Example Community');b.api.dispose();
});
test('editing or changing competition interest invalidates old exports without losing the proposal draft',async()=>{
 const b=fixture();b.setProject();b.get('arena-prepare').emit('click');b.get('project-goal').value='Create one original public guide another project can use.';
 b.get('project-form').emit('submit');assert.equal(b.get('project-output').hidden,false);assert.match(b.get('project-brief').value,/Proposed format: Creative Clash/);
 await b.get('project-copy').emit('click');assert.match(b.copies.at(-1),/not an invitation/);
 b.get('project-format').value='builder';b.get('project-format').emit('change');assert.equal(b.get('project-output').hidden,true);assert.equal(b.get('project-download').hidden,true);
 b.get('project-interest').value='education';b.get('project-interest').emit('change');assert.equal(b.get('project-competition').hidden,true);assert.equal(b.get('project-goal').disabled,true);
 b.get('project-form').emit('submit');assert.doesNotMatch(b.get('project-brief').value,/Create one original public guide/);
 b.get('arena-prepare').emit('click');assert.equal(b.get('project-format').value,'builder');assert.match(b.get('project-goal').value,/original public guide/);b.api.dispose();
});
test('clearing a competition worksheet removes its draft and disposed Arena actions stay inert',()=>{
 const b=fixture();b.setProject();b.get('arena-prepare').emit('click');b.get('project-goal').value='Create one original public guide another project can use.';b.get('project-form').emit('submit');
 b.get('project-clear').emit('click');assert.equal(b.get('project-goal').value,'');assert.equal(b.get('project-format').value,'creative');assert.equal(b.get('project-goal').disabled,true);
 assert.equal(b.get('project-competition').hidden,true);assert.equal(b.get('project-brief').value,'');assert.equal(b.get('project-download').hidden,true);
 b.api.dispose();b.get('arena-prepare').emit('click');assert.equal(b.get('project-interest').value,'education');assert.equal(b.get('arena-prepare').disabled,true);
});

test('starter briefs fill only an empty competition draft and preserve the founder’s edits',()=>{
 const b=fixture();b.setProject();b.get('arena-prepare').emit('click');assert.match(b.get('project-starter-preview').textContent,/30-second video/);
 b.get('project-use-starter').emit('click');assert.match(b.get('project-goal').value,/30-second video/);assert.equal(b.document.activeElement,b.get('project-goal'));
 b.get('project-goal').value='Our own original public deliverable for both project teams.';b.get('project-form').emit('submit');const before=b.get('project-brief').value;
 b.get('project-use-starter').emit('click');assert.equal(b.get('project-goal').value,'Our own original public deliverable for both project teams.');assert.equal(b.get('project-brief').value,before);assert.match(b.get('project-prep-status').textContent,/Your draft was kept/);b.api.dispose();
});
test('changing format updates the suggested brief without replacing an existing deliverable',()=>{
 const b=fixture();b.setProject();b.get('arena-prepare').emit('click');b.get('project-goal').value='An existing founder draft that must not be overwritten.';b.get('project-form').emit('submit');
 b.get('project-format').value='builder';b.get('project-format').emit('change');assert.match(b.get('project-starter-preview').textContent,/working public tool/);assert.equal(b.get('project-goal').value,'An existing founder draft that must not be overwritten.');assert.equal(b.get('project-output').hidden,true);
 b.get('project-goal').value='';b.get('project-goal').emit('input');b.get('project-use-starter').emit('click');b.get('project-form').emit('submit');assert.match(b.get('project-brief').value,/Proposed format: Builder Battle/);assert.match(b.get('project-brief').value,/working public tool/);b.api.dispose();
});
test('starter action refuses unknown formats, inactive interests and disposal',()=>{
 const b=fixture();b.get('project-use-starter').emit('click');assert.equal(b.get('project-goal').value,'');b.get('arena-prepare').emit('click');b.get('project-format').value='__proto__';b.get('project-format').emit('change');assert.equal(b.get('project-use-starter').disabled,true);assert.equal(b.get('project-starter-preview').textContent,'');b.get('project-use-starter').emit('click');assert.equal(b.get('project-goal').value,'');
 b.get('project-clear').emit('click');assert.equal(b.get('project-use-starter').disabled,true);b.get('arena-prepare').emit('click');b.api.dispose();b.get('project-use-starter').emit('click');assert.equal(b.get('project-goal').value,'');assert.equal(b.get('project-use-starter').disabled,true);
});

test('closed planner ignores retained form, copy, route and detached activity handlers',async()=>{
 const b=fixture();b.setProject();b.get('project-form').emit('submit');
 const toggle=b.get('activity-toggle-first-mission'),remove=b.get('crew-selected').children[0].children[1].children.at(-1),selection=b.api.getSelection();
 b.api.dispose();const files=b.created.length,revoked=b.revoked.length;
 await b.get('project-form').emit('submit');await b.get('project-copy').emit('click');await b.get('crew-copy').emit('click');
 b.get('crew-route').value='evidence';b.get('crew-load-route').emit('click');toggle.emit('click');remove.emit('click');b.get('project-clear').emit('click');
 assert.deepEqual(b.api.getSelection(),selection);assert.equal(b.created.length,files);assert.equal(b.revoked.length,revoked);assert.equal(b.copies.length,0);
 assert.equal(b.get('project-fields').disabled,true);assert.equal(b.get('project-output').hidden,true);assert.equal(b.get('crew-output').hidden,true);assert.equal(b.get('project-name').value,'Example Community');
 b.api.dispose();assert.equal(b.revoked.length,revoked);
});
test('closing during a clipboard wait prevents late success and cancels remaining local timers',async()=>{
 const gate=deferred(),b=fixture({copy:()=>gate.promise});const copying=b.get('crew-copy').emit('click');assert.equal(b.clock.timers.size,1);
 b.api.dispose();await copying;gate.resolve();await flush();assert.equal(b.clock.timers.size,0);assert.equal(b.get('crew-copy-status').textContent,'');assert.equal(b.get('crew-download').hidden,true);
});

test('request intake is an explicit separate native form with reply consent and no artwork upload',()=>{
 const html=readFileSync(new URL('../alliance.html',import.meta.url),'utf8');const form=html.match(/<form id="project-send-form"[\s\S]*?<\/form>/)?.[0];
 assert.ok(form);assert.match(form,/name="alliance-project-request"/);assert.match(form,/method="POST"/);assert.match(form,/action="\/alliance-request-received"/);assert.match(form,/data-netlify="true"/);assert.match(form,/netlify-honeypot="bot-field"/);
 assert.match(form,/<textarea[^>]*name="proposal"[^>]*readonly/);assert.match(form,/<input[^>]*type="email"[^>]*name="email"[^>]*required/);assert.match(form,/<input[^>]*name="review-consent"[^>]*required/);assert.match(form,/%\{submissionId\}/);assert.doesNotMatch(form,/type="file"|<form[\s\S]*<form/);
 assert.match(html,/connect-src 'none'/);assert.match(html,/form-action 'self'/);
 const received=readFileSync(new URL('../alliance-request-received.html',import.meta.url),'utf8');assert.match(received,/not a delivery receipt/);assert.match(received,/no public request-status portal/);
});
test('clearing and closing project intake remove reply-email and consent state',()=>{
 const b=fixture();b.get('project-reply-email').value='owner@example.com';b.get('project-send-consent').checked=true;b.get('project-clear').emit('click');assert.equal(b.get('project-reply-email').value,'');assert.equal(b.get('project-send-consent').checked,false);
 b.get('project-reply-email').value='owner@example.com';b.get('project-send-consent').checked=true;b.api.dispose();assert.equal(b.get('project-reply-email').value,'');assert.equal(b.get('project-send-consent').checked,false);assert.equal(b.get('project-send').disabled,true);
});
