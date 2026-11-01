import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
test('review entry loads nothing automatically and requires one explicit provider-button action',async()=>{
 const calls=[],elements=new Map(['open-provider','direction','status','receipt','jupiter-plugin','start-controls'].map(id=>[id,{disabled:false,textContent:'',value:'sell',replaceChildren(){},addEventListener(type,fn){this.click=fn;assert.equal(type,'click');}}]));
 const script=(await readFile(new URL('../tools/swap-pilot/page.mjs',import.meta.url),'utf8')).replace(/^import .*?;\r?\n/,'');
 runInNewContext(script,{window:{},document:{getElementById:id=>elements.get(id)},loadJupiter(){throw Error('Unexpected provider load');},createManagedSwap:()=>({start:direction=>{calls.push(direction);return Promise.resolve(true);}})});
 assert.deepEqual(calls,[]);assert.equal(elements.get('open-provider').disabled,false);
 elements.get('open-provider').click();assert.deepEqual(calls,['sell']);
 assert.equal(elements.get('open-provider').disabled,true);assert.equal(elements.get('direction').disabled,true);
 const html=await readFile(new URL('../tools/swap-pilot/index.html',import.meta.url),'utf8');
 assert.match(html,/current wallet warning state still needs owner verification/);
 assert.match(html,/does not authorize a signature, trade or account creation/);
 assert.match(html,/0\.50% Federation fee is not active or verified/);
});

test('preview rebuild replaces stale cached output and emits only the six pilot files',async t=>{
 const {mkdtemp,mkdir,copyFile,writeFile,readdir,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const {execFileSync}=await import('node:child_process');
 const root=await mkdtemp(join(tmpdir(),'gfof-pilot-build-'));t.after(()=>rm(root,{recursive:true,force:true}));
 for(const name of ['build.mjs','index.html','style.css','provider.mjs','page.mjs'])await copyFile(new URL('../tools/swap-pilot/'+name,import.meta.url),join(root,name));
 await mkdir(join(root,'dist'));await writeFile(join(root,'dist','stale-output.txt'),'cached generated fixture');
 execFileSync(process.execPath,[join(root,'build.mjs')],{env:{...process.env,CONTEXT:'deploy-preview'}});
 assert.deepEqual((await readdir(join(root,'dist'))).sort(),['_headers','index.html','page.mjs','provider.mjs','robots.txt','style.css']);
});
