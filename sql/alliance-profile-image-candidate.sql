-- Unapplied candidate for the optional profile image route. Apply in a
-- transaction after creation admission and anchored removal.
set local role alliance_avatar_owner;

create function alliance_avatar.current_image_receipt_session(
  p_actor uuid, p_session uuid, p_object uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid;
  obj alliance_avatar.objects;
begin
  pid := alliance_avatar.require_session(p_actor, p_session);
  if not exists (select 1 from alliance_avatar.control where id and enabled) then
    raise insufficient_privilege using message = 'avatar_unavailable';
  end if;
  select o.* into obj
  from alliance_avatar.heads h
  join alliance_avatar.objects o on o.id = h.object_id and o.profile_id = h.profile_id
  where h.profile_id = pid and h.object_id = p_object and h.removed_at is null
    and o.state = 'active' and o.write_settled and o.verified and o.deletion_receipt is null;
  if not found then raise insufficient_privilege using message = 'avatar_unavailable'; end if;
  return jsonb_build_object('state', 'committed', 'profileId', obj.profile_id,
    'objectId', obj.id, 'key', 'v1/' || obj.profile_id || '/' || obj.id || '.png',
    'writeSettled', obj.write_settled, 'verified', obj.verified, 'receipt', obj.receipt,
    'descriptor', obj.descriptor, 'deletionReceipt', obj.deletion_receipt);
end $$;

create function alliance_avatar.prepare_profile_bound_image_session(
  p_actor uuid, p_session uuid, p_operation uuid, p_version bigint, p_profile uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform alliance_avatar.lock_enabled();
  if alliance_avatar.require_visible_session(p_actor, p_session) is distinct from p_profile then
    raise insufficient_privilege using message = 'avatar_unavailable';
  end if;
  return alliance_avatar.prepare_image_session(p_actor, p_session, p_operation, p_version);
end $$;

create function alliance_avatar.prepare_profile_bound_image_removal_session(
  p_actor uuid, p_session uuid, p_operation uuid, p_version bigint, p_profile uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform alliance_avatar.lock_enabled();
  if alliance_avatar.require_session(p_actor, p_session) is distinct from p_profile then
    raise insufficient_privilege using message = 'avatar_unavailable';
  end if;
  result := alliance_avatar.prepare_anchored_removal_session(p_actor, p_session, p_operation, p_version, 'image');
  if result #>> '{plan,profileId}' is distinct from p_profile::text then
    raise insufficient_privilege using message = 'avatar_unavailable';
  end if;
  return result;
end $$;

revoke all on function alliance_avatar.current_image_receipt_session(uuid,uuid,uuid),
  alliance_avatar.prepare_profile_bound_image_session(uuid,uuid,uuid,bigint,uuid),
  alliance_avatar.prepare_profile_bound_image_removal_session(uuid,uuid,uuid,bigint,uuid)
  from public, anon, authenticated, service_role, alliance_avatar_executor;
grant execute on function alliance_avatar.current_image_receipt_session(uuid,uuid,uuid),
  alliance_avatar.prepare_profile_bound_image_session(uuid,uuid,uuid,bigint,uuid),
  alliance_avatar.prepare_profile_bound_image_removal_session(uuid,uuid,uuid,bigint,uuid)
  to alliance_avatar_executor;
reset role;
