import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAvatarRestoreReview} from './restore-review.mjs';
export async function restoreReviewNative({admin,ledger}){
  admin('begin;'+readFileSync(new URL('../../sql/alliance-avatar-restore-review-candidate.sql',import.meta.url),'utf8')+'commit;');
  const tables=['control','heads','operations','objects','daily','cleanup_attempts'];
  const fingerprint=()=>admin(tables.map(t=>`select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) from alliance_avatar.${t} t;`).join(''));
  const projectRef='abcdefghijklmnopqrst',freezeId='77777777-7777-4777-8777-777777777777';
  const review=createAvatarRestoreReview({enabled:true,projectRef,ledger});
  admin('update alliance_avatar.control set enabled=false,cleanup_enabled=false;');
  const previous=fingerprint(),baseline=await ledger.restoreInventory();assert.equal(fingerprint(),previous);
  const input={freezeId,frozenAt:new Date(Date.now()-1000).toISOString(),checkpoint:{format:1,projectRef,freezeId,capturedAt:new Date().toISOString(),inventory:baseline}};
  assert.deepEqual(await review.inspect(input),{state:'matches_checkpoint',access:'closed'});assert.equal(fingerprint(),previous);
  console.log('PASS six-table frozen ledger inventory is stable and read-only; an exact checkpoint match still keeps access closed');
  // Only this disposable fixture: preserve copies before simulating older rows.
  admin(tables.map(t=>`create table public.alliance_restore_fixture_${t} as select * from alliance_avatar.${t};`).join(''));
  const restore=sql=>admin(sql);
  try{
    const scenarios=[
      ["update alliance_avatar.heads set version=version+1,removed_at=null;","update alliance_avatar.heads a set version=s.version,removed_at=s.removed_at from public.alliance_restore_fixture_heads s where a.profile_id=s.profile_id;"],
      ["update alliance_avatar.operations set expected_version=expected_version+1;","update alliance_avatar.operations a set expected_version=s.expected_version from public.alliance_restore_fixture_operations s where a.id=s.id;"],
      ["update alliance_avatar.objects set deletion_receipt=null where deletion_receipt is not null;","update alliance_avatar.objects a set deletion_receipt=s.deletion_receipt from public.alliance_restore_fixture_objects s where a.id=s.id;"],
      ["update alliance_avatar.daily set attempts=attempts-1 where attempts>0;","update alliance_avatar.daily a set attempts=s.attempts from public.alliance_restore_fixture_daily s where a.actor_id=s.actor_id and a.day=s.day;"],
      ["update alliance_avatar.cleanup_attempts set finished_at=finished_at-interval '1 second' where finished_at is not null;","update alliance_avatar.cleanup_attempts a set finished_at=s.finished_at from public.alliance_restore_fixture_cleanup_attempts s where a.claim_id=s.claim_id;"]
    ];
    for(const [change,undo] of scenarios){
      admin(change);const changed=fingerprint();assert.notEqual(changed,previous);assert.deepEqual(await review.inspect(input),{state:'quarantine',access:'closed',reason:'ledger_mismatch'});assert.equal(fingerprint(),changed);restore(undo);assert.equal(fingerprint(),previous);
    }
    console.log('PASS older removal/version/replay/deletion-proof/quota/claim histories are quarantined without changing restored rows');
    admin('update alliance_avatar.control set enabled=true;');assert.equal((await review.inspect(input)).reason,'feature_open');restore('update alliance_avatar.control set enabled=false;');assert.equal(fingerprint(),previous);
    console.log('PASS an enabled restored feature is refused rather than accepted as recovery evidence');
    const timezone=admin("begin;set local timezone='Pacific/Auckland';set local datestyle='SQL, DMY';select alliance_avatar.restore_inventory();rollback;");
    const line=timezone.split('\n').map(x=>x.trim()).find(x=>x.startsWith('{'));assert.deepEqual(JSON.parse(line),baseline);
    admin('cluster alliance_avatar.operations using operations_pkey;');assert.deepEqual(await ledger.restoreInventory(),baseline);assert.equal(fingerprint(),previous);
    console.log('PASS UTC/ISO inventory is independent of caller timezone/date formatting and row scan order');
    admin("do $$ begin if exists(select 1 from alliance_avatar.daily where day='1960-01-01') then raise exception 'Unexpected fixture date';end if;end $$;insert into alliance_avatar.daily(actor_id,day) select md5('restore_fixture_'||n)::uuid,date '1960-01-01' from generate_series(1,1001)n;");
    const oversized=fingerprint();assert.equal((await review.inspect(input)).reason,'unavailable');assert.equal(fingerprint(),oversized);admin("delete from alliance_avatar.daily where day='1960-01-01';");assert.equal(fingerprint(),previous);
    console.log('PASS a table beyond 1000 rows refuses instead of issuing a partial inventory or erasing records');
    const rights=admin("select has_function_privilege('anon','alliance_avatar.restore_inventory()','EXECUTE'),has_function_privilege('authenticated','alliance_avatar.restore_inventory()','EXECUTE'),has_function_privilege('service_role','alliance_avatar.restore_inventory()','EXECUTE'),has_table_privilege('alliance_avatar_executor','alliance_avatar.objects','SELECT');");assert.match(rights,/f\s*\|\s*f\s*\|\s*f\s*\|\s*f/);
    console.log('PASS restore inventory remains private to the existing executor with no direct-table or member permission');
  }finally{review.close();admin(tables.map(t=>`drop table public.alliance_restore_fixture_${t};`).join(''));}
}
