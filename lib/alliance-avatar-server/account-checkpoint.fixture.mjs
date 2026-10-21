// SYNTHETIC TEST ADAPTER ONLY. Same-host SQLite files are NOT independent custody
// or an approved production backend. No provider project/credential is accepted.
import {mkdtemp,realpath,lstat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
let DatabaseSync;try{({DatabaseSync}=createRequire(import.meta.url)('node:sqlite'));}catch(e){if(e.code!=='ERR_UNKNOWN_BUILTIN_MODULE')throw e;}
export const checkpointSqliteAvailable=typeof DatabaseSync==='function';
const confirm='synthetic_account_checkpoint',sha=b=>createHash('sha256').update(b).digest('hex');
export async function openCheckpointFixture(directory,confirmation){
 if(confirmation!==confirm||!checkpointSqliteAvailable)throw Error('fixture_only');const root=await realpath(tmpdir());
 if(dirname(directory)!==root||!/^alliance-checkpoint-[a-zA-Z0-9]+$/.test(basename(directory))||await realpath(directory)!==directory||(await lstat(directory)).isSymbolicLink())throw Error('fixture_only');
 const opened=[];
 try{
  for(const kind of ['slot','anchor']){
   const path=join(directory,kind+'.sqlite'),stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||await realpath(path)!==path)throw Error('fixture_only');
   const db=new DatabaseSync(path);opened.push(db);db.exec('PRAGMA busy_timeout=0;PRAGMA synchronous=FULL;PRAGMA trusted_schema=OFF;');
   if(db.prepare('PRAGMA journal_mode').get().journal_mode!=='wal'||db.prepare('PRAGMA synchronous').get().synchronous!==2||db.prepare('select marker from fixture_marker').get()?.marker!==confirm)throw Error('fixture_only');
  }
 }catch(e){for(const db of opened)db.close();throw e;}
 const [slotDb,anchorDb]=opened;
 const read=db=>{const r=db.prepare('SELECT generation,sha256,bytes FROM checkpoint WHERE id=1').get();if(!r)throw Error('missing');return {bytes:r.bytes===null?null:Buffer.from(r.bytes),receipt:{generation:r.generation,sha256:r.sha256}};};
 const cas=(db,expected,next,bytes,crash)=>{
  let committed=false;
  try{
   db.exec('BEGIN IMMEDIATE');const current=read(db);
   if(current.receipt.generation!==expected.generation||current.receipt.sha256!==expected.sha256){db.exec('ROLLBACK');return {state:'conflict',receipt:current.receipt};}
   if(next.generation!==expected.generation+1)throw Error('generation');
   db.prepare('UPDATE checkpoint SET generation=?,sha256=?,bytes=? WHERE id=1').run(next.generation,next.sha256,bytes);
   if(crash==='before_commit')process.exit(0); // Deliberate child exit, no graceful close.
   db.exec('COMMIT');committed=true;if(crash==='after_commit')process.exit(0);
   return {state:'committed',receipt:read(db).receipt};
  }catch(e){if(!committed)try{db.exec('ROLLBACK');}catch{}throw e;}
 };
 return {
  slot:{read:async()=>read(slotDb),compareAndSet:async({expected,bytes})=>{const b=Buffer.from(bytes),r=JSON.parse(b);return cas(slotDb,expected,{generation:r.generation,sha256:sha(b)},b);}},
  anchor:{read:async()=>read(anchorDb).receipt,advance:async({expected,next})=>cas(anchorDb,expected,next,null)},
  // Exact synthetic fault injection, never part of the runtime coordinator API.
  crashSlot:({expected,bytes},phase)=>{if(!['before_commit','after_commit'].includes(phase))throw Error('fixture_only');const b=Buffer.from(bytes);return cas(slotDb,expected,{generation:JSON.parse(b).generation,sha256:sha(b)},b,phase);},
  replace:(kind,bytes,r)=>{if(!['slot','anchor'].includes(kind))throw Error('fixture_only');const db=kind==='slot'?slotDb:anchorDb;db.prepare('UPDATE checkpoint SET generation=?,sha256=?,bytes=? WHERE id=1').run(r.generation,r.sha256,bytes);},
  close(){for(const db of opened)db.close();}
 };
}
export async function checkpointFixture(bytes,confirmation){
 if(confirmation!==confirm||!checkpointSqliteAvailable)throw Error('fixture_only');const root=await realpath(tmpdir()),directory=await mkdtemp(join(root,'alliance-checkpoint-')),b=Buffer.from(bytes),r=JSON.parse(b),receipt={generation:r.generation,sha256:sha(b)};
 const cleanup=async()=>{if(dirname(directory)!==root||await realpath(directory)!==directory||!/^alliance-checkpoint-[a-zA-Z0-9]+$/.test(basename(directory)))throw Error('fixture_cleanup');await rm(directory,{recursive:true,force:true});};
 try{
  for(const kind of ['slot','anchor']){const db=new DatabaseSync(join(directory,kind+'.sqlite'));try{db.exec("PRAGMA journal_mode=WAL;PRAGMA synchronous=FULL;CREATE TABLE fixture_marker(marker TEXT NOT NULL) STRICT;CREATE TABLE checkpoint(id INTEGER PRIMARY KEY CHECK(id=1),generation INTEGER NOT NULL,sha256 TEXT NOT NULL,bytes BLOB) STRICT;");db.prepare('INSERT INTO fixture_marker VALUES(?)').run(confirm);db.prepare('INSERT INTO checkpoint VALUES(1,?,?,?)').run(receipt.generation,receipt.sha256,kind==='slot'?b:null);}finally{db.close();}}
  return {directory,receipt,open:()=>openCheckpointFixture(directory,confirm),cleanup};
 }catch(e){await cleanup();throw e;}
}
