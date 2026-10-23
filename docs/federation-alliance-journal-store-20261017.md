# Alliance independent journal store candidate

October17,2026. Unapplied SQL plus a disabled direct-Postgres adapter. No hosted
project, role/login/password, database installation, actual independent backup,
signing service, current floor, member route, retention policy or public feature
is created/enabled. This completes a locally tested recording component, not an
operating independent journal or a complete deletion/recovery guarantee.

## Member task and accessible outcomes

Record a removal intent once, preserve it after a lost reply and avoid consuming
two journal positions when requests compete or repeat. Keep recording separate
from detaching an image and proving physical cleanup. A journal receipt proves
neither Storage erasure nor that every deletion route participated.

Future UI should distinguish removal pending, recorded intent and cleanup pending
in plain text. Do not ask members to resubmit repeatedly, transcribe credentials
or race a deadline. Images stay optional and independently authorized text profiles
should remain usable. Provide an accessible support/recovery path for uncertainty.
This internal adapter adds no UI, assistive/mobile test or WCAG conformance claim.

## Placement, permissions and defaults

The proposed store belongs to a separately approved project and restore boundary.
The adapter rejects the member project's own host, pins a different20-character
Supabase-compatible direct database hostname and validates its CA/hostname/TLS.
SQL installation refuses a database containing the member ledger/profile binding.
Each connection also checks for later member co-location. These are checks of
configuration/catalogs, not proof of an independent provider failure domain,
backup procedure or account security. Approve and verify those before hosting.

SQL proposes two NOLOGIN, non-inheriting, non-superuser/non-bypass roles and a
private schema with two forced-RLS tables. Initial control is disabled,
unconfigured and empty at sequence0/zero digest. No configuration/login function
is granted. Future reviewed administration would configure the member scope/epoch
once and supply a separate restricted credential privately. There is no automatic
epoch reset, truncate, delete, update-entry or retention function.

Only the executor can call the four fixed private entry points. It has no direct
table access, public-schema CREATE, role membership or member Auth permission.
PUBLIC, anon, authenticated and service_role cannot execute them or read tables.
Owner-only helper functions retain a fixed empty search path. No table is exposed
through a public member API. A trusted server still must authorize the member and
bind the exact intent before calling this administrative recording boundary.

## Atomic append, idempotency and recovery

append receives the exact scope/epoch, expected sequence/hash and a strict minimal
intent. The SQL control-row lock serializes writers. An existing event ID with
the same kind/profile/object returns its original record, even after later appends;
reusing it for another intent is rejected. A new event with a stale expected tip
returns conflict without advancing. No automatic retry or rebase occurs.

For a new accepted event, SQL constructs the same fixed ASCII record format as the
existing encoder, computes its domain-separated SHA-256, inserts one unique event
and advances the control tip in one transaction. The independent Python vector
and actual driver tests verify SQL/JavaScript byte agreement. No original image,
email, Auth ID, token, URL, free text or raw provider receipt is stored. UUIDs and
the resulting hashes remain private, linkable metadata, not anonymized evidence.

The adapter sets synchronous_commit=on and requires fsync/full_page_writes on,
verified TLS, exact role/database and restricted privileges before its fixed SQL
call. Append also refuses asynchronous-commit settings at invocation. The adapter
validates the returned record/hash/subject before sending COMMIT and returns
recorded only after a confirmed COMMIT response. There is no caller-supplied SQL
or subsequent setting change. An executor deliberately issuing different SQL
could change its own session settings; permissions alone do not enforce a client's
commit behavior. Use the reviewed adapter, not a claim of arbitrary-client safety.

Post-dispatch/COMMIT uncertainty is unknown, not success or proof of no write.
The adapter destroys an unconfirmed connection and never automatically repeats
the append or performs a lookup. On a separately initiated recovery, lookup takes
the **entire original intent**. SQL selects by event ID; the adapter verifies the
recovered ID/kind/profile/object and exact hash before returning it. A matching ID
for another subject cannot become a recovery receipt. Missing means only that the
current verified read found no entry; failed reads stay unavailable. Reconcile
the independent current tip/floor and original authorization before further work.

These checks cover PostgreSQL's configured commit acknowledgement on the tested
server. They do not prove power-loss hardware behavior, synchronous replica/HA
failover durability, independent backup recovery or the cloud provider's actual
settings/SLA. The local lost-ack test is a real committed transaction followed by
a synthetic caller error; it is not a server-crash or power-loss experiment.

## Readability, capacity and witness composition

tip and lookup are read-only; records exports a complete prefix ending at an
explicit requested sequence/hash. A later append does not change an earlier
verified prefix. The adapter independently validates order, all hashes, unique IDs
and complete counts. Pausing append preserves reads and existing denials.

The first protocol caps history at256 entries to match the bounded verifier.
A final-slot race admits one new record; full returns without discarding old
intents. Exact old receipts remain recoverable at capacity. This is a candidate
work bound, not a public retention promise or approved production capacity. Before
real member use, design sufficient deletion capacity/admission and a reviewed
scalable checkpoint scheme. Exhaustion must keep serving/removal acknowledgement
closed and route to support; it cannot justify forgetting denials or denying an
unexplained privacy request indefinitely. No compaction or automatic expiry exists.

The existing signed reader can consume the actual SQL prefix with a synthetic
in-memory witness in tests. A real witness must consult this store's current tip,
use separately protected signing authority and preserve an independent monotonic
startup floor. Those components and their costs/custody/permissions remain gates.
Never sign a tip supplied by an untrusted caller or copied from a member backup.

## Driver bounds

Default closed; pg8.23.1 is imported lazily only when explicitly enabled. No new
package/version is added. The certificate-only CA and24–128-character credential
are supplied by a future reviewed host, never discovered from project files or
environment. Connection URLs, extra settings and private-key text refuse.

At most two connections/calls,2.5-second acquisition,2-second statements,
750ms locks,3-second idle transactions and4.5-second independent total deadline
bound work. Fixed parameter signatures and copied input prevent late caller edits.
Responses are bounded to256KiB. Cancellation/close destroys unconfirmed work;
late acquisition/results cannot issue a new transaction or COMMIT. Pool shutdown
is bounded to1second. Raw credentials/driver/database errors are not returned.
There is no queue, scheduler, retry loop or automatic provider action.

## Verification and release gates

Unit tests cover defaults, host separation, TLS/role/durability checks, exact
intent-bound recovery, strict copied DTOs, prefix integrity, conflict/full/paused,
lost responses, cancellation, deadlines, capacity and shutdown.

The actual-driver TLS fixture initializes this store only after removing the
earlier member fixture entirely. It reuses the same disposable server afterward;
that is not a physical independence or simultaneous multi-project recovery test.
It checks default locks, canonical hashing, fresh-client recovery, three real
concurrency races (different intents, same ID, final slot), a committed lost reply,
paused reads, complete256-entry export, SQL-side malformed/durability refusal,
private grants and later co-location refusal. Only synthetic records and ephemeral
test logins are used; exact journal rows/schema/roles are removed afterward.

Before adoption: independent hosting/backup/failure-domain decision and actual
durability/permissions/TLS/cost/data-rights checks; append crash/lost-ack/operator
recovery; real witness/key custody and persisted floor; deletion routing/bypass
prevention, capacity/admission, current-serving/startup freeze interlocks and
retention/replay/backup-erasure policy. Actual hosted Auth/Storage, member HTTP,
unknown-provider-proof reconciliation, abuse/privacy/support, native isolation,
assistive/mobile acceptance, Google warning clearance and publication remain gates.

Primary references checked October17: [PostgreSQL WAL reliability](https://www.postgresql.org/docs/17/wal-reliability.html),
[row locking](https://www.postgresql.org/docs/17/explicit-locking.html),
[Supabase changelog](https://supabase.com/changelog). No upgrade or hosted setting
change is made; provider-specific behavior remains unverified.
