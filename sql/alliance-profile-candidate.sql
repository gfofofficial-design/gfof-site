-- Reviewed candidate DDL, not an applied migration. No hosted database is changed.
-- Native tests supply restricted Auth-role/claim fixtures; hosted Auth acceptance
-- and a CLI-generated migration are separate release gates.
create table public.alliance_member_owners (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
create table public.alliance_profiles (
  id uuid primary key references public.alliance_member_owners(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40 and display_name=btrim(display_name) and display_name !~ '[[:cntrl:]<>]' and display_name !~ U&'[\202A-\202E\2066-\2069]'),
  community text not null default '' check (char_length(community)<=70 and community=btrim(community) and community !~ '[[:cntrl:]<>]' and community !~ U&'[\202A-\202E\2066-\2069]'),
  bio text not null check (char_length(bio) between 10 and 280 and octet_length(bio)<=1120 and bio=btrim(bio) and bio !~ '[<>]' and bio !~ U&'[\202A-\202E\2066-\2069]'),
  contribution_role text not null check (contribution_role in ('explorer','builder','researcher','connector')),
  listed boolean not null default false,
  moderation_state text not null default 'visible' check (moderation_state in ('visible','held')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);
create index alliance_profiles_directory on public.alliance_profiles(id) where listed and moderation_state='visible';
alter table public.alliance_member_owners enable row level security;
alter table public.alliance_member_owners force row level security;
alter table public.alliance_profiles enable row level security;
alter table public.alliance_profiles force row level security;
revoke all on public.alliance_member_owners, public.alliance_profiles from public, anon, authenticated, service_role;
grant select, delete on public.alliance_member_owners to authenticated;
grant insert(user_id) on public.alliance_member_owners to authenticated;
grant select, delete on public.alliance_profiles to authenticated;
grant insert(id,display_name,community,bio,contribution_role,listed) on public.alliance_profiles to authenticated;
grant update(display_name,community,bio,contribution_role,listed) on public.alliance_profiles to authenticated;

create function public.alliance_member_eligible() returns boolean
language sql stable security invoker set search_path='' as $$
  select auth.uid() is not null and coalesce(auth.jwt()->>'is_anonymous','true')='false';
$$;
revoke all on function public.alliance_member_eligible() from public,anon,authenticated,service_role;
grant execute on function public.alliance_member_eligible() to authenticated;

create policy alliance_owners_read on public.alliance_member_owners for select to authenticated
using ((select public.alliance_member_eligible()) and user_id=(select auth.uid()));
create policy alliance_owners_create on public.alliance_member_owners for insert to authenticated
with check ((select public.alliance_member_eligible()) and user_id=(select auth.uid()));
create policy alliance_owners_remove on public.alliance_member_owners for delete to authenticated
using ((select public.alliance_member_eligible()) and user_id=(select auth.uid()));

create policy alliance_profile_read on public.alliance_profiles for select to authenticated
using ((select public.alliance_member_eligible())
  and exists(select 1 from public.alliance_member_owners m where m.user_id=(select auth.uid()))
  and ((listed and moderation_state='visible') or exists(select 1 from public.alliance_member_owners m where m.id=alliance_profiles.id and m.user_id=(select auth.uid()))));
create policy alliance_profile_create on public.alliance_profiles for insert to authenticated
with check ((select public.alliance_member_eligible()) and exists(select 1 from public.alliance_member_owners m where m.id=alliance_profiles.id and m.user_id=(select auth.uid())));
create policy alliance_profile_edit on public.alliance_profiles for update to authenticated
using ((select public.alliance_member_eligible()) and exists(select 1 from public.alliance_member_owners m where m.id=alliance_profiles.id and m.user_id=(select auth.uid())))
with check ((select public.alliance_member_eligible()) and exists(select 1 from public.alliance_member_owners m where m.id=alliance_profiles.id and m.user_id=(select auth.uid())));
create policy alliance_profile_remove on public.alliance_profiles for delete to authenticated
using ((select public.alliance_member_eligible()) and exists(select 1 from public.alliance_member_owners m where m.id=alliance_profiles.id and m.user_id=(select auth.uid())));

create function public.alliance_profile_stamp() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  new.updated_at=pg_catalog.clock_timestamp();
  return new;
end;
$$;
revoke all on function public.alliance_profile_stamp() from public,anon,authenticated,service_role;
create trigger alliance_profile_stamp before update on public.alliance_profiles
for each row execute function public.alliance_profile_stamp();

create function public.alliance_save_profile(p_name text,p_community text,p_bio text,p_role text,p_listed boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare profile_id uuid; saved public.alliance_profiles;
begin
  if not public.alliance_member_eligible() then raise insufficient_privilege using message='Member sign-in required'; end if;
  insert into public.alliance_member_owners(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  select m.id into strict profile_id from public.alliance_member_owners m where m.user_id=auth.uid();
  insert into public.alliance_profiles(id,display_name,community,bio,contribution_role,listed)
    values(profile_id,p_name,p_community,p_bio,p_role,p_listed)
    on conflict(id) do update set display_name=excluded.display_name,community=excluded.community,bio=excluded.bio,contribution_role=excluded.contribution_role,listed=excluded.listed
    returning * into saved;
  return pg_catalog.jsonb_build_object('id',saved.id,'name',saved.display_name,'community',saved.community,'bio',saved.bio,'role',saved.contribution_role,'listed',saved.listed,'publication',case when saved.moderation_state='held' then 'held' when saved.listed then 'listed' else 'private' end,'updatedAt',saved.updated_at);
end;
$$;
create function public.alliance_my_profile() returns jsonb
language sql stable security invoker set search_path='' as $$
  select pg_catalog.jsonb_build_object('id',p.id,'name',p.display_name,'community',p.community,'bio',p.bio,'role',p.contribution_role,'listed',p.listed,'publication',case when p.moderation_state='held' then 'held' when p.listed then 'listed' else 'private' end,'updatedAt',p.updated_at)
  from public.alliance_profiles p join public.alliance_member_owners m on m.id=p.id where m.user_id=(select auth.uid());
$$;
create function public.alliance_remove_profile() returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  if not public.alliance_member_eligible() then raise insufficient_privilege using message='Member sign-in required'; end if;
  delete from public.alliance_member_owners where user_id=auth.uid();
  return pg_catalog.jsonb_build_object('removed',true);
end;
$$;
revoke all on function public.alliance_save_profile(text,text,text,text,boolean),public.alliance_my_profile(),public.alliance_remove_profile() from public,anon,authenticated,service_role;
grant execute on function public.alliance_save_profile(text,text,text,text,boolean),public.alliance_my_profile(),public.alliance_remove_profile() to authenticated;
