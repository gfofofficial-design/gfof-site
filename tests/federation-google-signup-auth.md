# Disposable Supabase Auth HTTP acceptance

`federation-google-signup-auth.mjs` runs the real self-hosted Supabase Auth
v2.197.0 service against a fresh PostgreSQL 17.11 Docker fixture with Mailpit
v1.31.4. This is a test harness, not a migration, hosted project or deployment.
It accepts only the explicit disposable-fixture confirmation and matching local
Postgres container ID/image/database. HTTP ports bind to 127.0.0.1. Auth and
Mailpit join only a newly-created internal Docker network, without outbound
internet or a configured mail relay. No real Google configuration is supplied.

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
  500 and no creation/delivery. Synthetic runtime failure and timeout must also
  fail closed. These are expected errors in this disposable fixture only.
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
build's behavior. Those checks, browser session acceptance and the remaining
security/recovery/privacy/operating gates still precede public registration.
Read the full hosted acceptance matrix in the account data operations plan.
