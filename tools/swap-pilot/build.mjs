// Dedicated deploy-preview only. Never builds the Federation production site.
import {copyFile,mkdir,readdir,writeFile,lstat,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
if(process.env.CONTEXT!=='deploy-preview')throw Error('Pilot builds require deploy-preview context');
const root=fileURLToPath(new URL('.',import.meta.url)),out=join(root,'dist');
// Netlify may restore the previous generated output from its build cache.
// Refuse a symlink, then replace only this fixed generated directory.
try{if((await lstat(out)).isSymbolicLink())throw Error('Pilot output must not be a symlink');}catch(error){if(error.code!=='ENOENT')throw error;}
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const name of ['index.html','style.css','provider.mjs','page.mjs'])await copyFile(join(root,name),join(out,name));
await writeFile(join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');
await writeFile(join(out,'_headers'),'/*\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n  Cache-Control: no-store\n');
const names=(await readdir(out)).sort();
if(names.join(',')!==['_headers','index.html','page.mjs','provider.mjs','robots.txt','style.css'].join(','))throw Error('Unexpected pilot output');
console.log('Prepared six isolated pilot files; no functions or account pages.');
