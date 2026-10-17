-- Review-only rule/ACL probe for the approved isolated Restore Drill.
-- Not a migration or hook deployment. Never attach this probe as an Auth hook.
-- Uses synthetic payloads only; all created objects and grants roll back.
-- Hosted Auth-role execution and signup integration are not tested here.
begin;
set local statement_timeout = '8s';
set local lock_timeout = '2s';
create schema federation_signup_probe_20261007;
revoke all on schema federation_signup_probe_20261007 from public, anon, authenticated;
create function federation_signup_probe_20261007.google_only(event jsonb)
returns jsonb language plpgsql security invoker set search_path = ''
as $hook$
begin
  if event #>> '{user,app_metadata,provider}' = 'google'
     and event #> '{user,is_anonymous}' = 'false'::jsonb then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Account creation is unavailable for this sign-in method.'));
end;
$hook$;
revoke all on function federation_signup_probe_20261007.google_only(jsonb) from public, anon, authenticated;
grant usage on schema federation_signup_probe_20261007 to supabase_auth_admin;
grant execute on function federation_signup_probe_20261007.google_only(jsonb) to supabase_auth_admin;
do $checks$
declare r record; actual jsonb; tested integer := 0;
begin
  for r in select * from (values
    ('{"user":{"app_metadata":{"provider":"google"},"is_anonymous":false}}'::jsonb,true),
    ('{"user":{"app_metadata":{"provider":"email"},"is_anonymous":false}}'::jsonb,false),
    ('{"user":{"app_metadata":{"provider":"apple"},"is_anonymous":false}}'::jsonb,false),
    ('{"user":{"app_metadata":{"provider":"github"},"is_anonymous":false}}'::jsonb,false),
    ('{"user":{"app_metadata":{"provider":"phone"},"is_anonymous":false}}'::jsonb,false),
    ('{"user":{"app_metadata":{"provider":"discord"},"is_anonymous":false}}'::jsonb,false),
    ('{"user":{"app_metadata":{"provider":"google"},"is_anonymous":true}}'::jsonb,false),
    ('{"user":{"app_metadata":{"provider":"google"}}}'::jsonb,false),
    ('{"user":{"app_metadata":{"provider":"google"},"is_anonymous":"false"}}'::jsonb,false),
    ('{"user":{"app_metadata":{},"is_anonymous":false}}'::jsonb,false),
    ('{"user":{"app_metadata":{"provider":"email"},"user_metadata":{"provider":"google"},"is_anonymous":false}}'::jsonb,false),
    ('{}'::jsonb,false),
    (null::jsonb,false),
    ('[]'::jsonb,false),
    ('{"user":{"app_metadata":"google","is_anonymous":false}}'::jsonb,false),
    ('{"user":{"app_metadata":{"provider":["google"]},"is_anonymous":false}}'::jsonb,false),
    ('{"user":{"app_metadata":{"provider":null},"is_anonymous":false}}'::jsonb,false),
    ('{"user":{"app_metadata":{"provider":"google"},"is_anonymous":{}}}'::jsonb,false),
    ('{"user":{"app_metadata":{"provider":"Google"},"is_anonymous":false}}'::jsonb,false),
    ('{"user":{"app_metadata":{"provider":true},"is_anonymous":false}}'::jsonb,false),
    ('{"user":{"app_metadata":{"providers":["google"]},"is_anonymous":false}}'::jsonb,false)
  ) as cases(payload, allowed)
  loop
    actual := federation_signup_probe_20261007.google_only(r.payload);
    if r.allowed then
      if actual is distinct from '{}'::jsonb then raise exception 'allow case failed'; end if;
    else
      if actual #>> '{error,http_code}' is distinct from '403' then raise exception 'deny case failed'; end if;
    end if;
    tested := tested + 1;
  end loop;
  if tested <> 21 then raise exception 'case count failed'; end if;
  if not has_schema_privilege('supabase_auth_admin','federation_signup_probe_20261007','USAGE') then raise exception 'auth schema usage failed'; end if;
  if not has_function_privilege('supabase_auth_admin','federation_signup_probe_20261007.google_only(jsonb)','EXECUTE') then raise exception 'auth execute failed'; end if;
  if has_function_privilege('anon','federation_signup_probe_20261007.google_only(jsonb)','EXECUTE')
     or has_function_privilege('authenticated','federation_signup_probe_20261007.google_only(jsonb)','EXECUTE')
     or has_function_privilege('service_role','federation_signup_probe_20261007.google_only(jsonb)','EXECUTE') then raise exception 'unexpected public API execute'; end if;
  if (select prosecdef from pg_proc where oid='federation_signup_probe_20261007.google_only(jsonb)'::regprocedure) then raise exception 'definer forbidden'; end if;
end;
$checks$;
rollback;
select current_setting('server_version') as postgres_version,
       not exists (select 1 from pg_namespace where nspname='federation_signup_probe_20261007') as probe_removed,
       (select count(*) from auth.users) as users,
       (select count(*) from auth.identities) as identities;