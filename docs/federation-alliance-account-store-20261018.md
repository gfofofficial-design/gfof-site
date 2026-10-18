# Alliance account history and acknowledgement storage

Disabled source candidate, October 18, 2026. Three unapplied SQL files and two
unmounted server modules add separate account-history and acknowledgement paths.
They do not open signup, authenticate an owner, remove an account, mount a route
or replace the existing Auth-removal hold. No hosted project, role, credential,
signing key, provider request, purchase or public feature changes.

## Domains and data flow

The [explicit managed-host candidate](federation-alliance-account-managed-20261018.md)
adds an opt-in provider schema/creator-membership profile and offline installer.
The strict default and original SQL files remain unchanged. It is not hosted
acceptance or permission to enable a service.

The [account contract](federation-alliance-account-history-contract-20261018.md)
defines separate subject/event/record domains, potentially linkable tags and the
128-admission/256-record lifetime bound. This storage candidate preserves it:

1. A trusted future coordinator derives the subject from a verified Auth identity.
   This increment has no such owner-verification/authorization endpoint.
2. A dedicated history database serializes conditional admission/removal appends.
   It stores a scoped singleton and bounded canonical records, with no raw Auth
   UUID, email, profile, token or image in those records.
3. A different dedicated acknowledgement database stores a monotonic sequence/hash
   floor. It independently validates the complete submitted chain and prior prefix
   before advancing. It does not store account contents or claim source freshness.
4. The bridge reads both, checks a protected external minimum, advances once by
   compare-and-set, then reads both again before returning evidence. An intent
   arriving during that operation remains pending until separately acknowledged.

The member database is neither history nor acknowledgement authority. Installing
both account domains in one database refuses. The common protocol refuses known
member/Auth/content-journal/control schemas. This is an isolation precondition,
not an inspection of every possible unrelated database object or an administrator
security boundary. Hosted accounts must be dedicated, reviewed and independently
recoverable; no new hosted target/access/cost is approved by these source files.

## Transactions, capacity and uncertain outcomes

The history singleton is locked for append, serializing capacity and the next tip.
Each lifetime admission reserves one removal slot. New admissions may be closed
while removals continue. At 128 admissions, later removals still fit; removal does
not replenish capacity. An old subject cannot re-admit after its removal. A replay
can return a prior receipt without inserting another row; it never reactivates an
account. Every caller must still inspect current full account history.

Both adapters use fixed parameterized queries, finite verified TLS pools, live
restricted-role/rights checks and committed-only results. Readers have no mutation
permission. Read transactions use repeatable-read/read-only snapshots. Writers
check synchronous commit, fsync and full-page writes, then return only after an
explicit COMMIT acknowledgement. The SQL history snapshot is volatile so an append
waiting on a competing singleton lock observes the newly committed tip, rather
than reusing the original statement's stale read snapshot.

Lost replies, deadline/cancellation after dispatch and malformed mutation replies
are unknown. There is no automatic retry, queue or late COMMIT after cancellation.
Fresh read-only inspection can recover an already-recorded receipt. A bridge with
an uncertain mutation refuses further mutations for its lifetime; it may still
perform read reconciliation. Reconstructing a bridge is not itself permission to
retry an unresolved business operation. An external durable pending-operation and
minimum handoff remains necessary before real users.

The acknowledgement store refuses regression, same-height forks, missing prefixes,
cross-scope or malformed history. Concurrent advances use an expected sequence/hash;
a conflict does not mean completion. A master switch pauses writes while allowing
scoped read reconciliation. An acknowledged removal is an acknowledged **intent**,
not erased Storage, revoked tokens or a physically deleted account.

## Least privilege and default closure

Each domain starts unconfigured, disabled and with four NOLOGIN/password-free roles:
owner, reader, writer and operator. Two history tables or one acknowledgement table
use forced RLS and an owner-only policy. Application roles have no direct table or
column access. Fixed private definer functions have empty search paths; public/API
execution is revoked. Only readers/writers can read; writers can call the one
domain mutation; the separate operator can bootstrap once and set mode. Bootstrap
leaves controls closed. Runtime adapters offer no bootstrap/mode operation.

The adapter pins distinct member/history/control refs, exact domain hostname,
certificate validation, TLS version and role identity. Unexpected memberships,
table/column rights, helper/operator execution or mixed-domain schemas refuse.
It reads no credential file/environment and imports no driver until explicitly
enabled with an exact connection object. Real managed-provider automatic role
memberships, ownership and grants still need review; the disposable bootstrap is
not proof those production settings match. Privileged operators can alter/drop
schemas and source, so independent protected minima and fleet fencing remain vital.

## Trust and recovery limits

These SQL paths establish recorded transactions in disposable PostgreSQL fixtures,
not an independently signed current witness. A caller supplying an old head and
old minimum can still validate an old self-consistent history. The bridge pins
observed floors within its process, but no real key, durable pin custody, current
challenge response, cross-instance admission fence or restart/handoff is configured.
Neither an admitted nor an acknowledged state is authorization to serve.

The original old-copy test rolls back synthetic history rows while retaining the
other cluster's higher floor. A separate [encrypted account capsule rehearsal](federation-alliance-account-recovery-20261018.md)
now covers these three tables, full schema/roles and fresh replacements against an
outside minimum. Existing sixteen-table archives remain unchanged; the companion
is not a coordinated nineteen-table or managed-service recovery. Current signed
authority, coordinated generations and real independent custody remain gates
before account-history storage is enabled. No running backup,
off-device custody, managed recovery, failover or RPO/RTO acceptance is claimed.

## Validation and remaining gates

Unit tests exercise default closure, host/TLS/rights/result validation, fixed
parameterization, commit/cancellation uncertainty, pending/acknowledged state,
floor rollback/forks, readback races and refusal to repeat an uncertain mutation.
The native driver adds two fresh local clusters after the earlier recovery suite,
using synthetic credentials only. It tests actual SQL canonical hashes, locked
defaults/forced RLS, reader restrictions and grant drift, lost history/ack COMMIT
replies, rollback against a separate floor, final-slot admission concurrency,
all reserved removals after admission closure, switches and exact teardown.

Both account domains now have a separate encrypted replacement rehearsal and an
unmounted [signed status candidate](federation-alliance-account-witness-20261018.md).
Next persist protected minimum/unknown handoff and integrate admission/denial checks into
every member/content operation. Owner/session verification, legacy admission and
epoch carry-forward, managed Auth/Storage deletion, persistent unknown-operation
handling, real keys/custody, privacy/retention, bounds and hosted acceptance remain.
No existing content v1 schema, Auth hold or public serving behavior is widened.

## Accessibility

No interface changes. Pending, unknown, access removed and erased must remain
different persistent text statuses in the future interface, with a keyboard and
screen-reader usable support route after sign-out. Users must not transcribe
ledger hashes or internal identifiers. The finite background protocol deadline
must not become timed pressure on a user completing a form. Plain status controls
and assistive/mobile acceptance remain required; tests imply no WCAG conformance.

Transaction reference: [PostgreSQL row locks](https://www.postgresql.org/docs/17/explicit-locking.html)
and [COMMIT](https://www.postgresql.org/docs/17/sql-commit.html). Supabase changelog
checked October18: October12's November10 HTTP TLS-cipher change is a later managed
HTTP acceptance concern, not a change to this direct PostgreSQL candidate.
