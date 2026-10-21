# Alliance journal-first removal candidate

October 17, 2026. Disabled/unmounted source and unapplied SQL extension. No hosted
schema, permission, credential, project, provider call or public feature changed.

## Removal and recovery behavior

The existing member facade now delegates image/profile deletion only to the
journal-first coordinator. There is no older direct-mutation fallback. A verified
cookie supplies account/session/expiry; the browser supplies only operation ID,
version and the appropriate explicit self-removal confirmation. The older profile
API DELETE path is closed before Auth/RPC, and the SQL extension revokes direct
authenticated table deletion, the older profile RPC and executor image removal.

Prepare commits an immutable plan in the existing private operations table before
any external call. It binds the actor, operation, profile, version and scope.
Reusing the same operation returns the same plan or its already committed result.
Another pending removal cannot replace it or consume another removal allowance.
The control-row lock serializes prepare with reserve/claim/publication. Pending
plans fence those writes and private head reads. No lock is held across a journal
call. Settlement of already-dispatched provider acknowledgements remains possible.

Image removal includes **all retained object identities**, including deleted,
cleanup and in-flight rows, rather than just the current pointer. The finite
candidate refuses more than four identities; it never silently omits old history.
Profile removal needs one profile-wide intent. Its old profile ID is permanently
denied; recreating a profile must use a new ID. The journal's256-record bound and
this four-identity limit are test constraints, not production admission policy.

Deterministic, domain-separated event IDs bind kind/profile/object independently
of retries. A run verifies the complete current journal chain and its configured/
observed floor, reuses exact known intents and conditionally appends each missing
intent once. Conflict/full/pause stops without retry. A lost append reply stays
unknown: a separately requested run reconciles the complete chain instead of
blindly appending again. No physical cleanup or provider request occurs here.

Only after all exact intents have confirmed records does the coordinator request
finish. SQL binds the frozen plan and exact derived event identities, then clears
the image pointer or cascades the profile removal. The original operation stores
its result. A lost member reply can therefore be confirmed without repeating the
journal writes, version change or quota charge. Profile completion can replay
after the profile is gone, but only with the same actor's current live session.

## Trust, privacy and bounds

SQL validates receipt identities/shape but cannot prove an independent remote
commit from a supplied hash. The restricted executor is a trusted server boundary,
not an end-user credential; it must use this coordinator. A compromised executor
could fabricate receipt hashes. No claim of cryptographic SQL enforcement or a
distributed transaction is made.

The coordinator admits one run, no queue, at most four appends, a30-second response
deadline and earlier session expiry/cancellation. It has no automatic retry or
background task. Unknown dispatch/commit results never claim rollback. Aborted
instances stay closed; noncooperative late dependencies cannot start follow-up
work through them. Preparation does not expire/reset automatically: the intent
needs explicit recovery, not disappearance during a backup restore.

The member store adds private removal actor/manifest columns to the existing
operations table; no new role or table is proposed. Auth IDs in the actor binding
are linkable personal metadata and are not sent to the independent journal or
browser. The journal contains private profile/object/event UUIDs and hashes, not
images, email, free text or Auth IDs. Neither hash chain nor UUIDs are anonymization.
Retention/replay/backup policy and actual encrypted backup coverage remain gates.

## Accessibility

The future UI must distinguish removal pending, outcome unknown and confirmed
removal. It should preserve the operation ID, allow accessible user-controlled
reconciliation, keep text profiles usable and avoid repeated confirmation,
transcription or countdown tasks. It must explain that detaching access and
physical provider cleanup are separate. No UI/assistive/mobile acceptance or
WCAG conformance is established by these source tests.

## Verification and remaining work

Unit tests cover journal-first ordering, complete identity coverage, stable event
IDs, partial lost replies, repeat confirmation, mismatches, paused/full/conflicting
records, floor/fork refusal, cancellation and capacity. Actual-driver TLS tests
cover private grants, durable capture, competing plans, write/read fencing, exact
event-identity binding, quota idempotency and profile cascade/replay. Journal
transport in the member-removal fixture is synthetic; the separate actual journal
store/producer tests do not establish two hosted projects communicating end to end.

Before activation: independent hosting/key custody and authenticated persisted
startup floor; actual startup/restore gate; journal capacity reserved before every
potential image creation; production admission/history bounds; bounded HTTP/UI
composition; directory/profile-text filtering after restore; the account-deletion
bridge; permission/cost/durability/encrypted recovery acceptance; unknown provider
proof; retention/replay/privacy/support; real assistive/mobile checks; Google
warning clearance and publication review. Administrative Auth cascades can still
delete data outside this application path; do not claim universal bypass prevention.

Primary references reviewed: [PostgreSQL locking](https://www.postgresql.org/docs/17/explicit-locking.html),
[Supabase sessions](https://supabase.com/docs/guides/auth/sessions), and
[Supabase changelog](https://supabase.com/changelog). The Markdown changelog was
unsupported. No SDK, database extension or provider feature upgrade was introduced.
