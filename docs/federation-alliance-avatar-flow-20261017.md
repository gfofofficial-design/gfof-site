# Alliance image replacement orchestration candidate

October 17, 2026. Disabled server source in the existing Alliance draft. No route,
environment lookup, hosted setup, member credential or background worker.

## Member task and accessibility

An optional profile image must not make a member lose their text profile, repeat
an uncertain upload, or see an old image reappear after removal. The coordinator
waits for committed permission at each dispatch boundary and reports bounded
plain states. A future form must preserve text/current image on failure, announce
progress and uncertainty politely, and offer a read-only status check rather
than silently uploading again. Cancellation stops future dispatch; it cannot
undo a publication already committed. Removing an image is a separate versioned
ledger action. No keyboard, screen-reader, phone or WCAG acceptance is claimed.

## Trust boundary and data flow

`createAvatarFlow` composes injected trusted ledger, processor and private Storage
gateway. Explicit boolean activation is required. Dependencies are server-owned,
never request-selected. `actorId` must be supplied by independently verified
server Auth, not browser JSON. The SQL role identity is not member authentication.
The current source deliberately exposes no browser endpoint or member session.

1. Validate and copy a bounded static PNG/JPEG/WebP input and operation/version.
2. Await a committed reservation. A replay returns state without decoding.
3. Decode/re-encode once; validate and hash the bounded PNG derivative.
4. Await a committed claim binding that descriptor and immutable object path.
   The profile UUID comes from this server claim, not the account UUID or browser.
5. Dispatch at most one gateway upload. Only a matching, settled, verified receipt
   can reach publication; the receipt is copied before an asynchronous SQL call.
6. Await confirmed publication. Stale/denied publication or settled unverified
   delivery records the exact proof as unpublished cleanup evidence. Unknown
   publication is never retried or assumed absent.

No SQL transaction is held while decoding or fetching Storage. Paths, provider
IDs, raw errors and receipts are excluded from result DTOs. `status` reads only
the operation state and never dispatches image work; it does not promise a current
profile image or version. A replay's committed version describes that operation,
not necessarily today's profile head. The immutable operation ID must be reused
after interruption; choosing another ID is not recovery.

## Limits, cancellation and uncertainty

At most two replacement calls are active per coordinator and one per actor/
operation; the durable ledger still governs cross-process quotas/idempotency.
The default total budget is 30 seconds, with the last 4.5 seconds reserved for an
awaited receipt/cancellation record. Stage ceilings are 4.75 seconds for ledger
calls and 8.25 seconds for codec/gateway work, allowing their existing 4.5/8-second
deadlines to return a sanitized outcome. Remaining total work time may shorten
any stage. Tests can lower the budget, never raise it above 30 seconds.

Abort is forwarded immediately. A gateway may return an already-known settled
receipt after cancellation; a separate bounded live signal records it without
publication. This phase is awaited, never queued as an untracked background task.
A response arriving after its stage deadline is ignored and cannot trigger another
stage. The original dependencies must also enforce their own dispatch/exit gates.

Before upload claim, confirmed cancellation can release only an undispatched
reservation. After committed claim, an unknown/not-started gateway result remains
conservatively unknown: the coordinator cannot invent evidence to refund the
writer. Unknown reserve/claim/commit, lost receipts, process crashes and database
unavailability require durable reconciliation. No retry, refund, physical deletion
or complete crash-recovery claim is provided. `cleanup_pending` confirms evidence
recording only; it is not a deletion receipt or running cleanup service.

`close` refuses new operations and aborts active replacement work while allowing
its bounded evidence recording. It does not own/close the injected database pool.
The caller must await in-flight requests and separately close owned resources.

## Evidence and remaining gates

Unit checks cover ordering, replay, copying, invalid/mismatched evidence, failed
decoding, uncertain mutations, cancellation at dispatch boundaries, late callbacks,
finite receipt recording, capacity, shutdown and private status results.

A real native child decoder plus real gateway compose against synthetic ledger/
provider responses on Windows and Ubuntu CI. A separate real-driver TLS/SCRAM
PostgreSQL fixture composes the coordinator and gateway with a validated fixture
derivative. It checks no transaction held across delivery, replay without another
provider request, and removal during delivery preserving settled stale evidence.
Neither fixture calls hosted Auth/Storage; the two fixtures are not an end-to-end
production or real-member acceptance test.

Before a member route: compose actual verified sessions, origin/CSRF and current
membership/profile authorization; authorize private viewing before/after reads;
design exclusive durable cleanup claims, uncertain-write reconciliation, bounded
metadata/tombstone retention and account/backup deletion without resurrection.
Hosting isolation, abuse/read limits, actual provider permissions, cost/retention
rights, recovery/support and assistive/mobile acceptance remain release gates.
Google's unresolved preview warning and existing publication review still apply.
