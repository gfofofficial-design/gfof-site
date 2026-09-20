import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const model=readFileSync(new URL('../journey/avatar-model.js',import.meta.url),'utf8');
const code=readFileSync(new URL('../journey/avatar.js',import.meta.url),'utf8');
function boot(saved=null,blocked=false,imageOptions={}){
 const nodes=new Map(),store=new Map([['gf-journey-v1','[1]']]); if(saved!==null)store.set('gf-journey-avatar-v1',saved);
 let blob,drawArgs;
 const element=()=>({value:'',textContent:'',innerHTML:'',events:{},addEventListener(k,f){this.events[k]=f;},click(){},remove(){}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
 const storage={getItem(k){if(blocked)throw Error();return store.get(k)||null;},setItem(k,v){if(blocked)throw Error();store.set(k,v);},removeItem(k){if(blocked)throw Error();store.delete(k);}};
 vm.runInNewContext(model+code,{document:{getElementById:get,createElement:tag=>tag==="canvas"?{getContext(){return {fillRect(){},drawImage(...args){drawArgs=args;}};},toDataURL(){return "data:image/jpeg;base64,YQ==";},toBlob(callback,type){callback(imageOptions.nullBlob?null:new Blob(["test-pixels"],{type}));}}:element(),body:{append(){}}},localStorage:storage,Image:class{naturalWidth=imageOptions.width||800;naturalHeight=imageOptions.height||400;decode(){return imageOptions.decode?imageOptions.decode():Promise.resolve();}},Blob,URL:{createObjectURL(b){blob=b;return 'blob:test';},revokeObjectURL(){}},setTimeout(f){f();},Math});
 return {get,store,blob:()=>blob,draw:()=>drawArgs,fire(id,event='click',target){return get(id).events[event]({preventDefault(){},target});}};
}
test('preview saves only on explicit save; removal preserves mission markers',()=>{const t=boot();t.get('callsign').value='Nova';t.fire('avatar-form','input');assert.equal(t.store.has('gf-journey-avatar-v1'),false);t.fire('avatar-form','submit');assert.equal(JSON.parse(t.store.get('gf-journey-avatar-v1')).callsign,'Nova');t.fire('forget');assert.equal(t.store.has('gf-journey-avatar-v1'),false);assert.equal(t.store.get('gf-journey-v1'),'[1]');});
test('untrusted saved choices cannot add SVG markup',()=>{const t=boot(JSON.stringify({callsign:'<script>bad</script>',skin:'"/><script>bad</script>',form:'unknown'}));assert.equal(t.get('skin').value,'bronze');assert.equal(t.get('form').value,'voyager');assert.ok(!t.get('portrait').innerHTML.includes('<script>'));assert.equal(t.get('preview-name').textContent,'<script>bad</script>');});
test('malformed storage and blocked storage leave creator usable',()=>{for(const t of [boot('{'),boot(null,true)]){assert.ok(t.get('portrait').innerHTML.includes('<svg'));t.fire('shuffle');t.fire('avatar-form','submit');assert.ok(t.get('portrait').innerHTML.includes('<svg'));}const t=boot(null,true);t.fire('avatar-form','submit');assert.match(t.get('avatar-status').textContent,/could not save/);t.fire('forget');assert.match(t.get('avatar-status').textContent,/could not remove/);});
test('download uses a self-contained SVG without callsign',async()=>{const t=boot();t.get('callsign').value='PrivateNickname';t.fire('avatar-form','input');t.fire('download');const b=t.blob();assert.equal(b.type,'image/svg+xml');const s=await b.text();assert.ok(s.startsWith('<svg'));assert.ok(!s.includes('PrivateNickname'));assert.ok(!s.includes('<script'));assert.ok(!s.includes('href='));});

test('photo normalization crops to square, saves explicitly, and character save discards hidden photo',async()=>{
 const t=boot();t.get('photo-file').files=[{type:'image/png',size:2000}];await t.fire('photo-file','change');assert.equal(t.store.has('gf-journey-avatar-v1'),false);assert.deepEqual(t.draw().slice(1),[200,0,400,400,0,0,512,512]);t.fire('avatar-form','submit');let saved=JSON.parse(t.store.get('gf-journey-avatar-v1'));assert.equal(saved.mode,'photo');assert.equal(saved.photo,'data:image/jpeg;base64,YQ==');t.get('portrait-mode').value='character';t.fire('avatar-form','input',{id:'portrait-mode'});t.fire('avatar-form','submit');saved=JSON.parse(t.store.get('gf-journey-avatar-v1'));assert.equal(saved.photo,null);
});
test('invalid type, oversize, oversized dimensions and decode failure reject',async()=>{
 for(const file of [{type:'image/svg+xml',size:10},{type:'image/png',size:6*1024*1024}]){const t=boot();t.get('photo-file').files=[file];await t.fire('photo-file','change');assert.match(t.get('avatar-status').textContent,/no larger than/);}
 for(const opts of [{width:6000,height:6000},{decode:()=>Promise.reject(Error())}]){const t=boot(null,false,opts);t.get('photo-file').files=[{type:'image/png',size:100}];await t.fire('photo-file','change');assert.match(t.get('avatar-status').textContent,/could not be opened/);assert.ok(t.get('portrait').innerHTML.includes('<svg'));}
});
test('pending image completion cannot resurrect a removed avatar',async()=>{
 let finish;const t=boot(null,false,{decode:()=>new Promise(r=>finish=r)});t.get('photo-file').files=[{type:'image/png',size:100}];const pending=t.fire('photo-file','change');t.fire('forget');finish();await pending;assert.ok(t.get('portrait').innerHTML.includes('<svg'));assert.equal(t.store.has('gf-journey-avatar-v1'),false);
});
test('remote or executable saved photo sources are ignored; missing image blocks save',()=>{
 for(const photo of ['https://example.com/image.png','data:image/svg+xml;base64,YQ==','data:image/jpeg;base64,YQ==" onerror="bad']){const t=boot(JSON.stringify({mode:'photo',photo}));assert.ok(!t.get('portrait').innerHTML.includes('<img'));t.fire('avatar-form','submit');assert.match(t.get('avatar-status').textContent,/Choose an image/);}
});

test('PNG export preserves aspect ratio, generates PNG, and never saves implicitly',async()=>{const t=boot(null,false,{width:400,height:420});await t.fire('download-png');assert.equal(t.blob().type,'image/png');const args=t.draw().slice(1);assert.equal(args[3],1024);assert.ok(Math.abs(args[2]/args[3]-400/420)<1e-12);assert.ok(args[0]>0);assert.equal(args[1],0);assert.equal(t.store.has('gf-journey-avatar-v1'),false);assert.equal(t.get('download-png').disabled,false);});
test('PNG errors restore controls and offer original-format fallback',async()=>{for(const opts of [{nullBlob:true},{decode:()=>Promise.reject(Error())}]){const t=boot(null,false,opts);await t.fire('download-png');assert.equal(t.get('download-png').disabled,false);assert.match(t.get('avatar-status').textContent,/original format/);}});
test('personal portrait also exports PNG; missing photo rejects',async()=>{const t=boot(JSON.stringify({mode:'photo',photo:'data:image/jpeg;base64,YQ=='}),false,{width:512,height:512});await t.fire('download-png');assert.equal(t.blob().type,'image/png');assert.deepEqual(t.draw().slice(1),[0,0,1024,1024]);const missing=boot(JSON.stringify({mode:'photo'}));await missing.fire('download-png');assert.match(missing.get('avatar-status').textContent,/Choose an image/);});
