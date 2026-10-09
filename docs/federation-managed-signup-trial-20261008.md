# Managed Google-only signup acceptance — proposed isolated test

Prepared October 8, 2026 for the Google-first Command Deck launch. Nothing in
this packet opens signup or applies a hosted migration. The owner-completed
Supabase Pro upgrade is now independently verified, with the spend cap enabled.

## Exact change proposed for owner review

Create **Federation Google Signup Acceptance** in the existing **Galactic
Federation Org**, region `us-east-2`, Micro compute. Both existing Pilot and
Restore Drill projects stay unchanged. The provider's current project cost
tool quotes **$10/month while the additional project remains active**. Published
Micro compute is $0.01344 per started hour; the test is intended for one session
and the temporary project should be removed afterward. This is an operating
plan, not an automatic billing cutoff. Creation needs separate cost approval.

The local migration
`supabase/migrations/20261009013602_federation_google_only_signup.sql` was
generated with Supabase CLI 2.120.0. It creates only a private schema and an
invoker function with an empty search path; only `supabase_auth_admin` receives
schema USAGE/function EXECUTE. It reads Auth-supplied provider metadata and
allows non-anonymous Google creation. All other inputs receive a generic deny.
It adds no table, ownership association, background job or application data.
The existing disposable native and Auth-service fixtures now load this exact
migration, instead of independently reproducing its rule.

## Before any signup setting

1. Record the newly returned project ID, health, Postgres/Auth versions, empty
   Auth counts and exposed schemas. Refuse either existing project ID.
2. Keep new-user signup closed. Apply only the reviewed migration and inspect
   its exact function, path, invoker mode and effective grants to Auth and
   public/API roles. Run provider security advisors.
3. Configure a dedicated test Google client or explicitly approved temporary
   callback on the pilot client. Keep credentials owner-private. Restrict the
   app's test audience and redirect to the exact acceptance callback; do not
   add a wildcard or publish the Google app. Prepare a server-side PKCE test
   receiver that keeps state/codes/tokens out of logs and saved evidence.
4. Record the attached Before User Created function and managed Auth request
   deadline. Keep Email provider enabled for the denial test, anonymous/phone/
   Apple off, and prove no alternate hook or privileged API route is exposed.

## Acceptance window

After exact-target/grant/Google configuration checks, enable new-user signup
**only on this disposable target** for the bounded test. Use the owner's
designated Google test identity and controlled delivery isolation. Record
aggregate results, status codes and elapsed times, never tokens, credentials,
identity payloads or full Auth request bodies.

Run the [complete acceptance matrix](federation-account-data-operations.md#isolated-acceptance-matrix):
new Google creation/session, direct Email/password and OTP rejection, spoofed
metadata rejection, existing-user behavior, public function denial, deliberate
grant/function failure, corrected-rule behavior and managed timeout handling.
For OTP, verify the rule's specific denial before insertion/delivery; a mail
allowlist or disabled SMTP alone is not rule enforcement. Do not repeatedly
retry a failing route or count a provider's generic email failure as a pass.

On any failed/uncertain gate, close new-user signup first and verify closure
before changing the hook. The original account, recovery copy, public site,
wallet permissions, financial services and paid RPC remain unchanged.

## Teardown and evidence

Close and prove new-user signup first; remove only the approved test callback
and credentials, then delete only the returned temporary project after exact
identity/data review. Any irreversible browser confirmation follows the
owner's action-time review process. Until deletion is verified, compute can
continue to accrue; report a teardown blocker rather than calling the bill
stopped. Preserve only sanitized results and public configuration/DDL hashes.

This test does not complete administrator MFA, actual-device checks, account
deletion/recovery reconciliation, monitoring, a production Google app or the
exact public-release approval. Keep PR #99 draft and production signup closed.

References: [compute billing](https://supabase.com/docs/guides/platform/manage-your-usage/compute),
[Before User Created hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook).

## October 9 isolated preparation and incomplete provider attempt

The owner separately approved and created the temporary target. Its pinned
rule was applied with invoker/empty-search-path mode and restricted effective
rights; only Auth has schema/function access. The Before User Created hook is
attached. A dedicated Google client and exact localhost callback are configured;
the owner handled the secret privately. Preflight and postflight both returned
zero users and identities. These catalog/configuration observations do not
prove managed signup enforcement or credential validity.

The first short window stopped at local initiation. Offline Chrome reproduced
the no-referrer form policy's Origin:null conflict; the repaired receiver keeps
exact-origin checks, finishes the local POST before provider navigation, and
retains no-referrer on that navigation. Eight tests and the wired offline
browser handoff passed. A separately approved retry reached Google's account
chooser, but no completed owner consent/callback receipt arrived. Registration
was closed and independently verified within its ten-minute maximum, and the
receiver and expired flow were removed. No user was created, no managed session
acceptance is claimed, and no existing project or public website changed.

The trial remains incomplete and closed. A fresh consent window and the rest
of the managed acceptance matrix require review. Temporary compute continues
until teardown is separately approved and verified. Keep PR #99 draft.

## October 9 subsequent window — managed Google allowed path passed

A fresh bounded window on the same temporary target completed one new,
non-anonymous Google account and identity on managed Auth v2.197.0. Google
reused the official account's existing consent. Ten instrumented Auth calls
verified PKCE exchange and authenticated user read, rejection of the consumed
sign-in code, refresh with a matching user, local logout and rejection of the
old refresh token. No session tokens were displayed or saved.

Registration was opened by 03:15:38 UTC and saved/refreshed off by 03:16:20 UTC.
An independent settings read confirmed closed signup. Read-only aggregate
postflight found one Google user, one identity and no public tables. The local
receiver was stopped. Existing projects and the public site stayed unchanged.

This supersedes the incomplete allowed-path status above; it does not complete
the managed denial, privilege/fault, timeout, production-session or operations
matrix. Prepare those checks with signup closed and obtain separate review for
any new window or hosted change. The temporary project continues to accrue
compute until verified teardown. Keep PR #99 draft.

## Next bounded rejection window — prepared, not run

The private exact-target runner passes eight offline tests. It proposes one
separately reviewed three-minute window on the same temporary project, with
five attempts: direct Email/password, forged user metadata, forged top-level
provider fields, Email OTP requesting creation, and forged OTP metadata.
Only owner-controlled mailbox aliases would be used. No existing user,
installed rule, privileges, delivery configuration or public site changes.

The normal path uses eight Auth calls, with at most one unexpected-session
logout and one independent closure read: ten calls total, no retries. Every
case must return HTTP 403 and the exact rule message. Generic errors, mail
allowlist failures, rate limits or a success containing no session are not
passes. Stop on the first uncertain result and close registration immediately;
independently confirm settings, unchanged aggregate rows and rule/grants.
The managed no-delivery condition also requires checking the controlled inbox,
rather than inferring it solely from row counts. This proposal has not run and
does not complete the separate privilege/fault/deadline matrix.

### First reviewed rejection window stopped before requests

The first reviewed window stopped at the independent open-state guard after
three health/settings calls; no signup or OTP creation case was attempted.
Registration was closed and independently confirmed within the approved bound.
Aggregate rows and the pinned rule/rights remained unchanged. The first receipt
did not identify which state condition failed; no propagation or caching cause
is established. The revised checker retains fixed diagnostic booleans, and the
next separately reviewed procedure verifies save/reload plus one short settling
interval before its single state read. Eight offline tests pass. No managed
non-Google rejection acceptance is claimed from this stopped window.
