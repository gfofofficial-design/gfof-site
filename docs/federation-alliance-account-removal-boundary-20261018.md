# Alliance account-removal boundary

Source candidate, October 18, 2026. **Unapplied safety hold, not an account-erasure
service or complete recovery acceptance.** No existing Supabase project, account,
login, website or data is changed. No account-removal endpoint is enabled.

## Gap demonstrated

The current independent journal records profile/image removal intents. A direct
Auth user deletion can cascade to local sessions, ownership and profile rows
without recording an account-wide independent intent. The native test demonstrates
that cascade using synthetic rows inside a transaction, rolls it back, and verifies
that the independent journal tip did not advance. A local cascade is insufficient
evidence to keep an older account/content backup from being revived later.

The account pilot's separate login/session source and earlier disposable-account
tests are not an Alliance account-erasure bridge. No code on that branch changes
in this increment. Supabase documents that already-issued access tokens survive
user deletion until expiry; sensitive operations need current session checks.
It also requires Storage ownership to be resolved before user deletion. See
[Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data).

## Implemented safety hold

The unapplied `alliance-auth-deletion-guard-candidate.sql` adds a private invoker
trigger function with an empty search path and no API/executor execution grant.
Two `ENABLE ALWAYS` triggers reject:

- Hard deletion of any `auth.users` row.
- Any change to `deleted_at`, including soft removal or clearing an existing mark.
- Bulk `TRUNCATE` of `auth.users`, including a cascading truncation.

There is no request flag, user-metadata claim, custom database setting, receipt
placeholder or allow-removal entrypoint. Replication mode does not bypass the
ALWAYS triggers. Ordinary unchanged deletion metadata, account restrictions and
session revocation remain possible. These operations are not account erasure.

The hold adds no role, table, credential, external connection or write authority.
It intentionally refuses deletion until a separately reviewed account-wide
protocol exists. Applying this partial hold to a shared managed project could
also block legitimate administrator deletion/maintenance. It is not approved for
hosted installation or production release. Auth schema ownership, provider
compatibility and the complete replacement protocol need concrete review first.

An administrator capable of disabling/dropping triggers, dropping schemas or
restoring database files can change this boundary. The hold does not prevent an
old Auth row being inserted by a restore, invalidate JWTs, erase Storage or create
an independent account tombstone. It must not be described as administrator-proof
protection or solved account resurrection. See
[PostgreSQL trigger enable modes](https://www.postgresql.org/docs/17/sql-altertable.html).

## Verification

The actual PostgreSQL fixture first demonstrates the unguarded cascade, then
installs the hold and checks its ownership, invoker/search-path settings, ALWAYS
mode and denied API execution. Linked synthetic profiles/sessions survive refused
hard, soft and bulk removal. Clearing a soft-delete mark also refuses. A forged
claim/custom setting and replica mode do not bypass the hold. Expected refusals
leave original inventory and the independent journal unchanged; every probe rolls
back its synthetic rows.

The full encrypted replacement exercise captures these Auth triggers and private
function with the schema/security archive. After restoration to a fresh member
cluster, the same linked-profile removal checks run again. Exact original data,
security, deletion-chain and closed-control checks remain, followed by complete
fixture teardown. Synthetic Auth is still a dependency substitute, not managed
Google login or provider-admin API acceptance.

Local verification: 432 server unit tests and 163 actual PostgreSQL18.6 driver
checks, plus the outer cleanup wrapper. Five new driver checks cover the cascade,
hold and restored behavior. The final linked-profile rehearsal passes; earlier
passing account/session-only evidence is retained separately. Final-head hosted
CI must be checked before source acceptance. All rows, roles, archives, clusters
and scratch belong to disposable fixtures and are removed afterward.

## Required account-wide protocol before release

1. Bind an explicit owner request to a fresh, verified account/session. A browser
   ID, mutable claim or checksum alone cannot authorize removal.
2. Define a separate canonical account subject and durable admission/intent in
   independent history, covering accounts with no profile, pending preparation,
   active content or previously removed content. Existing profile/image event
   shapes cannot silently stand in for account identity. Account identifiers or
   derived tags remain potentially linkable; privacy and retention need review.
3. Prevent further account/content work across all serving instances. Confirm the
   independent acknowledged minimum before claiming completion. Unknown writes or
   lost replies stay unresolved; do not automatically retry or infer a commit.
4. Coordinate existing profile/image intents, pending writes, exact Storage
   cleanup and managed session/user removal. Verify actual provider behavior and
   fresh authentication/refresh rejection with a disposable authorized account.
5. Restore an older Auth/member/Storage copy in isolation while obtaining current
   denial evidence outside that copy. Old identity/content must remain unavailable;
   a separately consented new identity must not inherit the old account's data.
6. Prove current provenance/minimums, independent key custody and old-fleet
   fencing, then define backup/object retention, erasure limits and support for
   pending requests. Cross-service operations are not one atomic transaction.
7. Review exact managed permissions/targets/costs and the accessible request/status
   interface before replacing this hold or publishing a deletion feature.

These are unresolved release requirements, not implemented services or authority
to create cloud access, keys or new retention policy. The separate
[account-history contract](federation-alliance-account-history-contract-20261018.md)
now defines a pure account subject/admission/intent/acknowledgement structure and
its privacy limits. It has no store, authenticated current witness, live serving
integration or deletion writer; those are still required before a managed Auth
deletion trial. No owner secret or cloud change is needed for this local work.

## Accessibility

No user interface changed. A future removal flow needs a plain description of
scope/retention, familiar keyboard/screen-reader controls and a clear confirmation
without timed pressure or repeated transcription. Pending, unknown, access removed
and physically erased are different statuses; communicate them in text rather
than color or a disappearing notification. Provide a usable support/reconciliation
path after sign-out without requiring the deleted account to authenticate.
Database tests establish no browser/mobile/assistive-technology or WCAG acceptance.
