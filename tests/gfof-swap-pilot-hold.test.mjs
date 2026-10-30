import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
test('paused browser entry keeps actions disabled and never loads a provider or registers wallet actions',async()=>{
 const elements=new Map(['open-provider','direction','status'].map(id=>[id,{disabled:false,textContent:''}]));
 const script=await readFile(new URL('../tools/swap-pilot/page.mjs',import.meta.url),'utf8');
 // Only local status elements are available. Network, script creation and event
 // registration would fail this entry test rather than silently start a wallet.
 runInNewContext(script,{document:{getElementById:id=>elements.get(id)}});
 assert.equal(elements.get('open-provider').disabled,true);
 assert.equal(elements.get('direction').disabled,true);
 assert.match(elements.get('status').textContent,/Testing paused/);
 const html=await readFile(new URL('../tools/swap-pilot/index.html',import.meta.url),'utf8');
 assert.match(html,/<button id="open-provider"[^>]* disabled>/);
 assert.match(html,/<select id="direction" disabled>/);
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
