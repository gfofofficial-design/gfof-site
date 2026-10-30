// Fixed disposable Auth dependency fixtures only. No managed Auth API or key.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const fixture=()=>{if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture')throw Error('Wrong Auth deletion guard fixture');};
const yes=(admin,sql)=>assert.match(admin(sql),/\n\s*t\s*\n/);
export function assertAuthDeletionHeld(admin){
 fixture();const actor=randomUUID(),deletedActor=randomUUID(),session=randomUUID(),profile=randomUUID();
 // Any unexpected success throws in the enclosing transaction, so all source
 // fixtures roll back even when an interlock assertion itself fails.
 admin(`begin;set local statement_timeout='8s';set local lock_timeout='2s';
 insert into auth.users(id) values('${actor}');insert into auth.sessions values('${session}','${actor}',null);
 insert into auth.users(id,deleted_at) values('${deletedActor}',clock_timestamp());
 insert into public.alliance_member_owners(id,user_id) values('${profile}','${actor}');
 insert into public.alliance_profiles(id,display_name,bio,contribution_role) values('${profile}','Synthetic protected cascade','Synthetic only.','builder');
 do $$ begin
  begin delete from auth.users where id='${actor}';raise exception 'Expected hard removal refusal';
   exception when insufficient_privilege then if sqlerrm<>'alliance_account_removal_unavailable' then raise;end if;end;
  begin update auth.users set deleted_at=clock_timestamp() where id='${actor}';raise exception 'Expected soft removal refusal';
   exception when insufficient_privilege then if sqlerrm<>'alliance_account_removal_unavailable' then raise;end if;end;
  begin update auth.users set deleted_at=null where id='${deletedActor}';raise exception 'Expected soft restoration refusal';
   exception when insufficient_privilege then if sqlerrm<>'alliance_account_removal_unavailable' then raise;end if;end;
  begin truncate auth.users cascade;raise exception 'Expected bulk removal refusal';
   exception when insufficient_privilege then if sqlerrm<>'alliance_account_removal_unavailable' then raise;end if;end;
  if not exists(select 1 from auth.users where id='${actor}' and deleted_at is null)
    or not exists(select 1 from auth.sessions where id='${session}')
    or not exists(select 1 from public.alliance_member_owners where id='${profile}' and user_id='${actor}')
    or not exists(select 1 from public.alliance_profiles where id='${profile}') then raise exception 'Removal changed dependency fixtures';end if;
 end $$;
 set local session_replication_role='replica';select set_config('request.jwt.claim.role','service_role',true),set_config('alliance.account_removal_allow','true',true);
 do $$ begin
  begin delete from auth.users where id='${actor}';raise exception 'Expected replica/claim bypass refusal';
   exception when insufficient_privilege then if sqlerrm<>'alliance_account_removal_unavailable' then raise;end if;end;
  begin update auth.users set deleted_at=clock_timestamp() where id='${actor}';raise exception 'Expected replica soft removal refusal';
   exception when insufficient_privilege then if sqlerrm<>'alliance_account_removal_unavailable' then raise;end if;end;
  begin truncate auth.users cascade;raise exception 'Expected replica bulk removal refusal';
   exception when insufficient_privilege then if sqlerrm<>'alliance_account_removal_unavailable' then raise;end if;end;
 end $$;
 set local session_replication_role='origin';
 -- Ordinary unchanged soft-delete metadata, account restrictions and session
 -- revocation remain possible. None is mistaken for completed account erasure.
 update auth.users set deleted_at=deleted_at,banned_until=clock_timestamp()+interval '1 minute' where id='${actor}';
 delete from auth.sessions where id='${session}';
 do $$ begin if not exists(select 1 from auth.users where id='${actor}' and deleted_at is null and banned_until>clock_timestamp())
  or exists(select 1 from auth.sessions where id='${session}') then raise exception 'Ordinary account/session operation blocked';end if;end $$;
 rollback;`);
}
export async function authDeletionGuardNative({admin,journal}){
 fixture();const actor=randomUUID(),session=randomUUID(),profile=randomUUID(),before=await journal.tip();
 admin(`begin;insert into auth.users(id) values('${actor}');insert into auth.sessions values('${session}','${actor}',null);
 insert into public.alliance_member_owners(id,user_id) values('${profile}','${actor}');
 insert into public.alliance_profiles(id,display_name,bio,contribution_role) values('${profile}','Synthetic cascade','Synthetic only.','builder');
 delete from auth.users where id='${actor}';
 do $$ begin if exists(select 1 from auth.sessions where id='${session}') or exists(select 1 from public.alliance_profiles where id='${profile}')
  or exists(select 1 from public.alliance_member_owners where id='${profile}') then raise exception 'Expected Auth cascade absent';end if;end $$;rollback;`);
 assert.deepEqual(await journal.tip(),before);
 console.log('PASS a rolled-back synthetic Auth deletion demonstrates profile/session cascade without independent journal advancement; cascade alone is not durable account-removal evidence');
 admin('begin;'+readFileSync(new URL('../../sql/alliance-auth-deletion-guard-candidate.sql',import.meta.url),'utf8')+'commit;');
 yes(admin,`select count(*)=2 and bool_and(t.tgenabled='A') and bool_and(not p.prosecdef and r.rolname='alliance_avatar_owner' and p.proconfig @> array['search_path=""']::text[])
 from pg_catalog.pg_trigger t join pg_catalog.pg_proc p on p.oid=t.tgfoid join pg_catalog.pg_roles r on r.oid=p.proowner
 where t.tgrelid='auth.users'::regclass and t.tgname in('alliance_account_removal_rows','alliance_account_removal_bulk');`);
 yes(admin,`select not bool_or(has_function_privilege(r,'alliance_avatar.hold_auth_account_removal()','EXECUTE')) from unnest(array['anon','authenticated','service_role','alliance_avatar_executor'])r;`);
 console.log('PASS unapplied Auth removal interlock installs two ALWAYS triggers with private invoker function/empty search path and no API/executor execute grant, new role or bypass setting');
 const inventory=()=>admin('select alliance_avatar.recovery_inventory();');
 const original=inventory();assertAuthDeletionHeld(admin);assert.equal(inventory(),original);assert.deepEqual(await journal.tip(),before);
 console.log('PASS hard deletion, soft deletion and bulk truncation refuse atomically in actual PostgreSQL; rollback preserves the original member inventory and independent journal');
 console.log('PASS replica mode and forged claim/custom setting cannot bypass ALWAYS removal guards; ordinary account restrictions, unchanged deletion metadata and session revocation still work');
}
