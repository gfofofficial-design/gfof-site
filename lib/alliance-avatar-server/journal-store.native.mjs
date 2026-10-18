import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDeletionJournalStore} from './journal-store.mjs';
import {createAvatarDeletionJournal} from './deletion-journal.mjs';
import {createJournalWitness} from './journal-witness.mjs';
import {event,projectRef,epoch,other,zero,journalFixture} from './deletion-journal.fixture.mjs';
export async function journalStoreNative({admin,connection,openPool}){
  // Only the guarded fixture remaps this distinct virtual journal host to localhost.
  connection={...connection,host:'db.uvwxyzabcdefghijklmn.supabase.co'};
  const sql=readFileSync(new URL('../../sql/alliance-deletion-journal-store-candidate.sql',import.meta.url),'utf8');
  admin("do $$ begin if to_regnamespace('alliance_avatar') is not null or to_regnamespace('alliance_journal') is not null or exists(select 1 from pg_roles where rolname in('anon','authenticated','service_role','alliance_journal_owner','alliance_journal_executor')) then raise exception 'Journal fixture not empty';end if;end $$;begin;create role anon nologin;create role authenticated nologin;create role service_role nologin;"+sql+'commit;');
  const stores=[];const open=async factory=>{const s=await createDeletionJournalStore({enabled:true,projectRef,epoch,connection,openPool:factory||openPool});stores.push(s);return s;};
  try{
    const locked=admin("select enabled,project_ref is null,epoch is null,sequence from alliance_journal.control;select count(*) from pg_roles where rolname in('alliance_journal_owner','alliance_journal_executor') and rolcanlogin;");assert.match(locked,/f\s*\|\s*t\s*\|\s*t\s*\|\s*0/);assert.match(locked,/\n\s*0\s*\n/);
    console.log('PASS independent journal candidate starts unconfigured/default-off with two NOLOGIN roles and no member schema');
    admin(`update alliance_journal.control set project_ref='${projectRef}',epoch='${epoch}',enabled=true;alter role alliance_journal_executor login password '${connection.password}';`);
    const store=await open(),second=await open();assert.deepEqual(await store.tip(),{projectRef,epoch,sequence:0,sha256:zero,enabled:true});
    const first=await store.append({event:event(),expected:{sequence:0,sha256:zero}});assert.equal(first.record.sha256,'16be7915a18c5625b3e3fcafc59e722d4cf201845f734b61e11efd52403983c3');
    assert.deepEqual(await second.lookup(event()),first);assert.deepEqual(await second.append({event:event(),expected:{sequence:0,sha256:zero}}),first);
    console.log('PASS SQL canonical hashing matches the independent vector; committed receipt survives a fresh client and exact event replay adds no row');
    const start={sequence:first.tip.sequence,sha256:first.tip.sha256};
    const race=await Promise.all([store.append({event:event({id:'a1111111-1111-4111-8111-111111111111'}),expected:start}),second.append({event:event({id:'b1111111-1111-4111-8111-111111111111'}),expected:start})]);
    assert.deepEqual(race.map(x=>x.state).sort(),['conflict','recorded']);assert.equal((await store.tip()).sequence,2);
    console.log('PASS two real competing appends admit one next tip and return one conflict without automatic retries');
    const p=await store.tip(),same=event({id:'c1111111-1111-4111-8111-111111111111'}),expected={sequence:p.sequence,sha256:p.sha256};
    const replay=await Promise.all([store.append({event:same,expected}),second.append({event:same,expected})]);assert.deepEqual(replay[0],replay[1]);assert.equal((await store.tip()).sequence,3);
    await assert.rejects(store.append({event:{...same,profileId:other},expected}),e=>e.outcome==='rejected');assert.equal((await store.tip()).sequence,3);
    console.log('PASS concurrent identical event IDs record once; reusing an ID for another subject is rejected without mutation');
    let lost=true;const lossy=await open(config=>{const pool=openPool(config);return {on:pool.on.bind(pool),end:pool.end.bind(pool),async connect(){const client=await pool.connect();return {release:client.release.bind(client),async query(q){const result=await client.query(q);if(q.text==='COMMIT'&&lost){lost=false;throw Error('Synthetic lost COMMIT acknowledgement');}return result;}};}};});
    const before=await store.tip(),lostEvent=event({id:'d1111111-1111-4111-8111-111111111111'});
    await assert.rejects(lossy.append({event:lostEvent,expected:{sequence:before.sequence,sha256:before.sha256}}),e=>e.outcome==='unknown');await lossy.close();
    const recovered=await second.lookup(lostEvent);assert.equal(recovered.state,'recorded');assert.equal(recovered.record.sequence,4);assert.equal((await store.tip()).sequence,4);
    await assert.rejects(second.lookup({...lostEvent,profileId:other}),e=>e.outcome==='not_started');assert.equal((await store.tip()).sequence,4);
    console.log('PASS real committed append with a lost caller acknowledgement is recovered by event-ID lookup without a second append');
    assert.deepEqual(await store.records({sequence:1,sha256:first.record.sha256}),[first.record]);
    admin('update alliance_journal.control set enabled=false;');const off=await store.append({event:event({id:other}),expected:{sequence:4,sha256:recovered.tip.sha256}});assert.equal(off.state,'paused');assert.equal((await store.lookup(lostEvent)).state,'recorded');
    const signer=journalFixture({events:[]});const producer=createJournalWitness({enabled:true,projectRef,epoch,verificationKey:signer.verificationKey,minimum:{sequence:1,sha256:first.record.sha256},store,signBytes:signer.signBytes});
    const reader=createAvatarDeletionJournal({enabled:true,projectRef,epoch,verificationKey:signer.verificationKey,minimum:{sequence:1,sha256:first.record.sha256},
      readWitness:async({challenge,signal})=>{const issued=await producer.issue({challenge},{signal});assert.equal(issued.state,'signed');return issued.bytes;},
      readRecords:async({through,sha256})=>Buffer.from(JSON.stringify(await store.records({sequence:through,sha256})))});
    const view=await reader.review();assert.equal(view.state,'verified_evidence');assert.deepEqual(view.check({profileId:event().profileId,objectId:other}),{state:'blocked',scope:'profile'});view.close();reader.close();
    console.log('PASS paused journal preserves deny evidence; actual SQL store/witness producer/complete-chain reader compose');
    admin('update alliance_journal.control set sequence=3,sha256=(select sha256 from alliance_journal.entries where sequence=3);');
    assert.equal((await producer.issue({challenge:'a'.repeat(64)})).state,'unavailable');
    admin(`update alliance_journal.control set sequence=4,sha256='${recovered.tip.sha256}';`);
    assert.equal((await producer.issue({challenge:'b'.repeat(64)})).state,'unavailable');producer.close();signer.client.close();
    console.log('PASS witness refuses a simulated SQL tip rollback after observing tip four; restoring the pointer does not reopen the faulted producer');
    admin(`begin;set local role alliance_journal_executor;set local synchronous_commit='off';do $$ begin perform alliance_journal.append('${projectRef}','${epoch}',4,'${recovered.tip.sha256}',jsonb_build_object('id','${other}','kind','profile_remove_requested','profileId','${other}','objectId',null));raise exception 'Expected durability refusal';exception when insufficient_privilege then null;end $$;rollback;
      begin;set local role alliance_journal_executor;do $$ begin perform alliance_journal.append('${projectRef}','${epoch}',4,'${recovered.tip.sha256}',jsonb_build_object('id','${other}','kind',null,'profileId','${other}','objectId',null));raise exception 'Expected malformed-event refusal';exception when insufficient_privilege then null;end $$;rollback;`);
    assert.equal((await store.tip()).sequence,4);
    console.log('PASS direct restricted SQL calls cannot append with asynchronous commit or malformed intent; existing history stays unchanged');
    admin(`update alliance_journal.control set enabled=true;set role alliance_journal_executor;do $$ declare n integer;t jsonb;begin for n in 5..255 loop t:=alliance_journal.tip('${projectRef}','${epoch}');perform alliance_journal.append('${projectRef}','${epoch}',(t->>'sequence')::integer,t->>'sha256',jsonb_build_object('id',md5('journal-fixture-'||n)::uuid,'kind','profile_remove_requested','profileId','${other}','objectId',null));end loop;end $$;reset role;`);
    const end=await store.tip(),lastExpected={sequence:end.sequence,sha256:end.sha256};assert.equal(end.sequence,255);
    const last=await Promise.all([store.append({event:event({id:'e1111111-1111-4111-8111-111111111111'}),expected:lastExpected}),second.append({event:event({id:'f1111111-1111-4111-8111-111111111111'}),expected:lastExpected})]);assert.deepEqual(last.map(x=>x.state).sort(),['conflict','recorded']);
    const cap=await store.tip();assert.equal(cap.sequence,256);assert.equal((await store.append({event:event({id:other}),expected:{sequence:256,sha256:cap.sha256}})).state,'full');assert.equal((await store.append({event:event(),expected:{sequence:256,sha256:cap.sha256}})).record.sequence,1);assert.equal((await store.records({sequence:256,sha256:cap.sha256})).length,256);
    console.log('PASS actual final-slot race admits one record; capacity refuses without pruning while old exact receipts and complete history remain readable');
    const rights=admin("select has_table_privilege('alliance_journal_executor','alliance_journal.entries','SELECT'),has_table_privilege('alliance_journal_executor','alliance_journal.entries','UPDATE'),has_function_privilege('authenticated','alliance_journal.append(text,uuid,integer,text,jsonb)','EXECUTE'),has_function_privilege('service_role','alliance_journal.lookup(text,uuid,uuid)','EXECUTE');");assert.match(rights,/f\s*\|\s*f\s*\|\s*f\s*\|\s*f/);
    admin('create schema alliance_avatar;');await assert.rejects(store.tip(),e=>e.outcome==='not_started');admin('drop schema alliance_avatar;');assert.equal((await store.tip()).sequence,256);
    console.log('PASS restricted journal connections refuse later member co-location; member/service roles and direct table bypass remain denied');
  }finally{
    for(const s of stores){try{await s.close();}catch{}}
    admin('begin;alter role alliance_journal_executor nologin password null;drop owned by alliance_journal_owner,alliance_journal_executor,anon,authenticated,service_role cascade;drop schema if exists alliance_journal cascade;drop role alliance_journal_owner,alliance_journal_executor,anon,authenticated,service_role;commit;do $$ begin if to_regnamespace(\'alliance_journal\') is not null or exists(select 1 from pg_roles where rolname in(\'alliance_journal_owner\',\'alliance_journal_executor\')) then raise exception \'Journal teardown failed\';end if;end $$;');
    console.log('PASS exact independent journal fixture rows/schema/roles removed; no hosted database, real key or provider request');
  }
}
