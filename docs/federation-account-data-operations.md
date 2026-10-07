# Federation account data operations — draft

This plan applies to the closed, owner-only Google pilot in PR #99. It is a
release checklist, not a public privacy policy or an authorization to open
registration. Apple, wallet access, staking and lending remain off.

## What the pilot currently holds

| Location | Observed or implemented data | Limit |
| --- | --- | --- |
| Isolated Supabase Auth project | One owner user with Email and Google identities as of the October 7, 2026 read-only check. Google sign-in can share email, name and profile picture. | No application tables were found in the `public` schema; this does not inventory provider logs or backups. |
| Federation browser | Secure HttpOnly access and refresh cookies (at most one hour and 24 hours respectively); a ten-minute sign-in flow cookie. | Signing out clears this browser and asks the provider to revoke its session; already-issued access tokens can remain valid until expiry. |
| Journey browser storage | Local choices and mission progress. | Not attached to the Auth user or synchronized across devices. |
| Netlify and Google | Request/identity-provider operational records under their own services. | Their actual log and backup retention must be confirmed before a public notice promises a deletion deadline. |

The Federation account page displays the email returned from Supabase. No
wallet address, token balance, entitlement, financial position, or account
profile is stored by this application. Do not imply that this inventory covers
all data held by vendors.

### Vendor records still to verify

Supabase says Auth audit events can include sign-ins, refreshes, IP address and
user agent; optional database storage is separate from external log storage.
The isolated pilot's Auth dashboard showed database audit storage **off** on
October 7, 2026; external Auth logs remain available through its log viewer.
Supabase's Free pricing describes one day of API/database log access; Netlify
describes Function logs covering up to seven days depending on plan. These are
dashboard access windows, **not** proof that every underlying vendor copy is deleted by
that date. Do not promise a fixed vendor-log or backup erasure deadline in the
public notice until the relevant provider terms and pilot settings are checked.
[Supabase Auth audit logs](https://supabase.com/docs/guides/auth/audit-logs),
[Supabase pricing](https://supabase.com/pricing), and
[Netlify logs](https://docs.netlify.com/manage/monitoring/logs/) are the
current public references.

## Manual account-deletion procedure to prove before public registration

1. Accept a request at the Federation support address shown on the account
   page. Treat the sender address as a clue, not identity proof. Confirm
   control of the account through a fresh provider sign-in or a separately
   documented verification step; do not delete from an unverified email.
2. Record only a case identifier, request date, verification method and
   outcome in restricted internal operations. Avoid placing identity data in
   Git or a public corrections record. Check for any linked application data or
   Storage objects before deletion; the pilot currently has no application
   tables but that can change.
3. Revoke active sessions where the provider allows it, delete the exact Auth
   user through the provider's administrative workflow, and verify the user and
   linked identities are absent. A deleted Auth user can leave an already-issued
   access token valid until its expiry. Test that the Federation `/session` and
   `/refresh` routes reject the deleted user's browser after deletion, then
   clear its browser cookies.
4. Tell the requester what was deleted and any verified limits from vendor
   backups or logs. Do not promise immediate removal from backups without
   confirming provider policy.

Run the entire procedure first with a disposable account created for this
purpose. Preserve the owner's only pilot user. If any step cannot be verified,
keep public registration closed and state the failure precisely.

The isolated technical test on October 7 used a disposable user and proved
that the Federation preview returned 200 for its session before deletion and
401 for that same session afterward. Supabase returned `refresh_token_not_found`
for the old refresh token. The draft's refresh route now maps that provider
response to 401 and clears cookies; the hosted mapping was checked with a
synthetic invalid token. The owner pilot user remained present. This does not
test an actual requester's identity verification, vendor backup/log retention,
or whether unrelated consumers of an already-issued JWT reject it immediately.

## Recovery and release gates

- Supabase Free can pause during low activity and does not supply the same
  downloadable dashboard backups as paid plans. Design a restricted,
  encrypted logical backup and restore test before depending on accounts for
  public access. The pilot dashboard confirmed no automatic Free backups on
  October 7. The official CLI dump path requires Docker and a database
  connection; the CLI, Docker and `psql` were not available on this dev
  computer's PATH at the initial preflight. Official pgAdmin 4 later supplied
  local PostgreSQL client tools, including `pg_dump` and `pg_restore`, but no
  Auth export or restore has been performed. A local Git checkout is not an
  identity-data backup. Do not put a connection URL, password, raw dump or
  user export in Git or chat.
- A generic `supabase db dump` file is not yet evidence that Federation users
  can be recovered. The [CLI command reference](https://supabase.com/docs/reference/cli/supabase-db-dump)
  says its default filtering excludes managed schemas including `auth`, while
  [Supabase's Auth migration guide](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects)
  says an Auth migration needs its own verified procedure. Before treating any
  manual export as a backup, confirm the encrypted artifact includes the
  expected `auth.users` and `auth.identities` records without printing them in
  logs, and restore it into a disposable isolated target. Compare only counts
  and a private test login; do not overwrite this pilot or send live mail from
  the restore. Record the tool version, exact commands, artifact hash, target,
  and result in the restricted operations area. Provider settings, redirect
  allowlists, and secrets need a separate recovery checklist.
- Confirm which vendor records are kept, where the data notice links, who
  handles deletion requests, and what realistic response time can be offered.
- Supabase's Email provider remains enabled in the pilot even though the site
  presents only Google. With signup disabled this does not open public
  registration. On October 7, 2026, one direct Email/password signup request
  and one direct Email OTP request with user creation requested each returned
  HTTP 422 `signup_disabled`; a read-only Auth count stayed at one and neither
  synthetic address appeared. This proves the current closed configuration for
  those two routes, not the future behavior after global signup is enabled.
  Before turning signup on, verify and close any direct Email
  signup route or review it as a separately supported option. The October 7
  provider page shows one `Enable email provider` control covering both email
  sign-up and login; disabling it would remove the owner's password fallback.
  The pilot has no Auth hook configured. A documented Before User Created hook
  could reject new users whose provider is not Google without removing an
  existing password login, but it needs privilege review, a real hosted
  enabled-signup test, and a fail-closed rollback before it can count as a
  control. Preserve a tested Google and recovery path first. This includes the direct
  passwordless Email route: [Supabase documents](https://supabase.com/docs/guides/auth/auth-email-passwordless)
  that an OTP/Magic Link request can create a new user by default unless its
  caller explicitly opts out. Hiding Email controls on the Federation page is
  not a substitute for testing the provider's own public endpoints.
- The October 7 security advisor reported leaked-password protection disabled.
  Resolve or explicitly scope that warning before any password registration.
- Keep Google production credentials separate from the preview OAuth client;
  register only required callbacks and basic identity scopes. Apple can remain
  off for a Google-only launch. Review real cancellation, replay, provider
  outage, multi-tab refresh, cost and a production rollback before publishing.

**Cost choice at external beta:** keep the closed one-owner pilot on Free for
now. Supabase currently lists Pro from $25/month with seven days of daily
backups and no inactivity pause, while Free has neither automatic backups nor
an availability promise against low-activity pausing. Pro is the simpler
recovery/availability route for a public account service, but paying alone
does not prove a restore or settle deletion and Email-provider policy. No
subscription or paid feature was enabled in this review.

References: [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data),
[sessions](https://supabase.com/docs/guides/auth/sessions),
[sign-out](https://supabase.com/docs/guides/auth/signout),
[backups](https://supabase.com/docs/guides/platform/backups),
[backup/restore using CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore),
[Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing),
[pricing](https://supabase.com/pricing), and
[production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).

## October 7 daytime review — evidence and remaining work

A read-only aggregate check on October 7, 2026 found the following. No emails,
user identifiers, password hashes, tokens or identity payloads were retrieved.

| Project | Auth users | Linked identities | Orphan identities | Public application tables |
| --- | ---: | ---: | ---: | ---: |
| Federation Account Pilot | 1 | 2 | 0 | 0 |
| Federation Account Restore Drill | 1 | 2 | 0 | 0 |

Matching counts are a useful preflight, not proof of an export, matching record
contents, recoverable credentials, or successful restored sign-in. The earlier
statement that no export/restore had occurred describes the previous preflight;
this review cannot establish what transfer populated the restore target. Keep
the recovery gate unresolved until restricted evidence identifies the encrypted
artifact, source and target, tool versions, restore result and an actual restored
login. Do not repeat a restore over either existing project just to obtain proof.

### Request verification and deletion acceptance

Before public registration, rehearse these cases using a disposable account:

- A request from a different address or an unverified sender causes no deletion.
  Ask for verification without confirming whether an account exists.
- An authenticated deletion confirmation must identify the exact provider user,
  require a fresh sign-in and bind consent to that deletion request. The current
  account page has no such confirmation feature; an email address displayed in
  a screenshot or supplied in a message is not sufficient proof.
- If using a manual mailbox challenge instead, document and test a short-lived,
  single-use challenge sent only to the provider-verified account address. Do
  not accept forwarded screenshots as proof or ask for passwords, OAuth codes,
  wallet signatures or tokens. This challenge is a proposed procedure, not an
  implemented feature.
- A duplicate request is handled idempotently. A changed or ambiguous identity,
  failed verification, or unavailable provider pauses the deletion rather than
  selecting a user by an approximate email match.
- Record the exact user privately before revocation/deletion; verify both its
  Auth user and linked identities are absent afterward. Check linked Storage
  ownership and application records before declaring completion.
- Repeat the session and refresh rejection checks for that disposable user.
  Record the result privately and send completion only to the verified request
  channel. Preserve the owner pilot account.

The pilot already proved the technical disposable-user deletion path. These
request-verification cases remain untested and must not be described as a
completed support workflow.

### Prevent deletion reversal during recovery

A backup can contain an account deleted after the backup was taken. Maintain a
restricted deletion ledger outside the database being restored, containing the
minimum exact user reference, deletion time, case reference and outcome needed
to reconcile recovery. Decide its access controls and retention before launch;
do not put identifiers or request correspondence in this public repository.

Before connecting a restored project to any public application, keep signup and
outbound email closed, reconcile deletions newer than the recovery point,
remove the affected restored identities/users through the reviewed provider
workflow, and check the result. Do not restore old sessions or refresh tokens
as a way of keeping browsers signed in. Require fresh authentication following
recovery and prove that a previously deleted disposable account stays absent
and cannot resume its old session. Any failure keeps the restored service
isolated.

This is a proposed recovery safeguard; no ledger, deletion, provider change,
restore, mail delivery or production activation was performed by this review.


## Google-only new-account control — reviewed design, not deployed

The owner's requested Google-only account entry must be enforced at the identity
provider as well as on the Federation page. The proposed control is Supabase's
Before User Created Postgres hook. It runs only before a new user is inserted;
it is not a password-verification hook and is not intended to disable existing
owner password login. Its actual interaction with existing-user login and OAuth
identity linking still needs hosted tests.

### Decision and privilege contract

- Allow a new user only when the hook's server-supplied
  `user.app_metadata.provider` is exactly `google` and
  `user.is_anonymous` is explicitly false. Reject missing, malformed or unknown
  values, Email/password, Email OTP, phone, Apple and every other provider.
- Never read `user_metadata` to authorize signup. A client-supplied claim of
  `provider: google` must not bypass the hook. Do not trust a provider label in
  an HTTP request or a browser form.
- Use a dedicated schema excluded from the Data API's exposed schemas and a
  JSONB-in/JSONB-out function with `SECURITY INVOKER` and an empty search path.
  The function needs no table access, Auth-table grants, network calls or writes.
  Do not introduce `SECURITY DEFINER` to fix a permission error.
- In one transaction, revoke schema/function access from PUBLIC, anon and
  authenticated, and grant only schema USAGE and exact-function EXECUTE to
  supabase_auth_admin. Verify effective privileges, including inherited roles
  and existing default privileges; do not assume a schema name makes it private.
  Confirm the dashboard-selected hook still has these effective privileges.
- Return a generic documented error object for rejection, without including
  email, identifiers, request metadata or payload values. Do not log payloads.
  An empty JSON object permits the signup. Treat a runtime error or timeout as
  an acceptance-test failure until hosted behavior proves no user was inserted.

No SQL function, schema, grant or hook setting was created by this review. A
versioned migration must be generated with the actual Supabase CLI when the
isolated implementation is authorized; this prose is not an executable migration.

### Isolated acceptance matrix

Use a separately approved disposable identity target, exact test preview,
owner-designated test identities and a bounded test window. Do not temporarily
open either existing owner project to public signup. Record only aggregate
outcomes in public Git; keep exact test-user references in restricted operations.

| Case | Required result |
| --- | --- |
| New Google test identity through the real provider round trip | Exactly one user created, verified server session, reload and logout work |
| Direct Email/password signup | Rejected by the hook, zero user/identity insertion |
| Direct Email OTP with user creation requested | Rejected, zero insertion, no signup mail delivered |
| Email request with spoofed user_metadata provider=google | Rejected, zero insertion |
| Missing provider, wrong types, anonymous user or unknown provider payload | Function denies without revealing payload |
| Existing owner Google login | Works, existing exact user retained |
| Existing owner password login | Works, existing exact user retained; no password shared with reviewer |
| Existing-user Google identity linking | Intended link behavior verified; no duplicate user or unintended identity link |
| Hook execute privilege revoked or hook made unavailable in disposable target | New-user creation fails closed; actual response and counts recorded |
| anon/authenticated direct function invocation | Denied; hook cannot be used as a public RPC |
| Corrected hook restored after failure test | Expected signup decision returns and existing login remains usable |

A payload unit test or current `signup_disabled` response does not prove these
hosted controls. New-user route tests require signup enabled only in the approved
disposable target with the hook already attached. Use a controlled mail sink or
reviewed delivery isolation before the OTP test; global mail suppression must not
be mistaken for hook enforcement. Preserve evidence of rejection before delivery.

### Rollout and rollback order

First verify the migration's privileges, attach the hook while signup is still
closed, and confirm the existing owner's two login paths. Then run the isolated
acceptance matrix and security advisor review. Only after the remaining recovery,
privacy/deletion, availability and cost gates are satisfied may a separate release
approve public signup. This hook controls account creation, not wallet ownership,
financial eligibility, post-creation identity linking or every Auth endpoint.

On any failed rollout, **disable new-user signup first** and verify direct Email
and Google creation are closed. Keep the reviewed hook attached while closing
signup. Only after closure is confirmed may a separately approved rollback detach
or replace the hook. Never remove it while signup remains open; that would reopen
alternative signup routes. Preserve the existing owner account, login paths and
restricted evidence. Do not delete users as an automatic rollback step.

Reviewed against the current October 7 changelog and official
[Before User Created hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
and [Auth hook security/error handling](https://supabase.com/docs/guides/auth/auth-hooks)
documentation. No relevant new Auth-hook breaking change was identified. The
provider control remains a candidate until the hosted acceptance matrix passes.


### October 7 rollback-only database probe

The owner authorized continuing the isolated test. The current execution
workspace did not have local PostgreSQL client/server tools. Instead,
[the reproducible probe](../tests/federation-google-signup-probe.sql) ran inside
an explicit transaction on Federation Account Restore Drill's PostgreSQL 17.11
and rolled back its dedicated schema, function and grants. The hook was never
attached and signup was never opened. It used synthetic JSON payloads, read no
user identifiers or password material, and wrote no Auth users or identities.

All 21 rule assertions passed: one exact non-anonymous Google payload allowed,
and 20 other/missing/malformed/spoofed payloads rejected. Effective schema and
function privilege assertions passed: supabase_auth_admin had the intended
USAGE/EXECUTE, while anon, authenticated and service_role had no function
EXECUTE. The function was SECURITY INVOKER. The final query reported the probe
schema absent, with the existing one user and two identities unchanged.

An attempted SET ROLE supabase_auth_admin was denied by the database connection.
The initial transaction did not persist; the probe was then rerun without role
impersonation and completed with rollback. No role membership or broader access
was granted to bypass this restriction. Effective ACL inspection and execution
as the creating database role do **not** prove actual Auth-role invocation.

The hosted acceptance matrix above therefore remains unresolved: actual hook
execution, new Google creation, direct Email/OTP denial before insertion/mail,
existing owner password/Google login and identity-link behavior, and real
hook-failure closure must be tested in a separately approved disposable target.
This probe is not an executable migration, a deployed signup control, or evidence
that public Google-only registration is ready.
