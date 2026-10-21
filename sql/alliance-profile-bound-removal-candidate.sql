-- UNAPPLIED after the anchored-removal extension. No role, LOGIN or table.
-- Opt-in entrypoint; existing legacy entries remain separate until adoption.
set local role alliance_avatar_owner;
create function alliance_avatar.prepare_profile_bound_anchored_removal_session(
 p_actor uuid,p_session uuid,p_operation uuid,p_version bigint,p_profile uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare op alliance_avatar.operations;r jsonb;
begin
 perform alliance_avatar.lock_enabled();
 perform alliance_avatar.require_removal_session(p_actor,p_session);
 if p_profile is null or p_operation is null or p_version is null or p_version<0 then
  raise insufficient_privilege using message='profile_removal_binding_unavailable';
 end if;
 select * into op from alliance_avatar.operations where id=p_operation;
 if found then
  -- Replay binds to the original immutable plan even after profile cascade.
  if op.removal_actor is distinct from p_actor or op.profile_id is distinct from p_profile
   or op.expected_version is distinct from p_version or op.removal_manifest->>'kind' is distinct from 'profile' then
   raise insufficient_privilege using message='profile_removal_binding_unavailable';
  end if;
 else
  -- Check identity under the same control lock as preparation, before any
  -- operation, quota or journal dispatch. Version equality alone is not enough.
  if alliance_avatar.require_session(p_actor,p_session) is distinct from p_profile then
   raise insufficient_privilege using message='profile_removal_binding_unavailable';
  end if;
 end if;
 r:=alliance_avatar.prepare_anchored_removal_session(p_actor,p_session,p_operation,p_version,'profile');
 if r#>>'{plan,profileId}' is distinct from p_profile::text then
  raise insufficient_privilege using message='profile_removal_binding_unavailable';
 end if;
 return r;
end $$;
revoke all on function alliance_avatar.prepare_profile_bound_anchored_removal_session(uuid,uuid,uuid,bigint,uuid)
 from public,anon,authenticated,service_role,alliance_avatar_executor;
grant execute on function alliance_avatar.prepare_profile_bound_anchored_removal_session(uuid,uuid,uuid,bigint,uuid)
 to alliance_avatar_executor;
reset role;
