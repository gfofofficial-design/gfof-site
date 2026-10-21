-- Unapplied READ-ONLY extension after cleanup. No retry, purge, flag, table,
-- role/login or Storage request. Same trusted server-only execution boundary.
set local role alliance_avatar_owner;
create index alliance_avatar_operation_object on alliance_avatar.operations(object_id);
create index alliance_avatar_cleanup_object_history on alliance_avatar.cleanup_attempts(object_id,created_at);
create function alliance_avatar.cleanup_recovery(p_claim uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a alliance_avatar.cleanup_attempts;o alliance_avatar.objects;proof boolean;status text;
begin
  select * into a from alliance_avatar.cleanup_attempts where claim_id=p_claim;
  if not found then return jsonb_build_object('state','missing');end if;
  select * into strict o from alliance_avatar.objects where id=a.object_id;
  proof:=o.receipt is not null and o.deletion_receipt=jsonb_build_object('state','deleted','writeSettled',true,'receipt',o.receipt);
  proof:=coalesce(proof,false);
  status:=case
    when a.state='deleted' and o.state='deleted' and o.write_settled and proof and a.finished_at is not null and a.dispatched_at is not null then 'deleted'
    when a.state='claimed' and a.dispatched_at is null and o.state='cleanup' then case when a.expires_at<=statement_timestamp() then 'expired' else 'waiting' end
    when a.state='expired' and a.dispatched_at is null then 'expired'
    when a.state in('dispatched','unknown') and a.dispatched_at is not null and o.state='cleanup' then 'unknown'
    else 'inconsistent' end;
  return jsonb_build_object('state',status,'claimState',a.state,'objectState',o.state,
    'writeSettled',o.write_settled,'proofRecorded',proof,'dispatchRecorded',a.dispatched_at is not null);
end $$;
create function alliance_avatar.upload_recovery(p_operation uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare op alliance_avatar.operations;o alliance_avatar.objects;current_image boolean;proof boolean;status text;
begin
  select * into op from alliance_avatar.operations where id=p_operation and kind='replace';
  if not found then return jsonb_build_object('state','missing');end if;
  select * into strict o from alliance_avatar.objects where id=op.object_id;
  current_image:=exists(select 1 from alliance_avatar.heads where object_id=o.id);
  proof:=coalesce(o.receipt is not null and o.deletion_receipt=jsonb_build_object('state','deleted','writeSettled',true,'receipt',o.receipt),false);
  status:=case
    when current_image and o.state='active' and o.write_settled and o.verified and o.receipt is not null then 'current'
    when current_image then 'inconsistent'
    when o.state='deleted' and o.write_settled and proof then 'deleted'
    when o.state='deleted' and o.descriptor is null and o.receipt is null and o.deletion_receipt is null and op.state in('cancelled','stale') then 'never_dispatched'
    when o.state='reserved' and op.state='reserved' and not o.write_settled then 'reserved'
    when o.state='cleanup' and o.write_settled and o.receipt is not null then 'cleanup_pending'
    when o.state in('uploading','cleanup') and not o.write_settled then 'unsettled'
    else 'inconsistent' end;
  return jsonb_build_object('state',status,'operationState',op.state,'objectState',o.state,
    'writeSettled',o.write_settled,'proofRecorded',proof,'current',current_image);
end $$;
create function alliance_avatar.retention_review(p_before timestamptz,p_after uuid,p_limit integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare obj alliance_avatar.objects;items jsonb:='[]'::jsonb;changed timestamptz;reason text;open_work boolean;last_id uuid;more boolean:=false;
begin
  if p_before is null or p_before<timestamp with time zone '1970-01-01 00:00:00Z' or p_before>statement_timestamp() or p_after is null or p_limit is null or p_limit not between 1 and 20 then
    raise insufficient_privilege using message='avatar_unavailable';end if;
  for obj in select * from alliance_avatar.objects where id>p_after and created_at<=p_before order by id limit p_limit+1 loop
    if jsonb_array_length(items)=p_limit then more:=true;exit;end if;
    select greatest(obj.created_at,obj.settled_at,obj.deleted_at,
      (select h.removed_at from alliance_avatar.heads h where h.profile_id=obj.profile_id),
      (select max(greatest(a.created_at,a.expires_at,a.dispatched_at,a.finished_at)) from alliance_avatar.cleanup_attempts a where a.object_id=obj.id),
      (select max(greatest(op.created_at,op.expires_at)) from alliance_avatar.operations op where op.object_id=obj.id)) into changed;
    open_work:=exists(select 1 from alliance_avatar.cleanup_attempts where object_id=obj.id and state in('claimed','dispatched','unknown'))
      or exists(select 1 from alliance_avatar.operations where object_id=obj.id and state in('reserved','uploading'));
    reason:=case
      when exists(select 1 from alliance_avatar.heads where object_id=obj.id) then 'keep_current'
      when open_work then 'keep_open'
      when changed>p_before then 'keep_recent'
      when obj.state='deleted' and obj.write_settled and obj.receipt is not null and obj.deletion_receipt=jsonb_build_object('state','deleted','writeSettled',true,'receipt',obj.receipt) then 'review_deleted'
      when obj.state='deleted' and obj.descriptor is null and obj.receipt is null and obj.deletion_receipt is null then 'review_never_dispatched'
      else 'keep_uncertain' end;
    items:=items||jsonb_build_array(jsonb_build_object('objectId',obj.id,'reason',reason,'createdAt',obj.created_at,'lastChangedAt',changed));last_id:=obj.id;
  end loop;
  return jsonb_build_object('before',p_before,'items',items,'next',case when more then last_id else null end);
end $$;
revoke all on function alliance_avatar.cleanup_recovery(uuid),alliance_avatar.upload_recovery(uuid),alliance_avatar.retention_review(timestamptz,uuid,integer) from public,anon,authenticated,service_role,alliance_avatar_executor;
grant execute on function alliance_avatar.cleanup_recovery(uuid),alliance_avatar.upload_recovery(uuid),alliance_avatar.retention_review(timestamptz,uuid,integer) to alliance_avatar_executor;
reset role;
