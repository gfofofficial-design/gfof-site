-- Unapplied extension; requires profile and avatar-ledger candidates first.
-- No login/password/bucket/route. auth schema compatibility needs hosted review.
grant usage on schema auth to alliance_avatar_owner;
grant select(id,user_id,not_after) on auth.sessions to alliance_avatar_owner;
grant select(id,email_confirmed_at,is_anonymous,deleted_at,banned_until) on auth.users to alliance_avatar_owner;
grant select(moderation_state) on public.alliance_profiles to alliance_avatar_owner;
set local role alliance_avatar_owner;
create function alliance_avatar.require_session(p_actor uuid,p_session uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare pid uuid;
begin
  -- Indexed exact session/account lookup; no claim/user_metadata authorization.
  if p_actor is null or p_session is null or not exists(
    select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=p_session and s.user_id=p_actor and u.email_confirmed_at is not null
      and u.is_anonymous is false and u.deleted_at is null
      and (u.banned_until is null or u.banned_until<=clock_timestamp())
      and (s.not_after is null or s.not_after>clock_timestamp())
  ) then raise insufficient_privilege using message='avatar_unavailable';end if;
  pid:=alliance_avatar.live_profile(p_actor);
  if pid is null then raise insufficient_privilege using message='avatar_unavailable';end if;
  return pid;
end $$;
create function alliance_avatar.require_visible_session(p_actor uuid,p_session uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare pid uuid;
begin
  pid:=alliance_avatar.require_session(p_actor,p_session);
  if not exists(select 1 from public.alliance_profiles p where p.id=pid and p.moderation_state='visible') then
    raise insufficient_privilege using message='avatar_unavailable';end if;
  return pid;
end $$;
create function alliance_avatar.authorize_session(p_actor uuid,p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
  perform alliance_avatar.lock_enabled();pid:=alliance_avatar.require_session(p_actor,p_session);
  return jsonb_build_object('actorId',p_actor,'sessionId',p_session,'profileId',pid);
end $$;
create function alliance_avatar.mine_session(p_actor uuid,p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin perform alliance_avatar.require_session(p_actor,p_session);return alliance_avatar.mine(p_actor);end $$;
create function alliance_avatar.reserve_session(p_actor uuid,p_session uuid,p_operation uuid,p_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
begin perform alliance_avatar.lock_enabled();perform alliance_avatar.require_visible_session(p_actor,p_session);return alliance_avatar.reserve(p_actor,p_operation,p_version);end $$;
create function alliance_avatar.claim_upload_session(p_actor uuid,p_session uuid,p_operation uuid,p_descriptor jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin perform alliance_avatar.lock_enabled();perform alliance_avatar.require_visible_session(p_actor,p_session);return alliance_avatar.claim_upload(p_actor,p_operation,p_descriptor);end $$;
create function alliance_avatar.commit_upload_session(p_actor uuid,p_session uuid,p_operation uuid,p_result jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin perform alliance_avatar.lock_enabled();perform alliance_avatar.require_visible_session(p_actor,p_session);return alliance_avatar.commit_upload(p_actor,p_operation,p_result);end $$;
create function alliance_avatar.cancel_reserved_session(p_actor uuid,p_session uuid,p_operation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin perform alliance_avatar.lock_enabled();perform alliance_avatar.require_session(p_actor,p_session);return alliance_avatar.cancel_reserved(p_actor,p_operation);end $$;
create function alliance_avatar.remove_image_session(p_actor uuid,p_session uuid,p_operation uuid,p_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
begin perform alliance_avatar.lock_enabled();perform alliance_avatar.require_session(p_actor,p_session);return alliance_avatar.remove_image(p_actor,p_operation,p_version);end $$;
create function alliance_avatar.operation_receipt_session(p_actor uuid,p_session uuid,p_operation uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin perform alliance_avatar.require_session(p_actor,p_session);return alliance_avatar.operation_receipt(p_actor,p_operation);end $$;
revoke all on function alliance_avatar.require_visible_session(uuid,uuid),alliance_avatar.require_session(uuid,uuid),alliance_avatar.authorize_session(uuid,uuid),alliance_avatar.mine_session(uuid,uuid),alliance_avatar.reserve_session(uuid,uuid,uuid,bigint),alliance_avatar.claim_upload_session(uuid,uuid,uuid,jsonb),alliance_avatar.commit_upload_session(uuid,uuid,uuid,jsonb),alliance_avatar.cancel_reserved_session(uuid,uuid,uuid),alliance_avatar.remove_image_session(uuid,uuid,uuid,bigint),alliance_avatar.operation_receipt_session(uuid,uuid,uuid) from public,anon,authenticated,service_role,alliance_avatar_executor;
grant execute on function alliance_avatar.authorize_session(uuid,uuid),alliance_avatar.mine_session(uuid,uuid),alliance_avatar.reserve_session(uuid,uuid,uuid,bigint),alliance_avatar.claim_upload_session(uuid,uuid,uuid,jsonb),alliance_avatar.commit_upload_session(uuid,uuid,uuid,jsonb),alliance_avatar.cancel_reserved_session(uuid,uuid,uuid),alliance_avatar.remove_image_session(uuid,uuid,uuid,bigint),alliance_avatar.operation_receipt_session(uuid,uuid,uuid) to alliance_avatar_executor;
-- The execution login cannot bypass session checks using the older actor-only API.
revoke execute on function alliance_avatar.mine(uuid),alliance_avatar.reserve(uuid,uuid,bigint),alliance_avatar.claim_upload(uuid,uuid,jsonb),alliance_avatar.commit_upload(uuid,uuid,jsonb),alliance_avatar.cancel_reserved(uuid,uuid),alliance_avatar.remove_image(uuid,uuid,bigint),alliance_avatar.operation_receipt(uuid,uuid) from alliance_avatar_executor;
-- Existing unpublished settlement/cleanup functions remain trusted server-only,
-- so logout/account removal cannot discard a known provider acknowledgement.
reset role;
