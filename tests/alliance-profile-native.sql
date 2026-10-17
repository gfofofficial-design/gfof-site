create function public.fixture_assert(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL %',label; end if; raise notice 'PASS %',label; end;
$$;
grant execute on function public.fixture_assert(boolean,text) to authenticated;
select public.fixture_assert((select count(*)=2 from pg_class where oid in ('public.alliance_profiles'::regclass,'public.alliance_member_owners'::regclass) and relrowsecurity and relforcerowsecurity),'both tables enforce RLS');
select public.fixture_assert(not has_column_privilege('authenticated','public.alliance_profiles','moderation_state','UPDATE'),'moderation flag is not member writable');
select public.fixture_assert(not has_column_privilege('authenticated','public.alliance_profiles','id','UPDATE'),'profile ownership cannot be reassigned');
select public.fixture_assert(not has_column_privilege('authenticated','public.alliance_member_owners','id','INSERT'),'member binding IDs are server generated');
select public.fixture_assert(not has_table_privilege('anon','public.alliance_profiles','SELECT'),'anonymous directory is not exposed');
select public.fixture_assert(not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname like 'alliance_%' and prosecdef),'candidate functions do not bypass RLS');
select public.fixture_assert(not exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname like 'alliance_%' and not coalesce(proconfig @> array['search_path=""']::text[],false)),'candidate function search paths are empty');

insert into auth.users(id) values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true),set_config('request.jwt.claim.is_anonymous','false',true);
set local role authenticated;
select public.fixture_assert(public.alliance_my_profile() is null,'unjoined member has no invented profile');
select public.alliance_save_profile('Native Explorer','Example crew','A synthetic profile for ownership checks.','builder',false)->>'id' as a_id \gset
select public.fixture_assert((public.alliance_my_profile()->>'id')=:'a_id','saved profile is returned for its owner');
select public.fixture_assert((public.alliance_my_profile()->>'publication')='private','listing defaults can remain private');
select public.fixture_assert((public.alliance_my_profile()->>'id')<>'11111111-1111-4111-8111-111111111111','public profile ID is distinct from account ID');
select public.fixture_assert(not (public.alliance_my_profile() ?| array['user_id','email','access_token']),'profile DTO excludes private identity and token fields');
select public.alliance_save_profile('Updated Explorer','Example crew','A synthetic profile updated without operator approval.','builder',true);
select public.fixture_assert((select count(*)=1 from public.alliance_member_owners),'one binding per account survives repeated save');
select public.fixture_assert((select count(*)=1 from public.alliance_profiles),'repeated save updates one profile');
select public.fixture_assert((public.alliance_my_profile()->>'name')='Updated Explorer','owner edit persists');
reset role;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select public.fixture_assert((select count(*)=0 from public.alliance_profiles),'unjoined account cannot enumerate listed profiles');
select public.alliance_save_profile('Second Explorer','Other crew','Another synthetic profile for cross-account checks.','researcher',false)->>'id' as b_id \gset
select public.fixture_assert((select count(*)=1 from public.alliance_profiles where id=:'a_id'),'joined member can read an explicitly listed profile');
select public.fixture_assert((select count(*)=1 from public.alliance_member_owners),'other account bindings remain private');
with changed as(update public.alliance_profiles set bio='An attempted cross-account replacement.' where id=:'a_id' returning id)
select public.fixture_assert((select count(*)=0 from changed),'cross-account profile updates affect zero rows');
with removed as(delete from public.alliance_member_owners where id=:'a_id' returning id)
select public.fixture_assert((select count(*)=0 from removed),'cross-account binding deletion affects zero rows');
do $$ begin
  begin update public.alliance_profiles set moderation_state='visible';raise exception 'unexpected moderation access';exception when insufficient_privilege then raise notice 'PASS moderation write denied';end;
  begin update public.alliance_profiles set updated_at=now();raise exception 'unexpected timestamp access';exception when insufficient_privilege then raise notice 'PASS timestamp write denied';end;
  begin update public.alliance_profiles set contribution_role='admin';raise exception 'unexpected admin role';exception when check_violation then raise notice 'PASS staff role rejected';end;
  begin insert into public.alliance_member_owners(id,user_id) values(gen_random_uuid(),auth.uid());raise exception 'unexpected binding identity access';exception when insufficient_privilege then raise notice 'PASS client-generated binding ID rejected';end;
  begin insert into public.alliance_member_owners(user_id) values('33333333-3333-4333-8333-333333333333');raise exception 'unexpected other account binding';exception when insufficient_privilege then raise notice 'PASS binding to another account rejected';end;
  begin insert into public.alliance_profiles(id,display_name,community,bio,contribution_role,listed) values(gen_random_uuid(),'Invented member','','An invalid unowned profile row.','explorer',true);raise exception 'unexpected unowned profile';exception when insufficient_privilege then raise notice 'PASS unowned profile insert rejected';end;
end $$;
reset role;

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.fixture_assert((select count(*)=0 from public.alliance_profiles where id=:'b_id'),'another member private profile stays private');
select public.alliance_save_profile('Updated Explorer','Example crew','A synthetic profile temporarily unlisted.','builder',false);
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select public.fixture_assert((select count(*)=0 from public.alliance_profiles where id=:'a_id'),'unlisting removes the profile from another member read');
reset role;
update public.alliance_profiles set listed=true,moderation_state='held' where id=:'a_id';
set local role authenticated;
select public.fixture_assert((select count(*)=0 from public.alliance_profiles where id=:'a_id'),'held profile is absent for another member');
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.fixture_assert((public.alliance_my_profile()->>'publication')='held','owner receives an accurate held publication status');
select public.alliance_save_profile('Updated Explorer','Example crew','Edited content cannot clear a moderation hold.','builder',true);
select public.fixture_assert((public.alliance_my_profile()->>'publication')='held','normal owner update cannot clear a protected hold');
reset role;

select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true),set_config('request.jwt.claim.is_anonymous','true',true);
set local role authenticated;
select public.fixture_assert((select count(*)=0 from public.alliance_profiles),'anonymous Auth user cannot read directory');
do $$ begin
  begin perform public.alliance_save_profile('Anonymous member','','An anonymous account must not join.','explorer',true);raise exception 'unexpected anonymous signup';exception when insufficient_privilege then raise notice 'PASS anonymous Auth profile creation denied';end;
end $$;
reset role;
select set_config('request.jwt.claim.is_anonymous','',true);
set local role authenticated;
select public.fixture_assert(not public.alliance_member_eligible(),'missing anonymous claim fails closed');
reset role;

set local role anon;
do $$ begin
  begin perform * from public.alliance_profiles;raise exception 'unexpected anon profile read';exception when insufficient_privilege then raise notice 'PASS anon table read denied';end;
  begin perform public.alliance_my_profile();raise exception 'unexpected anon RPC';exception when insufficient_privilege then raise notice 'PASS anon RPC denied';end;
end $$;
reset role;

delete from auth.users where id='11111111-1111-4111-8111-111111111111';
select public.fixture_assert(not exists(select 1 from public.alliance_member_owners where id=:'a_id') and not exists(select 1 from public.alliance_profiles where id=:'a_id'),'account deletion cascades the private binding and profile');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true),set_config('request.jwt.claim.is_anonymous','false',true);
set local role authenticated;
select public.fixture_assert((select count(*)=0 from public.alliance_profiles),'deleted-account claims cannot enumerate directory');
do $$ begin
  begin perform public.alliance_save_profile('Deleted member','','A stale account cannot recreate its profile.','explorer',true);raise exception 'unexpected deleted-account recreation';exception when foreign_key_violation then raise notice 'PASS deleted account cannot recreate member binding';end;
end $$;
reset role;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select public.fixture_assert(public.alliance_remove_profile()='{"removed":true}'::jsonb,'owner can remove its Alliance profile');
select public.fixture_assert(public.alliance_my_profile() is null,'removed profile is absent from a later read');
select public.fixture_assert(public.alliance_remove_profile()='{"removed":true}'::jsonb,'repeated profile removal is idempotent');
reset role;
select public.fixture_assert((select count(*)=0 from public.alliance_profiles) and (select count(*)=0 from public.alliance_member_owners),'no fixture profile or binding is orphaned');
