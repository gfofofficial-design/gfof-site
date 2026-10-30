import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildStaticPublish} from '../scripts/build-static-publish.mjs';

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
