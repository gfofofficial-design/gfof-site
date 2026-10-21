import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountAllianceMemberPage} from '../assets/federation/fed-alliance-member-page.mjs';
const html=readFileSync(new URL('../alliance-profile.html',import.meta.url),'utf8'),entry=readFileSync(new URL('../assets/federation/fed-alliance-profile-page.mjs',import.meta.url),'utf8');
const origin='https://deploy-preview-124--gfof.netlify.app',profileId='33333333-3333-4333-8333-333333333333';
const p=(name='Fixture member')=>({id:profileId,name,community:'Example crew',bio:'A synthetic member profile for page acceptance.',role:'builder',listed:false,publication:'private',updatedAt:'2026-10-21T12:00:00Z'});
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};},tick=()=>new Promise(r=>setImmediate(r));
function fixture(fetcher,enabled=true){
 const nodes=new Map();let doc;
 class Element{constructor(tag){this.tag=tag;this.children=[];this.events={};this.attributes={};this.value='';this.checked=false;this.hidden=false;this.disabled=false;this._text='';}get ownerDocument(){return doc;}set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}append(...v){this.children.push(...v);}replaceChildren(...v){this.children=[...v];this._text='';}setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}removeAttribute(k){delete this.attributes[k];}addEventListener(k,f){(this.events[k]??=new Set()).add(f);}removeEventListener(k,f){this.events[k]?.delete(f);}focus(){doc.activeElement=this;}async emit(k){for(const f of this.events[k]||[])await f({preventDefault(){}});}}
 for(const m of html.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){const n=new Element(m[1]);n.disabled=/\sdisabled(?:\s|>)/.test(m[0]);n.hidden=/\shidden(?:\s|>)/.test(m[0]);nodes.set(m[2],n);}
 doc={activeElement:null,getElementById:id=>nodes.get(id)||null,createElement:tag=>new Element(tag)};const get=id=>nodes.get('ap-'+id);get('role').value='explorer';const calls=[];
 const controller=mountAllianceMemberPage(doc,{enabled,origin,fetcher:async(url,init)=>{calls.push({url,init,body:init.body?JSON.parse(init.body):null});return fetcher(url,init);}});
 const find=text=>{const walk=n=>{if(n.textContent===text)return n;for(const c of n.children){const v=walk(c);if(v)return v;}};return walk(get('removal'));};
 const checkbox=()=>get('removal').children[3].children[0].children[0];
 async function review(){await find('Review profile removal').emit('click');checkbox().checked=true;await checkbox().emit('change');}
 return {get,doc,calls,controller,find,review};
}
test('normal entry remains closed with no client requests, attach bypass or CSP connection permission',()=>{
 const f=fixture(()=>{throw Error('No I/O');},false);assert.equal(f.calls.length,0);assert.equal(f.controller.attach(1),false);assert.equal(f.get('fields').disabled,true);assert.equal(f.find('Review profile removal').disabled,true);assert.match(html,/connect-src 'none'/);assert.match(entry,/mountAllianceMemberPage\(document\)/);assert.doesNotMatch(entry,/enabled\s*:\s*true|localStorage|location\.search/);f.controller.dispose();
});
test('explicit host attachment starts no read and detach clears drafts, profile, errors and comparison state',async()=>{
 const f=fixture(()=>json({profile:p(),revision:1}));assert.equal(f.controller.attach(1),true);assert.equal(f.calls.length,0);await f.get('read').emit('click');assert.equal(f.get('name').value,'Fixture member');f.get('name').value='Private unsent draft';f.get('name').setAttribute('aria-invalid','true');f.get('name-error').textContent='Old validation';f.controller.detach();assert.equal(f.get('name').value,'');assert.equal(f.get('current-body').textContent,'');assert.equal(f.get('name').getAttribute('aria-invalid'),null);assert.equal(f.get('name-error').textContent,'');assert.equal(f.get('fields').disabled,true);assert.equal(f.find('Review profile removal').disabled,true);assert.equal(f.controller.attach(1),false);assert.equal(f.controller.attach(2),true);assert.equal(f.get('accept').disabled,false);assert.equal(f.calls.length,1);f.controller.dispose();
});
test('stale account generations and late old-account responses cannot replace a new account form',async()=>{
 const gate=deferred();let calls=0;const f=fixture(async()=>++calls===1?gate.promise:json({profile:p('New account member'),revision:1}));f.controller.attach(1);const oldRead=f.get('read').emit('click');await tick();f.controller.attach(2);assert.equal(f.controller.attach(1),false);await f.get('read').emit('click');assert.equal(f.get('name').value,'New account member');gate.resolve(json({profile:p('Old private member'),revision:1}));await oldRead;await tick();assert.equal(f.get('name').value,'New account member');assert.doesNotMatch(f.get('current-body').textContent,/Old private member/);f.controller.dispose();
});
test('removal uses bound identity, closes editor before dispatch and makes no automatic follow-up',async()=>{
 const f=fixture((url,init)=>url.endsWith('/removal-status')?json({state:'ready',profileId,version:7}):init.method==='DELETE'?json({state:'committed',version:8}):json({profile:p(),revision:1}));f.controller.attach(1);await f.get('read').emit('click');await f.review();await f.find('Remove my Alliance profile').emit('click');assert.equal(f.get('fields').disabled,true);assert.equal(f.get('name').value,'');const writes=f.calls.filter(c=>c.init.method==='DELETE');assert.equal(writes.length,1);assert.equal(writes[0].body.profileId,profileId);assert.equal(writes[0].body.version,7);assert.equal(writes[0].body.confirm,'remove_my_profile');assert.equal(Object.hasOwn(writes[0].body,'actorId'),false);await tick();assert.equal(f.calls.length,3);assert.match(f.get('removal').textContent,/profile was removed/);f.controller.dispose();
});
test('active profile save blocks confirmation before any removal intention or request starts',async()=>{
 const gate=deferred();const f=fixture((url,init)=>url.endsWith('/removal-status')?json({state:'ready',profileId,version:7}):init.method==='POST'?gate.promise:init.method==='DELETE'?json({state:'committed',version:8}):json({profile:p(),revision:1}));f.controller.attach(1);await f.get('read').emit('click');await f.review();const saving=f.get('form').emit('submit');await tick();await f.find('Remove my Alliance profile').emit('click');assert.equal(f.calls.filter(c=>c.init.method==='DELETE').length,0);assert.match(f.get('removal').textContent,/No removal was started/);const save=f.calls.find(c=>c.init.method==='POST').body;gate.resolve(json({state:'saved',revision:2,operationId:save.operationId,profile:p()}));await saving;await f.find('Remove my Alliance profile').emit('click');assert.equal(f.calls.filter(c=>c.init.method==='DELETE').length,1);f.controller.dispose();
});
test('unknown removal keeps editor closed and only explicit check reuses the same operation',async()=>{
 let writes=0;const f=fixture((url,init)=>init.method==='GET'?json({state:'ready',profileId,version:7}):++writes===1?Promise.reject(Error('Synthetic lost reply')):json({state:'committed',version:8}));f.controller.attach(1);await f.review();await f.find('Remove my Alliance profile').emit('click');assert.equal(f.get('fields').disabled,true);assert.equal(writes,1);await tick();assert.equal(writes,1);await f.find('Check the same removal request').emit('click');const requests=f.calls.filter(c=>c.init.method==='DELETE');assert.deepEqual(requests[0].body,requests[1].body);assert.equal(writes,2);f.controller.dispose();
});
test('sign-in-required closes both surfaces without OAuth, refresh or another account lookup',async()=>{
 const f=fixture(()=>json({},401));f.controller.attach(1);await f.get('read').emit('click');assert.equal(f.get('fields').disabled,true);assert.equal(f.find('Review profile removal').disabled,true);assert.match(f.get('status').textContent,/Sign in again/);assert.equal(f.calls.length,1);assert.equal(f.controller.attach(1),false);f.controller.dispose();
});
test('dispose during removal-status read ignores late status and removes previous account content',async()=>{
 const gate=deferred();const f=fixture(()=>gate.promise);f.controller.attach(1);const reading=f.find('Review profile removal').emit('click');await tick();f.controller.dispose();gate.resolve(json({state:'ready',profileId,version:7}));await reading;await tick();assert.equal(f.get('removal').textContent,'');assert.equal(f.get('name').value,'');assert.equal(f.controller.attach(2),false);assert.equal(f.calls.length,1);
});
test('shared response bound withholds oversized account content instead of populating fields',async()=>{
 const f=fixture(()=>json({profile:p('x'.repeat(33000)),revision:1}));f.controller.attach(1);await f.get('read').emit('click');assert.equal(f.get('name').value,'');assert.equal(f.get('current-body').textContent,'');assert.equal(f.calls.length,1);f.controller.dispose();
});
test('a stale host detach for an earlier generation cannot close the new account',()=>{
 const f=fixture(()=>{throw Error('No automatic reads');});f.controller.attach(1);f.controller.attach(2);assert.equal(f.controller.detach(1),false);assert.equal(f.get('fields').disabled,false);assert.equal(f.controller.detach(2),true);assert.equal(f.get('fields').disabled,true);assert.equal(f.calls.length,0);f.controller.dispose();
});
