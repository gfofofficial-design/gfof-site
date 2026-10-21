-- UNAPPLIED alternative save protocol; NOT included in a hosted installer.
-- Requires the creation admission and legacy write fence on an empty store.
-- Revision comparison replaces delivery inference, not deletion/recovery checks.
do $$ begin
 if exists(select 1 from alliance_avatar.creation_plans) or exists(select 1 from public.alliance_profiles)
  or exists(select 1 from alliance_avatar.control where enabled or creation_enabled or cleanup_enabled)
 then raise exception 'Empty disabled member store required for revision saves';end if;
end $$;
set local role alliance_avatar_owner;
alter table alliance_avatar.control add column profile_revision_enabled boolean not null default false;
alter table alliance_avatar.creation_plans
 add column profile_last_operation uuid,
 add column profile_last_expected bigint,
 add column profile_last_result jsonb;
alter table alliance_avatar.creation_plans add constraint profile_revision_receipt_bound check(
 (profile_last_operation is null and profile_last_expected is null and profile_last_result is null)
 or (kind='profile' and profile_write_sequence>0 and not profile_write_pending
  and profile_last_operation is not null and profile_last_operation<>'00000000-0000-0000-0000-000000000000'::uuid
  and profile_last_expected is not null and profile_last_expected=profile_write_sequence-1
  and profile_last_result is not null and jsonb_typeof(profile_last_result)='object'
  and (profile_last_result->>'id') is not distinct from profile_id::text));
-- A new-mode store must not accept an older caller that omits its revision.
alter function alliance_avatar.finish_profile_session(uuid,uuid,jsonb,jsonb,jsonb) rename to finish_profile_review_session;
revoke all on function alliance_avatar.finish_profile_review_session(uuid,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role,alliance_avatar_executor;
create function alliance_avatar.finish_profile_session(p_actor uuid,p_session uuid,p_plan jsonb,p_input jsonb,p_event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 perform alliance_avatar.creation_live(p_actor,p_session);
 if exists(select 1 from alliance_avatar.control where id and profile_revision_enabled)
 then raise insufficient_privilege using message='profile_revision_required';end if;
 return alliance_avatar.finish_profile_review_session(p_actor,p_session,p_plan,p_input,p_event);
end $$;
create function alliance_avatar.finish_profile_revision_session(p_actor uuid,p_session uuid,p_plan jsonb,p_input jsonb,p_event jsonb,p_operation uuid,p_expected bigint) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' set datestyle='ISO, YMD' as $$
declare p alliance_avatar.creation_plans;saved jsonb;input_hash text;current_result jsonb;
begin
 -- Includes live exact Auth session, durable settings and the shared control
 -- lock used by creation/removal. No remote call runs inside this transaction.
 perform alliance_avatar.creation_live(p_actor,p_session);
 if not exists(select 1 from alliance_avatar.control where id and profile_revision_enabled)
  or p_operation is null or p_operation='00000000-0000-0000-0000-000000000000'::uuid
  or p_expected is null or p_expected<0 or p_expected>=9007199254740991
 then raise insufficient_privilege using message='profile_revision_unavailable';end if;
 p:=alliance_avatar.check_creation_plan(p_actor,p_plan);
 if p.kind<>'profile' then raise insufficient_privilege using message='profile_revision_unavailable';end if;
 perform alliance_avatar.check_creation_event(p,p_event);
 select * into strict p from alliance_avatar.creation_plans where actor_id=p_actor and kind='profile' for update;
 -- Never convert a legacy hold, including an owner-reviewed legacy write, into
 -- this protocol. Adoption needs a separately reviewed migration/recovery plan.
 if p.profile_write_pending or p.profile_write_sequence>0 and p.profile_last_operation is null
 then raise insufficient_privilege using message='profile_write_review_required';end if;
 input_hash:=encode(sha256(convert_to(p_input::text,'UTF8')),'hex');
 if p.profile_write_sequence>0 then
  current_result:=alliance_avatar.profile_write_current(p.profile_id);
  if current_result is distinct from p.profile_last_result
   or encode(sha256(convert_to(current_result::text,'UTF8')),'hex') is distinct from p.profile_write_result_sha256
  then raise insufficient_privilege using message='profile_revision_state_changed';end if;
 end if;
 if p.profile_last_operation=p_operation then
  if p.profile_last_expected is distinct from p_expected or p.profile_write_input_sha256 is distinct from input_hash
  then return jsonb_build_object('state','conflict','revision',p.profile_write_sequence);end if;
  -- Only the last exact operation can be read back, never re-executed. A replay
  -- after a later revision is a conflict, even when its payload matches.
  return jsonb_build_object('state','replayed','revision',p.profile_write_sequence,'operationId',p_operation,'profile',p.profile_last_result);
 end if;
 if p.profile_write_sequence<>p_expected then return jsonb_build_object('state','conflict','revision',p.profile_write_sequence);end if;
 saved:=alliance_avatar.finish_profile_unfenced(p_actor,p_session,p_plan,p_input,p_event);
 update alliance_avatar.creation_plans set profile_write_sequence=profile_write_sequence+1,
  profile_write_pending=false,profile_write_input_sha256=input_hash,
  profile_write_result_sha256=encode(sha256(convert_to(saved::text,'UTF8')),'hex'),
  profile_last_operation=p_operation,profile_last_expected=p_expected,profile_last_result=saved
 where actor_id=p_actor and kind='profile';
 return jsonb_build_object('state','saved','revision',p_expected+1,'operationId',p_operation,'profile',saved);
end $$;
revoke all on function alliance_avatar.finish_profile_session(uuid,uuid,jsonb,jsonb,jsonb),alliance_avatar.finish_profile_revision_session(uuid,uuid,jsonb,jsonb,jsonb,uuid,bigint) from public,anon,authenticated,service_role,alliance_avatar_executor;
grant execute on function alliance_avatar.finish_profile_session(uuid,uuid,jsonb,jsonb,jsonb),alliance_avatar.finish_profile_revision_session(uuid,uuid,jsonb,jsonb,jsonb,uuid,bigint) to alliance_avatar_executor;
reset role;
