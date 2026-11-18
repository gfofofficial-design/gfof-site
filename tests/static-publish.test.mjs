import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {buildStaticPublish} from '../scripts/build-static-publish.mjs';

test('production and branch deploys inherit the same restricted output as previews',async()=>{
  const config=await readFile(new URL('../netlify.toml',import.meta.url),'utf8');
  const sections=config.split(/(?=^\[)/m),build=sections.find(section=>section.startsWith('[build]'));
  assert.ok(build,'The default build must own the publication boundary');
  assert.match(build,/^\s*command\s*=\s*"node scripts\/build-static-publish\.mjs"\s*$/m);
  assert.match(build,/^\s*publish\s*=\s*"dist"\s*$/m);
  for(const context of sections.filter(section=>section.startsWith('[context.'))){
    assert.doesNotMatch(context,/^\s*(?:command|publish)\s*=/m,'A context must not bypass the default boundary');
  }
});

async function fixture(t,files) {
  const root=await mkdtemp(join(tmpdir(),'federation-static-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  for(const [path,content]of Object.entries(files)){await mkdir(join(root,path,'..'),{recursive:true});await writeFile(join(root,path),content);}
  return root;
}
test('public page, browser imports and public evidence survive byte-for-byte',async t=>{
  const files={'account.html':'<script src="/journey/passport.js"></script>','journey/passport.js':'public browser script','assets/federation/fed-account.js':'public account script','lib/mission-coach-core.mjs':'public imported module','config/public-availability.json':'{}','docs/public-evidence.md':'public report','record/evidence.json.ots':'timestamp proof','.well-known/security.txt':'security contact','whitepaper.pdf':'pdf fixture'};
  const root=await fixture(t,files),copied=await buildStaticPublish(root);
  assert.deepEqual(new Set(copied),new Set(Object.keys(files)));
  for(const [path,content]of Object.entries(files))assert.equal(await readFile(join(root,'dist',path),'utf8'),content);
});
test('server, dependencies, CI, test, migration, worker and unknown directory files are absent',async t=>{
  const root=await fixture(t,{'account.html':'public','netlify/functions/account.cjs':'server','tests/fixture.json':'test','scripts/report.mjs':'operator','supabase/migrations/test.sql':'migration','workers/example/worker.mjs':'worker','.github/workflows/check.yml':'CI','private/export.json':'private','netlify.toml':'settings','.env':'fixture only','assets/.env':'fixture only','assets/key.pem':'fixture only','lib/alliance-avatar-server/node_modules/package/index.js':'server dependency','assets/vendor/node_modules/package/index.mjs':'nested dependency'});
  assert.deepEqual(await buildStaticPublish(root),['account.html']);
  assert.deepEqual(await readdir(join(root,'dist')),['account.html']);
});

test('Alliance backend sources stay private while its public projection remains available',async t=>{
  const root=await fixture(t,{
    'alliance.html':'public page',
    'lib/alliance-constellation-projection.mjs':'public browser import',
    'lib/alliance-avatar-server/member-aws-runtime.mjs':'server runtime',
    'lib/alliance-avatar-server/deep/fixture.json':'server fixture',
    'lib/alliance-avatar-runtime/processor.mjs':'node child processor',
    'lib/alliance-avatar-runtime/worker.mjs':'native image worker',
    'lib/alliance-avatar-runtime/limits.mjs':'server limits',
    'lib/alliance-avatar-runtime/test.mjs':'server tests',
    'lib/alliance-avatar-runtime/package.json':'server package',
    'lib/alliance-avatar-runtime/package-lock.json':'server lock',
    'lib/alliance-member-closed-https.mjs':'server persistent host module',
    'lib/alliance-member-closed-process-entry.mjs':'server persistent host module',
    'lib/alliance-member-closed-tls-files.mjs':'server persistent host module',
    'lib/alliance-member-generation-process-entry.mjs':'server persistent host module',
    'lib/alliance-member-local-control-client.mjs':'server persistent host module',
    'lib/alliance-member-local-control.mjs':'server persistent host module',
    'lib/alliance-member-node-http.mjs':'server persistent host module',
    'lib/alliance-member-persistent-https.mjs':'server persistent host module',
    'lib/alliance-member-persistent-process.mjs':'server persistent host module',
    'lib/alliance-member-private-bundle.mjs':'server persistent host module',
    'lib/alliance-member-http.mjs':'server cookie boundary',
    'lib/alliance-member-preview-bundle.mjs':'server connection factory',
    'lib/alliance-avatar-storage.mjs':'server media adapter',
    'lib/alliance-profile-store.mjs':'server database adapter',
    'lib/alliance-report-review-http.mjs':'server owner-review boundary'
  });
  assert.deepEqual(await buildStaticPublish(root),['alliance.html','lib/alliance-constellation-projection.mjs']);
  assert.equal(await readFile(join(root,'dist/lib/alliance-constellation-projection.mjs'),'utf8'),'public browser import');
});
test('rebuild removes stale output without copying it back into itself',async t=>{
  const root=await fixture(t,{'account.html':'public','dist/stale.txt':'stale'});
  await buildStaticPublish(root);await buildStaticPublish(root);
  assert.deepEqual(await readdir(join(root,'dist')),['account.html']);
});
test('source symlink refuses build and preserves prior output',async t=>{
  const root=await fixture(t,{'account.html':'public','dist/prior.txt':'prior','outside.txt':'do not follow'});
  await mkdir(join(root,'assets'));await symlink(join(root,'outside.txt'),join(root,'assets','escape.txt'));
  await assert.rejects(buildStaticPublish(root),/Symbolic links/);
  assert.equal(await readFile(join(root,'dist/prior.txt'),'utf8'),'prior');
});
test('output symlink is never deleted or followed',async t=>{
  const root=await fixture(t,{'account.html':'public','outside/keep.txt':'keep'});
  await symlink(join(root,'outside'),join(root,'dist'));
  await assert.rejects(buildStaticPublish(root),/symbolic link/);
  assert.equal(await readFile(join(root,'outside/keep.txt'),'utf8'),'keep');
});

test('Arena publishes only numbered rules and results pages, excluding drafts and private records',async t=>{
 const files={'arena/arena-0001-rules.html':'approved rules fixture','arena/arena-0001-results.html':'reviewed results fixture','arena/intake.json':'private intake fixture','arena/draft.html':'draft fixture','arena/arena-0001-rules.json':'private metadata fixture','arena/archive/arena-0002-rules.html':'nested draft fixture','arena/arena-001-rules.html':'wrong identity fixture'};
 const root=await fixture(t,files),copied=await buildStaticPublish(root);
 assert.deepEqual(copied,['arena/arena-0001-results.html','arena/arena-0001-rules.html']);
 for(const path of copied)assert.equal(await readFile(join(root,'dist',path),'utf8'),files[path]);
});

test('the canonical homepage replaces a legacy index byte-for-byte',async t=>{
  const canonical='<!doctype html><title>Current Federation homepage</title>\n';
  const root=await fixture(t,{'command-preview.html':canonical,'index.html':'legacy homepage'});
  await buildStaticPublish(root,{requireCanonicalHome:true});
  assert.equal(await readFile(join(root,'dist/index.html'),'utf8'),canonical);
  assert.equal(await readFile(join(root,'dist/command-preview.html'),'utf8'),canonical);
});

test('requiring the canonical homepage refuses a legacy fallback and preserves previous output',async t=>{
  const root=await fixture(t,{'index.html':'legacy homepage','dist/index.html':'previous published homepage'});
  await assert.rejects(buildStaticPublish(root,{requireCanonicalHome:true}),/command-preview\.html.*required/);
  assert.equal(await readFile(join(root,'dist/index.html'),'utf8'),'previous published homepage');
  assert.ok(!(await readdir(root)).some(name=>name.startsWith('.static-publish-')));
});

async function cliFixture(t,files) {
  const script=await readFile(new URL('../scripts/build-static-publish.mjs',import.meta.url),'utf8');
  return fixture(t,{'scripts/build-static-publish.mjs':script,...files});
}

function publish(root) {
  return spawnSync(process.execPath,['scripts/build-static-publish.mjs'],{cwd:root,encoding:'utf8',timeout:5000});
}

test('the configured publish command requires the canonical homepage by default',async t=>{
  const root=await cliFixture(t,{'index.html':'legacy homepage','dist/index.html':'previous published homepage'});
  const result=publish(root);
  assert.equal(result.error,undefined);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/command-preview\.html.*required/);
  assert.equal(await readFile(join(root,'dist/index.html'),'utf8'),'previous published homepage');
  assert.ok(!(await readdir(root)).some(name=>name.startsWith('.static-publish-')));
});

test('the configured publish command stages the canonical homepage and its media unchanged',async t=>{
  const files={'command-preview.html':'<video poster="/assets/poster.jpg" src="/assets/video.mp4"></video>\n',
    'assets/poster.jpg':Buffer.from([0xff,0xd8,0xff,0xd9]),'assets/video.mp4':Buffer.from([0,0,0,8,102,116,121,112])};
  const root=await cliFixture(t,{'index.html':'legacy homepage',...files});
  const result=publish(root);
  assert.equal(result.error,undefined);
  assert.equal(result.status,0,result.stderr);
  for(const path of Object.keys(files))assert.deepEqual(await readFile(join(root,'dist',path)),await readFile(join(root,path)));
  assert.equal(await readFile(join(root,'dist/index.html'),'utf8'),files['command-preview.html']);
});

test('the legacy root worker is published alongside the app worker while other root scripts stay private', async t => {
  const root = await fixture(t, {
    'sw.js': 'root recovery worker',
    'app/sw.js': 'app offline worker',
    'operator.js': 'private root script',
    'operator.mjs': 'private root module'
  });
  const files = await buildStaticPublish(root);
  assert.deepEqual(files.sort(), ['app/sw.js', 'sw.js']);
  assert.equal(await readFile(join(root, 'dist/sw.js'), 'utf8'), 'root recovery worker');
  assert.equal(await readFile(join(root, 'dist/app/sw.js'), 'utf8'), 'app offline worker');
});

test('the legacy worker retires its own registration and lets the browser load pages normally', async () => {
  const script = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const handlers = new Map();
  const calls = [];
  const worker = {
    addEventListener(type, handler) { handlers.set(type, handler); },
    async skipWaiting() { calls.push('skipWaiting'); },
    registration: { async unregister() { calls.push('unregister'); return true; } }
  };
  runInNewContext(script, {self: worker});
  assert.deepEqual([...handlers.keys()].sort(), ['activate', 'install']);
  for (const type of ['install', 'activate']) {
    const pending = [];
    handlers.get(type)({waitUntil(work) { pending.push(work); }});
    assert.equal(pending.length, 1);
    await Promise.all(pending);
  }
  assert.deepEqual(calls, ['skipWaiting', 'unregister']);
});
