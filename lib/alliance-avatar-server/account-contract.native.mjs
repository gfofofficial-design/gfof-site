// Confirmed disposable account databases only. All drift is exact-target,
// synthetic and restored; no hosted credentials, SQL installation or DDL lock.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accountEvent,accountSubject} from './account-history.mjs';
export async function accountContractNative({history,ack,historyAdmin,ackAdmin,scope,openAfterCommit}){
 if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture')throw Error('Wrong account contract fixture');
 const before=await history.snapshot(),oldAck=await ack.read();assert.equal(before.head.sequence,3);assert.deepEqual(oldAck,before.head);
 const common=readFileSync(new URL('../../sql/alliance-account-protocol-candidate.sql',import.meta.url),'utf8'),historySql=readFileSync(new URL('../../sql/alliance-account-history-store-candidate.sql',import.meta.url),'utf8');
 const definition=(source,name)=>{const match=source.match(new RegExp('create function alliance_account\\.'+name+'\\([^]*?\\$\\$;'));if(!match)throw Error('Missing fixture function');return match[0].replace('create function','create or replace function');};
 const append=definition(historySql,'append'),helper=definition(common,'check_chain');
 const drift=s=>s.replace('as $$',()=> 'as $$\n-- exact synthetic contract drift\n');
 const subject=accountSubject({memberProjectRef:scope.memberProjectRef,epoch:scope.epoch,authUserId:'77777777-7777-4777-8777-777777777777'}),event=accountEvent({kind:'account_admitted',subject});
 const refuse=(promise,outcome='not_started')=>assert.rejects(promise,e=>e.message==='alliance_account_store_unavailable'&&e.outcome===outcome&&!e.cause);
 const unchanged=async()=>{assert.deepEqual(await history.snapshot(),before);assert.deepEqual(await ack.read(),oldAck);};
 console.log('PASS real TLS history and acknowledgement adapters accept exact eight-function fingerprints, private grants, isolated owner and table protections without new database privileges');
 for(const [admin,source] of [[historyAdmin,append],[historyAdmin,helper],[ackAdmin,helper]]){
  admin(drift(source));try{await refuse(admin===historyAdmin?history.snapshot():ack.read());if(admin===historyAdmin)await refuse(history.append({event,expected:before.head}));}finally{admin(source);}await unchanged();
 }
 console.log('PASS changed main or shared-helper SQL body is rejected before account-function dispatch, even when the change is only a harmless comment; exact restoration is accepted on the next call');
 for(const [admin,change,restore,read] of [
  [historyAdmin,'alter function alliance_account.snapshot(jsonb) stable;','alter function alliance_account.snapshot(jsonb) volatile;',()=>history.snapshot()],
  [ackAdmin,'grant execute on function alliance_account.ack_advance(jsonb,integer,text,jsonb) to anon;','revoke execute on function alliance_account.ack_advance(jsonb,integer,text,jsonb) from anon;',()=>ack.read()]
 ]){admin(change);try{await refuse(read());}finally{admin(restore);}await unchanged();}
 console.log('PASS actual function volatility drift and an anonymous mutation EXECUTE grant are refused without requiring that the current actor gained those privileges');
 const changes=[
  ['grant select(sequence) on alliance_account.entries to anon;','revoke select(sequence) on alliance_account.entries from anon;'],
  ['alter table alliance_account.entries disable row level security;','alter table alliance_account.entries enable row level security;'],
  ["set role alliance_account_owner;create function alliance_account.append(text) returns text language sql security invoker set search_path='' as $$select $1$$;reset role;",'drop function alliance_account.append(text);'],
  ["create function public.contract_fixture_trigger() returns trigger language plpgsql security invoker set search_path='' as $$begin return new;end$$;create trigger contract_fixture_trigger before insert on alliance_account.entries for each row execute function public.contract_fixture_trigger();",'drop trigger contract_fixture_trigger on alliance_account.entries;drop function public.contract_fixture_trigger();']
 ];
 for(const [change,restore] of changes){historyAdmin(change);try{await refuse(history.snapshot());await refuse(history.append({event,expected:before.head}));}finally{historyAdmin(restore);}await unchanged();}
 console.log('PASS actual unknown column grant, disabled RLS, extra function overload and user trigger each fail closed before account mutation; each exact synthetic change is removed without widening privileges');
 historyAdmin('create role contract_fixture_member nologin;grant alliance_account_owner to contract_fixture_member;');
 try{await refuse(history.snapshot());}finally{historyAdmin('revoke alliance_account_owner from contract_fixture_member;drop role contract_fixture_member;');}await unchanged();
 console.log('PASS unexpected membership involving the function-owner role is rejected even when the application login itself remains isolated and nonprivileged');
 let changed=false;const post=await openAfterCommit(()=>{changed=true;historyAdmin(drift(append));});
 try{await refuse(post.append({event,expected:before.head}),'unknown');assert.equal(changed,true);}finally{historyAdmin(append);}
 const committed=await history.snapshot();assert.equal(committed.head.sequence,4);assert.deepEqual(committed.records[3].event,event);
 assert.equal((await history.append({event,expected:before.head})).record.sequence,4);assert.deepEqual((await history.snapshot()).head,committed.head);
 console.log('PASS persistent SQL drift introduced after a real business COMMIT is detected by a fresh autocommit catalogue read; caller receives unknown, while independent read proves one committed event with no automatic retry');
 historyAdmin(`begin;set local role alliance_account_owner;delete from alliance_account.entries where sequence=4 and event_id='${event.id}';update alliance_account.history_control set sequence=${before.head.sequence},sha256='${before.head.sha256}';commit;`);
 await unchanged();
 console.log('PASS exact synthetic catalogue drift, membership, trigger, overload, grant and test record cleanup restores original history and acknowledgement baseline; no hosted contract, DDL freeze or custody claim');
}
