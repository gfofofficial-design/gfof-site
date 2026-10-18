// Synthetic-only actual dump/restore, inside the already checked two-server run.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAllianceRecoveryPair,RECOVERY_TABLES} from './recovery-pair.mjs';
import {fixtureArchive} from './recovery-archive.fixture.mjs';
import {startupFixture} from './startup-gate.fixture.mjs';
import {controlNative} from './control.native.mjs';
import {removalAnchorNative} from './removal-anchor.native.mjs';
export async function recoveryPairNative({admin,ja,ledger,journal,ref,journalRef,epoch,mainTarget,journalTarget}){
  const sql=name=>readFileSync(new URL('../../sql/'+name,import.meta.url),'utf8');
  admin('begin;'+sql('alliance-member-recovery-inventory-candidate.sql')+'commit;');ja('begin;'+sql('alliance-journal-recovery-inventory-candidate.sql')+'commit;');
  admin('update alliance_avatar.control set enabled=false,cleanup_enabled=false,creation_enabled=false;');ja('update alliance_journal.control set enabled=false,admission_enabled=false;');
  const member=await ledger.recoveryInventory(),independent=await journal.recoveryInventory(),minimum={sequence:independent.sequence,sha256:independent.sha256};
  assert.equal(member.tables.length,9);assert.equal(independent.tables.length,3);assert.equal(member.tables.at(-1).rows,6);assert.equal(independent.tables[1].rows,6);assert.equal(independent.sequence,1);
  const freezeId='e1111111-1111-4111-8111-111111111111',evidence={freezeId,frozenAt:new Date(Date.now()-1000).toISOString(),checkpoint:{format:2,memberProjectRef:ref,journalProjectRef:journalRef,epoch,freezeId,capturedAt:new Date().toISOString(),member,journal:independent}};
  const make=(l=ledger,j=journal)=>createAllianceRecoveryPair({enabled:true,memberProjectRef:ref,journalProjectRef:journalRef,epoch,minimum,ledger:l,journal:j});
  const review=make(),expected={state:'matches_checkpoint',access:'closed'},archives=[];
  const dumpers={};
  const truncate=domain=>(domain==='member'?admin:ja)('truncate '+RECOVERY_TABLES[domain].join(',')+';');
  try{
    assert.deepEqual(await review.inspect(evidence),expected);assert.deepEqual(await ledger.recoveryInventory(),member);assert.deepEqual(await journal.recoveryInventory(),independent);
    console.log('PASS nine member and three independent journal tables include preparations/admissions; stable paired inventories and full floor chain leave data unchanged and access closed');
    const startup=startupFixture({checkpoint:evidence.checkpoint,ledger,journal});startup.control.frozenAt=evidence.frozenAt;
    assert.equal(await startup.gate.authorize(),false);assert.deepEqual(await startup.gate.prepare(evidence.checkpoint),{state:'prepared',access:'closed'});
    startup.serve();assert.equal(await startup.gate.authorize(),true);startup.control.state='closed';startup.control.revision++;assert.equal(await startup.gate.authorize(),false);
    startup.serve();assert.equal(await startup.gate.authorize(),false);startup.gate.close();
    assert.equal((await ledger.recoveryInventory()).closed,true);assert.equal((await journal.recoveryInventory()).closed,true);
    console.log('PASS actual two-server inventories compose signed boot-specific startup review; separate synthetic control approval and revocation never change database switches');
    const restart=startupFixture({checkpoint:evidence.checkpoint,ledger,journal});restart.control.frozenAt=evidence.frozenAt;
    admin('update alliance_avatar.creation_plans set activated=not activated where slot=(select min(slot) from alliance_avatar.creation_plans);');
    assert.deepEqual(await restart.gate.prepare(evidence.checkpoint),{state:'quarantine',access:'closed'});assert.equal(await restart.gate.authorize(),false);restart.gate.close();
    admin('update alliance_avatar.creation_plans set activated=not activated where slot=(select min(slot) from alliance_avatar.creation_plans);');
    assert.deepEqual(await review.inspect(evidence),expected);
    console.log('PASS startup signed approval cannot override actual same-count restored-data corruption; failed boot stays closed and exact synthetic change is reversed');
    for(const [domain,target] of [['member',mainTarget],['journal',journalTarget]]){const d=fixtureArchive({domain,...target});archives.push(d);dumpers[domain]={d,handle:d.dump()};assert.equal(dumpers[domain].handle.tables.length,RECOVERY_TABLES[domain].length);}
    assert.throws(()=>dumpers.member.d.restore(dumpers.journal.handle));assert.throws(()=>dumpers.journal.d.restore(dumpers.member.handle));
    console.log('PASS two actual custom-format data-only archives verify exact table lists, bounded byte hashes and same-domain handles; neither can overwrite the other domain');
    admin("delete from alliance_avatar.creation_plans where operation_id=(select operation_id from alliance_avatar.creation_plans where kind='image' limit 1);");
    assert.equal((await review.inspect(evidence)).reason,'member_mismatch');truncate('member');dumpers.member.d.restore(dumpers.member.handle);
    assert.deepEqual(await journal.recoveryInventory(),independent);assert.deepEqual(await review.inspect(evidence),expected);
    console.log('PASS omitted prospective identity quarantines member copy; actual nine-table restore recovers exact IDs, receipts, tombstones, profiles and counters without changing journal');
    ja("delete from alliance_journal.admissions where event_id=(select event_id from alliance_journal.admissions where kind='image_remove_requested' limit 1);");
    assert.equal((await review.inspect(evidence)).reason,'journal_mismatch');truncate('journal');dumpers.journal.d.restore(dumpers.journal.handle);
    assert.deepEqual(await ledger.recoveryInventory(),member);assert.deepEqual(await review.inspect(evidence),expected);
    console.log('PASS omitted admission quarantines independent journal; actual three-table restore preserves exact reservation slots and deletion chain without changing member copy');
    ja("delete from alliance_journal.entries;update alliance_journal.control set sequence=0,sha256=repeat('0',64);");assert.equal((await review.inspect(evidence)).reason,'floor_regression');truncate('journal');dumpers.journal.d.restore(dumpers.journal.handle);assert.deepEqual(await review.inspect(evidence),expected);
    console.log('PASS older independent journal cannot qualify against separately supplied deletion floor, even when member backup and row counts are available');
    admin('update alliance_avatar.creation_plans set activated=not activated where slot=(select min(slot) from alliance_avatar.creation_plans);');assert.equal((await review.inspect(evidence)).reason,'member_mismatch');truncate('member');dumpers.member.d.restore(dumpers.member.handle);
    ja('update alliance_journal.admissions set slot=250 where slot=(select max(slot) from alliance_journal.admissions);');assert.equal((await review.inspect(evidence)).reason,'journal_mismatch');truncate('journal');dumpers.journal.d.restore(dumpers.journal.handle);
    console.log('PASS same-count activation-bit and reservation-slot corruption is detected, not hidden by count-only checks');
    let reads=0;const changing=make({...ledger,recoveryInventory:async(...args)=>{if(++reads===2)admin('update alliance_avatar.creation_plans set activated=not activated where slot=(select min(slot) from alliance_avatar.creation_plans);');return ledger.recoveryInventory(...args);}});
    assert.equal((await changing.inspect(evidence)).reason,'snapshot_changed');changing.close();truncate('member');dumpers.member.d.restore(dumpers.member.handle);
    for(const [fn,off,on] of [[admin,'creation_enabled','creation_enabled'],[admin,'cleanup_enabled','cleanup_enabled'],[ja,'admission_enabled','admission_enabled']]){fn('update '+(fn===admin?'alliance_avatar':'alliance_journal')+'.control set '+on+'=true;');assert.equal((await review.inspect(evidence)).reason,'feature_open');fn('update '+(fn===admin?'alliance_avatar':'alliance_journal')+'.control set '+off+'=false;');}
    console.log('PASS changing snapshots and independently reopened creation/cleanup/admission switches refuse; review never freezes, repairs or reopens data itself');
    const mText=admin("begin;set local timezone='Pacific/Auckland';set local datestyle='SQL, DMY';select alliance_avatar.recovery_inventory();rollback;");
    const jText=ja(`begin;set local timezone='Pacific/Auckland';set local datestyle='SQL, DMY';select alliance_journal.recovery_inventory('${ref}','${epoch}');rollback;`);
    const parsed=text=>JSON.parse(text.split('\n').map(x=>x.trim()).find(x=>x.startsWith('{')));assert.deepEqual(parsed(mText),member);assert.deepEqual(parsed(jText),independent);
    admin('cluster alliance_avatar.creation_plans using creation_plans_slot_key;');ja('cluster alliance_journal.admissions using admissions_slot_key;');assert.deepEqual(await review.inspect(evidence),expected);
    console.log('PASS both inventories ignore caller timezone/date formatting and physical row order after actual archive restores');
    admin("do $$ begin if exists(select 1 from alliance_avatar.daily where day='1961-01-01') then raise exception 'Unexpected synthetic date';end if;end $$;insert into alliance_avatar.daily(actor_id,day) select md5('paired_recovery_'||n)::uuid,date '1961-01-01' from generate_series(1,1001)n;");
    assert.equal((await review.inspect(evidence)).reason,'unavailable');admin("delete from alliance_avatar.daily where day='1961-01-01';");assert.deepEqual(await review.inspect(evidence),expected);
    console.log('PASS oversized member table refuses a partial inventory; exact synthetic overflow cleanup restores the same closed checkpoint');
    const rights=admin("select has_function_privilege('authenticated','alliance_avatar.recovery_inventory()','EXECUTE'),has_table_privilege('alliance_avatar_executor','alliance_avatar.creation_plans','SELECT');")+ja("select has_function_privilege('service_role','alliance_journal.recovery_inventory(text,uuid)','EXECUTE'),has_table_privilege('alliance_journal_executor','alliance_journal.admissions','SELECT');");assert.equal((rights.match(/\bf\b/g)||[]).length,4);
    assert.deepEqual(await review.inspect(evidence),expected);assert.equal((await ledger.recoveryInventory()).closed,true);assert.equal((await journal.recoveryInventory()).closed,true);
    console.log('PASS private inventory entrypoints do not grant table/member/API access; restored controls stay closed with no provider calls');
    await controlNative({mainTarget,ledger,journal,evidence});
    await removalAnchorNative({mainTarget,memberAdmin:admin,journalAdmin:ja,ledger,journal,evidence});
  }finally{review.close();for(const archive of archives)archive.close();}
}
