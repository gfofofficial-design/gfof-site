-- UNAPPLIED extension after creation admission, before any member creation.
-- Every committed profile change stays fenced until a separate owner review.
do $$ begin
 if exists(select 1 from alliance_avatar.creation_plans) or exists(select 1 from public.alliance_profiles)
  or exists(select 1 from alliance_avatar.control where enabled or creation_enabled or cleanup_enabled)
 then raise exception 'Empty disabled member store required for profile write fence';end if;
end $$;
set local role alliance_avatar_owner;
alter table alliance_avatar.creation_plans
 add column profile_write_sequence bigint not null default 0,
 add column profile_write_pending boolean not null default false,
 add column profile_write_input_sha256 text,
 add column profile_write_result_sha256 text;
alter table alliance_avatar.creation_plans add constraint profile_write_receipt_bound check(
 profile_write_sequence between 0 and 9007199254740991 and
 ((profile_write_sequence=0 and not profile_write_pending and profile_write_input_sha256 is null and profile_write_result_sha256 is null)
 or (kind='profile' and profile_write_sequence>0 and profile_write_input_sha256 is not null and profile_write_result_sha256 is not null and profile_write_input_sha256 ~ '^[0-9a-f]{64}$' and profile_write_result_sha256 ~ '^[0-9a-f]{64}$')));
-- Renaming preserves the old implementation for the owner only. The executor
-- cannot bypass the new wrapper by calling its previous implementation.
alter function alliance_avatar.finish_profile_session(uuid,uuid,jsonb,jsonb,jsonb) rename to finish_profile_unfenced;
revoke all on function alliance_avatar.finish_profile_unfenced(uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role,alliance_avatar_executor;
create function alliance_avatar.profile_write_current(p_profile uuid) returns jsonb
language sql stable security invoker set search_path='' set timezone='UTC' set datestyle='ISO, YMD' as $$
 select jsonb_build_object('id',p.id,'name',p.display_name,'community',p.community,'bio',p.bio,'role',p.contribution_role,'listed',p.listed,
 'publication',case when p.moderation_state='held' then 'held' when p.listed then 'listed' else 'private' end,'updatedAt',p.updated_at)
 from public.alliance_profiles p where p.id=p_profile;
$$;
create function alliance_avatar.finish_profile_session(p_actor uuid,p_session uuid,p_plan jsonb,p_input jsonb,p_event jsonb) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' set datestyle='ISO, YMD' as $$
declare p alliance_avatar.creation_plans;saved jsonb;
begin
 perform alliance_avatar.creation_live(p_actor,p_session);
 p:=alliance_avatar.check_creation_plan(p_actor,p_plan);
 if p.kind<>'profile' then raise insufficient_privilege using message='profile_write_unavailable';end if;
 select * into strict p from alliance_avatar.creation_plans where actor_id=p_actor and kind='profile' for update;
 if p.profile_write_pending or p.profile_write_sequence>=9007199254740991 then
  raise insufficient_privilege using message='profile_write_review_required';end if;
 saved:=alliance_avatar.finish_profile_unfenced(p_actor,p_session,p_plan,p_input,p_event);
 update alliance_avatar.creation_plans set profile_write_sequence=profile_write_sequence+1,profile_write_pending=true,
  profile_write_input_sha256=encode(sha256(convert_to(p_input::text,'UTF8')),'hex'),
  profile_write_result_sha256=encode(sha256(convert_to(saved::text,'UTF8')),'hex') where actor_id=p_actor and kind='profile';
 return saved;
end $$;
create function alliance_avatar.profile_write_status_session(p_actor uuid,p_session uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p alliance_avatar.creation_plans;
begin
 perform alliance_avatar.require_removal_session(p_actor,p_session);
 select * into p from alliance_avatar.creation_plans where actor_id=p_actor and kind='profile';
 if not found then return null;end if;
 return jsonb_build_object('profileId',p.profile_id,'sequence',p.profile_write_sequence,'pending',p.profile_write_pending,
  'inputSha256',p.profile_write_input_sha256,'resultSha256',p.profile_write_result_sha256);
end $$;
-- No executor/member grant. This is an owner-only, closed-store review seam,
-- not an automatic acknowledgement or proof that an HTTP response was received.
create function alliance_avatar.review_profile_write(p_actor uuid,p_sequence bigint,p_input_sha256 text,p_result_sha256 text) returns boolean
language plpgsql security invoker set search_path='' set timezone='UTC' set datestyle='ISO, YMD' set lock_timeout='750ms' as $$
declare p alliance_avatar.creation_plans;disabled boolean;current_result jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' or current_setting('synchronous_commit')<>'on' or current_setting('fsync')<>'on' or current_setting('full_page_writes')<>'on'
 then raise insufficient_privilege using message='profile_review_unavailable';end if;
 select not enabled and not creation_enabled and not cleanup_enabled into strict disabled from alliance_avatar.control where id for update;
 if not disabled then raise insufficient_privilege using message='profile_review_unavailable';end if;
 select * into strict p from alliance_avatar.creation_plans where actor_id=p_actor and kind='profile' for update;
 if p_sequence is null or p_sequence<=0 or p.profile_write_sequence is distinct from p_sequence
  or p.profile_write_input_sha256 is distinct from p_input_sha256 or p.profile_write_result_sha256 is distinct from p_result_sha256
 then raise insufficient_privilege using message='profile_review_mismatch';end if;
 -- The owner already has DELETE here; this table lock needs no UPDATE grant
 -- on the immutable account mapping. Normal member writes are closed.
 lock table public.alliance_member_owners in share mode;
 perform 1 from public.alliance_member_owners where id=p.profile_id and user_id=p_actor;
 if not found then raise insufficient_privilege using message='profile_review_mismatch';end if;
 perform 1 from public.alliance_profiles where id=p.profile_id for update;
 if not found then raise insufficient_privilege using message='profile_review_mismatch';end if;
 current_result:=alliance_avatar.profile_write_current(p.profile_id);
 if not exists(select 1 from public.alliance_member_owners where id=p.profile_id and user_id=p_actor) or current_result is null or encode(sha256(convert_to(current_result::text,'UTF8')),'hex') is distinct from p_result_sha256
 then raise insufficient_privilege using message='profile_review_mismatch';end if;
 update alliance_avatar.creation_plans set profile_write_pending=false where actor_id=p_actor and kind='profile';
 return true;
end $$;
revoke all on function alliance_avatar.profile_write_current(uuid),alliance_avatar.finish_profile_session(uuid,uuid,jsonb,jsonb,jsonb),alliance_avatar.profile_write_status_session(uuid,uuid),alliance_avatar.review_profile_write(uuid,bigint,text,text) from public,anon,authenticated,service_role,alliance_avatar_executor;
grant execute on function alliance_avatar.finish_profile_session(uuid,uuid,jsonb,jsonb,jsonb),alliance_avatar.profile_write_status_session(uuid,uuid) to alliance_avatar_executor;
reset role;
