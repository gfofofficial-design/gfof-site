# Disposable Supabase Auth HTTP acceptance

`federation-google-signup-auth.mjs` runs the real self-hosted Supabase Auth
v2.197.0 service against a fresh PostgreSQL 17.11 Docker fixture with Mailpit
v1.31.4. This is a test harness, not a migration, hosted project or deployment.
It accepts only the explicit disposable-fixture confirmation and matching local
Postgres container ID/image/database. Auth and Mailpit publish no host ports and
join only a newly-created internal Docker network, without outbound internet or
a configured mail relay. The runner uses private addresses derived from those
exact containers on that owned network. No real Google configuration is supplied.

The harness generates temporary database/password/JWT credentials in memory.
It never accepts hosted URLs, exports credentials, prints token/user/mail
payloads, uploads Auth logs, or touches either existing owner project. Test
addresses use the reserved `.invalid` domain and mail stays in the sink.

The fixed test sequence proves:

- With signup enabled and no hook, real password signup and OTP creation each
  insert a synthetic account/identity and deliver sink mail. These positive
  controls prevent global closure or broken delivery from faking later success.
- The exact candidate SQL is installed only in this fixture. The hook is first
  attached with signup closed, preserving a confirmed synthetic user's login.
- With signup enabled and Email still enabled, direct password/OTP requests and
  spoofed user metadata/provider/app-metadata fields receive the candidate's
  generic 403, with no new users, identities or sink mail.
- Removing function EXECUTE, schema USAGE, or the selected function causes HTTP
  500 and no creation/delivery. Synthetic runtime failure must also fail closed.
  A separate cancellation case sets the disposable Auth role's statement_timeout
  to two seconds, restarts its connection pool, and requires a three-second
  sleeping hook to fail closed. This verifies an explicit database deadline,
  not the default Auth hook deadline. These are fixture-only expected errors.
- After removing that role deadline and restarting the pool, a twelve-second
  sleeping hook must be interrupted by the default ten-second API request limit:
  HTTP 504 within the bounded window, zero insertion and zero new sink mail.
- Existing synthetic password login and authenticated user read still work,
  including with missing hook EXECUTE. Local logout rejects the old refresh
  token. Restoring the exact candidate restores the expected deny decision.
- Signup is closed again before disposal. Auth/mail child containers and their
  internal network are removed in `finally`; GitHub disposes the Postgres
  service and runner afterward. No container volume or Auth backup is retained.

The harness uses a restricted LOGIN Auth role owning only its Auth schema. Its
hook has a separate database owner, SECURITY INVOKER, an empty search path and
only explicit Auth USAGE/EXECUTE. Do not broaden grants to make a failure pass.

The PR #99 job runs it with:

```sh
FEDERATION_AUTH_TEST_CONFIRM=disposable_auth_fixture \
FEDERATION_AUTH_TEST_POSTGRES=<matching-local-postgres-container-id> \
node tests/federation-google-signup-auth.mjs
```

This cannot establish a real new Google round trip, Google identity linking,
existing owner's hosted access, dashboard hook attachment or the hosted Auth
build's behavior. In an earlier isolated v2.197.0 run, the three-second sleeping
hook returned its deliberately allowing result and OTP creation completed;
the assumed default two-second hook deadline was not enforced in that fixture.
That finding matches the open upstream [Auth issue #2852](https://github.com/supabase/auth/issues/2852).
The explicit database deadline above is a separate test configuration, not a
repair to or validation of the hosted service. The outer request-limit check
also does not establish that the shorter hook deadline works. Verify the actual
hosted build and effective deadlines before registration. No hosted role timeout
or other project setting was changed.

Those checks, browser session acceptance and the remaining security/recovery/
privacy/operating gates still precede public registration.
Read the full hosted acceptance matrix in the account data operations plan.
