-- Source-only extension of the existing private member/community foundation.
-- Caller creates alliance_feedback owned by the same locked owner in one transaction.
-- No LOGIN, role, provider connection, public grant or service activation.
set local role alliance_avatar_owner;
create table alliance_feedback.control(
 id boolean primary key default true check(id),enabled boolean not null default false,
 mutations integer not null default 0 check(mutations between 0 and 1024),
 ideas_created integer not null default 0 check(ideas_created between 0 and 128),
 support_adds integer not null default 0 check(support_adds between 0 and 512),
 reports_created integer not null default 0 check(reports_created between 0 and 256)
);
insert into alliance_feedback.control(id) values(true);
create table alliance_feedback.ideas(
 id uuid primary key,owner uuid not null references public.alliance_profiles(id) on delete cascade,
 title text,category text,detail text,created_at timestamptz not null default clock_timestamp(),removed boolean not null default false,
 check((removed and title is null and category is null and detail is null) or
  (not removed and title is not null and char_length(title) between 5 and 80 and detail is not null and char_length(detail) between 15 and 600 and category is not null and category in('tools','community','learning','accessibility','research')))
);
create index feedback_idea_owner on alliance_feedback.ideas(owner,id);
create table alliance_feedback.supports(
 idea_id uuid not null references alliance_feedback.ideas(id) on delete cascade,
 supporter uuid not null references public.alliance_profiles(id) on delete cascade,
 primary key(idea_id,supporter)
);
create index feedback_supporter on alliance_feedback.supports(supporter);
create table alliance_feedback.reports(
 id uuid primary key,reporter uuid not null references public.alliance_profiles(id) on delete cascade,
 target_owner uuid not null references public.alliance_profiles(id) on delete cascade,
 kind text not null check(kind in('member','idea','challenge')),target uuid not null,
 created_at timestamptz not null default clock_timestamp(),unique(reporter,kind,target),check(reporter<>target_owner)
);
create index feedback_report_target_owner on alliance_feedback.reports(target_owner);
do $$ declare t text;begin
 foreach t in array array['control','ideas','supports','reports'] loop
  execute format('alter table alliance_feedback.%I enable row level security',t);
  execute format('alter table alliance_feedback.%I force row level security',t);
  execute format('revoke all on alliance_feedback.%I from public,anon,authenticated,service_role,alliance_avatar_executor',t);
  execute format('create policy owner_only on alliance_feedback.%I to alliance_avatar_owner using(true) with check(true)',t);
 end loop;
end $$;
create function alliance_feedback.member(p_actor uuid,p_session uuid,positive boolean) returns uuid
language plpgsql security invoker set search_path='' as $$ declare pid uuid;begin
 -- Keep the established member -> community -> feedback lock order.
 pid:=alliance_community.member(p_actor,p_session,positive);
 perform 1 from alliance_feedback.control where id and enabled for update;
 if not found then raise insufficient_privilege using message='feedback_unavailable';end if;return pid;
end $$;
create function alliance_feedback.snapshot(p_id uuid,p_member uuid) returns jsonb
language plpgsql stable security invoker set search_path='' set timezone='UTC' set datestyle='ISO, YMD' as $$
declare i alliance_feedback.ideas;people jsonb;visible_count integer;mine boolean;begin
 select * into i from alliance_feedback.ideas where id=p_id and not removed;
 if not found or not exists(select 1 from public.alliance_profiles where id=i.owner and moderation_state='visible')
 or (i.owner<>p_member and not alliance_community.visible(p_member,i.owner))
 then raise insufficient_privilege using message='feedback_unavailable';end if;
 select jsonb_build_array(i.owner)||coalesce(jsonb_agg(s.supporter order by s.supporter),'[]'::jsonb) into people from alliance_feedback.supports s where s.idea_id=i.id;
 select count(*)::integer,coalesce(bool_or(s.supporter=p_member),false) into visible_count,mine
 from alliance_feedback.supports s where s.idea_id=i.id and exists(select 1 from public.alliance_profiles p where p.id=s.supporter and p.moderation_state='visible')
 and (s.supporter=p_member or alliance_community.visible(p_member,s.supporter));
 return jsonb_build_object('idea',jsonb_build_object('id',i.id,'owner',i.owner,'title',i.title,'category',i.category,'detail',i.detail,
  'createdAt',to_char(i.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'supportCount',visible_count,'supported',mine),'evidenceProfiles',people);
end $$;
create function alliance_feedback.read_session(p_actor uuid,p_session uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ declare pid uuid;begin
 pid:=alliance_feedback.member(p_actor,p_session,false);return alliance_feedback.snapshot(p_id,pid);
end $$;
create function alliance_feedback.list_session(p_actor uuid,p_session uuid,p_after uuid,p_limit integer) returns jsonb
language plpgsql security definer set search_path='' as $$ declare pid uuid;ids uuid[];items jsonb:='[]';iid uuid;nxt uuid;begin
 pid:=alliance_feedback.member(p_actor,p_session,false);
 if p_limit is null or p_limit not between 1 and 5 then raise insufficient_privilege using message='feedback_invalid';end if;
 select array_agg(x.id order by x.id) into ids from(select i.id from alliance_feedback.ideas i join public.alliance_profiles p on p.id=i.owner
 where not i.removed and p.moderation_state='visible' and (p_after is null or i.id>p_after)
 and (i.owner=pid or alliance_community.visible(pid,i.owner)) order by i.id limit p_limit+1)x;
 if cardinality(ids)>p_limit then nxt:=ids[p_limit];end if;
 foreach iid in array coalesce(ids[1:p_limit],array[]::uuid[]) loop items:=items||jsonb_build_array(alliance_feedback.snapshot(iid,pid));end loop;
 return jsonb_build_object('items',items,'next',nxt);
end $$;
create function alliance_feedback.change_session(p_actor uuid,p_session uuid,v jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare pid uuid;iid uuid;action text;i alliance_feedback.ideas;before_support boolean;wanted boolean;target_id uuid;target_owner_id uuid;r alliance_feedback.reports;begin
 if jsonb_typeof(v) is distinct from 'object' or not(v ?& array['action','id']) or jsonb_typeof(v->'action') is distinct from 'string' or jsonb_typeof(v->'id') is distinct from 'string'
 then raise insufficient_privilege using message='feedback_invalid';end if;
 iid:=(v->>'id')::uuid;action:=v->>'action';
 if iid='00000000-0000-0000-0000-000000000000' or action not in('post','remove','support','report') then raise insufficient_privilege using message='feedback_invalid';end if;
 pid:=alliance_feedback.member(p_actor,p_session,action in('post','report') or (action='support' and v->'supported'='true'::jsonb));
 if action='post' then
  if (select count(*) from jsonb_object_keys(v))<>5 or not(v ?& array['title','category','detail'])
   or jsonb_typeof(v->'title') is distinct from 'string' or jsonb_typeof(v->'category') is distinct from 'string' or jsonb_typeof(v->'detail') is distinct from 'string'
   or v->>'category' not in('tools','community','learning','accessibility','research') or (v->>'title') ~ E'[\r\n\t]'
  then raise insufficient_privilege using message='feedback_invalid';end if;
  perform alliance_community.clean_text(v->>'title',5,80);perform alliance_community.clean_text(v->>'detail',15,600);
  select * into i from alliance_feedback.ideas where id=iid;
  if found then
   if i.owner<>pid or i.removed or i.title<>v->>'title' or i.category<>v->>'category' or i.detail<>v->>'detail'
   then raise insufficient_privilege using message='feedback_unavailable';end if;
   return jsonb_build_object('state','replayed','record',alliance_feedback.snapshot(iid,pid));
  end if;
  if (select mutations>=1024 or ideas_created>=128 from alliance_feedback.control where id) then raise insufficient_privilege using message='feedback_full';end if;
  insert into alliance_feedback.ideas(id,owner,title,category,detail) values(iid,pid,v->>'title',v->>'category',v->>'detail');
  update alliance_feedback.control set mutations=mutations+1,ideas_created=ideas_created+1 where id;
  return jsonb_build_object('state','applied','record',alliance_feedback.snapshot(iid,pid));
 elsif action='remove' then
  if (select count(*) from jsonb_object_keys(v))<>2 then raise insufficient_privilege using message='feedback_invalid';end if;
  select * into i from alliance_feedback.ideas where id=iid and owner=pid;
  if not found then raise insufficient_privilege using message='feedback_unavailable';end if;
  if not i.removed then
   if (select mutations>=1024 from alliance_feedback.control where id) then raise insufficient_privilege using message='feedback_full';end if;
   update alliance_feedback.ideas set title=null,category=null,detail=null,removed=true where id=iid;
   delete from alliance_feedback.supports where idea_id=iid;
   delete from alliance_feedback.reports where kind='idea' and target=iid;
   update alliance_feedback.control set mutations=mutations+1 where id;
  end if;
  return jsonb_build_object('state','removed','id',iid);
 elsif action='support' then
  if (select count(*) from jsonb_object_keys(v))<>3 or not(v ? 'supported') or jsonb_typeof(v->'supported') is distinct from 'boolean'
  then raise insufficient_privilege using message='feedback_invalid';end if;
  wanted:=(v->>'supported')::boolean;
  select exists(select 1 from alliance_feedback.supports where idea_id=iid and supporter=pid) into before_support;
  if wanted then
   select * into i from alliance_feedback.ideas where id=iid and not removed;
   if not found or i.owner=pid or not alliance_community.visible(pid,i.owner) then raise insufficient_privilege using message='feedback_unavailable';end if;
  end if;
  if before_support<>wanted then
   if (select mutations>=1024 or (wanted and support_adds>=512) from alliance_feedback.control where id) then raise insufficient_privilege using message='feedback_full';end if;
   if wanted then insert into alliance_feedback.supports values(iid,pid);else delete from alliance_feedback.supports where idea_id=iid and supporter=pid;end if;
   update alliance_feedback.control set mutations=mutations+1,support_adds=support_adds+case when wanted then 1 else 0 end where id;
  end if;
  return jsonb_build_object('state','set','id',iid,'supported',wanted);
 else
  if (select count(*) from jsonb_object_keys(v))<>4 or not(v ?& array['kind','target']) or jsonb_typeof(v->'kind') is distinct from 'string' or jsonb_typeof(v->'target') is distinct from 'string'
   or v->>'kind' not in('member','idea','challenge') then raise insufficient_privilege using message='feedback_invalid';end if;
  target_id:=(v->>'target')::uuid;
  if target_id='00000000-0000-0000-0000-000000000000' then raise insufficient_privilege using message='feedback_invalid';end if;
  if v->>'kind'='member' then
   select id into target_owner_id from public.alliance_profiles where id=target_id and moderation_state='visible';
  elsif v->>'kind'='idea' then
   select owner into target_owner_id from alliance_feedback.ideas where id=target_id and not removed;
  else
   select sender into target_owner_id from alliance_community.challenges where id=target_id and pid in(sender,recipient);
  end if;
  if target_owner_id is null or target_owner_id=pid or not alliance_community.visible(pid,target_owner_id)
  then raise insufficient_privilege using message='feedback_unavailable';end if;
  select * into r from alliance_feedback.reports where id=iid;
  if found then
   if r.reporter<>pid or r.kind<>v->>'kind' or r.target<>target_id then raise insufficient_privilege using message='feedback_unavailable';end if;
  else
   if exists(select 1 from alliance_feedback.reports where reporter=pid and kind=v->>'kind' and target=target_id) then raise insufficient_privilege using message='feedback_already_reported';end if;
   if (select mutations>=1024 or reports_created>=256 from alliance_feedback.control where id) then raise insufficient_privilege using message='feedback_full';end if;
   insert into alliance_feedback.reports(id,reporter,target_owner,kind,target) values(iid,pid,target_owner_id,v->>'kind',target_id);
   update alliance_feedback.control set mutations=mutations+1,reports_created=reports_created+1 where id;
  end if;
  return jsonb_build_object('state','recorded','id',iid,'kind',v->>'kind','target',target_id,'removed',false);
 end if;
end $$;
create function alliance_feedback.recovery_inventory() returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' set datestyle='ISO, YMD' as $$
declare t text;n bigint;digest text;items jsonb:='[]';begin
 perform 1 from alliance_avatar.control where id and not enabled and not creation_enabled and not cleanup_enabled and not profile_revision_enabled for update;
 if not found then raise insufficient_privilege using message='feedback_inventory_open';end if;
 perform 1 from alliance_community.control where id and not enabled for update;
 if not found then raise insufficient_privilege using message='feedback_inventory_open';end if;
 perform 1 from alliance_feedback.control where id and not enabled for update;
 if not found then raise insufficient_privilege using message='feedback_inventory_open';end if;
 foreach t in array array['control','ideas','supports','reports'] loop
  execute format('select count(*),encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb)::text,''UTF8'')),''hex'') from alliance_feedback.%I t',t) into n,digest;
  items:=items||jsonb_build_array(jsonb_build_object('table','alliance_feedback.'||t,'rows',n,'sha256',digest));
 end loop;
 return jsonb_build_object('format',1,'domain','feedback','closed',true,'tables',items);
end $$;
revoke all on all functions in schema alliance_feedback from public,anon,authenticated,service_role,alliance_avatar_executor;
revoke all on schema alliance_feedback from public,anon,authenticated,service_role,alliance_avatar_executor;
grant usage on schema alliance_feedback to alliance_avatar_executor;
grant execute on function alliance_feedback.read_session(uuid,uuid,uuid),alliance_feedback.list_session(uuid,uuid,uuid,integer),alliance_feedback.change_session(uuid,uuid,jsonb),alliance_feedback.recovery_inventory() to alliance_avatar_executor;
reset role;
