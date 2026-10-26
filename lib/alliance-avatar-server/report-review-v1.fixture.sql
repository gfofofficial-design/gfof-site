-- Disabled source-only extension. The reviewed installer owns the transaction.
-- No new role, LOGIN, public API grant, schedule or enabled reviewer binding.
set local role alliance_avatar_owner;
create table alliance_report_review.control(
 id boolean primary key default true check(id),
 enabled boolean not null default false,
 reviewer_actor uuid,
 check(not enabled or reviewer_actor is not null)
);
insert into alliance_report_review.control(id) values(true);
create table alliance_report_review.reviews(
 report_id uuid primary key references alliance_feedback.reports(id) on delete cascade,
 first_reviewed_at timestamptz not null,
 disposition text not null check(disposition in('no_action','owner_follow_up'))
);
do $$ declare t text;begin
 foreach t in array array['control','reviews'] loop
  execute format('alter table alliance_report_review.%I enable row level security',t);
  execute format('alter table alliance_report_review.%I force row level security',t);
  execute format('revoke all on alliance_report_review.%I from public,anon,authenticated,service_role,alliance_avatar_executor',t);
  execute format('create policy owner_only on alliance_report_review.%I to alliance_avatar_owner using(true) with check(true)',t);
 end loop;
end $$;
create function alliance_report_review.expires_at(p_created timestamptz,p_reviewed timestamptz) returns timestamptz
language sql immutable security invoker set search_path='' as $$
 select case when p_reviewed is null then p_created+interval '2160 hours' else p_reviewed+interval '720 hours' end
$$;
create function alliance_report_review.reviewer(p_actor uuid,p_session uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform alliance_avatar.lock_enabled();
 perform alliance_avatar.require_account_session(p_actor,p_session);
 perform 1 from alliance_report_review.control where id and enabled and reviewer_actor=p_actor for update;
 if not found then raise insufficient_privilege using message='report_review_unavailable';end if;
end $$;
create function alliance_report_review.snapshot(p_id uuid,p_context boolean) returns jsonb
language plpgsql security invoker set search_path='' set timezone='UTC' set datestyle='ISO, YMD' as $$
declare r alliance_feedback.reports;v alliance_report_review.reviews;expiry timestamptz;ctx text;title_text text;summary_text text;begin
 select * into r from alliance_feedback.reports where id=p_id;
 if not found then raise insufficient_privilege using message='report_review_unavailable';end if;
 select * into v from alliance_report_review.reviews where report_id=p_id;
 expiry:=alliance_report_review.expires_at(r.created_at,v.first_reviewed_at);
 if expiry<=clock_timestamp() then raise insufficient_privilege using message='report_review_unavailable';end if;
 -- Lists contain metadata only. A selected read gets bounded idea/profile text;
 -- reporter identity and private challenge text never enter this review API.
 ctx:='unavailable';
 if r.kind='member' and exists(select 1 from public.alliance_profiles where id=r.target) then ctx:='available';
 elsif r.kind='idea' then
  select case when removed then 'removed' else 'available' end into ctx from alliance_feedback.ideas where id=r.target;
 elsif r.kind='challenge' and exists(select 1 from alliance_community.challenges where id=r.target) then ctx:='available';
 end if;
 if p_context is true and ctx='available' then
  if r.kind='member' then select display_name,bio into title_text,summary_text from public.alliance_profiles where id=r.target;
  elsif r.kind='idea' then select title,detail into title_text,summary_text from alliance_feedback.ideas where id=r.target and not removed;
  end if;
 end if;
 return jsonb_build_object('id',r.id,'kind',r.kind,'target',r.target,'contextState',coalesce(ctx,'unavailable'),
  'contextLoaded',p_context is true,'targetTitle',title_text,'targetSummary',summary_text,
  'createdAt',to_char(r.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'reviewedAt',case when v.first_reviewed_at is null then null else to_char(v.first_reviewed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
  'disposition',coalesce(v.disposition,'unreviewed'),
  'expiresAt',to_char(expiry at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;
create function alliance_report_review.queue_session(p_actor uuid,p_session uuid,p_after uuid,p_limit integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ids uuid[];rid uuid;nxt uuid;items jsonb:='[]';begin
 perform alliance_report_review.reviewer(p_actor,p_session);
 if p_limit is null or p_limit not between 1 and 5 then raise insufficient_privilege using message='report_review_invalid';end if;
 select array_agg(x.id order by x.id) into ids from(
  select r.id from alliance_feedback.reports r left join alliance_report_review.reviews v on v.report_id=r.id
  where (p_after is null or r.id>p_after) and alliance_report_review.expires_at(r.created_at,v.first_reviewed_at)>clock_timestamp()
  order by r.id limit p_limit+1
 )x;
 if cardinality(ids)>p_limit then nxt:=ids[p_limit];end if;
 foreach rid in array coalesce(ids[1:p_limit],array[]::uuid[]) loop
  items:=items||jsonb_build_array(alliance_report_review.snapshot(rid,false));
 end loop;
 return jsonb_build_object('items',items,'next',nxt);
end $$;
create function alliance_report_review.read_session(p_actor uuid,p_session uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin perform alliance_report_review.reviewer(p_actor,p_session);return alliance_report_review.snapshot(p_id,true);end $$;
create function alliance_report_review.review_session(p_actor uuid,p_session uuid,p_id uuid,p_expected text,p_disposition text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r alliance_feedback.reports;v alliance_report_review.reviews;current_disposition text;begin
 perform alliance_report_review.reviewer(p_actor,p_session);
 if p_expected is null or p_expected not in('unreviewed','no_action','owner_follow_up')
 or p_disposition is null or p_disposition not in('no_action','owner_follow_up') then raise insufficient_privilege using message='report_review_invalid';end if;
 select * into r from alliance_feedback.reports where id=p_id for update;
 if not found then raise insufficient_privilege using message='report_review_unavailable';end if;
 select * into v from alliance_report_review.reviews where report_id=p_id for update;
 if alliance_report_review.expires_at(r.created_at,v.first_reviewed_at)<=clock_timestamp() then raise insufficient_privilege using message='report_review_unavailable';end if;
 current_disposition:=coalesce(v.disposition,'unreviewed');
 if current_disposition=p_disposition then return alliance_report_review.snapshot(p_id,true);end if;
 if current_disposition<>p_expected then raise insufficient_privilege using message='report_review_conflict';end if;
 if v.report_id is null then
  insert into alliance_report_review.reviews(report_id,first_reviewed_at,disposition) values(p_id,clock_timestamp(),p_disposition);
 else
  update alliance_report_review.reviews set disposition=p_disposition where report_id=p_id;
 end if;
 return alliance_report_review.snapshot(p_id,true);
end $$;
create function alliance_report_review.expire_closed(p_limit integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare removed integer;more boolean;begin
 if p_limit is null or p_limit not between 1 and 50 then raise insufficient_privilege using message='report_review_invalid';end if;
 -- Maintenance-only entry: no executor grant, no caller-supplied clock.
 perform 1 from alliance_avatar.control where id and not enabled for update;
 if not found then raise insufficient_privilege using message='report_review_unavailable';end if;
 perform 1 from alliance_community.control where id and not enabled for update;
 if not found then raise insufficient_privilege using message='report_review_unavailable';end if;
 perform 1 from alliance_feedback.control where id and not enabled for update;
 if not found then raise insufficient_privilege using message='report_review_unavailable';end if;
 perform 1 from alliance_report_review.control where id and not enabled for update;
 if not found then raise insufficient_privilege using message='report_review_unavailable';end if;
 delete from alliance_feedback.reports where id in(
  select r.id from alliance_feedback.reports r left join alliance_report_review.reviews v on v.report_id=r.id
  where alliance_report_review.expires_at(r.created_at,v.first_reviewed_at)<=clock_timestamp()
  order by r.id limit p_limit for update of r
 );
 get diagnostics removed=row_count;
 select exists(select 1 from alliance_feedback.reports r left join alliance_report_review.reviews v on v.report_id=r.id
  where alliance_report_review.expires_at(r.created_at,v.first_reviewed_at)<=clock_timestamp()) into more;
 return jsonb_build_object('removed',removed,'remainingExpired',more);
end $$;
create function alliance_report_review.recovery_inventory() returns jsonb
language plpgsql security definer set search_path='' as $$
declare t text;rows bigint;digest text;items jsonb:='[]';closed_state boolean;expired integer;begin
 foreach t in array array['control','reviews'] loop
  execute format('select count(*),encode(sha256(convert_to(coalesce(string_agg(row_to_json(x)::text,E''\n'' order by row_to_json(x)::text),''''),''UTF8'')),''hex'') from alliance_report_review.%I x',t) into rows,digest;
  items:=items||jsonb_build_array(jsonb_build_object('table','alliance_report_review.'||t,'rows',rows,'sha256',digest));
 end loop;
 select exists(select 1 from alliance_avatar.control where id and not enabled)
  and exists(select 1 from alliance_community.control where id and not enabled)
  and exists(select 1 from alliance_feedback.control where id and not enabled)
  and exists(select 1 from alliance_report_review.control where id and not enabled) into closed_state;
 select count(*)::integer into expired from alliance_feedback.reports r left join alliance_report_review.reviews v on v.report_id=r.id
  where alliance_report_review.expires_at(r.created_at,v.first_reviewed_at)<=clock_timestamp();
 return jsonb_build_object('format',1,'closed',closed_state,'expiredReports',expired,'tables',items);
end $$;
do $$ declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='alliance_report_review' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role,alliance_avatar_executor',f.signature);
 end loop;
end $$;
grant usage on schema alliance_report_review to alliance_avatar_executor;
revoke all on schema alliance_report_review from public,anon,authenticated,service_role;
grant execute on function alliance_report_review.queue_session(uuid,uuid,uuid,integer),alliance_report_review.read_session(uuid,uuid,uuid),alliance_report_review.review_session(uuid,uuid,uuid,text,text),alliance_report_review.recovery_inventory() to alliance_avatar_executor;
reset role;
