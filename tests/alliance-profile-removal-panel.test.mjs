import test from 'node:test';
import assert from 'node:assert/strict';
import {mountProfileRemovalPanel} from '../assets/federation/fed-alliance-profile-removal-panel.mjs';
function fixture(){
 const doc={activeElement:null,createElement(tag){return new Element(tag);}};
 class Element{constructor(tag){this.tag=tag;this.ownerDocument=doc;this.children=[];this.events={};this.attributes={};this.hidden=false;this.disabled=false;this.checked=false;this.textContent='';}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=[...nodes];}setAttribute(k,v){this.attributes[k]=v;}addEventListener(k,f){(this.events[k]??=new Set()).add(f);}removeEventListener(k,f){this.events[k]?.delete(f);}focus(){doc.activeElement=this;}async emit(k){for(const f of this.events[k]||[])await f();}}
 const root=new Element('section'),find=text=>{const walk=n=>{if(n.textContent===text)return n;for(const c of n.children){const v=walk(c);if(v)return v;}};return walk(root);};return {root,doc,find};
}
test('default panel stays closed without constructing client and describes profile-only scope',()=>{
 const f=fixture();let calls=0;const p=mountProfileRemovalPanel(f.root,{createClient(){calls++;}});assert.equal(calls,0);assert.equal(f.find('Review profile removal').disabled,true);assert.match(f.root.children[1].textContent,/does not delete your sign-in account/);assert.equal(f.root.children[4].attributes['aria-live'],'polite');p.dispose();assert.equal(f.root.children.length,0);
});
test('review, checkbox and explicit Remove are separate; keeping profile starts nothing',async()=>{
 const f=fixture(),calls=[];let state;const p=mountProfileRemovalPanel(f.root,{enabled:true,version:7,createClient:onState=>{state=onState;return {confirm:async v=>{calls.push(v);onState({status:'removed',message:'Profile removed; account retained.'});},reconcile(){throw Error('Unexpected');},cancel(){},dispose(){}};}});
 const review=f.find('Review profile removal'),remove=f.find('Remove my Alliance profile'),keep=f.find('Keep my profile'),checkbox=f.root.children[3].children[0].children[0];
 await remove.emit('click');assert.equal(calls.length,0);await review.emit('click');assert.equal(f.doc.activeElement,checkbox);assert.equal(remove.disabled,true);await keep.emit('click');assert.equal(f.doc.activeElement,review);assert.equal(calls.length,0);
 await review.emit('click');checkbox.checked=true;await checkbox.emit('change');assert.equal(remove.disabled,false);await remove.emit('click');assert.deepEqual(calls,[{version:7,confirm:'remove_my_profile'}]);assert.equal(f.find('Check the same removal request').hidden,true);await remove.emit('click');assert.equal(calls.length,1);p.dispose();
});
test('unknown outcome exposes an explicit same-request check without repeating confirmation',async()=>{
 const f=fixture();let confirms=0,checks=0;const p=mountProfileRemovalPanel(f.root,{enabled:true,version:7,createClient:onState=>({async confirm(){confirms++;onState({status:'unknown',message:'May have completed.'});},async reconcile(){checks++;onState({status:'removed',message:'Profile removed.'});},cancel(){},dispose(){}})});
 await f.find('Review profile removal').emit('click');const checkbox=f.root.children[3].children[0].children[0];checkbox.checked=true;await checkbox.emit('change');await f.find('Remove my Alliance profile').emit('click');assert.equal(confirms,1);assert.equal(checks,0);assert.equal(f.find('Check the same removal request').hidden,false);await f.find('Check the same removal request').emit('click');assert.equal(confirms,1);assert.equal(checks,1);p.dispose();
});
test('disposal removes all handlers and ignores callbacks from an earlier account',async()=>{
 const f=fixture();let callback,disposed=0;const p=mountProfileRemovalPanel(f.root,{enabled:true,version:7,createClient:onState=>{callback=onState;return {confirm(){throw Error('No request');},reconcile(){},cancel(){},dispose(){disposed++;}};}});const review=f.find('Review profile removal');p.dispose();callback({status:'removed',message:'Old account'});await review.emit('click');assert.equal(f.root.children.length,0);assert.equal(review.events.click.size,0);assert.equal(disposed,1);
});
test('review explicitly reads current removal version before confirmation and discards it when member backs out',async()=>{
 const f=fixture(),calls=[];let reads=0;const p=mountProfileRemovalPanel(f.root,{enabled:true,version:999,readVersion:async()=>({version:++reads}),createClient:onState=>({async confirm(v){calls.push(v);onState({status:'removed',message:'Removed'});},reconcile(){},cancel(){},dispose(){}})});
 assert.equal(reads,0);await f.find('Review profile removal').emit('click');assert.equal(reads,1);await f.find('Keep my profile').emit('click');await f.find('Review profile removal').emit('click');assert.equal(reads,2);const check=f.root.children[3].children[0].children[0];check.checked=true;await check.emit('change');await f.find('Remove my Alliance profile').emit('click');assert.deepEqual(calls,[{version:2,confirm:'remove_my_profile'}]);assert.equal(reads,2);p.dispose();
});
test('failed version read never presents confirmation or starts removal',async()=>{
 const f=fixture();let calls=0;const p=mountProfileRemovalPanel(f.root,{enabled:true,readVersion:async()=>{throw Error('No current authority');},createClient:()=>({confirm(){calls++;},reconcile(){},cancel(){},dispose(){}})});await f.find('Review profile removal').emit('click');assert.equal(f.root.children[3].hidden,true);assert.equal(f.find('Review profile removal').hidden,false);assert.match(f.root.children[4].textContent,/No removal was started/);assert.equal(calls,0);p.dispose();
});
test('disposal cancels current-version read and cannot display another account from a late callback',async()=>{
 const f=fixture();let resolve,signal;const p=mountProfileRemovalPanel(f.root,{enabled:true,readVersion:opts=>{signal=opts.signal;return new Promise(r=>resolve=r);},createClient:()=>({confirm(){throw Error('No removal');},reconcile(){},cancel(){},dispose(){}})});const reading=f.find('Review profile removal').emit('click');p.dispose();assert.equal(signal.aborted,true);resolve({version:7});await reading;assert.equal(f.root.children.length,0);
});
test('bound panel carries read identity only as a precondition and does not ask the member to type it',async()=>{
 const f=fixture(),profileId='33333333-3333-4333-8333-333333333333',calls=[];const p=mountProfileRemovalPanel(f.root,{enabled:true,profileBinding:true,readVersion:async()=>({profileId,version:0}),createClient:onState=>({async confirm(v){calls.push(v);onState({status:'removed',message:'Profile removed.'});},reconcile(){},cancel(){},dispose(){}})});
 await f.find('Review profile removal').emit('click');const check=f.root.children[3].children[0].children[0];check.checked=true;await check.emit('change');await f.find('Remove my Alliance profile').emit('click');assert.deepEqual(calls,[{profileId,version:0,confirm:'remove_my_profile'}]);assert.equal(JSON.stringify(f.root.children.map(n=>n.textContent)).includes(profileId),false);p.dispose();
});
test('bound panel refuses a version-only read before displaying confirmation',async()=>{
 const f=fixture();const p=mountProfileRemovalPanel(f.root,{enabled:true,profileBinding:true,readVersion:async()=>({version:0}),createClient:()=>({confirm(){throw Error('No removal');},reconcile(){},cancel(){},dispose(){}})});await f.find('Review profile removal').emit('click');assert.equal(f.root.children[3].hidden,true);assert.match(f.root.children[4].textContent,/No removal was started/);p.dispose();
});
