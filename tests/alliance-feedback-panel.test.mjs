import test from 'node:test';
import assert from 'node:assert/strict';
import {mountAllianceFeedbackPanel} from '../assets/federation/fed-alliance-feedback-panel.mjs';
const origin='https://deploy-preview-124--gfof.netlify.app',own='11111111-1111-4111-8111-111111111111',peer='22222222-2222-4222-8222-222222222222',iid='33333333-3333-4333-8333-333333333333';
const initial=()=>({id:iid,owner:peer,title:'A fictional useful idea',category:'tools',detail:'A fictional idea with a clear practical limitation.',createdAt:'2026-10-24T12:00:00.000Z',supportCount:0,supported:false});
const tick=()=>new Promise(r=>setImmediate(r));
function fixture({enabled=true,work}={}){
 const nodes=new Map();let doc,lose=false;
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.events={};this.attributes={};this.value='';this.checked=false;this._text='';this.disabled=false;this.hidden=false;}
  get ownerDocument(){return doc;}set innerHTML(v){throw Error('No HTML interpolation');}
  set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  setAttribute(k,v){this.attributes[k]=String(v);if(k==='id')nodes.set(v,this);}getAttribute(k){return this.attributes[k]??null;}
  append(...children){this.children.push(...children);}replaceChildren(...children){this._text='';this.children=children;}
  addEventListener(k,f){(this.events[k]??=new Set()).add(f);}removeEventListener(k,f){this.events[k]?.delete(f);}
  focus(){doc.activeElement=this;}async emit(k){for(const f of [...(this.events[k]||[])])await f({preventDefault(){}});}
 }
 doc={createElement:tag=>new Element(tag)};const root=new Element('section'),calls=[],rows=new Map([[iid,initial()]]),reports=new Map();
 const reply=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json','cache-control':'private, no-store'}});
 const fetcher=async(url,init)=>{
  calls.push({url,init});if(work)return work(url,init);
  if(url.endsWith('/me'))return reply({profile:{id:own,name:'Fictional owner',community:'Example crew',bio:'A fictional profile for panel acceptance.',role:'builder',listed:true,publication:'listed',updatedAt:'2026-10-24T12:00:00.000Z'},revision:1});
  if(url.includes('/ideas?'))return reply({state:'ready',page:{items:[...rows.values()],next:null}});
  if(url.includes('/idea?'))return reply({state:'ready',idea:rows.get(new URL(url).searchParams.get('id'))});
  const v=JSON.parse(init.body);let result;
  if(v.action==='post'){const replayed=rows.has(v.id);if(!replayed)rows.set(v.id,{...initial(),id:v.id,owner:own,title:v.title,category:v.category,detail:v.detail});result={state:replayed?'replayed':'applied',idea:rows.get(v.id)};}
  if(v.action==='support'){const r=rows.get(v.id);r.supported=v.supported;r.supportCount=v.supported?1:0;result={state:'set',id:v.id,supported:v.supported};}
  if(v.action==='remove'){rows.delete(v.id);result={state:'removed',id:v.id};}
  if(v.action==='report'){reports.set(v.id,v);result={state:'recorded',id:v.id,kind:v.kind,target:v.target,removed:false};}
  if(lose){lose=false;throw Error('Fictional lost response');}return reply(result);
 };
 const panel=mountAllianceFeedbackPanel(root,{enabled,origin,fetcher}),get=id=>nodes.get('af-'+id);
 const draft=()=>{get('idea-title').value='My practical idea';get('category').value='research';get('idea-detail').value='A source-backed practical example with one limitation.';};
 const readPeer=async()=>{get('selection').value=iid;await get('selection').emit('change');await get('read').emit('click');};
 return {panel,root,calls,get,doc,rows,reports,draft,readPeer,set lose(v){lose=v;}};
}
test('closed feedback panel has no client requests or enabled actions',()=>{
 const f=fixture({enabled:false});assert.equal(f.calls.length,0);assert.equal(f.get('load'),undefined);assert.match(f.root.textContent,/not open/);f.panel.dispose();
});
test('drafting is available before loading; only a checked profile can enable posting',async()=>{
 const f=fixture();try{
  assert.equal(f.calls.length,0);assert.equal(f.get('fields').disabled,false);assert.equal(f.get('post').disabled,true);assert.equal(f.get('status').getAttribute('aria-live'),'polite');
  assert.equal(f.get('form').getAttribute('aria-describedby'),'af-draft-help');assert.match(f.get('draft-help').textContent,/type a draft now/);f.draft();
  await f.get('form').emit('submit');assert.equal(f.calls.length,0);
  await f.get('load').emit('click');assert.equal(f.calls.length,2);assert.equal(f.get('fields').disabled,false);assert.equal(f.get('post').disabled,false);assert.equal(f.get('idea-title').value,'My practical idea');
  await f.get('form').emit('submit');assert.equal(f.calls.length,3);assert.match(f.get('detail').textContent,/My practical idea/);assert.equal(f.doc.activeElement,f.get('detail'));assert.equal(f.get('removal').disabled,false);assert.equal(f.get('remove').disabled,true);
  assert.doesNotMatch(f.root.textContent,/11111111|22222222|operationId|actorId/);
 }finally{f.panel.dispose();}
});

test('a missing profile keeps the draft editable and retained but cannot post',async()=>{
 const f=fixture({work:async()=>new Response(JSON.stringify({profile:null,revision:0}),{headers:{'content-type':'application/json','cache-control':'private, no-store'}})});try{
  f.draft();await f.get('load').emit('click');assert.equal(f.calls.length,1);assert.equal(f.get('fields').disabled,false);assert.equal(f.get('post').disabled,true);
  assert.equal(f.get('idea-title').value,'My practical idea');assert.match(f.get('status').textContent,/before posting or supporting/);
  await f.get('form').emit('submit');assert.equal(f.calls.length,1);
 }finally{f.panel.dispose();}
});
test('support is explicit on/off and its receipt does not invent a refreshed count or auto-read',async()=>{
 const f=fixture();try{
  await f.get('load').emit('click');await f.readPeer();const before=f.calls.length;assert.equal(f.get('support-on').disabled,false);assert.equal(f.get('support-off').disabled,true);
  await f.get('support-on').emit('click');assert.equal(f.calls.length,before+1);assert.deepEqual(JSON.parse(f.calls.at(-1).init.body),{action:'support',id:iid,supported:true});
  assert.doesNotMatch(f.get('detail').textContent,/Support visible/);assert.match(f.get('status').textContent,/Read the idea again/);
  await f.get('read').emit('click');assert.match(f.get('detail').textContent,/read: 1/);assert.equal(f.get('support-off').disabled,false);
  await f.get('support-off').emit('click');assert.equal(JSON.parse(f.calls.at(-1).init.body).supported,false);
 }finally{f.panel.dispose();}
});
test('reports require an explicit confirmation and bind to the selected idea or author without takedown claims',async()=>{
 const f=fixture();try{
  await f.get('load').emit('click');await f.readPeer();const before=f.calls.length;await f.get('report').emit('click');assert.equal(f.calls.length,before);
  f.get('report-check').checked=true;await f.get('report-check').emit('change');await f.get('report').emit('click');assert.equal(f.reports.size,1);assert.equal(JSON.parse(f.calls.at(-1).init.body).target,iid);assert.match(f.get('status').textContent,/human review are not confirmed/);assert.equal(f.get('report-check').checked,false);
  f.get('report-kind').value='member';await f.get('report-kind').emit('change');f.get('report-check').checked=true;await f.get('report-check').emit('change');await f.get('report').emit('click');assert.equal(JSON.parse(f.calls.at(-1).init.body).target,peer);assert.equal(f.reports.size,2);
 }finally{f.panel.dispose();}
});
test('only own removal is offered, needs a check, clears matching draft and dispatches one exact action',async()=>{
 const f=fixture();try{
  await f.get('load').emit('click');await f.readPeer();assert.equal(f.get('removal').disabled,true);f.draft();await f.get('form').emit('submit');const id=f.get('selection').value;assert.equal(f.get('reports').disabled,true);
  const before=f.calls.length;await f.get('remove').emit('click');assert.equal(f.calls.length,before);f.get('remove-check').checked=true;await f.get('remove-check').emit('change');await f.get('remove').emit('click');
  assert.equal(f.calls.length,before+1);assert.deepEqual(JSON.parse(f.calls.at(-1).init.body),{action:'remove',id});assert.equal(f.rows.has(id),false);assert.equal(f.get('idea-title').value,'');assert.equal(f.get('idea-detail').value,'');assert.doesNotMatch(f.get('detail').textContent,/My practical idea/);assert.equal(f.doc.activeElement,f.get('load'));
 }finally{f.panel.dispose();}
});
test('lost post holds all changes, retains the draft and offers only exact intentional reconciliation',async()=>{
 const f=fixture();try{
  await f.get('load').emit('click');f.draft();f.lose=true;await f.get('form').emit('submit');const first=f.calls.at(-1).init.body,before=f.calls.length;
  assert.equal(f.get('fields').disabled,true);assert.equal(f.get('post').disabled,true);assert.equal(f.get('previous').hidden,false);assert.equal(f.doc.activeElement,f.get('previous'));assert.match(f.get('previous-note').textContent,/may finish/);
  await f.get('form').emit('submit');assert.equal(f.calls.length,before);assert.equal(f.get('idea-title').value,'My practical idea');
  await f.get('previous').emit('click');assert.equal(f.calls.length,before+1);assert.equal(f.calls.at(-1).init.body,first);assert.equal(f.get('previous').hidden,true);assert.equal(f.get('fields').disabled,false);assert.equal(f.get('post').disabled,false);assert.equal(f.rows.size,2);
 }finally{f.panel.dispose();}
});
test('stopping a delayed read withholds late content and disposal removes stale handlers and private drafts',async()=>{
 let resume,started=false;const f=fixture({work:async()=>{started=true;return new Promise(r=>resume=r);}});
 const read=f.get('load').emit('click');while(!started)await tick();assert.equal(f.get('fields').disabled,true);assert.equal(f.get('post').disabled,true);await f.get('cancel').emit('click');assert.equal(f.get('fields').disabled,false);assert.equal(f.get('post').disabled,true);const old=f.get('form');f.draft();f.panel.dispose();resume(new Response(JSON.stringify({profile:null,revision:0}),{headers:{'content-type':'application/json'}}));await read;await tick();const before=f.calls.length;await old.emit('submit');assert.equal(f.calls.length,before);assert.doesNotMatch(f.root.textContent,/My practical idea/);assert.equal(f.get('idea-title').value,'');assert.match(f.root.textContent,/cleared/);
});
