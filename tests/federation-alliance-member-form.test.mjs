import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountMemberProfileForm} from '../assets/federation/fed-alliance-member-form.mjs';
import {createMemberProfileClient} from '../assets/federation/fed-alliance-member-client.mjs';
const html=readFileSync(new URL('../alliance-profile.html',import.meta.url),'utf8');
const input=()=>({name:'Fixture Explorer',community:'Example crew',bio:'A synthetic member form for local acceptance.',role:'builder',listed:false});
const profile=(value=input())=>({id:'11111111-1111-4111-8111-111111111111',...value,publication:value.listed?'listed':'private',updatedAt:'2026-10-20T12:00:00Z'});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
function fixture({enabled=true}={}){
 const nodes=new Map();let document;
 class Element{
  constructor(tag='div'){this.tag=tag;this.children=[];this.attributes={};this.events={};this.value='';this.checked=false;this.hidden=false;this.disabled=false;this._text='';}
  set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  set innerHTML(_){throw Error('No profile HTML interpolation');}
  append(...v){this.children.push(...v);}replaceChildren(...v){this.children=[...v];this._text='';}
  setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}removeAttribute(k){delete this.attributes[k];}
  addEventListener(k,fn){(this.events[k]??=new Set()).add(fn);}removeEventListener(k,fn){this.events[k]?.delete(fn);}
  emit(k){return Promise.all([...(this.events[k]||[])].map(fn=>fn({preventDefault(){}})));}
  focus(){document.activeElement=this;}
 }
 for(const m of html.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){assert.equal(nodes.has(m[2]),false);const n=new Element(m[1]);n.id=m[2];n.disabled=/\sdisabled(?:\s|>)/.test(m[0]);n.hidden=/\shidden(?:\s|>)/.test(m[0]);nodes.set(n.id,n);}
 document={activeElement:null,getElementById:id=>nodes.get(id)||null,createElement:tag=>new Element(tag)};
 const get=id=>nodes.get('ap-'+id);get('role').value='explorer';
 const server={profile:null,revision:0,lose:false,gate:null},calls=[];let factoryCalls=0,next=0;
 const controller=mountMemberProfileForm(document,{enabled,createClient:onState=>{factoryCalls++;return createMemberProfileClient({enabled:true,profileRevisions:true,origin:'https://deploy-preview-124--gfof.netlify.app',newOperationId:()=>`${String(++next).padStart(8,'0')}-5555-4555-8555-555555555555`,onState,fetcher:async(endpoint,init)=>{
  calls.push({endpoint,init});let body,status=200;
  if(init.method==='GET')body={profile:structuredClone(server.profile),revision:server.revision};
  else{const request=JSON.parse(init.body);if(request.revision!==server.revision){body={state:'conflict',revision:server.revision};status=409;}else{server.revision++;server.profile=profile(request.profile);body={state:'saved',profile:structuredClone(server.profile),revision:server.revision,operationId:request.operationId};}}
  await server.gate?.promise;if(init.method==='POST'&&server.lose){server.lose=false;throw Error('Synthetic lost response');}
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 }});}});
 async function fill(value=input()){for(const k of ['name','community','bio','role','listed']){if(k==='listed')get(k).checked=value[k];else get(k).value=value[k];await get(k).emit('input');}}
 return {get,document,controller,calls,server,fill,get factoryCalls(){return factoryCalls;}};
}
test('real page is default-closed with no client construction, startup request or native form submission',()=>{
 const f=fixture({enabled:false});assert.equal(f.factoryCalls,0);assert.equal(f.calls.length,0);assert.equal(f.get('fields').disabled,true);assert.equal(f.get('read').disabled,true);assert.equal(f.get('save').disabled,true);assert.match(f.get('status').textContent,/not open/);
 assert.match(html,/connect-src 'none'/);assert.match(html,/form-action 'none'/);assert.match(html,/aria-live="polite" aria-atomic="true"/);assert.doesNotMatch(html,/on(?:click|submit)=/);f.controller.dispose();
});
test('explicit read/create/second edit retain input and show a separate last-read profile without identity fields',async()=>{
 const f=fixture();try{assert.equal(f.calls.length,0);await f.get('read').emit('click');await f.fill();await f.get('form').emit('submit');assert.equal(f.server.revision,1);assert.equal(f.get('name').value,'Fixture Explorer');
 await f.fill({...input(),name:'Second ordinary edit',listed:true});await f.get('form').emit('submit');assert.equal(f.server.revision,2);assert.equal(f.server.profile.listed,true);assert.match(f.get('current-body').textContent,/Second ordinary edit/);assert.doesNotMatch(f.get('current-body').textContent,/11111111|session|operationId/);
 }finally{f.controller.dispose();}
});
test('initial read with an existing typed draft requires comparison rather than silently selecting a baseline',async()=>{
 const f=fixture();try{f.server.profile=profile();f.server.revision=1;await f.fill({...input(),name:'My unsent draft'});await f.get('read').emit('click');assert.equal(f.get('name').value,'My unsent draft');assert.equal(f.get('comparison').hidden,false);assert.equal(f.get('save').getAttribute('aria-disabled'),'true');await f.get('form').emit('submit');assert.equal(f.server.revision,1);
 await f.get('accept').emit('click');assert.equal(f.document.activeElement,f.get('save'));assert.equal(f.server.revision,1);await f.get('form').emit('submit');assert.equal(f.server.profile.name,'My unsent draft');
 }finally{f.controller.dispose();}
});
test('conflict keeps current and draft distinct; explicit continue is the only local unlock and submits nothing',async()=>{
 const f=fixture();try{f.server.profile=profile();f.server.revision=1;await f.get('read').emit('click');await f.fill({...input(),name:'Retained local draft'});f.server.profile=profile({...input(),name:'Newer server version'});f.server.revision=2;
 f.get('save').focus();await f.get('form').emit('submit');assert.equal(f.get('name').value,'Retained local draft');assert.equal(f.document.activeElement,f.get('save'));assert.equal(f.get('save').getAttribute('aria-disabled'),'true');
 await f.get('read').emit('click');assert.match(f.get('current-body').textContent,/Newer server version/);assert.equal(f.get('name').value,'Retained local draft');const count=f.calls.length;await f.get('accept').emit('click');assert.equal(f.calls.length,count);assert.equal(f.get('name').value,'Retained local draft');await f.get('form').emit('submit');assert.equal(f.server.revision,3);
 }finally{f.controller.dispose();}
});
test('lost response preserves the draft and cannot be unlocked by a current read alone',async()=>{
 const f=fixture();try{await f.get('read').emit('click');await f.fill();f.server.lose=true;await f.get('form').emit('submit');assert.equal(f.server.revision,1);assert.match(f.get('status').textContent,/may have completed/);const count=f.calls.length;await f.get('form').emit('submit');assert.equal(f.calls.length,count);
 await f.get('read').emit('click');assert.equal(f.get('comparison').hidden,false);assert.equal(f.get('save').getAttribute('aria-disabled'),'true');assert.equal(f.get('bio').value,input().bio);await f.get('accept').emit('click');assert.equal(f.calls.length,count+1);
 }finally{f.controller.dispose();}
});
test('field errors focus their input, keep help text and clear on correction without changing the draft',async()=>{
 const f=fixture();try{await f.get('read').emit('click');await f.fill({...input(),name:'X'});await f.get('form').emit('submit');assert.equal(f.calls.length,1);assert.equal(f.document.activeElement,f.get('name'));assert.equal(f.get('name').getAttribute('aria-invalid'),'true');assert.equal(f.get('name').getAttribute('aria-describedby'),'ap-name-help ap-name-error');
 f.get('name').value='Corrected name';await f.get('name').emit('input');assert.equal(f.get('name').getAttribute('aria-invalid'),null);assert.equal(f.get('name').getAttribute('aria-describedby'),'ap-name-help');assert.equal(f.get('bio').value,input().bio);assert.match(f.get('status').textContent,/Draft updated/);
 }finally{f.controller.dispose();}
});
test('typing during a slow save is preserved when its earlier submitted fields return',async()=>{
 const f=fixture();try{await f.get('read').emit('click');await f.fill();f.server.gate=deferred();const saving=f.get('form').emit('submit');await tick();f.get('bio').value='New text typed while the earlier save is pending.';await f.get('bio').emit('input');f.server.gate.resolve();await saving;
 assert.equal(f.server.profile.bio,input().bio);assert.equal(f.get('bio').value,'New text typed while the earlier save is pending.');assert.match(f.get('draft-note').textContent,/has changes/);
 }finally{f.controller.dispose();}
});
test('typing after a clean read begins still requires comparison and never silently fills over the new draft',async()=>{
 const f=fixture();try{f.server.profile=profile();f.server.revision=1;f.server.gate=deferred();const reading=f.get('read').emit('click');await tick();await f.fill({...input(),name:'Typed while loading'});f.server.gate.resolve();await reading;
 assert.equal(f.get('name').value,'Typed while loading');assert.equal(f.get('comparison').hidden,false);assert.equal(f.get('save').getAttribute('aria-disabled'),'true');const count=f.calls.length;await f.get('form').emit('submit');assert.equal(f.calls.length,count);await f.get('accept').emit('click');assert.equal(f.calls.length,count);await f.get('form').emit('submit');assert.equal(f.server.profile.name,'Typed while loading');
 }finally{f.controller.dispose();}
});
test('disposal clears displayed profile and draft before another account could mount here',async()=>{
 const f=fixture();f.server.profile=profile();f.server.revision=1;await f.get('read').emit('click');await f.fill();f.controller.dispose();assert.equal(f.get('name').value,'');assert.equal(f.get('bio').value,'');assert.equal(f.get('current-body').textContent,'');assert.equal(f.get('current').hidden,true);assert.equal(f.get('comparison').hidden,true);
});
test('cancelled save ignores late response, returns focus to Read and retains uncertainty',async()=>{
 const f=fixture();try{await f.get('read').emit('click');await f.fill();f.server.gate=deferred();const saving=f.get('form').emit('submit');await tick();await f.get('cancel').emit('click');await saving;f.server.gate.resolve();await tick();assert.match(f.get('status').textContent,/may have completed/);assert.equal(f.document.activeElement,f.get('read'));assert.equal(f.get('name').value,input().name);assert.equal(f.get('save').getAttribute('aria-disabled'),'true');
 }finally{f.controller.dispose();}
});
test('disposed form has no active handlers and cannot repopulate itself from a late read',async()=>{
 const f=fixture();f.server.profile=profile();f.server.revision=1;f.server.gate=deferred();const reading=f.get('read').emit('click');await tick();f.controller.dispose();await reading;const text=f.get('status').textContent;f.server.gate.resolve();await tick();assert.equal(f.get('status').textContent,text);assert.equal(f.get('name').value,'');assert.equal(f.get('fields').disabled,true);assert.equal(f.get('form').events.submit.size,0);
});
