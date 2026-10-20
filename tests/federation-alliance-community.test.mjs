import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHALLENGE_KITS,profileFields,challengeFields,ideaFields,matchingKits,kitGoalLabel,createCommunitySandbox} from '../assets/federation/fed-alliance-community-core.mjs';
import {mountCommunityHub} from '../assets/federation/fed-alliance-community.mjs';
const profile=(name='Preview Explorer',community='Example crew')=>({name,community,bio:'I build useful public tools and compare the evidence.',role:'builder',listed:true});
const challenge=()=>({kit:'explain',scope:'members',days:7,goal:1,note:'Compare clear explanations using public sources.'});
function pair(){const s=createCommunitySandbox(),a=s.createMember(profile()),b=s.createMember(profile('Other explorer','Other crew'));return {s,a,b};}
test('six non-Journey templates cover creative, evidence, feedback and social goals',()=>{assert.equal(CHALLENGE_KITS.length,6);assert.equal(new Set(CHALLENGE_KITS.map(x=>x.id)).size,6);assert.equal(matchingKits('Create').length,2);assert.equal(matchingKits('missing').length,0);assert.equal(kitGoalLabel(CHALLENGE_KITS[5],1),'1 working demonstration');assert.equal(kitGoalLabel(CHALLENGE_KITS[0],2),'2 sourced explainers');for(const k of CHALLENGE_KITS){assert.ok(Object.isFrozen(k));assert.doesNotMatch(JSON.stringify(k),/journey|trade volume|buy token|staking|airdrop/i);}});
test('profile fields accept both listing choices, reject coercion and never confer project authority',()=>{for(const listed of [undefined,null,'false',0,1])assert.throws(()=>profileFields({...profile(),listed}));assert.equal(profileFields({...profile(),listed:false}).listed,false);assert.throws(()=>profileFields({...profile(),role:'admin'}));const m=profileFields({...profile(),verified:true,email:'private@example.invalid'});assert.deepEqual(Object.keys(m).sort(),['bio','community','listed','name','role']);});
test('text limits and hidden direction or markup characters are rejected',()=>{for(const name of ['x','x'.repeat(41),'<script>','Hidden\u202eName','Line\nBreak'])assert.throws(()=>profileFields({...profile(),name}));assert.throws(()=>profileFields({...profile(),bio:'x'.repeat(281)}));assert.throws(()=>ideaFields({category:'tools',title:'<b>idea</b>',detail:'A useful change for the members.'}));for(const goal of [0,21,1.5,NaN,Infinity,'1'])assert.throws(()=>challengeFields({...challenge(),goal}));assert.throws(()=>challengeFields({...challenge(),days:4}));assert.throws(()=>ideaFields({category:'__proto__',title:'Useful idea',detail:'A useful change for everyone.'}));});
test('routine profile creation and updates have no owner approval step',()=>{const {s,a,b}=pair();assert.equal(s.directory().length,2);s.updateMember(a.id,a.id,{...profile('Updated explorer'),community:'New self-described group'});assert.equal(s.getMember(a.id).name,'Updated explorer');assert.throws(()=>s.updateMember(b.id,a.id,profile('Impersonation')));const copy=s.directory();copy[0].bio='changed';assert.notEqual(s.getMember(a.id).bio,'changed');});
test('only the invited participant can accept or decline and each invitation needs consent',()=>{const {s,a,b}=pair(),c=s.invite(a.id,b.id,challenge());assert.equal(c.status,'invited');assert.throws(()=>s.respond(a.id,c.id,'accept'));assert.throws(()=>s.addProof(a.id,c.id,'A sourced explanation for the crew.'));assert.equal(s.respond(b.id,c.id,'accept').status,'active');assert.throws(()=>s.respond(b.id,c.id,'accept'));assert.throws(()=>s.invite(a.id,b.id,challenge()));});
test('cancellation and decline end only their open invitation; they do not enroll anyone',()=>{const {s,a,b}=pair();const c=s.invite(a.id,b.id,challenge());assert.throws(()=>s.cancel(b.id,c.id));assert.equal(s.cancel(a.id,c.id).status,'cancelled');const next=s.invite(a.id,b.id,challenge());assert.equal(s.respond(b.id,next.id,'decline').status,'declined');assert.equal(s.directory().length,2);assert.throws(()=>s.invite(a.id,a.id,challenge()));});
test('community proposals need distinct self-described affiliations and carry no official status',()=>{const {s,a,b}=pair();const c=s.invite(a.id,b.id,{...challenge(),scope:'communities'});assert.equal(c.scope,'communities');assert.equal(Object.hasOwn(c,'official'),false);const same=s.createMember(profile('Third member'));assert.throws(()=>s.invite(a.id,same.id,{...challenge(),scope:'communities'}));});
test('only the other participant can acknowledge proof, once, after acceptance',()=>{const {s,a,b}=pair(),outsider=s.createMember(profile('Outsider'));let c=s.invite(a.id,b.id,challenge());s.respond(b.id,c.id,'accept');c=s.addProof(a.id,c.id,'Source-backed explanation with a concrete example.');const p=c.proofs[0];assert.throws(()=>s.reviewProof(a.id,c.id,p.id,true));assert.throws(()=>s.reviewProof(outsider.id,c.id,p.id,true));c=s.reviewProof(b.id,c.id,p.id,true);assert.equal(c.status,'complete');assert.equal(c.winner,a.id);assert.throws(()=>s.reviewProof(b.id,c.id,p.id,true));assert.throws(()=>s.addProof(a.id,c.id,'Another explanation after completion.'));});
test('duplicate contributions and unrelated participation are rejected',()=>{const {s,a,b}=pair(),o=s.createMember(profile('Outsider'));let c=s.invite(a.id,b.id,{...challenge(),goal:2});s.respond(b.id,c.id,'accept');c=s.addProof(a.id,c.id,'A useful explanation with source context.');assert.throws(()=>s.addProof(a.id,c.id,'A USEFUL EXPLANATION WITH SOURCE CONTEXT.'));assert.throws(()=>s.addProof(o.id,c.id,'An unrelated contribution from outside.'));s.reviewProof(b.id,c.id,c.proofs[0].id,false);assert.equal(s.challengeList()[0].status,'active');});
test('suggestions post without approval and support toggles once per other identity',()=>{const {s,a,b}=pair();const i=s.postIdea(a.id,{title:'A clearer wallet summary',category:'tools',detail:'Group unavailable prices separately so the total is easier to understand.'});assert.equal(s.ideaList().length,1);assert.throws(()=>s.vote(a.id,i.id));assert.equal(s.vote(b.id,i.id).votes.length,1);assert.equal(s.vote(b.id,i.id).votes.length,0);assert.throws(()=>s.removeIdea(b.id,i.id));s.removeIdea(a.id,i.id);assert.equal(s.ideaList().length,0);});
test('hiding is reversible, prevents invitations both ways and hides contributions',()=>{const {s,a,b}=pair();s.postIdea(b.id,{title:'A useful research guide',category:'research',detail:'Add a guide explaining the limits of token-account evidence.'});s.block(a.id,b.id);assert.equal(s.directory(a.id).length,1);assert.equal(s.ideaList(a.id).length,0);assert.throws(()=>s.invite(b.id,a.id,challenge()));assert.throws(()=>s.invite(a.id,b.id,challenge()));assert.equal(s.blockedList(a.id).length,1);s.block(a.id,b.id);assert.equal(s.directory(a.id).length,2);assert.equal(s.ideaList(a.id).length,1);});
test('reports are deduplicated and do not let a reporter remove another member',()=>{const {s,a,b}=pair();assert.deepEqual(s.report(a.id,'member',b.id),{recorded:true,removed:false});assert.throws(()=>s.report(a.id,'member',b.id));assert.throws(()=>s.report(a.id,'member',a.id));assert.throws(()=>s.report(a.id,'unknown',b.id));assert.equal(s.directory().length,2);});
test('sandbox capacities bound profiles, ideas and pending contribution history',()=>{const {s,a,b}=pair();for(let n=0;n<10;n++)s.createMember(profile('Example '+n));assert.throws(()=>s.createMember(profile('Overflow')));for(let n=0;n<20;n++)s.postIdea(a.id,{title:'Useful idea '+n,category:'tools',detail:'Explain a concrete useful change for other members.'});assert.throws(()=>s.postIdea(a.id,{title:'Overflow idea',category:'tools',detail:'This is beyond the bounded workspace.'}));const c=s.invite(a.id,b.id,challenge());s.respond(b.id,c.id,'accept');for(let n=0;n<4;n++)s.addProof(a.id,c.id,'Distinct contribution number '+n);assert.throws(()=>s.addProof(a.id,c.id,'Too many pending contributions.'));});

function fixture(options={}){
 const nodes=new Map();let document;
 function detach(n){if(document?.activeElement===n)document.activeElement=null;if(n.id&&nodes.get(n.id)===n)nodes.delete(n.id);for(const child of n.children)detach(child);}
 class Element{
  constructor(tag='div'){this.tag=tag;this.children=[];this.events={};this.attributes={};this.dataset={};this.value='';this.checked=false;this.disabled=false;this.hidden=false;this._text='';}
  set id(v){this._id=v;nodes.set(v,this);}get id(){return this._id;}
  set textContent(v){for(const child of this.children)detach(child);this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  set innerHTML(_){throw Error('HTML interpolation forbidden');}
  append(...v){this.children.push(...v);}replaceChildren(...v){for(const child of this.children)detach(child);this.children=[...v];this._text='';if(this.tag==='select')this.value=v[0]?.value||'';}
  setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}removeAttribute(k){delete this.attributes[k];if(k==='src')delete this.src;}
  addEventListener(k,f){(this.events[k]??=new Set()).add(f);}removeEventListener(k,f){this.events[k]?.delete(f);}
  emit(k,extra={}){return Promise.all([...(this.events[k]||[])].map(fn=>fn({preventDefault(){},...extra})));}
  focus(){document.activeElement=this;}
 }
 const html=readFileSync(new URL('../alliance.html',import.meta.url),'utf8');
 for(const m of html.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){assert.equal(nodes.has(m[2]),false,'duplicate id '+m[2]);const n=new Element(m[1]);n.id=m[2];n.hidden=/\shidden(?:\s|>)/.test(m[0]);n.disabled=/\sdisabled(?:\s|>)/.test(m[0]);}
 document={getElementById:id=>nodes.get(id)||null,createElement:tag=>new Element(tag)};
 if(options.media)document.defaultView={matchMedia:()=>options.media};
 const get=id=>nodes.get(id);for(const [id,v]of Object.entries({'hub-role':'explorer','hub-kit-filter':'all','hub-challenge-filter':'all','hub-challenge-scope':'members','hub-challenge-days':'7','hub-idea-category':'tools','hub-idea-filter':'all'}))get(id).value=v;
 const api=mountCommunityHub(document,options);
 const descendants=n=>[n,...n.children.flatMap(descendants)];
 function find(id,label){const result=descendants(get(id)).find(n=>n.tag==='button'&&(n.textContent===label||n.getAttribute('aria-label')===label));assert.ok(result,'missing button '+label);return result;}
 function create(listed=true){const p=profile();get('hub-name').value=p.name;get('hub-community').value=p.community;get('hub-bio').value=p.bio;get('hub-role').value=p.role;get('hub-listed').checked=listed;return get('hub-profile-form').emit('submit');}
 return {api,get,find,descendants,create,document};
}
test('hub starts with no invented members, ideas or active invitation and no provider calls',()=>{const b=fixture();assert.equal(b.api.getState().members.length,0);assert.equal(b.get('hub-session').hidden,true);assert.equal(b.get('hub-kits').children.length,6);assert.equal(b.get('hub-challenge-fields').disabled,true);assert.equal(b.get('hub-idea-fields').disabled,true);assert.match(b.get('hub-status').textContent,/No real account/);b.api.dispose();});
test('profile UI creates and edits its own directory entry without a Telegram handoff',async()=>{const b=fixture();await b.create();assert.equal(b.api.getState().members.length,1);assert.equal(b.get('hub-card-name').textContent,'Preview Explorer');assert.equal(b.get('hub-session').hidden,false);assert.match(b.get('hub-profile-status').textContent,/No manual approval/);b.get('hub-name').value='Renamed explorer';await b.get('hub-profile-form').emit('submit');assert.equal(b.api.getState().members[0].name,'Renamed explorer');b.api.dispose();});
test('profile errors identify and focus the field without discarding the draft or creating a member',async()=>{
 const b=fixture(),bio='A useful public introduction.';b.get('hub-name').value='x';b.get('hub-community').value='Example crew';b.get('hub-bio').value=bio;
 await b.get('hub-profile-form').emit('submit');assert.equal(b.api.getState().members.length,0);assert.equal(b.api.getState().self,'');assert.match(b.get('hub-profile-status').textContent,/Display name: use 2–40 characters/);
 assert.equal(b.document.activeElement,b.get('hub-name'));assert.equal(b.get('hub-name').getAttribute('aria-invalid'),'true');assert.equal(b.get('hub-name').getAttribute('aria-describedby'),'hub-profile-status');assert.equal(b.get('hub-bio').value,bio);
 b.get('hub-name').value='Updated explorer';await b.get('hub-name').emit('input');assert.equal(b.get('hub-name').getAttribute('aria-invalid'),null);assert.equal(b.get('hub-name').getAttribute('aria-describedby'),null);assert.match(b.get('hub-profile-status').textContent,/not saved yet/);
 b.get('hub-community').value='Example <crew>';await b.get('hub-profile-form').emit('submit');assert.equal(b.document.activeElement,b.get('hub-community'));assert.match(b.get('hub-profile-status').textContent,/Your project or community/);assert.equal(b.get('hub-name').value,'Updated explorer');assert.equal(b.get('hub-bio').value,bio);assert.equal(b.api.getState().members.length,0);
 b.get('hub-community').value='Example crew';await b.get('hub-community').emit('input');await b.get('hub-profile-form').emit('submit');assert.notEqual(b.api.getState().self,'');assert.equal(b.api.getState().members.length,0);assert.equal(b.get('hub-card-name').textContent,'Updated explorer');assert.equal(b.get('hub-community').getAttribute('aria-invalid'),null);assert.match(b.get('hub-status').textContent,/Profile saved/);b.api.dispose();
});
test('profile error association preserves help text and reset removes stale invalid state',async()=>{
 const b=fixture();b.get('hub-role').value='unknown';b.get('hub-role').setAttribute('aria-describedby','role-help');await b.get('hub-profile-form').emit('submit');assert.equal(b.document.activeElement,b.get('hub-role'));assert.equal(b.get('hub-role').getAttribute('aria-describedby'),'role-help hub-profile-status');
 await b.get('hub-reset').emit('click');assert.equal(b.get('hub-role').getAttribute('aria-invalid'),null);assert.equal(b.get('hub-role').getAttribute('aria-describedby'),'role-help');assert.equal(b.document.activeElement,b.get('hub-tab-profile'));assert.equal(b.api.getState().members.length,0);b.api.dispose();
});
test('fictional crew is opt-in, roleplay is labelled and cannot edit the visitor profile',async()=>{const b=fixture();await b.create();await b.get('hub-examples').emit('click');assert.equal(b.api.getState().members.length,3);const other=b.api.getState().members.find(m=>m.example);b.get('hub-actor').value=other.id;await b.get('hub-actor').emit('change');assert.equal(b.get('hub-profile-fields').disabled,true);await b.get('hub-profile-form').emit('submit');assert.equal(b.api.getState().members[0].name,'Preview Explorer');assert.match(b.get('hub-profile-status').textContent,/own preview identity/);await b.get('hub-return').emit('click');assert.equal(b.get('hub-profile-fields').disabled,false);b.api.dispose();});
test('member invitations can be accepted by roleplaying the invited fictional member',async()=>{const b=fixture();await b.create();await b.get('hub-examples').emit('click');const target=b.api.getState().members.find(m=>m.example);b.get('hub-challenge-target').value=target.id;b.get('hub-challenge-goal').value='1';await b.get('hub-challenge-form').emit('submit');assert.equal(b.api.getState().challenges[0].status,'invited');b.get('hub-actor').value=target.id;await b.get('hub-actor').emit('change');await b.find('hub-challenges','Accept invitation').emit('click');assert.equal(b.api.getState().challenges[0].status,'active');assert.match(b.get('hub-status').textContent,/No real event/);b.api.dispose();});
test('idea UI supports self-service post, other-member support and author removal',async()=>{const b=fixture();await b.create();await b.get('hub-examples').emit('click');b.get('hub-idea-title').value='A clearer dashboard';b.get('hub-idea-detail').value='Group missing prices so members can understand which assets are valued.';await b.get('hub-idea-form').emit('submit');const self=b.api.getState().self;assert.equal(b.api.getState().ideas.length,1);b.get('hub-actor').value=b.api.getState().members.find(m=>m.example).id;await b.get('hub-actor').emit('change');await b.find('hub-ideas','Support idea · 0').emit('click');assert.equal(b.api.getState().ideas[0].votes.length,1);assert.equal(b.document.activeElement,b.find('hub-ideas','Remove support · 1'));await b.find('hub-ideas','Remove support · 1').emit('click');assert.equal(b.api.getState().ideas[0].votes.length,0);b.get('hub-actor').value=self;await b.get('hub-actor').emit('change');await b.find('hub-ideas','Remove my idea').emit('click');assert.equal(b.api.getState().ideas.length,0);b.api.dispose();});
test('tabs support arrow, Home and End keys, with a single selected tab',async()=>{const b=fixture();await b.get('hub-tab-profile').emit('keydown',{key:'ArrowRight'});assert.equal(b.get('hub-panel-challenges').hidden,false);assert.equal(b.get('hub-tab-challenges').getAttribute('tabindex'),'0');assert.equal(b.document.activeElement,b.get('hub-tab-challenges'));await b.get('hub-tab-challenges').emit('keydown',{key:'End'});assert.equal(b.get('hub-panel-ideas').hidden,false);await b.get('hub-tab-ideas').emit('keydown',{key:'Home'});assert.equal(b.get('hub-panel-profile').hidden,false);b.api.dispose();});
test('reset clears all roleplay content and restores the closed empty state',async()=>{const b=fixture();await b.create();await b.get('hub-examples').emit('click');await b.get('hub-reset').emit('click');assert.equal(b.api.getState().members.length,0);assert.equal(b.api.getState().challenges.length,0);assert.equal(b.api.getState().ideas.length,0);assert.equal(b.get('hub-listed').checked,false);assert.equal(b.get('hub-session').hidden,true);assert.equal(b.get('hub-challenge-fields').disabled,true);b.api.dispose();});
test('image selection is local and reset revokes its URL without adding bytes to profiles',async()=>{let revoked=[];const b=fixture({artwork:{createUrl:()=> 'blob:local-profile',revokeUrl:u=>revoked.push(u),inspect:()=>({promise:Promise.resolve({width:2,height:2}),cancel(){}})}});await b.create();const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10]);const view=new DataView(bytes.buffer);view.setUint32(8,13);view.setUint32(12,0x49484452);view.setUint32(16,2);view.setUint32(20,2);b.get('hub-image').files=[{type:'image/png',name:'public-logo.png',size:bytes.length,arrayBuffer:async()=>bytes.buffer}];await b.get('hub-image').emit('change');assert.equal(b.get('hub-avatar-image').src,'blob:local-profile');assert.equal(b.get('hub-avatar-image').hidden,false);assert.doesNotMatch(JSON.stringify(b.api.getState()),/blob:|public-logo\.png|base64/);await b.get('hub-reset').emit('click');assert.deepEqual(revoked,['blob:local-profile']);assert.equal(b.get('hub-avatar-image').hidden,true);b.api.dispose();});
test('disposing removes permanent handlers and guards existing dynamic buttons',async()=>{const b=fixture();const existing=b.find('hub-kits','Use Explain the signal challenge template');b.api.dispose();const before=b.get('hub-challenge-kit').value;await existing.emit('click');assert.equal(b.get('hub-challenge-kit').value,before);assert.equal(b.get('hub-profile-fields').disabled,true);assert.equal(b.get('hub-reset').events.click.size,0);});
test('integration preserves the first three sections and makes the isolated scope visible',()=>{const html=readFileSync(new URL('../alliance.html',import.meta.url),'utf8');const ids=[...html.matchAll(/<section\b[^>]*id="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(ids.slice(0,4),['station-explorer','community-league','project-kit','community-hub']);assert.match(html,/INTERACTIVE PREVIEW · NOT PUBLIC MEMBERSHIP/);assert.match(html,/public joining remains closed/i);for(const file of ['fed-alliance-community.mjs','fed-alliance-community-core.mjs']){const source=readFileSync(new URL('../assets/federation/'+file,import.meta.url),'utf8');assert.doesNotMatch(source,/\bfetch\s*\(|localStorage|sessionStorage|document\.cookie|innerHTML|mailto:|t\.me/);}assert.match(html,/routine participation will not require Telegram intake or owner approval/i);});

async function invitationFixture(goal=1){
 const b=fixture();await b.create();await b.get('hub-examples').emit('click');
 const target=b.api.getState().members.find(m=>m.example);
 b.get('hub-challenge-target').value=target.id;b.get('hub-challenge-goal').value=String(goal);
 await b.get('hub-challenge-form').emit('submit');
 return {b,target,key:b.api.getState().challenges[0].id};
}
test('accept and decline return focus to the filter when an awaiting invitation disappears',async()=>{
 for(const label of ['Accept invitation','Decline invitation']){
  const {b,target,key}=await invitationFixture();b.get('hub-actor').value=target.id;await b.get('hub-actor').emit('change');
  b.get('hub-challenge-filter').value='invited';await b.get('hub-challenge-filter').emit('change');
  const control=b.find('hub-challenges',label);control.focus();await control.emit('click');
  assert.equal(b.document.getElementById('hub-challenge-card-'+key),null,'removed cards must not remain in the fixture document');
  assert.equal(b.document.activeElement,b.get('hub-challenge-filter'));b.api.dispose();
 }
});
test('cancelling a filtered invitation keeps a reachable keyboard destination',async()=>{
 const {b,key}=await invitationFixture();b.get('hub-challenge-filter').value='invited';await b.get('hub-challenge-filter').emit('change');
 const control=b.find('hub-challenges','Cancel invitation');control.focus();await control.emit('click');
 assert.equal(b.document.getElementById('hub-challenge-card-'+key),null);assert.equal(b.document.activeElement,b.get('hub-challenge-filter'));b.api.dispose();
});
test('the final acknowledgement returns to the active filter while intermediate acknowledgement keeps its card',async()=>{
 for(const goal of [1,2]){
  const {b,target,key}=await invitationFixture(goal);const self=b.api.getState().self;
  b.get('hub-actor').value=target.id;await b.get('hub-actor').emit('change');await b.find('hub-challenges','Accept invitation').emit('click');
  b.get('hub-actor').value=self;await b.get('hub-actor').emit('change');
  const form=b.descendants(b.get('hub-challenges')).find(n=>n.tag==='form');
  b.descendants(form).find(n=>n.tag==='textarea').value='A source-backed explanation for another member.';await form.emit('submit');
  b.get('hub-actor').value=target.id;await b.get('hub-actor').emit('change');
  b.get('hub-challenge-filter').value='active';await b.get('hub-challenge-filter').emit('change');
  const control=b.find('hub-challenges','Acknowledge');control.focus();await control.emit('click');
  assert.equal(b.document.activeElement,goal===1?b.get('hub-challenge-filter'):b.get('hub-challenge-card-'+key));b.api.dispose();
 }
});
test('showing the last hidden member focuses its restored card or the search when excluded',async()=>{
 for(const query of ['','no matching member']){
  const b=fixture();await b.create();await b.get('hub-examples').emit('click');const target=b.api.getState().members.find(m=>m.example);
  await b.find('hub-members','Hide '+target.name+' in this preview').emit('click');
  b.get('hub-member-search').value=query;await b.get('hub-member-search').emit('input');
  const control=b.find('hub-blocks','Show '+target.name);control.focus();await control.emit('click');
  assert.equal(b.get('hub-blocks').hidden,true);assert.equal(b.document.activeElement,query?b.get('hub-member-search'):b.get('hub-member-card-'+target.id));b.api.dispose();
 }
});
test('a status change keeps focus on its card when the current filter still includes it',async()=>{
 const {b,target,key}=await invitationFixture();b.get('hub-actor').value=target.id;await b.get('hub-actor').emit('change');
 const control=b.find('hub-challenges','Accept invitation');control.focus();await control.emit('click');
 assert.equal(b.document.activeElement,b.get('hub-challenge-card-'+key));b.api.dispose();
});

test('unlisted profiles remain editable by their owner and are unavailable as new invitation targets',()=>{
 const {s,a,b}=pair();s.updateMember(a.id,a.id,{...profile(),listed:false});
 assert.equal(s.getMember(a.id).listed,false);assert.equal(s.directory().some(m=>m.id===a.id),false);
 assert.throws(()=>s.updateMember(b.id,a.id,{...profile(),listed:true}));assert.throws(()=>s.invite(b.id,a.id,challenge()));
 s.updateMember(a.id,a.id,{...profile(),listed:true});assert.equal(s.directory().some(m=>m.id===a.id),true);
});
test('unlisting preserves existing invitations and ideas while allowing intentional outgoing invitations',()=>{
 const {s,a,b}=pair(),c=s.invite(b.id,a.id,challenge());
 const idea=s.postIdea(a.id,{title:'Useful evidence guide',category:'research',detail:'Explain the public sources and limits of a token-account snapshot.'});
 s.updateMember(a.id,a.id,{...profile(),listed:false});
 assert.equal(s.respond(a.id,c.id,'accept').status,'active');assert.equal(s.ideaList(a.id)[0].id,idea.id);
 assert.equal(s.invite(a.id,b.id,{...challenge(),kit:'feedback'}).status,'invited');
 assert.equal(s.challengeList(a.id).length,2);
});
test('an unchecked listing choice creates an unlisted profile and keeps its roleplay identity reachable',async()=>{
 const b=fixture();await b.create(false);const self=b.api.getState().self;assert.ok(self);
 assert.equal(b.api.getState().members.length,0);assert.equal(b.get('hub-actor').value,self);
 assert.match(b.get('hub-actor').textContent,/unlisted local profile/);assert.match(b.get('hub-card-visibility').textContent,/Unlisted/);
 assert.match(b.get('hub-profile-status').textContent,/unlisted/);assert.match(b.get('hub-members').textContent,/Your profile is unlisted/);
 await b.get('hub-examples').emit('click');const target=b.api.getState().members[0];assert.equal(b.api.getState().members.length,2);
 b.get('hub-actor').value=target.id;await b.get('hub-actor').emit('change');
 assert.equal(b.get('hub-challenge-target').children.some(n=>n.value===self),false);
 await b.get('hub-return').emit('click');assert.equal(b.get('hub-actor').value,self);assert.equal(b.get('hub-profile-fields').disabled,false);
 assert.equal(b.get('hub-card-name').textContent,'Preview Explorer');b.api.dispose();
});
test('profile listing can be changed without resetting preview ideas or invitation history',async()=>{
 const {b,key}=await invitationFixture();const self=b.api.getState().self;
 b.get('hub-idea-title').value='A useful directory guide';b.get('hub-idea-detail').value='Explain how to list and unlist a preview profile.';await b.get('hub-idea-form').emit('submit');
 b.get('hub-listed').checked=false;await b.get('hub-profile-form').emit('submit');
 assert.equal(b.api.getState().members.some(m=>m.id===self),false);assert.equal(b.api.getState().challenges[0].id,key);assert.equal(b.api.getState().ideas.length,1);
 assert.match(b.get('hub-card-visibility').textContent,/Existing preview ideas and challenges remain/);
 b.get('hub-listed').checked=true;await b.get('hub-profile-form').emit('submit');
 assert.equal(b.api.getState().members.some(m=>m.id===self),true);assert.equal(b.api.getState().ideas.length,1);assert.match(b.get('hub-card-visibility').textContent,/Listed/);
 const html=readFileSync(new URL('../alliance.html',import.meta.url),'utf8');assert.match(html,/aria-describedby="hub-listing-help"/);assert.match(html,/Unlisting does not remove existing preview ideas or challenges/);b.api.dispose();
});

async function activeFixture(goal=2,b=fixture()){
 await b.create();await b.get('hub-examples').emit('click');const self=b.api.getState().self,target=b.api.getState().members.find(m=>m.example);
 b.get('hub-challenge-target').value=target.id;b.get('hub-challenge-goal').value=String(goal);await b.get('hub-challenge-form').emit('submit');
 const key=b.api.getState().challenges[0].id;b.get('hub-actor').value=target.id;await b.get('hub-actor').emit('change');await b.find('hub-challenges','Accept invitation').emit('click');
 b.get('hub-actor').value=self;await b.get('hub-actor').emit('change');return {b,self,target,key};
}
function proofForm(b,key){const area=b.get('hub-proof-'+key);return b.descendants(b.get('hub-challenges')).find(n=>n.tag==='form'&&b.descendants(n).includes(area));}
test('unsent contribution text survives filters and unrelated profile saves',async()=>{
 const {b,key}=await activeFixture();const note='An unfinished source-backed explanation for another member.';
 b.get('hub-proof-'+key).value=note;await b.get('hub-proof-'+key).emit('input');
 b.get('hub-challenge-filter').value='invited';await b.get('hub-challenge-filter').emit('change');
 b.get('hub-challenge-filter').value='active';await b.get('hub-challenge-filter').emit('change');assert.equal(b.get('hub-proof-'+key).value,note);
 await b.get('hub-profile-form').emit('submit');assert.equal(b.get('hub-proof-'+key).value,note);b.api.dispose();
});
test('submitting one contribution clears only that challenge draft',async()=>{
 const {b,self,target,key}=await activeFixture();b.get('hub-challenge-kit').value='feedback';b.get('hub-challenge-goal').value='2';await b.get('hub-challenge-form').emit('submit');
 const second=b.api.getState().challenges.find(c=>c.kit==='feedback').id;
 b.get('hub-actor').value=target.id;await b.get('hub-actor').emit('change');await b.find('hub-challenges','Accept invitation').emit('click');b.get('hub-actor').value=self;await b.get('hub-actor').emit('change');
 for(const [id,note]of [[key,'A completed explanation ready for peer review.'],[second,'An unfinished feedback note to keep working on.']]){b.get('hub-proof-'+id).value=note;await b.get('hub-proof-'+id).emit('input');}
 await proofForm(b,key).emit('submit');assert.equal(b.get('hub-proof-'+key).value,'');assert.equal(b.get('hub-proof-'+second).value,'An unfinished feedback note to keep working on.');
 assert.equal(b.api.getState().challenges.find(c=>c.id===key).proofs.length,1);b.api.dispose();
});
test('contribution drafts belong to each preview identity and removed forms cannot submit later',async()=>{
 const {b,self,target,key}=await activeFixture();const own='An unfinished note from my own preview identity.',other='A separate unfinished note from the fictional participant.';
 const ownArea=b.get('hub-proof-'+key),oldOwnForm=proofForm(b,key);ownArea.value=own;await ownArea.emit('input');
 b.get('hub-actor').value=target.id;await b.get('hub-actor').emit('change');assert.equal(b.get('hub-proof-'+key).value,'');
 const oldOtherArea=b.get('hub-proof-'+key);oldOtherArea.value=other;await oldOtherArea.emit('input');
 b.get('hub-actor').value=self;await b.get('hub-actor').emit('change');assert.equal(b.get('hub-proof-'+key).value,own);
 oldOtherArea.value='A late detached input must be ignored.';await oldOtherArea.emit('input');await oldOwnForm.emit('submit');assert.equal(b.api.getState().challenges[0].proofs.length,0);
 b.get('hub-actor').value=target.id;await b.get('hub-actor').emit('change');assert.equal(b.get('hub-proof-'+key).value,other);b.api.dispose();
});
test('reset clears drafts even when a fresh sandbox reuses the same preview IDs',async()=>{
 const first=await activeFixture();const {b,key}=first,old=proofForm(b,key);b.get('hub-proof-'+key).value='An old draft that must not enter a new sandbox.';await b.get('hub-proof-'+key).emit('input');
 await b.get('hub-reset').emit('click');const fresh=await activeFixture(2,b);assert.equal(fresh.key,key);assert.equal(b.get('hub-proof-'+key).value,'');
 await old.emit('submit');assert.equal(b.api.getState().challenges[0].proofs.length,0);assert.equal(b.get('hub-proof-'+key).value,'');b.api.dispose();
});
test('validation failures retain draft text until a successful submission',async()=>{
 const {b,key}=await activeFixture();b.get('hub-proof-'+key).value='short';await b.get('hub-proof-'+key).emit('input');await proofForm(b,key).emit('submit');
 assert.equal(b.api.getState().challenges[0].proofs.length,0);b.get('hub-challenge-filter').value='invited';await b.get('hub-challenge-filter').emit('change');b.get('hub-challenge-filter').value='active';await b.get('hub-challenge-filter').emit('change');assert.equal(b.get('hub-proof-'+key).value,'short');
 b.get('hub-proof-'+key).value='A repaired explanation with enough public context.';await b.get('hub-proof-'+key).emit('input');await proofForm(b,key).emit('submit');assert.equal(b.api.getState().challenges[0].proofs.length,1);assert.equal(b.get('hub-proof-'+key).value,'');b.api.dispose();
});
test('intentionally clearing a contribution does not resurrect it after a filter change',async()=>{
 const {b,key}=await activeFixture();b.get('hub-proof-'+key).value='A draft the member intentionally discards.';await b.get('hub-proof-'+key).emit('input');b.get('hub-proof-'+key).value='';await b.get('hub-proof-'+key).emit('input');
 b.get('hub-challenge-filter').value='invited';await b.get('hub-challenge-filter').emit('change');b.get('hub-challenge-filter').value='active';await b.get('hub-challenge-filter').emit('change');assert.equal(b.get('hub-proof-'+key).value,'');b.api.dispose();
});

async function draftFixture(){const b=fixture();await b.create();await b.get('hub-examples').emit('click');const other=b.api.getState().members.find(m=>m.example).id;b.get('hub-challenge-target').value=other;return {b,self:b.api.getState().self,other};}
async function switchPreview(b,id){b.get('hub-actor').value=id;await b.get('hub-actor').emit('change');}
test('idea drafts and categories follow their preview author, including return-to-own',async()=>{
 const {b,self,other}=await draftFixture();b.get('hub-idea-title').value='My unfinished evidence guide';b.get('hub-idea-detail').value='Explain which public sources support the guide.';b.get('hub-idea-category').value='research';
 await switchPreview(b,other);assert.equal(b.get('hub-idea-title').value,'');assert.equal(b.get('hub-idea-detail').value,'');assert.equal(b.get('hub-idea-category').value,'tools');
 b.get('hub-idea-title').value='A fictional crew idea';b.get('hub-idea-detail').value='Make the preview easier to explore for a new member.';b.get('hub-idea-category').value='community';
 await b.get('hub-return').emit('click');assert.equal(b.get('hub-idea-title').value,'My unfinished evidence guide');assert.equal(b.get('hub-idea-category').value,'research');
 await b.get('hub-idea-form').emit('submit');assert.equal(b.api.getState().ideas[0].owner,self);assert.equal(b.get('hub-idea-title').value,'');
 await switchPreview(b,other);assert.equal(b.get('hub-idea-title').value,'A fictional crew idea');assert.equal(b.get('hub-idea-category').value,'community');assert.doesNotMatch(b.get('hub-idea-status').textContent,/Idea posted/);
 await b.get('hub-idea-form').emit('submit');assert.equal(b.api.getState().ideas.find(i=>i.owner===other).title,'A fictional crew idea');await switchPreview(b,self);assert.equal(b.get('hub-idea-title').value,'');b.api.dispose();
});
test('invitation drafts restore their own template, eligible target, terms and brief',async()=>{
 const {b,self,other}=await draftFixture();b.get('hub-challenge-kit').value='feedback';await b.get('hub-challenge-kit').emit('change');b.get('hub-challenge-target').value=other;b.get('hub-challenge-scope').value='communities';b.get('hub-challenge-days').value='14';b.get('hub-challenge-goal').value='4';b.get('hub-challenge-note').value='A personal unfinished invitation brief.';
 await switchPreview(b,other);assert.equal(b.get('hub-challenge-note').value,'');assert.equal(b.get('hub-challenge-kit').value,'explain');assert.equal(b.get('hub-challenge-scope').value,'members');assert.equal(b.get('hub-challenge-days').value,'7');assert.equal(b.get('hub-challenge-goal').value,'3');
 b.get('hub-challenge-target').value=self;b.get('hub-challenge-note').value='A separate invitation from the fictional member.';b.get('hub-challenge-goal').value='2';
 await switchPreview(b,self);assert.equal(b.get('hub-challenge-target').value,other);assert.equal(b.get('hub-challenge-kit').value,'feedback');assert.equal(b.get('hub-challenge-scope').value,'communities');assert.equal(b.get('hub-challenge-days').value,'14');assert.equal(b.get('hub-challenge-goal').value,'4');assert.match(b.get('hub-challenge-unit').textContent,/actionable feedback notes/);assert.equal(b.get('hub-challenge-note').value,'A personal unfinished invitation brief.');
 await b.get('hub-challenge-form').emit('submit');assert.equal(b.api.getState().challenges[0].from,self);assert.equal(b.get('hub-challenge-note').value,'');assert.equal(b.get('hub-challenge-goal').value,'4');
 await switchPreview(b,other);assert.equal(b.get('hub-challenge-target').value,self);assert.equal(b.get('hub-challenge-goal').value,'2');assert.equal(b.get('hub-challenge-note').value,'A separate invitation from the fictional member.');assert.doesNotMatch(b.get('hub-challenge-status').textContent,/invitation created/);b.api.dispose();
});
test('failed form submissions keep that identity’s editable drafts without crossing forms',async()=>{
 const {b,self,other}=await draftFixture();b.get('hub-idea-title').value='tiny';b.get('hub-idea-detail').value='A valid detail with a title still needing work.';b.get('hub-challenge-goal').value='0';b.get('hub-challenge-note').value='A brief with an invalid contribution goal.';
 await b.get('hub-idea-form').emit('submit');await b.get('hub-challenge-form').emit('submit');assert.equal(b.api.getState().ideas.length,0);assert.equal(b.api.getState().challenges.length,0);
 await switchPreview(b,other);await switchPreview(b,self);assert.equal(b.get('hub-idea-title').value,'tiny');assert.equal(b.get('hub-challenge-goal').value,'0');assert.equal(b.get('hub-challenge-note').value,'A brief with an invalid contribution goal.');
 b.get('hub-idea-title').value='A repaired evidence guide';await b.get('hub-idea-form').emit('submit');assert.equal(b.api.getState().ideas.length,1);assert.equal(b.get('hub-challenge-note').value,'A brief with an invalid contribution goal.');
 b.get('hub-challenge-goal').value='3';await b.get('hub-challenge-form').emit('submit');assert.equal(b.api.getState().challenges.length,1);assert.equal(b.get('hub-idea-title').value,'');assert.equal(b.get('hub-challenge-note').value,'');b.api.dispose();
});
test('cleared form drafts stay cleared and reset discards all identities before IDs are reused',async()=>{
 const {b,self,other}=await draftFixture();b.get('hub-idea-title').value='A discarded own idea';b.get('hub-challenge-note').value='An own invitation to discard.';await switchPreview(b,other);
 b.get('hub-idea-title').value='An old fictional idea';b.get('hub-challenge-note').value='An old fictional invitation.';await switchPreview(b,self);b.get('hub-idea-title').value='';b.get('hub-challenge-note').value='';await switchPreview(b,other);await switchPreview(b,self);assert.equal(b.get('hub-idea-title').value,'');assert.equal(b.get('hub-challenge-note').value,'');
 await b.get('hub-reset').emit('click');await b.create();await b.get('hub-examples').emit('click');assert.equal(b.api.getState().self,self);await switchPreview(b,other);assert.equal(b.get('hub-idea-title').value,'');assert.equal(b.get('hub-idea-detail').value,'');assert.equal(b.get('hub-challenge-note').value,'');b.api.dispose();
});
test('an invitation draft never restores a target hidden by its author',async()=>{
 const {b,self,other}=await draftFixture();b.get('hub-challenge-target').value=other;b.get('hub-challenge-note').value='Keep the brief while changing eligible recipients.';await switchPreview(b,other);await switchPreview(b,self);
 await b.find('hub-members','Hide '+b.api.getState().members.find(m=>m.id===other).name+' in this preview').emit('click');await switchPreview(b,other);await switchPreview(b,self);
 assert.notEqual(b.get('hub-challenge-target').value,other);assert.equal(b.get('hub-challenge-target').children.some(n=>n.value===other),false);assert.equal(b.get('hub-challenge-note').value,'Keep the brief while changing eligible recipients.');b.api.dispose();
});

function fillIdea(b,category='research'){b.get('hub-idea-title').value='Show public evidence sources';b.get('hub-idea-category').value=category;b.get('hub-idea-detail').value='Explain the public sources so new members can compare the evidence.';}
test('posting an idea reveals and focuses its card when the selected category would hide it',async()=>{
 const b=fixture();await b.create();b.get('hub-idea-filter').value='tools';await b.get('hub-idea-filter').emit('change');fillIdea(b);
 await b.get('hub-idea-form').emit('submit');const idea=b.api.getState().ideas[0],card=b.get('hub-idea-card-'+idea.id);
 assert.ok(card);assert.match(card.textContent,/Show public evidence sources/);assert.equal(b.get('hub-idea-filter').value,'research');assert.equal(b.document.activeElement,card);assert.match(b.get('hub-idea-status').textContent,/Showing Research & evidence/);b.api.dispose();
});
test('idea submission preserves an all-category or matching filter and focuses the created card',async()=>{
 for(const filter of ['all','research']){const b=fixture();await b.create();b.get('hub-idea-filter').value=filter;fillIdea(b);await b.get('hub-idea-form').emit('submit');
  assert.equal(b.get('hub-idea-filter').value,filter);assert.equal(b.document.activeElement,b.get('hub-idea-card-'+b.api.getState().ideas[0].id));assert.doesNotMatch(b.get('hub-idea-status').textContent,/Showing/);b.api.dispose();}
});
test('creating an invitation reveals and focuses it without claiming it is already active',async()=>{
 for(const filter of ['active','complete']){const {b}=await draftFixture();b.get('hub-challenge-filter').value=filter;await b.get('hub-challenge-filter').emit('change');
  b.get('hub-challenge-note').value='An invitation that still needs the other member’s acceptance.';await b.get('hub-challenge-form').emit('submit');const c=b.api.getState().challenges[0],card=b.get('hub-challenge-card-'+c.id);
  assert.ok(card);assert.equal(c.status,'invited');assert.equal(card.dataset.status,'invited');assert.equal(b.get('hub-challenge-filter').value,'invited');assert.equal(b.document.activeElement,card);assert.match(b.get('hub-challenge-status').textContent,/Showing awaiting invitations/);assert.ok(b.find('hub-challenges','Cancel invitation'));b.api.dispose();}
});
test('invitation creation preserves an all-status or already-awaiting filter',async()=>{
 for(const filter of ['all','invited']){const {b}=await draftFixture();b.get('hub-challenge-filter').value=filter;await b.get('hub-challenge-form').emit('submit');
  assert.equal(b.get('hub-challenge-filter').value,filter);assert.equal(b.document.activeElement,b.get('hub-challenge-card-'+b.api.getState().challenges[0].id));assert.doesNotMatch(b.get('hub-challenge-status').textContent,/Showing/);b.api.dispose();}
});
test('failed submissions preserve filters, editable text and the existing keyboard position',async()=>{
 const {b}=await draftFixture();b.get('hub-idea-filter').value='tools';fillIdea(b);b.get('hub-idea-title').value='tiny';b.get('hub-idea-title').focus();await b.get('hub-idea-form').emit('submit');
 assert.equal(b.api.getState().ideas.length,0);assert.equal(b.get('hub-idea-filter').value,'tools');assert.equal(b.get('hub-idea-title').value,'tiny');assert.equal(b.document.activeElement,b.get('hub-idea-title'));assert.doesNotMatch(b.get('hub-idea-status').textContent,/Showing/);
 b.get('hub-challenge-filter').value='active';b.get('hub-challenge-goal').value='0';b.get('hub-challenge-note').value='Keep this brief while repairing the goal.';b.get('hub-challenge-goal').focus();await b.get('hub-challenge-form').emit('submit');
 assert.equal(b.api.getState().challenges.length,0);assert.equal(b.get('hub-challenge-filter').value,'active');assert.equal(b.get('hub-challenge-note').value,'Keep this brief while repairing the goal.');assert.equal(b.document.activeElement,b.get('hub-challenge-goal'));assert.doesNotMatch(b.get('hub-challenge-status').textContent,/Showing/);b.api.dispose();
});
test('revealing a new invitation preserves an unfinished contribution hidden by the new filter',async()=>{
 const {b,key}=await activeFixture();b.get('hub-challenge-filter').value='active';await b.get('hub-challenge-filter').emit('change');b.get('hub-proof-'+key).value='An unfinished contribution that must survive a new invitation.';await b.get('hub-proof-'+key).emit('input');
 b.get('hub-challenge-kit').value='feedback';await b.get('hub-challenge-kit').emit('change');await b.get('hub-challenge-form').emit('submit');assert.equal(b.get('hub-challenge-filter').value,'invited');assert.equal(b.document.getElementById('hub-proof-'+key),null);
 b.get('hub-challenge-filter').value='active';await b.get('hub-challenge-filter').emit('change');assert.equal(b.get('hub-proof-'+key).value,'An unfinished contribution that must survive a new invitation.');b.api.dispose();
});

test('invitation recipients require an explicit choice while directory Challenge selects the named member',async()=>{
 const b=fixture();await b.create();await b.get('hub-examples').emit('click');const other=b.api.getState().members.find(m=>m.example);
 assert.equal(b.get('hub-challenge-target').value,'');assert.match(b.get('hub-challenge-target').children[0].textContent,/Choose a preview member/);
 await b.find('hub-kits','Use Find the friction challenge template').emit('click');assert.equal(b.get('hub-challenge-target').value,'');
 await b.find('hub-members','Challenge '+other.name).emit('click');assert.equal(b.get('hub-challenge-target').value,other.id);assert.equal(b.document.activeElement,b.get('hub-challenge-target'));
 await switchPreview(b,other.id);assert.equal(b.get('hub-challenge-target').value,'');b.api.dispose();
});
test('hiding the intended recipient clears the choice without substituting another member',async()=>{
 const {b,self,other}=await draftFixture();const note='An unfinished brief specifically intended for the selected member.';b.get('hub-challenge-note').value=note;
 await b.find('hub-members','Hide '+b.api.getState().members.find(m=>m.id===other).name+' in this preview').emit('click');assert.equal(b.get('hub-challenge-target').value,'');assert.equal(b.get('hub-challenge-note').value,note);assert.match(b.get('hub-challenge-status').textContent,/recipient is unavailable/);
 await b.get('hub-profile-form').emit('submit');assert.equal(b.get('hub-challenge-target').value,'');
 const remaining=b.api.getState().members.find(m=>m.example&&m.id!==other);await switchPreview(b,remaining.id);await switchPreview(b,self);assert.equal(b.get('hub-challenge-target').value,'');assert.equal(b.get('hub-challenge-note').value,note);b.api.dispose();
});
test('a missing recipient preserves the draft until an available recipient is intentionally selected',async()=>{
 const {b,other}=await draftFixture();b.get('hub-challenge-target').value='';b.get('hub-challenge-filter').value='active';b.get('hub-challenge-note').value='Keep this brief until I choose who should receive it.';b.get('hub-challenge-target').focus();await b.get('hub-challenge-form').emit('submit');
 assert.equal(b.api.getState().challenges.length,0);assert.match(b.get('hub-challenge-status').textContent,/Choose an available preview member/);assert.equal(b.get('hub-challenge-filter').value,'active');assert.equal(b.document.activeElement,b.get('hub-challenge-target'));assert.equal(b.get('hub-challenge-note').value,'Keep this brief until I choose who should receive it.');
 b.get('hub-challenge-target').value=other;await b.get('hub-challenge-form').emit('submit');assert.equal(b.api.getState().challenges[0].to,other);assert.equal(b.api.getState().challenges[0].note,'Keep this brief until I choose who should receive it.');b.api.dispose();
});
test('restoring a draft whose recipient was unlisted leaves the recipient blank',async()=>{
 const {b,self,other}=await draftFixture();await switchPreview(b,other);b.get('hub-challenge-target').value=self;b.get('hub-challenge-note').value='A fictional invitation specifically intended for the original profile.';
 await b.get('hub-return').emit('click');b.get('hub-listed').checked=false;await b.get('hub-profile-form').emit('submit');await switchPreview(b,other);
 assert.equal(b.get('hub-challenge-target').value,'');assert.equal(b.get('hub-challenge-target').children.some(n=>n.value===self),false);assert.match(b.get('hub-challenge-note').value,/specifically intended/);assert.match(b.get('hub-challenge-status').textContent,/recipient is unavailable/);b.api.dispose();
});
test('unhiding a member does not automatically select them for a retained invitation draft',async()=>{
 const {b,other}=await draftFixture();const examples=b.api.getState().members.filter(m=>m.example);b.get('hub-challenge-note').value='A brief to retain while no recipients are available.';
 for(const m of examples)await b.find('hub-members','Hide '+m.name+' in this preview').emit('click');assert.equal(b.get('hub-challenge-fields').disabled,true);
 const restored=examples.find(m=>m.id!==other);await b.find('hub-blocks','Show '+restored.name).emit('click');assert.equal(b.get('hub-challenge-fields').disabled,false);assert.equal(b.get('hub-challenge-target').value,'');assert.equal(b.get('hub-challenge-note').value,'A brief to retain while no recipients are available.');b.api.dispose();
});
test('hiding and showing a participant preserves challenge history and its own unfinished contribution',async()=>{
 const {b,target,key}=await activeFixture();b.get('hub-proof-'+key).value='A finished contribution ready for the other participant.';await proofForm(b,key).emit('submit');
 b.get('hub-proof-'+key).value='A separate unfinished contribution to keep working on.';await b.get('hub-proof-'+key).emit('input');const oldForm=proofForm(b,key);
 await b.find('hub-members','Hide '+target.name+' in this preview').emit('click');assert.equal(b.api.getState().challenges.length,0);assert.equal(b.document.getElementById('hub-proof-'+key),null);await oldForm.emit('submit');
 await b.find('hub-blocks','Show '+target.name).emit('click');assert.equal(b.api.getState().challenges[0].proofs.length,1);assert.equal(b.get('hub-proof-'+key).value,'A separate unfinished contribution to keep working on.');b.api.dispose();
});

function mediaFixture(matches=false){const listeners=new Set();return {matches,listeners,addEventListener(type,fn){assert.equal(type,'change');listeners.add(fn);},removeEventListener(type,fn){assert.equal(type,'change');listeners.delete(fn);},change(matches){this.matches=matches;for(const fn of [...listeners])fn({matches});}};}
test('stacked tabs declare vertical orientation and use Up/Down with wrapping',async()=>{
 const b=fixture({media:mediaFixture(true)});assert.equal(b.get('hub-tabs').getAttribute('aria-orientation'),'vertical');
 await b.get('hub-tab-profile').emit('keydown',{key:'ArrowDown'});assert.equal(b.get('hub-panel-challenges').hidden,false);assert.equal(b.document.activeElement,b.get('hub-tab-challenges'));
 await b.get('hub-tab-challenges').emit('keydown',{key:'ArrowUp'});assert.equal(b.get('hub-tab-profile').getAttribute('aria-selected'),'true');
 await b.get('hub-tab-profile').emit('keydown',{key:'ArrowUp'});assert.equal(b.get('hub-tab-ideas').getAttribute('aria-selected'),'true');
 await b.get('hub-tab-ideas').emit('keydown',{key:'ArrowDown'});assert.equal(b.get('hub-tab-profile').getAttribute('aria-selected'),'true');
 assert.equal(['profile','challenges','ideas'].filter(k=>b.get('hub-tab-'+k).getAttribute('tabindex')==='0').length,1);b.api.dispose();
});
test('wide and no-media environments keep horizontal Left/Right navigation',async()=>{
 for(const options of [{},{media:mediaFixture(false)}]){const b=fixture(options);assert.equal(b.get('hub-tabs').getAttribute('aria-orientation'),'horizontal');
  await b.get('hub-tab-profile').emit('keydown',{key:'ArrowLeft'});assert.equal(b.get('hub-tab-ideas').getAttribute('aria-selected'),'true');await b.get('hub-tab-ideas').emit('keydown',{key:'ArrowRight'});assert.equal(b.get('hub-tab-profile').getAttribute('aria-selected'),'true');b.api.dispose();}
});
test('resizing changes tab orientation without changing the selected panel or keyboard position',async()=>{
 const media=mediaFixture(false),b=fixture({media});await b.get('hub-tab-profile').emit('keydown',{key:'End'});const selected=b.document.activeElement;
 media.change(true);assert.equal(b.get('hub-tabs').getAttribute('aria-orientation'),'vertical');assert.equal(b.get('hub-panel-ideas').hidden,false);assert.equal(b.document.activeElement,selected);
 await b.get('hub-tab-ideas').emit('keydown',{key:'ArrowDown'});assert.equal(b.get('hub-panel-profile').hidden,false);media.change(false);assert.equal(b.get('hub-tabs').getAttribute('aria-orientation'),'horizontal');assert.equal(b.document.activeElement,b.get('hub-tab-profile'));
 await b.get('hub-tab-profile').emit('keydown',{key:'ArrowRight'});assert.equal(b.get('hub-panel-challenges').hidden,false);b.api.dispose();
});
test('the unused arrow axis keeps normal browser behavior and Home/End work in both orientations',async()=>{
 for(const narrow of [false,true]){const b=fixture({media:mediaFixture(narrow)});await b.get('hub-tab-profile').emit('click');b.get('hub-tab-profile').focus();let prevented=false;
  for(const key of narrow?['ArrowLeft','ArrowRight']:['ArrowUp','ArrowDown'])await b.get('hub-tab-profile').emit('keydown',{key,preventDefault(){prevented=true;}});
  assert.equal(prevented,false);assert.equal(b.get('hub-tab-profile').getAttribute('aria-selected'),'true');assert.equal(b.document.activeElement,b.get('hub-tab-profile'));
  await b.get('hub-tab-profile').emit('keydown',{key:'End'});assert.equal(b.document.activeElement,b.get('hub-tab-ideas'));await b.get('hub-tab-ideas').emit('keydown',{key:'Home'});assert.equal(b.document.activeElement,b.get('hub-tab-profile'));b.api.dispose();}
});
test('disposing removes the responsive listener and ignores a late resize callback',()=>{
 const media=mediaFixture(false),b=fixture({media});assert.equal(media.listeners.size,1);const late=[...media.listeners][0];b.api.dispose();assert.equal(media.listeners.size,0);media.matches=true;late({matches:true});assert.equal(b.get('hub-tabs').getAttribute('aria-orientation'),'horizontal');
});

