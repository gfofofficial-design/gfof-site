-- UNAPPLIED safety interlock, NOT an account-erasure implementation.
-- Hold hard/soft/bulk Auth removal until an account-wide independent intent,
-- admission, acknowledgement and recovery contract is implemented/reviewed.
-- No role, table, credential, bypass flag or allow-removal entrypoint is added.
-- Managed auth schema ownership/compatibility requires separate hosted review.
do $$ begin
 if current_database()<>'postgres' or to_regnamespace('alliance_avatar') is null
   or to_regclass('auth.users') is null or not exists(select 1 from pg_catalog.pg_attribute
     where attrelid='auth.users'::regclass and attname='deleted_at' and not attisdropped)
   or exists(select 1 from pg_catalog.pg_trigger where tgrelid='auth.users'::regclass
     and tgname in('alliance_account_removal_rows','alliance_account_removal_bulk')) then
  raise exception 'Reviewed Auth/member schema and absent removal interlock required';
 end if;
end $$;
set local role alliance_avatar_owner;
create function alliance_avatar.hold_auth_account_removal() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP in('DELETE','TRUNCATE') then
  raise insufficient_privilege using message='alliance_account_removal_unavailable';
 end if;
 if TG_OP<>'UPDATE' or NEW.deleted_at is distinct from OLD.deleted_at then
  raise insufficient_privilege using message='alliance_account_removal_unavailable';
 end if;
 return NEW;
end $$;
revoke all on function alliance_avatar.hold_auth_account_removal()
 from public,anon,authenticated,service_role,alliance_avatar_executor;
reset role;
create trigger alliance_account_removal_rows before delete or update of deleted_at
 on auth.users for each row execute function alliance_avatar.hold_auth_account_removal();
create trigger alliance_account_removal_bulk before truncate
 on auth.users for each statement execute function alliance_avatar.hold_auth_account_removal();
alter table auth.users enable always trigger alliance_account_removal_rows;
alter table auth.users enable always trigger alliance_account_removal_bulk;
