-- Synthetic receipt helpers are fixture-only and disappear on rollback.
create function public.avatar_descriptor(n integer) returns jsonb language sql immutable as $$
 select jsonb_build_object('bytes',n,'sha256',repeat('a',64),'width',1,'height',1,'mime','image/png');
$$;
create function public.avatar_upload_result(operation uuid,ok boolean default true) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('state',case when ok then 'stored' else 'stored_unverified' end,'writeSettled',true,'verified',ok,'receipt',obj.descriptor||jsonb_build_object('profileId',obj.profile_id,'objectId',obj.id,'key','v1/'||obj.profile_id||'/'||obj.id||'.png','providerId',obj.id))
 from alliance_avatar.objects obj join alliance_avatar.operations op on op.object_id=obj.id where op.id=operation;
$$;
create function public.avatar_deletion_result(object_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('state','deleted','writeSettled',true,'receipt',obj.receipt) from alliance_avatar.objects obj where obj.id=object_id;
$$;
grant execute on function public.avatar_descriptor(integer),public.avatar_upload_result(uuid,boolean),public.avatar_deletion_result(uuid) to alliance_avatar_executor;

-- Synthetic native database acceptance, inside the disposable fixture transaction.
grant execute on function public.fixture_assert(boolean,text) to alliance_avatar_executor;
create function public.avatar_expect_denied(statement text,label text) returns void language plpgsql security invoker as $$
begin
  begin execute statement;exception when insufficient_privilege then raise notice 'PASS %',label;return;end;
  raise exception 'FAIL expected denial: %',label;
end $$;
grant execute on function public.avatar_expect_denied(text,text) to anon,authenticated,service_role,alliance_avatar_executor;

select public.fixture_assert((select count(*)=5 from pg_class where relnamespace='alliance_avatar'::regnamespace and relkind='r' and relrowsecurity and relforcerowsecurity),'avatar tables force RLS');
select public.fixture_assert(not exists(select 1 from pg_roles where rolname in('alliance_avatar_owner','alliance_avatar_executor') and(rolcanlogin or rolbypassrls or rolsuper or rolcreaterole or rolcreatedb)),'both avatar roles remain locked and unprivileged');
select public.fixture_assert(not exists(select 1 from pg_auth_members where roleid in(select oid from pg_roles where rolname in('alliance_avatar_owner','alliance_avatar_executor')) or member in(select oid from pg_roles where rolname in('alliance_avatar_owner','alliance_avatar_executor'))),'avatar roles have no inherited memberships');
select public.fixture_assert(not has_schema_privilege('authenticated','alliance_avatar','USAGE') and not has_schema_privilege('anon','alliance_avatar','USAGE') and not has_schema_privilege('service_role','alliance_avatar','USAGE'),'public and API roles cannot enter avatar schema');
select public.fixture_assert(not has_table_privilege('alliance_avatar_executor','alliance_avatar.daily','UPDATE') and not has_table_privilege('alliance_avatar_executor','alliance_avatar.objects','SELECT'),'executor cannot bypass functions or edit quota/object tables');
select public.fixture_assert(not has_function_privilege('alliance_avatar_executor','alliance_avatar.live_profile(uuid)','EXECUTE') and not has_function_privilege('alliance_avatar_executor','alliance_avatar.lock_enabled()','EXECUTE'),'internal helper execution is not exposed');
select public.fixture_assert(not has_column_privilege('alliance_avatar_owner','public.alliance_profiles','bio','SELECT') and not has_column_privilege('alliance_avatar_owner','public.alliance_profiles','listed','UPDATE'),'definer has no profile content or mutation privilege');
select public.fixture_assert(not exists(select 1 from pg_proc where pronamespace='alliance_avatar'::regnamespace and not coalesce(proconfig @> array['search_path=""']::text[],false)),'avatar function search paths are empty');

insert into auth.users(id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),set_config('request.jwt.claim.is_anonymous','false',true);
set local role authenticated;
select public.alliance_save_profile('Avatar Alpha','','Synthetic avatar owner alpha.','builder',false)->>'id' as avatar_a \gset
select public.avatar_expect_denied($q$select alliance_avatar.reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',gen_random_uuid(),0)$q$,'browser member cannot call privileged reserve');
reset role;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
set local role authenticated;
select public.alliance_save_profile('Avatar Beta','','Synthetic avatar owner beta.','builder',false)->>'id' as avatar_b \gset
reset role;
set local role alliance_avatar_executor;
select public.avatar_expect_denied($q$select alliance_avatar.reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',gen_random_uuid(),0)$q$,'default closed refuses reserve');
reset role;
update alliance_avatar.control set enabled=true;
set local role alliance_avatar_executor;
select public.fixture_assert((alliance_avatar.mine('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'version')='0','read of initial version does not invent an image');
select public.avatar_expect_denied($q$select alliance_avatar.reserve('cccccccc-cccc-4ccc-8ccc-cccccccccccc',gen_random_uuid(),0)$q$,'unjoined actor cannot reserve');
select public.avatar_expect_denied($q$select alliance_avatar.reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',gen_random_uuid(),-1)$q$,'negative version refuses');
select gen_random_uuid() as avatar_op1 \gset
select alliance_avatar.reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_op1',0)->>'objectId' as avatar_o1 \gset
select public.fixture_assert((alliance_avatar.reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_op1',0)->>'dispatch')='false','same operation cannot dispatch processing twice');
select public.avatar_expect_denied(format('select alliance_avatar.reserve(%L,%L,0)','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',:'avatar_op1'),'other account cannot replay an operation');
select public.avatar_expect_denied($q$select alliance_avatar.reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',gen_random_uuid(),0)$q$,'second pending decode refuses');
select public.fixture_assert(jsonb_array_length(alliance_avatar.mine('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'pending')=1,'reload can discover its durable pending operation');
select public.avatar_expect_denied(format('select alliance_avatar.claim_upload(%L,%L,public.avatar_descriptor(1024))','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',:'avatar_op1'),'other actor cannot claim upload');
select public.avatar_expect_denied(format('select alliance_avatar.claim_upload(%L,%L,public.avatar_descriptor(307201))','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_op1'),'oversized derivative cannot dispatch');
select public.fixture_assert((alliance_avatar.claim_upload('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_op1',public.avatar_descriptor(1024))->>'dispatch')='true','first upload dispatch succeeds');
select public.fixture_assert((alliance_avatar.claim_upload('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_op1',public.avatar_descriptor(1024))->>'dispatch')='false','same object never uploads twice');
select public.fixture_assert((alliance_avatar.cancel_reserved('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_op1')->>'state')='uploading','cancel cannot pretend an in-flight upload disappeared');
select public.fixture_assert((alliance_avatar.mine('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'objectId') is null,'pending upload is not visible');
select public.fixture_assert((alliance_avatar.commit_upload('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_op1',public.avatar_upload_result(:'avatar_op1'))->>'version')='1','acknowledged upload publishes version one');
select public.fixture_assert((alliance_avatar.commit_upload('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_op1',public.avatar_upload_result(:'avatar_op1'))->>'version')='1','commit replay does not increment version');
select public.fixture_assert((alliance_avatar.mine('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->>'objectId') is null,'another account has no access to the first image');
select public.avatar_expect_denied(format('select alliance_avatar.ack_deleted(%1$L,public.avatar_deletion_result(%1$L))',:'avatar_o1'),'active object cannot be acknowledged as deleted');
select gen_random_uuid() as avatar_op2 \gset
select alliance_avatar.reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_op2',1)->>'objectId' as avatar_o2 \gset
select public.fixture_assert((alliance_avatar.mine('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'objectId')=:'avatar_o1','replacement leaves current image intact');
select alliance_avatar.claim_upload('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_op2',public.avatar_descriptor(2048));
select gen_random_uuid() as avatar_remove1 \gset
select public.fixture_assert((alliance_avatar.remove_image('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_remove1',1)->>'version')='2','remove immediately detaches image and advances version');
select public.fixture_assert((alliance_avatar.remove_image('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_remove1',1)->>'version')='2','remove replay is stable');
select public.fixture_assert((alliance_avatar.commit_upload('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_op2',public.avatar_upload_result(:'avatar_op2'))->>'state')='stale','late replacement cannot restore a removed image');
select public.fixture_assert((alliance_avatar.mine('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'objectId') is null,'image stays empty after late success');
select public.fixture_assert(jsonb_array_length(alliance_avatar.cleanup_batch(20))=2,'old and stale settled images await physical cleanup');
select public.avatar_expect_denied($q$select alliance_avatar.reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',gen_random_uuid(),2)$q$,'unremoved cleanup files still consume owner slots');
select alliance_avatar.ack_deleted(:'avatar_o1',public.avatar_deletion_result(:'avatar_o1'));select alliance_avatar.ack_deleted(:'avatar_o2',public.avatar_deletion_result(:'avatar_o2'));select alliance_avatar.ack_deleted(:'avatar_o2',public.avatar_deletion_result(:'avatar_o2'));
select public.fixture_assert(jsonb_array_length(alliance_avatar.cleanup_batch(20))=0,'confirmed physical deletion releases cleanup entries idempotently');
select gen_random_uuid() as avatar_op3 \gset
select alliance_avatar.reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_op3',2)->>'objectId' as avatar_o3 \gset
select public.fixture_assert((alliance_avatar.cancel_reserved('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_op3')->>'state')='cancelled','failed decode releases only a never-dispatched object');
reset role;
select public.fixture_assert((select attempts=3 from alliance_avatar.daily where actor_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'cancel and deletion never refund consumed attempts');
select public.fixture_assert((select count(*)=1 from alliance_avatar.heads where profile_id=:'avatar_a'),'all operations share a durable head');
set local role alliance_avatar_executor;
select gen_random_uuid() as avatar_op4 \gset
select alliance_avatar.reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_op4',2)->>'objectId' as avatar_o4 \gset
reset role;
update alliance_avatar.operations set expires_at=clock_timestamp()-interval '1 second' where id=:'avatar_op4';
set local role alliance_avatar_executor;
select public.fixture_assert((alliance_avatar.claim_upload('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_op4',public.avatar_descriptor(1024))->>'dispatch')='false','expired reservation cannot upload');
select gen_random_uuid() as avatar_op5 \gset
select alliance_avatar.reserve('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_op5',2)->>'objectId' as avatar_o5 \gset
select alliance_avatar.claim_upload('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_op5',public.avatar_descriptor(1024));
reset role;
delete from auth.users where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select public.fixture_assert((select object_id is null and removed_at is not null from alliance_avatar.heads where profile_id=:'avatar_a'),'account deletion detaches image through profile trigger');
select public.fixture_assert((select state='cleanup' and not write_settled from alliance_avatar.objects where id=:'avatar_o5'),'unknown in-flight upload is quarantined after account deletion');
set local role alliance_avatar_executor;
select public.avatar_expect_denied(format('select alliance_avatar.ack_deleted(%1$L,public.avatar_deletion_result(%1$L))',:'avatar_o5'),'absence alone cannot release unknown upload slot');
select public.fixture_assert(jsonb_array_length(alliance_avatar.cleanup_batch(20))=0,'uncertain writes excluded from cleanup dispatch');
select public.avatar_expect_denied(format('select alliance_avatar.commit_upload(%1$L,%2$L,public.avatar_upload_result(%2$L))','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',:'avatar_op5'),'deleted account cannot publish late upload');
select alliance_avatar.settle_unpublished(:'avatar_op5',public.avatar_upload_result(:'avatar_op5'));
select public.fixture_assert(jsonb_array_length(alliance_avatar.cleanup_batch(20))=1,'definitively settled unpublished write becomes cleanup eligible');
select alliance_avatar.ack_deleted(:'avatar_o5',public.avatar_deletion_result(:'avatar_o5'));
select public.avatar_expect_denied($q$select alliance_avatar.cleanup_batch(21)$q$,'cleanup pages are bounded');
reset role;

select set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
set local role authenticated;
select public.alliance_save_profile('Avatar Gamma','','Synthetic replacement lifecycle fixture.','researcher',false)->>'id' as avatar_c \gset
reset role;
set local role alliance_avatar_executor;
select gen_random_uuid() as avatar_cop1 \gset
select alliance_avatar.reserve('cccccccc-cccc-4ccc-8ccc-cccccccccccc',:'avatar_cop1',0)->>'objectId' as avatar_co1 \gset
select alliance_avatar.claim_upload('cccccccc-cccc-4ccc-8ccc-cccccccccccc',:'avatar_cop1',public.avatar_descriptor(2048));
select alliance_avatar.commit_upload('cccccccc-cccc-4ccc-8ccc-cccccccccccc',:'avatar_cop1',public.avatar_upload_result(:'avatar_cop1'));
select gen_random_uuid() as avatar_cop2 \gset
select alliance_avatar.reserve('cccccccc-cccc-4ccc-8ccc-cccccccccccc',:'avatar_cop2',1)->>'objectId' as avatar_co2 \gset
select alliance_avatar.claim_upload('cccccccc-cccc-4ccc-8ccc-cccccccccccc',:'avatar_cop2',public.avatar_descriptor(307200));
select public.fixture_assert((alliance_avatar.commit_upload('cccccccc-cccc-4ccc-8ccc-cccccccccccc',:'avatar_cop2',public.avatar_upload_result(:'avatar_cop2'))->>'version')='2','successful replacement advances version atomically');
select public.fixture_assert((alliance_avatar.mine('cccccccc-cccc-4ccc-8ccc-cccccccccccc')->>'objectId')=:'avatar_co2','new image replaces old reference');
select alliance_avatar.ack_deleted(:'avatar_co1',public.avatar_deletion_result(:'avatar_co1'));
select gen_random_uuid() as avatar_cop3 \gset
select alliance_avatar.reserve('cccccccc-cccc-4ccc-8ccc-cccccccccccc',:'avatar_cop3',2);
select alliance_avatar.remove_image('cccccccc-cccc-4ccc-8ccc-cccccccccccc',gen_random_uuid(),2);
select public.fixture_assert((alliance_avatar.claim_upload('cccccccc-cccc-4ccc-8ccc-cccccccccccc',:'avatar_cop3',public.avatar_descriptor(1024))->>'dispatch')='false','remove cancels an undispatched replacement');
select alliance_avatar.ack_deleted(:'avatar_co2',public.avatar_deletion_result(:'avatar_co2'));
reset role;
select public.fixture_assert(not exists(select 1 from alliance_avatar.objects where profile_id=:'avatar_c' and state<>'deleted'),'remove and physical cleanup leave no retained owner slots');
set local role alliance_avatar_executor;
select gen_random_uuid() as avatar_cop4 \gset
select gen_random_uuid() as avatar_bop1 \gset
select alliance_avatar.reserve('cccccccc-cccc-4ccc-8ccc-cccccccccccc',:'avatar_cop4',3);
select alliance_avatar.reserve('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',:'avatar_bop1',0)->>'objectId' as avatar_bo1 \gset
select alliance_avatar.claim_upload('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',:'avatar_bop1',public.avatar_descriptor(1024));
reset role;
update alliance_avatar.operations set expires_at=clock_timestamp()-interval '1 second' where id in(:'avatar_cop4',:'avatar_bop1');
set local role alliance_avatar_executor;
select public.fixture_assert(alliance_avatar.expire_batch(20)=2,'bounded expiry handles never-dispatched and uncertain operations separately');
select public.fixture_assert(jsonb_array_length(alliance_avatar.mine('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->'pending')=1,'reload still reports an expired uncertain upload');
select public.avatar_expect_denied(format('select alliance_avatar.ack_deleted(%1$L,public.avatar_deletion_result(%1$L))',:'avatar_bo1'),'expiry does not free an unsettled object slot');
select alliance_avatar.settle_unpublished(:'avatar_bop1',public.avatar_upload_result(:'avatar_bop1'));select alliance_avatar.ack_deleted(:'avatar_bo1',public.avatar_deletion_result(:'avatar_bo1'));
reset role;

update alliance_avatar.daily set attempts=10 where actor_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
insert into alliance_avatar.daily(actor_id,day,attempts) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',(clock_timestamp() at time zone 'UTC')::date,10) on conflict do nothing;
set local role alliance_avatar_executor;
select public.avatar_expect_denied($q$select alliance_avatar.reserve('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',gen_random_uuid(),0)$q$,'daily actor processing budget refuses new attempts');
reset role;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
set local role authenticated;
select public.alliance_remove_profile();
select public.alliance_save_profile('Avatar Beta Rejoined','','Rejoining must not reset daily actor limits.','builder',false)->>'id' as avatar_b_new \gset
reset role;
select public.fixture_assert(:'avatar_b_new'<>:'avatar_b','rejoining gets a distinct profile binding');
set local role alliance_avatar_executor;
select public.avatar_expect_denied($q$select alliance_avatar.reserve('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',gen_random_uuid(),0)$q$,'profile recreation cannot reset actor processing budget');
reset role;
update alliance_avatar.daily set attempts=0 where actor_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
update alliance_avatar.daily set attempts=200 where actor_id='00000000-0000-0000-0000-000000000000';
set local role alliance_avatar_executor;
select public.avatar_expect_denied($q$select alliance_avatar.reserve('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',gen_random_uuid(),0)$q$,'global daily processing budget refuses new attempts');
reset role;
update alliance_avatar.daily set removals=20 where actor_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local role alliance_avatar_executor;
select public.avatar_expect_denied($q$select alliance_avatar.remove_image('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',gen_random_uuid(),0)$q$,'removal operation metadata is also rate bounded');
reset role;
update alliance_avatar.daily set attempts=0 where actor_id='00000000-0000-0000-0000-000000000000';
insert into alliance_avatar.objects(id,profile_id,state) values('ffffffff-ffff-4fff-8fff-fffffffffff1',gen_random_uuid(),'uploading'),('ffffffff-ffff-4fff-8fff-fffffffffff2',gen_random_uuid(),'reserved');
set local role alliance_avatar_executor;
select public.avatar_expect_denied($q$select alliance_avatar.reserve('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',gen_random_uuid(),0)$q$,'global processing concurrency cap refuses a third pending dispatch');
reset role;
delete from alliance_avatar.objects where id in('ffffffff-ffff-4fff-8fff-fffffffffff1','ffffffff-ffff-4fff-8fff-fffffffffff2');
insert into alliance_avatar.objects(id,profile_id,state) select gen_random_uuid(),gen_random_uuid(),'cleanup' from generate_series(1,100);
set local role alliance_avatar_executor;
select public.avatar_expect_denied($q$select alliance_avatar.reserve('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',gen_random_uuid(),0)$q$,'global outstanding-storage cap counts uncertain cleanup objects');
reset role;
