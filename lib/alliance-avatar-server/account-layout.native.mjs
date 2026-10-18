// Exact synthetic DDL drift only, on the existing confirmed disposable fixture.
import assert from 'node:assert/strict';
import {accountEvent,accountSubject} from './account-history.mjs';
export async function accountLayoutNative({history,ack,historyAdmin:admin,scope,openAfterCommit}){
 if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture')throw Error('Wrong account layout fixture');
 const before=await history.snapshot(),oldAck=await ack.read();assert.equal(before.head.sequence,3);
 const event=accountEvent({kind:'account_admitted',subject:accountSubject({memberProjectRef:scope.memberProjectRef,epoch:scope.epoch,authUserId:'88888888-8888-4888-8888-888888888888'})});
 const refuse=p=>assert.rejects(p,e=>e.message==='alliance_account_store_unavailable'&&e.outcome==='not_started');
 const changes=[
  ['default','alter table alliance_account.history_control alter column sequence set default 1;','alter table alliance_account.history_control alter column sequence set default 0;'],
  ['nullability','alter table alliance_account.entries alter column event_id drop not null;','alter table alliance_account.entries alter column event_id set not null;'],
  ['column name','alter table alliance_account.entries rename event_id to other_event_id;','alter table alliance_account.entries rename other_event_id to event_id;'],
  ['weaker CHECK','alter table alliance_account.entries drop constraint entries_sequence_check;alter table alliance_account.entries add constraint entries_sequence_check check(sequence between 1 and 512);','alter table alliance_account.entries drop constraint entries_sequence_check;alter table alliance_account.entries add constraint entries_sequence_check check(sequence between 1 and 256);'],
  ['NOT VALID CHECK','alter table alliance_account.entries drop constraint entries_sequence_check;alter table alliance_account.entries add constraint entries_sequence_check check(sequence between 1 and 256) not valid;','alter table alliance_account.entries validate constraint entries_sequence_check;'],
  ['deferred uniqueness','alter table alliance_account.entries drop constraint entries_event_id_key;alter table alliance_account.entries add constraint entries_event_id_key unique(event_id) deferrable initially deferred;','alter table alliance_account.entries drop constraint entries_event_id_key;alter table alliance_account.entries add constraint entries_event_id_key unique(event_id);'],
  ['extra FK','alter table alliance_account.entries add constraint layout_fixture_fk foreign key(sequence) references alliance_account.entries(sequence);','alter table alliance_account.entries drop constraint layout_fixture_fk;'],
  ['extra expression index',"create index layout_fixture_index on alliance_account.entries((record->>'sha256')) where sequence>1;",'drop index alliance_account.layout_fixture_index;'],
  ['owner policy USING','alter policy owner_only on alliance_account.entries using(false);','alter policy owner_only on alliance_account.entries using(true);'],
  ['additional restrictive policy','create policy layout_fixture_policy on alliance_account.entries as restrictive to alliance_account_owner using(false);','drop policy layout_fixture_policy on alliance_account.entries;'],
  ['future table grant','alter default privileges for role alliance_account_owner grant select on tables to anon;','alter default privileges for role alliance_account_owner revoke select on tables from anon;'],
  ['future schema function grant','alter default privileges for role alliance_account_owner in schema alliance_account grant execute on functions to anon;','alter default privileges for role alliance_account_owner in schema alliance_account revoke execute on functions from anon;'],
  ['unlogged table','alter table alliance_account.entries set unlogged;','alter table alliance_account.entries set logged;'],
  ['inherited child','create table public.layout_fixture_child() inherits(alliance_account.entries);','drop table public.layout_fixture_child;'],
  ['rewrite rule','create rule layout_fixture_rule as on insert to alliance_account.entries do instead nothing;','drop rule layout_fixture_rule on alliance_account.entries;']
 ];
 for(const [name,change,restore]of changes){admin(change);try{await refuse(history.snapshot());await refuse(history.append({event,expected:before.head}));}finally{admin(restore);}assert.deepEqual(await history.snapshot(),before);assert.deepEqual(await ack.read(),oldAck);console.log('PASS account table-layout '+name+' drift refuses before mutation; exact synthetic repair preserves all original records');}
 const post=await openAfterCommit(()=>admin('alter table alliance_account.history_control alter column sequence set default 1;'));
 try{await assert.rejects(post.append({event,expected:before.head}),e=>e.outcome==='unknown');}finally{admin('alter table alliance_account.history_control alter column sequence set default 0;');}
 const committed=await history.snapshot();assert.equal(committed.head.sequence,4);assert.deepEqual(committed.records[3].event,event);assert.deepEqual(await ack.read(),oldAck);
 console.log('PASS changed default after actual COMMIT returns unknown; independent read confirms one account event without retry');
 admin(`begin;set local role alliance_account_owner;delete from alliance_account.entries where sequence=4 and event_id='${event.id}';update alliance_account.history_control set sequence=${before.head.sequence},sha256='${before.head.sha256}';commit;`);
 assert.deepEqual(await history.snapshot(),before);assert.deepEqual(await ack.read(),oldAck);
 console.log('PASS exact table-layout drift objects/default grants and committed synthetic record removed; both history and acknowledgement baseline unchanged');
}
