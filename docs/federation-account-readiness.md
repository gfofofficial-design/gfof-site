# Federation account foundation — review build

Requested by the owner on October 6, 2026 for a shared Federation account,
including eventual staking and lending participation. This implementation is
closed by default. It does not open those financial products or connect wallets.

## Implemented

- Account dashboard with Google/Apple provider buttons enabled only by server configuration.
- Server-side OAuth authorization-code flow with PKCE, a random browser-bound state and ten-minute flow cookie.
- Verified provider user lookup before issuing HttpOnly, Secure, SameSite=Lax, host-only session cookies. Tokens never returned to browser JavaScript or stored in localStorage.
- Exact configured-origin validation on every POST; no return URL accepted from the client. Duplicate auth cookies fail closed.
- Session inspection, bounded cookie lifetime, refresh rotation and browser logout; upstream errors are generic and responses cannot be cached.
- Public browsing remains available. Dashboard links to missions and current staking/lending status.

## Configuration and release status

The owner created a dedicated Free Supabase project for this private pilot.
On October 6–7, 2026, the exact PR #99 Deploy Preview completed an owner-only
Google sign-in, existing-user identity link, session reload and browser logout.
New-user signup remains disabled, Apple remains disabled, and production has
no account environment settings. This result does not authorize a public
release or establish production availability.

The isolated pilot remains on Free while signup is closed. On October 7 its
Database Backups page explicitly said that Free has no project backups; the
local dev computer initially lacked the Supabase CLI, Docker and `psql` on PATH.
Official pgAdmin 4 was subsequently installed and its bundled `pg_dump`,
`pg_restore` and `psql` version 18.6 checked locally. This supplies client
tools but does not constitute a backup or remove the need for an isolated
restore under the [documented migration route](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
[Supabase's current plan page](https://supabase.com/pricing) lists Pro from
$25/month with seven days of daily backups, and its
[pausing guide](https://supabase.com/docs/guides/platform/free-project-pausing)
says paid projects do not auto-pause. No upgrade or manual database export has
been performed. Before inviting external account holders, choose and verify
an actual recovery path and acceptable availability/cost; do not describe the
Free pilot as a production account service.
The manual recovery proof must include Auth users and identities; a generic
schema/data dump may exclude Supabase-managed Auth tables. Verify an isolated
restore and test login rather than counting the presence of a dump file.

Server environment only:

| Name | Purpose |
| --- | --- |
| FEDERATION_ACCOUNT_ENABLED | True only on the exact pilot preview; leave production unset until acceptance is complete |
| FEDERATION_ACCOUNT_ORIGIN | Exact HTTPS origin; production https://galacticfederation.co |
| FEDERATION_AUTH_URL | Dedicated HTTPS project origin ending in .supabase.co |
| FEDERATION_AUTH_PUBLISHABLE_KEY | Publishable key only; service/secret keys rejected |
| FEDERATION_AUTH_GOOGLE_ENABLED | true only after Google OAuth configuration and testing |
| FEDERATION_AUTH_APPLE_ENABLED | true only after Apple configuration and testing |

The pilot's allowed application redirect pattern is
`https://deploy-preview-99--gfof.netlify.app/api/federation-account/callback?state=*`.
For a separately approved production release, use
`https://galacticfederation.co/api/federation-account/callback?state=*`.
The only wildcard is the generated state value; the scheme, host and callback
path remain exact. The callback independently validates the state against the
HttpOnly browser cookie. The separate Google/Apple registered redirect points
to the dedicated Supabase project's `/auth/v1/callback`, not the Federation
application callback. Do not use broad production redirect wildcards. Prove
successful sign-in, cancellation, expired callbacks and replay rejection for
each provider actually enabled in production. Apple can remain off for a
Google-only launch. Enabling Apple later requires its own
developer setup, Services ID, verified web domain, signing-key/client-secret
maintenance; never paste those credentials into GitHub or chat. A native app
configuration does not establish web sign-in support.

Use an isolated identity project and exact preview origin for acceptance.
An enabled Netlify deploy-preview or branch-deploy must have
FEDERATION_ACCOUNT_ORIGIN equal to DEPLOY_PRIME_URL's origin; inherited
production settings fail closed. Production accepts only the canonical
Federation origin. An explicit origin is required whenever accounts are
enabled. The hosted function also requires the platform request URL's origin to
match that exact configured origin before any provider operation, including GET
callbacks and session lookups. Missing or malformed request URLs fail closed.
Netlify's CONTEXT and DEPLOY_PRIME_URL build variables are supplemental checks
when present; they are not assumed to exist in Functions at runtime.
Never enable preview signups against the production identity project.

Configure provider rate limits and abuse controls, minimal scopes, user support,
privacy/retention/deletion policy, backup/recovery and cost ceilings before
registration opens. No email sign-in is implemented in this first build; it
needs separately configured delivery and abuse controls.

The draft Netlify redirects limit OAuth starts to 10 requests per minute per
IP/domain and other account API paths to 60 requests per minute per IP/domain.
Check Netlify's deploy post-processing log before counting those rules as active.
These are traffic throttles, not a site-wide hard cap or spending limit; a
distributed client can still make requests, and enforcement is not instant.
The handler rejects Netlify's built-in direct-function address before provider
calls, but that rejected request still invokes the function. Monitor usage and
set a separate operational budget before public registration.

The draft account page now states what sign-in records and offers an owner-managed
deletion request route. That short explanation is not a complete privacy policy
or an automated deletion workflow. Before public registration, confirm vendor
log/backup retention, complete the owner-request verification and deletion
procedure beyond the technical disposable-user test, and review the notice
with counsel as appropriate.

The October 7 read-only pilot check found one Auth user with two linked
identities and no tables in the application's `public` schema. This is an
observation of the isolated pilot, not proof that Supabase or Google retains no
other data. Supabase's security advisor also reported that leaked-password
protection is disabled. The pilot has an enabled Email provider and its owner
test user has a password, although the Federation page offers only Google.
With global signup disabled, direct hosted requests to the isolated pilot's
Email/password `/auth/v1/signup` and Email OTP `/auth/v1/otp` with
`create_user: true` both returned HTTP 422 `signup_disabled` on October 7, 2026.
A read-only Auth count was one before and after, with neither synthetic test
address present. This verifies these two routes only in the current closed
configuration; it does not show what they would do after enabling global
signup or whether every alternative route is covered.
Before allowing public **Google-only** registration, confirm the Email
provider cannot be used to create an account outside this page; disable that
route or document a separately reviewed control. Preserve a recovery path for
the owner test user before changing its password login. Supabase's direct
passwordless Email method can create users by default, so do not rely on hiding
an email button in the Federation interface.
The hosted pilot's Email-provider switch controls both Email signup and login;
turning it off would remove the owner's existing password fallback. The pilot
has no Auth hook configured. Supabase documents a **Before User Created** hook
that can reject new users by `user.app_metadata.provider`. A proposed
Google-only allowlist would reject Email, OTP, and every other provider at user
creation while leaving existing-user password login intact. It is a candidate,
not a deployed control: first review its SQL privileges and failure behavior,
test allow/deny payloads and the owner's two existing login paths, then run
bounded direct Email and Google new-user checks with signup enabled in an
isolated test. Do not turn on global signup based on the current 422 results or
on a function unit test alone. See the official
[hook input and provider example](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook).

The [account-data operations plan](federation-account-data-operations.md)
records the current data inventory, a manual deletion procedure and the
Free-plan backup/recovery gap. A deletion request is not complete merely
because the account page has an email link. A disposable user was deleted
after its preview session returned 200; that same session returned 401 after
deletion, and Supabase rejected its old refresh token. The draft now treats
that rejected refresh as 401 and clears cookies. This tests the technical
session path, not an incoming owner request, vendor backup erasure or every
way an issued token could be used. The only owner pilot account was preserved.

## Boundaries and follow-up

This is a central account on GalacticFederation.co. Cookies do not provide SSO
to the separate dossiertrack.co domain. No Dossier deployment, database grant,
saved-report activation or infrastructure change is included. A later reviewed
cross-domain authorization flow is required before describing shared sign-in
as operational across products.

Mission progress remains browser-local. There is no cloud progress, profile
database, wallet linking, token ownership check, entitlement, staking position,
credit decision, deposit, withdrawal or custody in this implementation. Do not
present signed-in status as financial eligibility. Wallet association requires
a separate replay-resistant proof with explicit user consent; transactions
must stay in an independently verified provider flow.

The refresh cookie has a 24-hour browser lifetime, access cookie at most one
hour, and each session lookup checks the provider. Logout reports whether
remote revocation was confirmed; clearing local cookies does not prove remote
revocation. Provider token/session behavior and multi-tab refresh contention
require integration testing. Sensitive transactions require a separately
designed recent-authentication/step-up policy. This code is not an audit or
proof of readiness for a lending service.

## Validation

`node --test tests/federation-account.test.mjs` uses synthetic fetch responses
only. It tests default closure, configuration constraints, CSRF rejection,
provider selection, PKCE/state binding, expiry, user verification, safe session
output, refresh, cookie ambiguity, upstream failures and local logout.
The private preview also exercised one Google provider round trip, browser
logout and an exact disposable-user deletion. On the hosted preview, synthetic callbacks with missing, mismatched or
expired flow state and an invalid authorization code returned to the failed
sign-in page without issuing an account session. A synthetic invalid refresh
returned 401 and cleared cookies after the deletion fix. These checks did not test a
real Google cancellation, successful-code replay, Apple, public registration,
provider downtime, multi-tab refresh or production cookies.

Primary implementation references:
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/social-login/auth-apple


October 7 follow-up: 29 focused handler/page tests passed after adding runtime
request-origin enforcement and dashboard query cleanup. Leftover OAuth return
parameters are removed without exchanging codes in browser JavaScript; the
server-verified cookie session remains the only sign-in signal. No registration
or financial access was activated by this change.

October 7 refresh correction: an expired or absent access cookie now clears
only that access cookie on a session check. The valid refresh cookie remains
available for the browser's next refresh request. Synthetic handler and page
tests cover that recovery path; an invalid or deleted-user refresh still
clears all auth cookies. Hosted multi-tab and real provider expiry remain
separate acceptance checks.

## October 7 security release requirement

The owner agreed to the [Federation security release gates](federation-security-release-gates.md). They apply before public registration or financial integration. The earlier missing-recovery description above predates the separate isolated restore pilot: Google sign-in was subsequently tested there, but recovery provenance and full session/deletion reconciliation are still incomplete. Keep signup closed until the required evidence packet and specific release approval are complete.
