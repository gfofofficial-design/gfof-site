-- Unapplied extension after the profile/avatar/session candidates. No schedule,
-- login, credential, bucket or Storage metadata mutation. Cleanup defaults OFF.
alter table alliance_avatar.control add column cleanup_enabled boolean not null default false;
set local role alliance_avatar_owner;
create index alliance_avatar_current_object on alliance_avatar.heads(object_id) where object_id is not null;
create table alliance_avatar.cleanup_attempts(
  claim_id uuid primary key,object_id uuid not null references alliance_avatar.objects(id),
  state text not null check(state in('claimed','expired','dispatched','unknown','deleted')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp()+interval '2 minutes',
  dispatched_at timestamptz,finished_at timestamptz
);
create unique index alliance_avatar_cleanup_one_open on alliance_avatar.cleanup_attempts(object_id)
  where state in('claimed','dispatched','unknown');
alter table alliance_avatar.cleanup_attempts enable row level security;
alter table alliance_avatar.cleanup_attempts force row level security;
create policy owner_only on alliance_avatar.cleanup_attempts to alliance_avatar_owner using(true) with check(true);
revoke all on alliance_avatar.cleanup_attempts from public,anon,authenticated,service_role,alliance_avatar_executor;

create function alliance_avatar.claim_cleanup(p_claim uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare attempt alliance_avatar.cleanup_attempts;obj alliance_avatar.objects;
begin
  if p_claim is null then raise insufficient_privilege using message='avatar_unavailable';end if;
  perform 1 from alliance_avatar.control where id and cleanup_enabled for update;
  if not found then raise insufficient_privilege using message='avatar_unavailable';end if;
  select * into attempt from alliance_avatar.cleanup_attempts where claim_id=p_claim;
  if found then return jsonb_build_object('granted',false,'state',attempt.state);end if;
  -- Expire only grants that never authorized a provider dispatch. Never recycle
  -- dispatched/unknown work: a slow old writer may still be completing it.
  update alliance_avatar.cleanup_attempts set state='expired' where state='claimed' and expires_at<=clock_timestamp();
  if (select count(*) from alliance_avatar.cleanup_attempts where state in('claimed','dispatched','unknown'))>=2 then
    return jsonb_build_object('granted',false,'state','busy');end if;
  select * into obj from alliance_avatar.objects o where o.state='cleanup' and o.write_settled and o.receipt is not null
    and not exists(select 1 from alliance_avatar.heads h where h.object_id=o.id)
    and not exists(select 1 from alliance_avatar.cleanup_attempts a where a.object_id=o.id and a.state in('claimed','dispatched','unknown'))
    order by o.created_at,o.id limit 1;
  if not found then return jsonb_build_object('granted',false,'state','empty');end if;
  insert into alliance_avatar.cleanup_attempts(claim_id,object_id,state) values(p_claim,obj.id,'claimed') returning * into attempt;
  return jsonb_build_object('granted',true,'claimId',p_claim,'objectId',obj.id,'receipt',obj.receipt,'expiresAt',attempt.expires_at);
end $$;

create function alliance_avatar.begin_cleanup(p_claim uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare attempt alliance_avatar.cleanup_attempts;obj alliance_avatar.objects;
begin
  perform 1 from alliance_avatar.control where id and cleanup_enabled for update;
  if not found then raise insufficient_privilege using message='avatar_unavailable';end if;
  select * into attempt from alliance_avatar.cleanup_attempts where claim_id=p_claim;
  if not found then raise insufficient_privilege using message='avatar_unavailable';end if;
  if attempt.state<>'claimed' then return jsonb_build_object('dispatch',false,'state',attempt.state);end if;
  if attempt.expires_at<=clock_timestamp() then
    update alliance_avatar.cleanup_attempts set state='expired' where claim_id=p_claim;
    return jsonb_build_object('dispatch',false,'state','expired');end if;
  select * into obj from alliance_avatar.objects where id=attempt.object_id;
  if obj.state<>'cleanup' or not obj.write_settled or obj.receipt is null or exists(select 1 from alliance_avatar.heads where object_id=obj.id) then
    raise insufficient_privilege using message='avatar_not_removable';end if;
  update alliance_avatar.cleanup_attempts set state='dispatched',dispatched_at=clock_timestamp() where claim_id=p_claim;
  return jsonb_build_object('dispatch',true,'claimId',p_claim,'objectId',obj.id,'receipt',obj.receipt);
end $$;

create function alliance_avatar.authorize_cleanup(p_claim uuid,p_receipt jsonb) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from alliance_avatar.cleanup_attempts a join alliance_avatar.objects o on o.id=a.object_id
    where a.claim_id=p_claim and a.state='dispatched' and o.state='cleanup' and o.write_settled and o.receipt=p_receipt
      and exists(select 1 from alliance_avatar.control where id and cleanup_enabled)
      and not exists(select 1 from alliance_avatar.heads where object_id=o.id));
$$;
create function alliance_avatar.unknown_cleanup(p_claim uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from alliance_avatar.control where id for update;
  update alliance_avatar.cleanup_attempts set state='unknown' where claim_id=p_claim and state='dispatched';
  if not found and not exists(select 1 from alliance_avatar.cleanup_attempts where claim_id=p_claim and state in('unknown','deleted')) then
    raise insufficient_privilege using message='avatar_unavailable';end if;
end $$;
create function alliance_avatar.finish_cleanup(p_claim uuid,p_result jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare attempt alliance_avatar.cleanup_attempts;
begin
  -- Recording a known deletion remains possible after cleanup is switched off.
  perform 1 from alliance_avatar.control where id for update;
  select * into attempt from alliance_avatar.cleanup_attempts where claim_id=p_claim;
  if not found or attempt.state not in('dispatched','unknown','deleted') then raise insufficient_privilege using message='avatar_unavailable';end if;
  perform alliance_avatar.ack_deleted(attempt.object_id,p_result);
  update alliance_avatar.cleanup_attempts set state='deleted',finished_at=coalesce(finished_at,clock_timestamp()) where claim_id=p_claim;
end $$;
revoke all on function alliance_avatar.claim_cleanup(uuid),alliance_avatar.begin_cleanup(uuid),alliance_avatar.authorize_cleanup(uuid,jsonb),alliance_avatar.unknown_cleanup(uuid),alliance_avatar.finish_cleanup(uuid,jsonb) from public,anon,authenticated,service_role,alliance_avatar_executor;
grant execute on function alliance_avatar.claim_cleanup(uuid),alliance_avatar.begin_cleanup(uuid),alliance_avatar.authorize_cleanup(uuid,jsonb),alliance_avatar.unknown_cleanup(uuid),alliance_avatar.finish_cleanup(uuid,jsonb) to alliance_avatar_executor;
-- Receipt-only acknowledgement/selection cannot bypass an exclusive attempt.
revoke execute on function alliance_avatar.ack_deleted(uuid,jsonb),alliance_avatar.cleanup_batch(integer) from alliance_avatar_executor;
reset role;
