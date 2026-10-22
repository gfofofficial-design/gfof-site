-- UNAPPLIED candidate, not an attached Auth hook or a hosted migration.
-- Install/attach only with exact-target approval while managed signup is closed.
-- This permits the email PROVIDER, including native email/password signup.
-- It does not distinguish OTP from password signup or authorize public rollout.
begin;
set local statement_timeout='8s';
set local lock_timeout='2s';

create schema federation_auth_email_signup;
revoke all on schema federation_auth_email_signup from public,anon,authenticated,service_role;

create function federation_auth_email_signup.email_provider_only(event jsonb)
returns jsonb language plpgsql security invoker set search_path=''
as $hook$
begin
  -- Auth supplies app_metadata. Applicant-controlled user_metadata grants nothing.
  -- Confirmation is checked after verification by the existing account handler;
  -- new users are not yet confirmed when this creation hook executes.
  if pg_catalog.jsonb_typeof(event)='object'
     and pg_catalog.jsonb_typeof(event->'user')='object'
     and pg_catalog.jsonb_typeof(event#>'{user,app_metadata}')='object'
     and event#>'{user,app_metadata,provider}'='"email"'::jsonb
     and event#>'{user,app_metadata,providers}'='["email"]'::jsonb
     and event#>'{user,is_anonymous}'='false'::jsonb
     and pg_catalog.jsonb_typeof(event#>'{user,email}')='string'
     and pg_catalog.length(event#>>'{user,email}') between 3 and 254
     and (event#>>'{user,email}') ~ '^[^@[:space:]<>]+@[^@[:space:]<>]+$'
     and (event#>'{user,phone}' is null
          or event#>'{user,phone}'='null'::jsonb
          or event#>'{user,phone}'='""'::jsonb) then
    return '{}'::jsonb;
  end if;
  return pg_catalog.jsonb_build_object('error',pg_catalog.jsonb_build_object(
    'http_code',403,
    'message','Account creation is unavailable for this sign-in method.'
  ));
end;
$hook$;

revoke all on function federation_auth_email_signup.email_provider_only(jsonb)
  from public,anon,authenticated,service_role;
grant usage on schema federation_auth_email_signup to supabase_auth_admin;
grant execute on function federation_auth_email_signup.email_provider_only(jsonb)
  to supabase_auth_admin;
commit;
