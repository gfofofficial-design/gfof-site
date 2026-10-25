import test from 'node:test';
import assert from 'node:assert/strict';
import {mountAllianceReportReviewPanel} from '../assets/federation/fed-alliance-report-review-panel.mjs';
const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const initial=()=>({id:id(1),kind:'idea',target:id(9),contextState:'unavailable',contextLoaded:true,targetTitle:null,targetSummary:null,createdAt:'2035-01-01T12:00:00.000Z',reviewedAt:null,disposition:'unreviewed',expiresAt:'2035-04-01T12:00:00.000Z'});
const updated=()=>({...initial(),reviewedAt:'2035-01-02T12:00:00.000Z',disposition:'no_action',expiresAt:'2035-02-01T12:00:00.000Z'});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({enabled=true,overrides={}}={}){
 const nodes=new Map(),calls=[];let doc,current=initial(),factoryCalls=0;
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.events={};this.value='';this.checked=false;this._text='';this.disabled=false;this.hidden=false;}
  get ownerDocument(){return doc;}set innerHTML(v){throw Error('HTML interpolation forbidden');}
  set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  setAttribute(k,v){this.attributes[k]=String(v);if(k==='id')nodes.set(v,this);}getAttribute(k){return this.attributes[k]??null;}
  append(...v){this.children.push(...v);}replaceChildren(...v){this.children=v;this._text='';}
  addEventListener(k,f){(this.events[k]??=new Set()).add(f);}removeEventListener(k,f){this.events[k]?.delete(f);}
  focus(){doc.activeElement=this;}async emit(k){for(const f of [...(this.events[k]||[])])await f({preventDefault(){}});}
 }
 doc={createElement:tag=>new Element(tag)};const root=new Element('section');
 const client={async list(...args){calls.push(['list',...args]);return overrides.list?overrides.list(...args):{items:[{...current,contextLoaded:false,targetTitle:null,targetSummary:null}],next:null};},async read(...args){calls.push(['read',...args]);return overrides.read?overrides.read(...args):current;},async review(...args){calls.push(['review',...args]);current=updated();return overrides.review?overrides.review(...args):current;},close(){calls.push(['close']);return overrides.close?.();}};
 const panel=mountAllianceReportReviewPanel(root,{enabled,clientFactory(){factoryCalls++;return client;}}),get=name=>nodes.get('arr-'+name);
 const read=async()=>{get('selection').value=id(1);await get('selection').emit('change');await get('read').emit('click');};
 const save=async()=>{get('checked').checked=true;await get('checked').emit('change');return get('save').emit('click');};
 return {panel,root,get,doc,calls,read,save,get factoryCalls(){return factoryCalls;}};
}
test('default-off panel creates no client or load controls',()=>{
 const f=fixture({enabled:false});assert.equal(f.factoryCalls,0);assert.equal(f.calls.length,0);assert.equal(f.get('load'),undefined);assert.match(f.root.textContent,/not open/);f.panel.dispose();
});
test('manual load, explicit read and confirmation use native labelled controls',async()=>{
 const f=fixture();try{
  assert.equal(f.calls.length,0);assert.equal(f.get('fields').disabled,true);assert.equal(f.get('status').getAttribute('aria-live'),'polite');
  await f.get('load').emit('click');assert.equal(f.calls.length,1);assert.equal(f.get('fields').disabled,true);
  await f.read();assert.equal(f.get('fields').disabled,false);assert.equal(f.get('save').disabled,true);assert.equal(f.doc.activeElement,f.get('detail'));
  assert.match(f.get('detail').textContent,/target is unavailable/);await f.save();assert.equal(f.calls.filter(c=>c[0]==='review').length,1);
  assert.match(f.get('status').textContent,/Review confirmed/);assert.equal(f.get('checked').checked,false);
  assert.match(f.root.textContent,/30 days after the first review/);assert.match(f.root.textContent,/90 days/);assert.match(f.root.textContent,/30 additional days/);
 }finally{f.panel.dispose();}
});
test('lost save acknowledgement offers read-only reconciliation without resubmission',async()=>{
 const f=fixture({overrides:{async review(){throw Error('Fictional lost acknowledgement');}}});try{
  await f.get('load').emit('click');await f.read();await f.save();assert.match(f.get('status').textContent,/not confirmed/);
  assert.equal(f.get('fields').disabled,true);assert.equal(f.get('check').hidden,false);assert.equal(f.doc.activeElement,f.get('check'));
  await f.get('check').emit('click');assert.match(f.get('status').textContent,/now matches/);assert.match(f.get('status').textContent,/Nothing was resubmitted/);
  assert.equal(f.calls.filter(c=>c[0]==='review').length,1);assert.equal(f.calls.filter(c=>c[0]==='read').length,2);assert.equal(f.get('fields').disabled,true);
 }finally{f.panel.dispose();}
});
test('selected target text is rendered as text only after an explicit read',async()=>{
 const f=fixture({overrides:{read:async()=>({...initial(),contextState:'available',targetTitle:'Fictional <b>chart</b> labels',targetSummary:'A plain-text description of the fictional chart.'})}});try{
  await f.get('load').emit('click');assert.doesNotMatch(f.root.textContent,/<b>/);await f.read();
  assert.match(f.get('detail').textContent,/<b>chart<\/b>/);assert.equal(f.get('fields').disabled,false);
 }finally{f.panel.dispose();}
});
test('late cancelled load cannot restore stale records',async()=>{
 let release;const f=fixture({overrides:{list:()=>new Promise(r=>{release=r;})}});try{
  const loading=f.get('load').emit('click');await tick();await f.get('stop').emit('click');
  release({items:[{...initial(),contextLoaded:false}],next:null});await loading;
  assert.equal(f.get('selection').children.length,1);assert.match(f.get('status').textContent,/Waiting stopped/);assert.equal(f.doc.activeElement,f.get('load'));
 }finally{f.panel.dispose();}
});
test('cancelled review remains uncertain after a late success',async()=>{
 let release;const f=fixture({overrides:{review:()=>new Promise(r=>{release=r;})}});try{
  await f.get('load').emit('click');await f.read();const saving=f.save();await tick();await f.get('stop').emit('click');
  release(updated());await saving;assert.match(f.get('status').textContent,/may have completed/);assert.equal(f.get('check').hidden,false);
  await f.get('check').emit('click');assert.match(f.get('status').textContent,/now matches/);assert.equal(f.calls.filter(c=>c[0]==='review').length,1);
 }finally{f.panel.dispose();}
});
test('sign-out disposal clears private reads even if client close fails',async()=>{
 let release;const f=fixture({overrides:{read:()=>new Promise(r=>{release=r;}),close(){throw Error('Fictional close failure');}}});
 await f.get('load').emit('click');const reading=f.read();await tick();f.panel.dispose();release(initial());await reading;
 assert.match(f.root.textContent,/Earlier reads were cleared/);assert.doesNotMatch(f.root.textContent,/2035|unavailable/);
 assert.equal(f.get('load').events.click.size,0);
});
test('malformed response and extra private identity fields fail without HTML insertion',async()=>{
 const f=fixture({overrides:{read:async()=>({...initial(),reporter:id(8),detail:'<script>unsafe</script>'})}});try{
  await f.get('load').emit('click');await f.read();assert.match(f.get('status').textContent,/could not be confirmed/);assert.equal(f.get('fields').disabled,true);assert.doesNotMatch(f.root.textContent,/script|unsafe|00000008/);
 }finally{f.panel.dispose();}
});
test('fresh read explicitly discards uncertainty without undo or repeating review',async()=>{
 const f=fixture({overrides:{review:async()=>{throw Error('Fictional lost acknowledgement');}}});try{
  await f.get('load').emit('click');await f.read();await f.save();await f.get('fresh').emit('click');
  assert.match(f.get('status').textContent,/not undone or repeated/);assert.equal(f.get('load').disabled,false);assert.equal(f.calls.filter(c=>c[0]==='review').length,1);assert.equal(f.get('fields').disabled,true);
 }finally{f.panel.dispose();}
});
