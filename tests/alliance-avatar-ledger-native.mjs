// Dedicated disposable native fixtures only. No hosted endpoint or credential.
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const profileRunner=fileURLToPath(new URL('alliance-profile-native.mjs',import.meta.url));
const original=execFileSync(process.execPath,[profileRunner,'--print-sql'],{encoding:'utf8',maxBuffer:1024*1024});
const avatar=readFileSync(new URL('sql/alliance-avatar-ledger-candidate.sql',root),'utf8');
const checks=readFileSync(new URL('alliance-avatar-ledger-native.sql',import.meta.url),'utf8');
const version=process.argv.includes('--local18')?180006:170011;
let fixture=original.replaceAll('federation_alliance_profile_test','federation_alliance_avatar_test').replaceAll('170011',String(version));
const marker='\nrollback;\n';assert.equal(fixture.split(marker).length,2);
const sql=fixture.replace(marker,()=>'\n'+avatar+'\n'+checks+marker)+`
do $$ begin
 if exists(select 1 from pg_roles where rolname in('alliance_avatar_owner','alliance_avatar_executor')) or exists(select 1 from pg_namespace where nspname='alliance_avatar') then raise exception 'Avatar rollback failed';end if;
 raise notice 'PASS avatar transaction rollback removes candidate roles and schema';
end $$;
`;
assert.ok(sql.includes('do $$ declare t text;'),'SQL dollar quoting must remain literal');
if(process.argv.includes('--print-sql')){process.stdout.write(sql);process.exit(0);}
if(process.env.ALLIANCE_AVATAR_TEST_CONFIRM!=='disposable_avatar_fixture')throw Error('Explicit disposable avatar fixture confirmation required');
let command,args;
if(process.argv.includes('--local18')){
  const socket=process.env.ALLIANCE_AVATAR_TEST_SOCKET||'';
  if(!/^\/tmp\/fed-alliance-avatar-[A-Za-z0-9]+\/socket$/.test(socket)||process.getuid?.()!==102)throw Error('Expected dedicated postgres-owned local fixture socket');
  command='/usr/lib/postgresql/18/bin/psql';args=['-h',socket,'-p','55487','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','federation_alliance_avatar_test'];
}else{
  const container=process.env.ALLIANCE_AVATAR_TEST_CONTAINER||'';if(!/^[a-f0-9]{12,64}$/.test(container))throw Error('Expected dedicated Docker fixture');
  const config=JSON.parse(execFileSync('docker',['inspect','--format','{{json .Config}}',container],{encoding:'utf8',timeout:10000}));
  if(config.Image!=='postgres:17.11-bookworm'||!config.Env?.includes('POSTGRES_DB=federation_alliance_avatar_test'))throw Error('Wrong fixture identity');
  command='docker';args=['exec','-i','-u','postgres',container,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','federation_alliance_avatar_test'];
}
const run=input=>execFileSync(command,args,{input,encoding:'utf8',timeout:60000,maxBuffer:2*1024*1024});
process.stdout.write(run(sql));

// Commit a fresh, dedicated fixture to test actual concurrent connections.
// Nothing in this phase can run until the earlier rollback and identity guards pass.
const bootstrap=fixture.slice(0,fixture.indexOf('create function public.fixture_assert'))+avatar+`
insert into auth.users values('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true),set_config('request.jwt.claim.is_anonymous','false',true);
set local role authenticated;
select public.alliance_save_profile('Race Fixture','','Synthetic concurrent reservation fixture.','builder',false);
reset role;
update alliance_avatar.control set enabled=true;
commit;
`;
const race=(operation,actor='dddddddd-dddd-4ddd-8ddd-dddddddddddd')=>new Promise((resolve,reject)=>{
 const child=spawn(command,args,{stdio:['pipe','pipe','pipe'],windowsHide:true});let out='',err='';
 const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Fixture connection deadline'));},15000);
 child.stdout.on('data',d=>{out+=d;});child.stderr.on('data',d=>{err+=d;});child.on('error',reject);
 child.on('exit',code=>{clearTimeout(timer);resolve({code,out,err});});
 child.stdin.end(`begin;set local statement_timeout='5s';set local lock_timeout='3s';set local role alliance_avatar_executor;
 select alliance_avatar.reserve('${actor}','${operation}',0);
 select pg_sleep(0.15);commit;`);
});
try{
 run(bootstrap);
 const results=await Promise.all(['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'].map(op=>race(op)));
 assert.equal(results.filter(r=>r.code===0).length,1);assert.equal(results.filter(r=>r.err.includes('avatar_limit_reached')).length,1);
 const counts=run(`select json_build_object('objects',(select count(*) from alliance_avatar.objects),'attempts',(select attempts from alliance_avatar.daily where actor_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'));
 select json_build_object('version',(select version from alliance_avatar.heads),'operations',(select count(*) from alliance_avatar.operations));`);
 assert.match(counts,/"objects" : 1, "attempts" : 1/);assert.match(counts,/"version" : 0, "operations" : 1/);
 console.log('PASS two concurrent reservations admit one dispatch and consume one attempt');
 const actors=['11111111-aaaa-4111-8111-111111111111','22222222-bbbb-4222-8222-222222222222'];
 run(`begin;insert into auth.users values('${actors[0]}'),('${actors[1]}');
 select set_config('request.jwt.claim.sub','${actors[0]}',true),set_config('request.jwt.claim.is_anonymous','false',true);
 set local role authenticated;select public.alliance_save_profile('Race Two','','Synthetic global concurrency fixture.','builder',false);reset role;
 select set_config('request.jwt.claim.sub','${actors[1]}',true);
 set local role authenticated;select public.alliance_save_profile('Race Three','','Another synthetic global concurrency fixture.','builder',false);reset role;commit;`);
 const globalRace=await Promise.all(actors.map((actor,i)=>race('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee'+(i+3),actor)));
 assert.equal(globalRace.filter(r=>r.code===0).length,1);assert.equal(globalRace.filter(r=>r.err.includes('avatar_limit_reached')).length,1);
 assert.match(run('select count(*) from alliance_avatar.objects where state in(\'reserved\',\'uploading\');'),/\n\s*2\s*\n/);
 console.log('PASS different accounts cannot race past the global two-dispatch cap');
 run(`select alliance_avatar.cancel_reserved(m.user_id,op.id) from alliance_avatar.operations op join public.alliance_member_owners m on m.id=op.profile_id where op.state='reserved';
 update alliance_avatar.daily set attempts=199 where actor_id='00000000-0000-0000-0000-000000000000';`);
 const lastAttempt=await Promise.all(actors.map((actor,i)=>race('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee'+(i+5),actor)));
 assert.equal(lastAttempt.filter(r=>r.code===0).length,1);assert.equal(lastAttempt.filter(r=>r.err.includes('avatar_limit_reached')).length,1);
 assert.match(run("select attempts from alliance_avatar.daily where actor_id='00000000-0000-0000-0000-000000000000';"),/\n\s*200\s*\n/);
 console.log('PASS different accounts cannot spend the final global daily attempt twice');
}finally{
 // Only these fixture-created roles/objects exist in the dedicated test DB.
 run(`begin;
 do $$ begin if current_database()<>'federation_alliance_avatar_test' or current_setting('server_version_num')::integer<>${version} then raise exception 'Fixture cleanup identity failed';end if;end $$;
 drop owned by alliance_avatar_owner,alliance_avatar_executor,anon,authenticated,service_role cascade;
 drop schema if exists alliance_avatar cascade;
 drop table if exists public.alliance_profiles,public.alliance_member_owners cascade;
 drop schema if exists auth cascade;
 drop function if exists public.alliance_member_eligible(),public.alliance_profile_stamp(),public.alliance_save_profile(text,text,text,text,boolean),public.alliance_my_profile(),public.alliance_remove_profile();
 drop role alliance_avatar_owner,alliance_avatar_executor,anon,authenticated,service_role;
 commit;
 do $$ begin if exists(select 1 from pg_roles where rolname in('alliance_avatar_owner','alliance_avatar_executor','authenticated')) or to_regclass('public.alliance_profiles') is not null then raise exception 'Fixture cleanup failed';end if;raise notice 'PASS committed concurrency fixture removed';end $$;`);
}
