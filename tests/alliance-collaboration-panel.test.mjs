import test from 'node:test';
import assert from 'node:assert/strict';
import {mountAllianceCollaborationPanel} from '../assets/federation/fed-alliance-collaboration-panel.mjs';
const origin='https://deploy-preview-124--gfof.netlify.app',own='11111111-1111-4111-8111-111111111111',peer='22222222-2222-4222-8222-222222222222';
function fixture({enabled=true,feedbackEnabled=false,work}={}){
 const nodes=new Map();let doc;
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.events={};this.attributes={};this.value='';this._text='';this.disabled=false;this.hidden=false;}
  get ownerDocument(){return doc;}set innerHTML(v){throw Error('No HTML interpolation');}
  set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  setAttribute(k,v){this.attributes[k]=String(v);if(k==='id')nodes.set(v,this);}getAttribute(k){return this.attributes[k]??null;}
  append(...children){this.children.push(...children);}replaceChildren(...children){this._text='';this.children=children;}
  addEventListener(k,f){(this.events[k]??=new Set()).add(f);}removeEventListener(k,f){this.events[k]?.delete(f);}
  querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tag===tag?[c]:[]),...c.querySelectorAll(tag)]);}
  focus(){doc.activeElement=this;}
  async emit(k){for(const f of [...(this.events[k]||[])])await f({preventDefault(){}});}
 }
 doc={createElement:tag=>new Element(tag)};const root=new Element('section'),calls=[];let lose=false,last;
 const response=v=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json','cache-control':'no-store'}});
 const fetcher=async(url,init)=>{
  calls.push({url,init});if(work)return work(url,init);
  if(url.endsWith('/me'))return response({profile:{id:own,name:'Fictional owner',community:'Example crew',bio:'A private local test profile only.',role:'builder',listed:true,publication:'listed',updatedAt:new Date().toISOString()},revision:1});
  if(url.includes('/directory?'))return response({items:[{id:peer,name:'Another member',community:'Other crew',bio:'A private local fixture.',role:'researcher'}],next:null});
  if(url.includes('/challenges?'))return response({state:'ready',page:{items:last?[last]:[],next:null}});
  const v=JSON.parse(init.body);if(url.endsWith('/feedback/change')){if(lose){lose=false;throw Error('Lost report reply');}return response({state:'recorded',id:v.id,kind:'challenge',target:v.target,removed:false});}if(url.endsWith('/visibility'))return response({state:'set',...v});
  last={id:v.challengeId,from:own,to:peer,kit:v.kit,scope:v.scope,days:v.days,goal:v.goal,note:v.note,status:'invited',revision:1,winner:null,createdAt:new Date().toISOString(),acceptedAt:null,endsAt:null,proofs:[]};if(lose){lose=false;throw Error('Lost fictional reply');}return response({state:'applied',operationId:v.operationId,challenge:last});
 };
 const panel=mountAllianceCollaborationPanel(root,{enabled,feedbackEnabled,origin,fetcher}),get=id=>nodes.get('ac-'+id);
 async function load(){await get('load').emit('click');get('target').value=peer;get('kit').value='research';get('scope').value='members';get('days').value='7';get('goal').value='1';get('brief').value='A useful public source research brief.';await get('target').emit('change');}
 return {panel,root,calls,get,load,incoming(){last={id:'77777777-7777-4777-8777-777777777777',from:peer,to:own,kit:'research',scope:'members',days:7,goal:1,note:'An incoming fictional invitation.',status:'invited',revision:1,winner:null,createdAt:new Date().toISOString(),acceptedAt:null,endsAt:null,proofs:[]};},set lose(v){lose=v;}};
}
test('default panel is closed and constructs no client or request',()=>{const f=fixture({enabled:false});assert.equal(f.calls.length,0);assert.match(f.root.textContent,/not open/);assert.equal(f.get('load'),undefined);f.panel.dispose();});
test('workspace reads only on command, labels controls, preserves drafts and confirms a private invitation',async()=>{const f=fixture();try{assert.equal(f.calls.length,0);assert.equal(f.get('fields').disabled,true);assert.equal(f.get('status').getAttribute('aria-live'),'polite');await f.load();assert.equal(f.calls.length,3);assert.equal(f.get('fields').disabled,false);assert.match(f.get('target').textContent,/Another member/);await f.get('invitation').emit('submit');assert.equal(f.calls.length,4);assert.match(f.get('detail').textContent,/invited/);assert.equal(f.get('brief').value,'A useful public source research brief.');assert.doesNotMatch(f.root.textContent,/11111111|22222222|operationId/);}finally{f.panel.dispose();}});
test('unknown save pauses controls and offers an accurately labelled explicit earlier intention',async()=>{const f=fixture();try{await f.load();f.lose=true;await f.get('invitation').emit('submit');assert.equal(f.get('fields').disabled,true);assert.equal(f.get('previous').hidden,false);assert.match(f.get('previous-note').textContent,/may finish/);assert.equal(f.calls.length,4);await f.get('previous').emit('click');assert.equal(f.calls.length,5);assert.equal(f.get('previous').hidden,true);assert.deepEqual(JSON.parse(f.calls[4].init.body),JSON.parse(f.calls[3].init.body));}finally{f.panel.dispose();}});
test('dispose clears private drafts/content and removes old handlers without a request',async()=>{const f=fixture();await f.load();await f.get('invitation').emit('submit');const before=f.calls.length;const old=f.get('invitation');f.panel.dispose();await old.emit('submit');assert.equal(f.calls.length,before);assert.doesNotMatch(f.root.textContent,/useful public source|Another member|invited/);assert.match(f.root.textContent,/closed/);});
test('hide clears the displayed private conversations without an automatic list request',async()=>{const f=fixture();try{await f.load();await f.get('invitation').emit('submit');const before=f.calls.length;await f.get('hide').emit('click');assert.equal(f.calls.length,before+1);assert.doesNotMatch(f.get('detail').textContent,/research brief/);assert.match(f.get('status').textContent,/hidden/);}finally{f.panel.dispose();}});

test('recipient-bound challenge reports are separately enabled, require consent and reconcile the exact uncertain report',async()=>{
 const f=fixture({feedbackEnabled:true});try{
  await f.load();await f.get('invitation').emit('submit');assert.equal(f.get('reports').disabled,true);
  f.incoming();await f.load();f.get('selection').value='77777777-7777-4777-8777-777777777777';await f.get('selection').emit('change');assert.equal(f.get('reports').disabled,false);const before=f.calls.length;await f.get('report-challenge').emit('click');assert.equal(f.calls.length,before);
  f.get('report-check').checked=true;await f.get('report-check').emit('change');f.lose=true;await f.get('report-challenge').emit('click');assert.equal(f.get('previous').hidden,false);const body=f.calls.at(-1).init.body;assert.equal(JSON.parse(body).kind,'challenge');assert.equal(Object.hasOwn(JSON.parse(body),'actorId'),false);
  await f.get('previous').emit('click');assert.equal(f.calls.at(-1).init.body,body);assert.match(f.get('status').textContent,/human review are not confirmed/);assert.equal(f.get('previous').hidden,true);
 }finally{f.panel.dispose();}
});
