import {cp, lstat, mkdir, mkdtemp, readdir, rename, rm} from 'node:fs/promises';
import {extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const publicDirectories = new Set(['.well-known','adjudication','app','arena','assets','config','docs','journey','lib','record']);
const publicExtensions = new Set(['.html','.css','.js','.mjs','.json','.png','.jpg','.jpeg','.svg','.webp','.gif','.ico','.pdf','.txt','.xml','.md','.webmanifest','.woff','.woff2','.mp4','.mp3','.webm','.ogg','.wav','.ots']);
const rootExtensions = new Set(['.html','.png','.jpg','.jpeg','.svg','.webp','.ico','.pdf','.txt','.xml','.md','.webmanifest']);
// These modules own server cookies, database connections or protected runtime
// construction. Browser modules in lib/ (including the constellation) remain.
const serverLibraryFiles = new Set([
  'lib/alliance-avatar-storage.mjs','lib/alliance-community-http.mjs',
  'lib/alliance-feedback-http.mjs','lib/alliance-member-application.mjs',
  'lib/alliance-member-finite-host.mjs','lib/alliance-member-http.mjs',
  'lib/alliance-member-preview-bundle.mjs','lib/alliance-profile-api.mjs',
  'lib/alliance-profile-removal-api.mjs','lib/alliance-profile-removal-status-api.mjs',
  'lib/alliance-profile-store.mjs','lib/alliance-report-review-http.mjs'
]);

// An explicit static output keeps Netlify's server bundle outside the publish
// directory. Public docs and timestamp evidence remain intentionally available.
export async function buildStaticPublish(root) {
  root=resolve(root);
  const output=join(root,'dist');
  try { if((await lstat(output)).isSymbolicLink())throw Error('Publish output must not be a symbolic link.'); }
  catch(error) { if(error.code!=='ENOENT')throw error; }
  const stage=await mkdtemp(join(root,'.static-publish-'));
  const copied=[];
  async function copyEntry(relative) {
    const name=relative.split('/').at(-1);
    if(relative==='lib/alliance-avatar-server'||serverLibraryFiles.has(relative))return;
    // Installed server/vendor dependencies are never browser publication inputs.
    if(name==='node_modules')return;
    const source=join(root,relative),stat=await lstat(source);
    if(stat.isSymbolicLink())throw Error('Symbolic links are not allowed in static output: '+relative);
    // Arena publishes only reviewed numbered rules/results HTML, never intake or drafts.
    if(relative.startsWith('arena/')&&!/^arena\/arena-[0-9]{4}-(rules|results)\.html$/.test(relative))return;
    if(name.startsWith('.')&&relative!=='.well-known')return;
    if(stat.isDirectory()) {
      for(const child of (await readdir(source)).sort())await copyEntry(relative+'/'+child);
    } else if(stat.isFile()&&publicExtensions.has(extname(name))) {
      await mkdir(join(stage,relative,'..'),{recursive:true});
      await cp(source,join(stage,relative));copied.push(relative);
    }
  }
  try {
    for(const entry of (await readdir(root,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      if(publicDirectories.has(entry.name)||(entry.isFile()&&!entry.name.startsWith('.')&&rootExtensions.has(extname(entry.name))))await copyEntry(entry.name);
    }
    await rm(output,{recursive:true,force:true});
    await rename(stage,output);
    return copied;
  } catch(error) { await rm(stage,{recursive:true,force:true});throw error; }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const files=await buildStaticPublish(resolve(fileURLToPath(new URL('..',import.meta.url))));
  console.log('Prepared '+files.length+' public files in dist/.');
}
