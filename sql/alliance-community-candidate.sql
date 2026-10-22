-- Source-only private collaboration extension; NOT a hosted migration/installer.
-- Caller owns one transaction, has the locked member-owner SET and REFERENCES
-- grants, and creates this private schema before switching to its owner.
-- No new role, password, LOGIN, publication, mail or automatic serving transition.
set local role alliance_avatar_owner;
create table alliance_community.control (
 id boolean primary key default true check(id),enabled boolean not null default false,
 mutations integer not null default 0 check(mutations between 0 and 1024),
 invitations integer not null default 0 check(invitations between 0 and 128),
 contributions integer not null default 0 check(contributions between 0 and 512)
);
insert into alliance_community.control(id) values(true);
create table alliance_community.challenges (
 id uuid primary key, sender uuid not null references public.alliance_profiles(id) on delete cascade,
 recipient uuid not null references public.alliance_profiles(id) on delete cascade,
 kit text not null check(kit in('explain','feedback','translate','research','roundtable','remix','teach-back','prototype')),
 scope text not null check(scope in('members','communities')),days integer not null check(days in(3,7,14,30)),goal integer not null check(goal between 1 and 20),
 note text not null check(char_length(note)<=400),status text not null default 'invited' check(status in('invited','active','declined','cancelled','complete')),
 revision integer not null default 1 check(revision between 1 and 1025),
 created_at timestamptz not null default clock_timestamp(),accepted_at timestamptz,ends_at timestamptz,
 winner uuid,check(sender<>recipient),check(winner is null or winner in(sender,recipient)),
 check((accepted_at is null and ends_at is null and status in('invited','declined','cancelled') and winner is null)
  or (accepted_at is not null and ends_at=accepted_at+days*interval '1 day' and status in('active','complete') and (status='complete')=(winner is not null)))
);
create index community_sender on alliance_community.challenges(sender,id);
create index community_recipient on alliance_community.challenges(recipient,id);
create table alliance_community.contributions (
 id uuid primary key,challenge_id uuid not null references alliance_community.challenges(id) on delete cascade,
 owner uuid not null references public.alliance_profiles(id) on delete cascade,
 note text not null check(char_length(note) between 10 and 240),status text not null default 'pending' check(status in('pending','acknowledged','declined')),
 created_at timestamptz not null default clock_timestamp(),reviewed_at timestamptz,
 check((status='pending')=(reviewed_at is null)),unique(challenge_id,id)
);
create index community_proof_challenge on alliance_community.contributions(challenge_id,created_at,id);
create index community_proof_owner on alliance_community.contributions(owner);
create table alliance_community.operations (
 id uuid primary key,actor uuid not null references public.alliance_profiles(id) on delete cascade,
 challenge_id uuid not null references alliance_community.challenges(id) on delete cascade,
 request_sha256 text not null check(request_sha256 ~ '^[0-9a-f]{64}$'),revision integer not null check(revision between 1 and 1025)
);
create index community_operation_actor on alliance_community.operations(actor);
create index community_operation_challenge on alliance_community.operations(challenge_id);
create table alliance_community.blocks (
 owner uuid not null references public.alliance_profiles(id) on delete cascade,
 target uuid not null references public.alliance_profiles(id) on delete cascade,
 primary key(owner,target),check(owner<>target)
);
create index community_block_target on alliance_community.blocks(target);
do $$ declare t text; begin
 foreach t in array array['control','challenges','contributions','operations','blocks'] loop
  execute format('alter table alliance_community.%I enable row level security',t);
  execute format('alter table alliance_community.%I force row level security',t);
  execute format('revoke all on alliance_community.%I from public,anon,authenticated,service_role,alliance_avatar_executor',t);
  execute format('create policy owner_only on alliance_community.%I to alliance_avatar_owner using(true) with check(true)',t);
 end loop;
end $$;
create function alliance_community.clean_text(v text,lo integer,hi integer) returns text
language plpgsql immutable security invoker set search_path='' as $$ begin
 if v is null or char_length(v) not between lo and hi or v<>btrim(v) or octet_length(v)>hi*4
  or v ~ '[<>]' or v ~ U&'[\0001-\0008\000B\000C\000E-\001F\007F\202A-\202E\2066-\2069]'
 then raise insufficient_privilege using message='community_invalid';end if;return v;
end $$;
create function alliance_community.member(p_actor uuid,p_session uuid,positive boolean) returns uuid
language plpgsql security invoker set search_path='' as $$ declare pid uuid; begin
 if current_setting('synchronous_commit')<>'on' or current_setting('fsync')<>'on' or current_setting('full_page_writes')<>'on'
 then raise insufficient_privilege using message='community_unavailable';end if;
 -- Same lock order as member mutation/removal: member control, community control.
 perform alliance_avatar.lock_enabled();pid:=alliance_avatar.require_session(p_actor,p_session);
 perform 1 from alliance_community.control where id and enabled for update;
 if not found then raise insufficient_privilege using message='community_unavailable';end if;
 if positive and not exists(select 1 from public.alliance_profiles where id=pid and moderation_state='visible')
 then raise insufficient_privilege using message='community_unavailable';end if;return pid;
end $$;
create function alliance_community.visible(a uuid,b uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select not exists(select 1 from alliance_community.blocks where (owner=a and target=b) or (owner=b and target=a))
 and (select count(*)=2 from public.alliance_profiles where id in(a,b) and moderation_state='visible')
$$;
create function alliance_community.snapshot(p_id uuid,p_member uuid) returns jsonb
language plpgsql stable security invoker set search_path='' set timezone='UTC' set datestyle='ISO, YMD' as $$
declare c alliance_community.challenges; begin
 select * into c from alliance_community.challenges where id=p_id and p_member in(sender,recipient);
 if not found or not alliance_community.visible(c.sender,c.recipient) then raise insufficient_privilege using message='community_unavailable';end if;
 return jsonb_build_object('id',c.id,'from',c.sender,'to',c.recipient,'kit',c.kit,'scope',c.scope,'days',c.days,'goal',c.goal,'note',c.note,
  'status',case when c.status='active' and c.ends_at<=clock_timestamp() then 'expired' else c.status end,'revision',c.revision,'winner',c.winner,
  'createdAt',to_char(c.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'acceptedAt',case when c.accepted_at is not null then to_char(c.accepted_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
  'endsAt',case when c.ends_at is not null then to_char(c.ends_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
  'proofs',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'owner',p.owner,'note',p.note,'status',p.status) order by p.created_at,p.id) from alliance_community.contributions p where p.challenge_id=c.id),'[]'::jsonb));
end $$;
create function alliance_community.read_session(p_actor uuid,p_session uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ declare pid uuid; begin
 pid:=alliance_community.member(p_actor,p_session,false);return alliance_community.snapshot(p_id,pid);
end $$;
create function alliance_community.list_session(p_actor uuid,p_session uuid,p_after uuid,p_limit integer) returns jsonb
language plpgsql security definer set search_path='' as $$ declare pid uuid;ids uuid[];n integer;items jsonb:='[]';i integer; begin
 pid:=alliance_community.member(p_actor,p_session,false);
 if p_limit is null or p_limit<1 or p_limit>5 then raise insufficient_privilege using message='community_invalid';end if;
 select array_agg(x.id order by x.id) into ids from(select c.id from alliance_community.challenges c
  where pid in(c.sender,c.recipient) and (p_after is null or c.id>p_after) and alliance_community.visible(c.sender,c.recipient)
  order by c.id limit p_limit+1)x;
 n:=coalesce(array_length(ids,1),0);
 for i in 1..least(n,p_limit) loop items:=items||jsonb_build_array(alliance_community.snapshot(ids[i],pid));end loop;
 return jsonb_build_object('items',items,'next',case when n>p_limit then ids[p_limit] else null end);
end $$;
-- One fixed dispatcher, no SQL identifiers learned from JSON. Every mutation
-- carries an operation ID and revision; receipts contain hashes/IDs, never text.
create function alliance_community.change_session(p_actor uuid,p_session uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' set datestyle='ISO, YMD' as $$
declare pid uuid;op uuid;cid uuid;expected integer;action text;fingerprint text;prior alliance_community.operations;c alliance_community.challenges;
 target uuid;proof uuid;v_note text;v_kit text;v_scope text;v_days integer;v_goal integer;stamp timestamptz;affected integer;
begin
 if p_input is null or jsonb_typeof(p_input)<>'object' or not(p_input ?& array['operationId','challengeId','revision','action'])
  or jsonb_typeof(p_input->'operationId')<>'string' or jsonb_typeof(p_input->'challengeId')<>'string' or jsonb_typeof(p_input->'revision')<>'number' or jsonb_typeof(p_input->'action')<>'string'
 then raise insufficient_privilege using message='community_invalid';end if;
 op:=(p_input->>'operationId')::uuid;cid:=(p_input->>'challengeId')::uuid;expected:=(p_input->>'revision')::integer;action:=p_input->>'action';
 if op='00000000-0000-0000-0000-000000000000'::uuid or cid='00000000-0000-0000-0000-000000000000'::uuid or expected<0 or expected>1024
  or (p_input->>'revision')::numeric<>expected or octet_length(p_input::text)>4096
  or action not in('invite','accept','decline','cancel','contribute','acknowledge','reject')
 then raise insufficient_privilege using message='community_invalid';end if;
 if (select count(*) from jsonb_object_keys(p_input))<>(case action when 'invite' then 11 when 'contribute' then 5 when 'acknowledge' then 5 when 'reject' then 5 else 4 end)
  or (action='invite' and not(p_input ?& array['target','kit','scope','days','goal','note','format']))
  or (action='contribute' and not(p_input ? 'note')) or (action in('acknowledge','reject') and not(p_input ? 'proofId'))
 then raise insufficient_privilege using message='community_invalid';end if;
 pid:=alliance_community.member(p_actor,p_session,action not in('cancel','decline'));
 fingerprint:=encode(sha256(convert_to(p_input::text,'UTF8')),'hex');
 select * into prior from alliance_community.operations where id=op;
 if found then
  if prior.actor<>pid or prior.challenge_id<>cid or prior.request_sha256<>fingerprint then raise insufficient_privilege using message='community_operation_changed';end if;
  select * into strict c from alliance_community.challenges where id=cid;
  if c.revision<>prior.revision then return jsonb_build_object('state','conflict','revision',c.revision);end if;
  return jsonb_build_object('state','replayed','operationId',op,'challenge',alliance_community.snapshot(cid,pid));
 end if;
 if (select mutations>=1024 from alliance_community.control where id) then raise insufficient_privilege using message='community_full';end if;
 if action='invite' then
  if op<>cid or expected<>0 or p_input->'format'<>'1'::jsonb or jsonb_typeof(p_input->'target')<>'string'
   or jsonb_typeof(p_input->'kit')<>'string' or jsonb_typeof(p_input->'scope')<>'string'
   or jsonb_typeof(p_input->'days')<>'number' or jsonb_typeof(p_input->'goal')<>'number' or jsonb_typeof(p_input->'note')<>'string'
  then raise insufficient_privilege using message='community_invalid';end if;
  target:=(p_input->>'target')::uuid;v_kit:=p_input->>'kit';v_scope:=p_input->>'scope';v_days:=(p_input->>'days')::integer;v_goal:=(p_input->>'goal')::integer;
  v_note:=alliance_community.clean_text(p_input->>'note',0,400);
  if pid=target or not alliance_community.visible(pid,target) or not exists(select 1 from public.alliance_profiles where id=target and listed)
   or (p_input->>'days')::numeric<>v_days or (p_input->>'goal')::numeric<>v_goal or v_days not in(3,7,14,30) or v_goal not between 1 and 20
   or v_kit not in('explain','feedback','translate','research','roundtable','remix','teach-back','prototype') or v_scope not in('members','communities')
   or (v_scope='communities' and not exists(select 1 from public.alliance_profiles a,public.alliance_profiles b where a.id=pid and b.id=target and a.community<>'' and b.community<>'' and lower(a.community)<>lower(b.community)))
   or exists(select 1 from alliance_community.challenges where kit=v_kit and sender in(pid,target) and recipient in(pid,target) and (status='invited' or status='active' and ends_at>clock_timestamp()))
   or (select invitations>=128 from alliance_community.control where id)
  then raise insufficient_privilege using message='community_invitation_unavailable';end if;
  insert into alliance_community.challenges(id,sender,recipient,kit,scope,days,goal,note) values(cid,pid,target,v_kit,v_scope,v_days,v_goal,v_note);
  update alliance_community.control set invitations=invitations+1 where id;
 else
  select * into c from alliance_community.challenges where id=cid and pid in(sender,recipient) for update;
  if not found or not alliance_community.visible(c.sender,c.recipient) then raise insufficient_privilege using message='community_unavailable';end if;
  if c.revision<>expected then return jsonb_build_object('state','conflict','revision',c.revision);end if;
  if action in('accept','decline','cancel') then
   if c.status<>'invited' or (action='cancel' and c.sender<>pid) or (action<>'cancel' and c.recipient<>pid) then raise insufficient_privilege using message='community_consent_required';end if;
   stamp:=clock_timestamp();update alliance_community.challenges set status=case action when 'accept' then 'active' when 'decline' then 'declined' else 'cancelled' end,
    accepted_at=case when action='accept' then stamp end,ends_at=case when action='accept' then stamp+c.days*interval '1 day' end where id=cid;
  else
   if c.status<>'active' or c.ends_at<=clock_timestamp() then raise insufficient_privilege using message='community_not_active';end if;
   if action='contribute' then
    if jsonb_typeof(p_input->'note')<>'string' then raise insufficient_privilege using message='community_invalid';end if;
    v_note:=alliance_community.clean_text(p_input->>'note',10,240);
    if (select contributions>=512 from alliance_community.control where id)
     or (select count(*) from alliance_community.contributions where challenge_id=cid and owner=pid)>=c.goal+3
     or exists(select 1 from alliance_community.contributions p where p.challenge_id=cid and p.owner=pid and lower(p.note)=lower(v_note))
    then raise insufficient_privilege using message='community_contribution_unavailable';end if;
    insert into alliance_community.contributions(id,challenge_id,owner,note) values(op,cid,pid,v_note);
    update alliance_community.control set contributions=contributions+1 where id;
   else
    if jsonb_typeof(p_input->'proofId')<>'string' then raise insufficient_privilege using message='community_invalid';end if;proof:=(p_input->>'proofId')::uuid;
    update alliance_community.contributions set status=case when action='acknowledge' then 'acknowledged' else 'declined' end,reviewed_at=clock_timestamp()
     where id=proof and challenge_id=cid and owner<>pid and owner in(c.sender,c.recipient) and status='pending';
    get diagnostics affected=row_count;if affected<>1 then raise insufficient_privilege using message='community_peer_required';end if;
    if action='acknowledge' and (select count(*) from alliance_community.contributions p where p.challenge_id=cid and p.owner=(select owner from alliance_community.contributions where id=proof) and p.status='acknowledged')>=c.goal
    then update alliance_community.challenges set status='complete',winner=(select owner from alliance_community.contributions where id=proof) where id=cid;end if;
   end if;
  end if;
  update alliance_community.challenges set revision=revision+1 where id=cid;
 end if;
 select * into strict c from alliance_community.challenges where id=cid;
 insert into alliance_community.operations(id,actor,challenge_id,request_sha256,revision) values(op,pid,cid,fingerprint,c.revision);
 update alliance_community.control set mutations=mutations+1 where id;
 return jsonb_build_object('state','applied','operationId',op,'challenge',alliance_community.snapshot(cid,pid));
end $$;
-- Explicit hide/show, never a retry-unsafe toggle. Profiles cascade these pairs.
create function alliance_community.block_session(p_actor uuid,p_session uuid,p_target uuid,p_hide boolean) returns jsonb
language plpgsql security definer set search_path='' as $$ declare pid uuid;affected integer; begin
 pid:=alliance_community.member(p_actor,p_session,false);
 if p_target is null or p_hide is null or p_target=pid or not exists(select 1 from public.alliance_profiles where id=p_target)
 then raise insufficient_privilege using message='community_invalid';end if;
 if (select mutations>=1024 from alliance_community.control where id) then raise insufficient_privilege using message='community_full';end if;
 if p_hide then
  if not exists(select 1 from alliance_community.blocks where owner=pid and target=p_target) and (select count(*) from alliance_community.blocks)>=256
  then raise insufficient_privilege using message='community_full';end if;
  insert into alliance_community.blocks(owner,target) values(pid,p_target) on conflict do nothing;
 else delete from alliance_community.blocks where owner=pid and target=p_target;end if;
 get diagnostics affected=row_count;if affected>0 then update alliance_community.control set mutations=mutations+1 where id;end if;
 return jsonb_build_object('target',p_target,'hidden',p_hide);
end $$;
-- Separate complete inventory: the existing format-2 member checkpoint does
-- NOT cover these tables. A future serving composition must bind both domains.
create function alliance_community.recovery_inventory() returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' set datestyle='ISO, YMD' as $$
declare t text;n bigint;digest text;items jsonb:='[]';begin
 perform 1 from alliance_avatar.control where id and not enabled and not creation_enabled and not cleanup_enabled and not profile_revision_enabled for update;
 if not found then raise insufficient_privilege using message='community_inventory_open';end if;
 perform 1 from alliance_community.control where id and not enabled for update;
 if not found then raise insufficient_privilege using message='community_inventory_open';end if;
 foreach t in array array['control','challenges','contributions','operations','blocks'] loop
  execute format('select count(*),encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb)::text,''UTF8'')),''hex'') from alliance_community.%I t',t) into n,digest;
  items:=items||jsonb_build_array(jsonb_build_object('table','alliance_community.'||t,'rows',n,'sha256',digest));
 end loop;
 return jsonb_build_object('format',1,'domain','community','closed',true,'tables',items);
end $$;
revoke all on all functions in schema alliance_community from public,anon,authenticated,service_role,alliance_avatar_executor;
revoke all on schema alliance_community from public,anon,authenticated,service_role,alliance_avatar_executor;
grant usage on schema alliance_community to alliance_avatar_executor;
grant execute on function alliance_community.read_session(uuid,uuid,uuid),alliance_community.list_session(uuid,uuid,uuid,integer),alliance_community.change_session(uuid,uuid,jsonb),alliance_community.block_session(uuid,uuid,uuid,boolean),alliance_community.recovery_inventory() to alliance_avatar_executor;
reset role;
