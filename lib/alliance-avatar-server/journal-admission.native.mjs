import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDeletionJournalStore} from './journal-store.mjs';
import {removalEvents} from './removal.mjs';
import {projectRef,epoch,profileId,objectId,other,zero} from './deletion-journal.fixture.mjs';
const subject=(profile=profileId,object=null)=>removalEvents({format:1,kind:object?'image':'profile',operationId:other,profileId:profile,version:0,objectIds:object?[object]:[]})[0];
export async function journalAdmissionNative({admin,connection,openPool}){
  const base=readFileSync(new URL('../../sql/alliance-deletion-journal-store-candidate.sql',import.meta.url),'utf8');
  const extension=readFileSync(new URL('../../sql/alliance-journal-admission-candidate.sql',import.meta.url),'utf8');
  admin("do $$ begin if to_regnamespace('alliance_journal') is not null or exists(select 1 from pg_roles where rolname in('anon','authenticated','service_role','alliance_journal_owner','alliance_journal_executor')) then raise exception 'Admission fixture not empty';end if;end $$;begin;create role anon nologin;create role authenticated nologin;create role service_role nologin;"+base+'\n'+extension+'commit;');
  const stores=[];const open=async(factory=openPool)=>{const s=await createDeletionJournalStore({enabled:true,projectRef,epoch,connection,openPool:factory});stores.push(s);return s;};
  const count=()=>admin('select count(*) from alliance_journal.admissions;');
  let alternate=false,renamed=false;const alternateAdmin=sql=>admin.as('fixture_admission_admin',sql);
  try{
    assert.match(admin("select enabled,admission_enabled,project_ref is null,epoch is null from alliance_journal.control;select relrowsecurity,relforcerowsecurity from pg_class where oid='alliance_journal.admissions'::regclass;"),/f\s*\|\s*f\s*\|\s*t\s*\|\s*t/);
    console.log('PASS admission extension starts closed/unconfigured with private forced-RLS capacity table');
    admin(`update alliance_journal.control set project_ref='${projectRef}',epoch='${epoch}',enabled=true;alter role alliance_journal_executor login password '${connection.password}';`);
    const store=await open(),second=await open(),profile=subject(),image=subject(profileId,objectId);
    assert.deepEqual(await store.admit(profile),{state:'paused'});assert.deepEqual(await store.admission(profile),{state:'missing'});assert.match(count(),/\n\s*0\s*\n/);
    admin('update alliance_journal.control set admission_enabled=true;');
    assert.deepEqual(await store.admit(image),{state:'profile_required'});assert.match(count(),/\n\s*0\s*\n/);
    console.log('PASS closed admission and missing profile capacity create no reservation or image capacity');
    const identical=await Promise.all([store.admit(profile),second.admit(profile)]);assert.deepEqual(identical,[{state:'admitted',event:profile},{state:'admitted',event:profile}]);assert.deepEqual(await second.admission(profile),{state:'admitted',event:profile});assert.deepEqual(await second.admit(profile),{state:'admitted',event:profile});assert.match(count(),/\n\s*1\s*\n/);
    await assert.rejects(store.append({expected:{sequence:0,sha256:zero},event:image}),e=>e.outcome==='rejected');assert.equal((await store.tip()).sequence,0);
    console.log('PASS canonical capacity is durable and replay-idempotent; unreserved deletion cannot consume another subject slot');
    let lost=true;const lossy=await open(config=>{const pool=openPool(config);return {on:pool.on.bind(pool),end:pool.end.bind(pool),async connect(){const c=await pool.connect();return {release:c.release.bind(c),async query(q){const r=await c.query(q);if(q.text==='COMMIT'&&lost){lost=false;throw Error('Synthetic lost admission acknowledgement');}return r;}};}};});
    await assert.rejects(lossy.admit(image),e=>e.outcome==='unknown');await lossy.close();assert.deepEqual(await second.admission(image),{state:'admitted',event:image});assert.match(count(),/\n\s*2\s*\n/);
    console.log('PASS actual lost COMMIT reply recovers by separate exact read without releasing or duplicating capacity');
    const lastImages=['61111111-1111-4111-8111-111111111111','71111111-1111-4111-8111-111111111111','81111111-1111-4111-8111-111111111111'];
    for(const id of lastImages)assert.equal((await store.admit(subject(profileId,id))).state,'admitted');
    assert.deepEqual(await store.admit(subject(profileId,other)),{state:'history_full'});assert.match(count(),/\n\s*5\s*\n/);
    const imageRecord=await store.append({expected:{sequence:0,sha256:zero},event:image});assert.equal(imageRecord.state,'recorded');assert.deepEqual(await store.admit(image),{state:'removed'});assert.deepEqual(await store.admission(image),{state:'removed'});assert.match(count(),/\n\s*5\s*\n/);
    console.log('PASS four-image history bound refuses before a fifth identity; recorded subjects never reopen or refund slots');
    admin(`set role alliance_journal_executor;do $$ declare n integer;pid uuid;e jsonb;h text;begin for n in 1..250 loop
      pid:=md5('admission-capacity-'||n)::uuid;
      h:=encode(sha256(convert_to('GF-ALLIANCE-REMOVAL-ID-V1','UTF8')||decode('00','hex')||convert_to('profile','UTF8')||decode('00','hex')||convert_to(pid::text,'UTF8')||decode('00','hex')||convert_to(pid::text,'UTF8')),'hex');
      e:=jsonb_build_object('id',substr(h,1,32)::uuid,'kind','profile_remove_requested','profileId',pid,'objectId',null);
      if alliance_journal.admit('${projectRef}','${epoch}',e)->>'state'<>'admitted' then raise exception 'Expected capacity admission';end if;
    end loop;end $$;reset role;`);
    assert.match(count(),/\n\s*255\s*\n/);
    const a=subject('91111111-1111-4111-8111-111111111111'),b=subject('a1111111-1111-4111-8111-111111111111');
    const race=await Promise.all([store.admit(a),second.admit(b)]);assert.deepEqual(race.map(x=>x.state).sort(),['admitted','full']);assert.match(count(),/\n\s*256\s*\n/);
    assert.deepEqual(await store.admit(subject(other)),{state:'full'});
    console.log('PASS real final-slot admission race admits exactly one subject; hard capacity cannot be oversubscribed');
    admin('update alliance_journal.control set admission_enabled=false;');
    const t=await store.tip(),removed=await store.append({expected:{sequence:t.sequence,sha256:t.sha256},event:profile});assert.equal(removed.state,'recorded');assert.match(count(),/\n\s*256\s*\n/);assert.equal((await store.tip()).sequence,2);
    assert.deepEqual(await store.admit(profile),{state:'paused'});admin('update alliance_journal.control set admission_enabled=true;');assert.deepEqual(await store.admit(image),{state:'removed'});assert.deepEqual(await store.admit(subject(profileId,other)),{state:'removed'});
    console.log('PASS full/closed new-admission capacity preserves later deletion and never reopens a removed profile or its images');
    const rights=admin("select has_table_privilege('alliance_journal_executor','alliance_journal.admissions','SELECT'),has_table_privilege('alliance_journal_executor','alliance_journal.admissions','INSERT'),has_function_privilege('alliance_journal_executor','alliance_journal.append_unreserved(text,uuid,integer,text,jsonb)','EXECUTE'),has_function_privilege('authenticated','alliance_journal.admit(text,uuid,jsonb)','EXECUTE');");assert.match(rights,/f\s*\|\s*f\s*\|\s*f\s*\|\s*f/);
    admin(`begin;set local role alliance_journal_executor;set local synchronous_commit='off';do $$ begin perform alliance_journal.admit('${projectRef}','${epoch}', '${JSON.stringify(subject(other))}'::jsonb);raise exception 'Expected durability refusal';exception when insufficient_privilege then null;end $$;rollback;`);
    assert.match(count(),/\n\s*256\s*\n/);console.log('PASS direct table and old append bypasses remain denied; asynchronous reservation cannot weaken durable capacity');
    admin(`begin;set local role alliance_journal_executor;do $$ begin perform alliance_journal.admit('${projectRef}','${epoch}', '${JSON.stringify({...profile,id:other})}'::jsonb);raise exception 'Expected canonical event refusal';exception when insufficient_privilege then null;end $$;rollback;`);
    assert.match(count(),/\n\s*256\s*\n/);console.log('PASS direct restricted SQL cannot reserve a noncanonical removal identity even at full capacity');
    admin("do $$ begin if not exists(select 1 from pg_roles where oid=10 and rolname='postgres' and rolsuper) or exists(select 1 from pg_roles where rolname in('supabase_admin','fixture_admission_admin')) then raise exception 'Wrong bootstrap fixture';end if;end $$;create role fixture_admission_admin superuser login;");alternate=true;
    alternateAdmin('begin;alter role postgres rename to supabase_admin;create role postgres login nosuperuser createrole createdb inherit;set role supabase_admin;grant alliance_journal_executor to postgres with admin true,inherit false,set false;reset role;commit;');renamed=true;
    assert.equal((await store.tip()).sequence,2);
    console.log('PASS actual bootstrap OID10 management-only grant to existing nonsuperuser administrator is accepted without SET or inherited access');
    alternateAdmin('alter role postgres rename to fixture_wrong_recipient;');await assert.rejects(store.tip(),e=>e.outcome==='not_started');alternateAdmin('alter role fixture_wrong_recipient rename to postgres;');
    alternateAdmin('alter role supabase_admin rename to fixture_wrong_bootstrap;');await assert.rejects(store.tip(),e=>e.outcome==='not_started');alternateAdmin('alter role fixture_wrong_bootstrap rename to supabase_admin;');
    for(const permission of ['inherit','set']){
      alternateAdmin(`set role supabase_admin;grant alliance_journal_executor to postgres with ${permission} true;reset role;`);
      await assert.rejects(store.tip(),e=>e.outcome==='not_started');
      alternateAdmin(`set role supabase_admin;grant alliance_journal_executor to postgres with ${permission} false;reset role;`);
    }
    alternateAdmin('grant alliance_journal_executor to fixture_admission_admin with admin false,inherit false,set false;');await assert.rejects(store.tip(),e=>e.outcome==='not_started');alternateAdmin('revoke alliance_journal_executor from fixture_admission_admin;');
    assert.equal((await store.tip()).sequence,2);
    console.log('PASS actual wrong/missing named recipient/bootstrap, SET, INHERIT or extra recipient fails identity; exact approved shape restores reads');
  }finally{
    for(const s of stores){try{await s.close();}catch{}}
    if(renamed){alternateAdmin('begin;drop role postgres;alter role supabase_admin rename to postgres;commit;');renamed=false;}
    if(alternate)admin('drop role fixture_admission_admin;');
    admin("begin;alter role alliance_journal_executor nologin password null;drop owned by alliance_journal_owner,alliance_journal_executor,anon,authenticated,service_role cascade;drop schema if exists alliance_journal cascade;drop role alliance_journal_owner,alliance_journal_executor,anon,authenticated,service_role;commit;do $$ begin if to_regnamespace('alliance_journal') is not null or exists(select 1 from pg_roles where rolname like 'alliance_journal_%') then raise exception 'Admission teardown failed';end if;end $$;");
    console.log('PASS exact admission fixture data/schema/roles removed without any hosted project or provider call');
  }
}
