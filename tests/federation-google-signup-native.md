# Google-only signup: disposable native PostgreSQL check

This harness validates the review-only candidate in
`federation-google-signup-probe.sql`. It is not a Supabase migration or hook
deployment and never connects to either hosted owner project.

The PR #99 CI job creates a fresh PostgreSQL 17.11 Docker service. The harness
requires its dedicated image, database name, local container ID and explicit
disposable-fixture confirmation. It also refuses existing Auth schemas or test
roles. All role/schema/table/function/grant changes occur in one rolled-back
transaction; no Auth users, identities, tokens or passwords are loaded.

The exact candidate DDL and 21 rule assertions are read from the existing probe.
The assertions run after `SET LOCAL ROLE supabase_auth_admin`, using a simulated
role with no login, superuser, BYPASSRLS, role membership, schema CREATE or table
SELECT. The test then attempts real function calls as anon, authenticated,
service_role and an unrelated role that receives only PUBLIC privileges; each
must fail with SQLSTATE 42501. It separately removes Auth EXECUTE and schema
USAGE, requires the same denial, restores the two grants, checks the allowed
Google decision and verifies transaction cleanup.

To run on an already-created matching disposable Docker fixture:

```sh
FEDERATION_SIGNUP_TEST_CONFIRM=disposable_native_fixture \
FEDERATION_SIGNUP_TEST_CONTAINER=<local-container-id> \
node tests/federation-google-signup-native.mjs
```

`node tests/federation-google-signup-native.mjs --print-sql` prints the synthetic
fixture for review. Do not run that SQL against a hosted or shared database.
The fixture has intentionally weaker simulated roles than Supabase's managed
roles; its result proves native SQL/ACL behavior for this fixture, not the
hosted project's effective permissions or Auth service execution.

Public registration still requires the hosted acceptance matrix in
`docs/federation-account-data-operations.md`: a real new Google identity,
direct Email/password and OTP rejection before insertion/delivery, preserved
existing owner login/link behavior, actual hook-failure closure, and the other
security/recovery/privacy/operating gates. A permission-denied SQL call does
not prove how Supabase Auth responds to an unavailable hook.
