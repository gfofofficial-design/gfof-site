# Alliance account checkpoint coordinator candidate

October 18, 2026. Local source and synthetic storage acceptance only. No hosted
store, account route, credential, signer, public feature or backend adoption.

## Ordering before mutation

`createAccountCheckpoint` in `lib/alliance-avatar-server/account-checkpoint.mjs`
defaults off. An enabled instance requires explicit scope/key, a protected minimum
receipt, separate record-slot and outside-anchor capabilities, account history and
acknowledgement adapters. It constructs no storage or credential lookup itself.

For each operation it reads the authenticated outside receipt, reads the matching
canonical record, then rereads the receipt. It refuses rollback below its retained
generation, a same-generation fork, mismatched pairs, wrong scope/key or bad bytes.
Complete account history must extend BOTH retained head and acknowledgement. New
observations are checkpointed before evidence is released; a final readback also
detects another writer staging pending work while an observation was underway.

`execute(intent)` first copies and validates the requested operation. It records
that exact pending intent in its own successor generation, commits record-slot
compare-and-set, commits outside-anchor compare-and-set, and reads both back before
one narrow `history.append` or `acknowledgements.advance` call. History pause blocks
dispatch. Admission closure blocks new admissions but permits removals. Actual
database functions must still enforce current policy and expected points.

Only one local request runs; there is no queue or automatic retry. Operations have
a total deadline of at most eight seconds, forward cancellation, and stop on close.
Input errors are distinct from unavailable evidence. Any uncertain storage write
or dispatched operation returns `unknown` and faults that instance. A late store
commit cannot resume its abandoned path to a mutation.

## Capability contract and trust boundary

| Capability | Required result |
| --- | --- |
| `slot.read(options)` | `{bytes, receipt:{generation,sha256}}` |
| `slot.compareAndSet({expected,bytes}, options)` | `{state:'committed',receipt}` only after a durable conditional commit; conflict must not overwrite |
| `anchor.read(options)` | Independently authenticated current `{generation,sha256}` |
| `anchor.advance({expected,next}, options)` | Same conditional durable commit semantics, exactly one successor |

`options.signal` applies to each bounded call. Production capabilities must enforce
their own deadlines and privileges and never claim a commit from an unacknowledged
write. Object separation alone does not establish independent storage, current
provenance, administrator protection or access control. Those properties need real
backend and custody acceptance. The factory's minimum receipt must also be retained
outside rollbackable restored copies; a fresh process with stale trusted inputs
cannot manufacture knowledge of a newer generation.

The two stores are not one distributed transaction. A record committed without
its outside receipt leaves a mismatched pair: future instances refuse it, rather
than advancing or rolling back either side automatically. If both commits succeed
but their reply is lost, a fresh instance sees pending work and refuses replay.
Compare-and-set permits only one competing successor; a loser never dispatches.

## Unknown outcomes remain unresolved

Even a reported business commit leaves the exact pending intent in both stores.
The outcome `reported_commit` is a reply classification, not independent commit
proof or permission. Any other reply remains unknown. No negative reply is treated
as proof that the operation did not commit.

`observe()` may checkpoint later complete history while preserving the identical
pending operation. It returns pending versus checkpointed plus minima, explicitly
establishing neither authorization nor erasure. A fresh `execute` seeing pending
work cannot dispatch, assign a new ID, clear it or retry it. The separate,
[explicitly opted-in conditional reconciliation candidate](federation-alliance-account-resolution-20261018.md)
can retain a version2 settlement receipt only when the canonical effect is
satisfied or the original expected position has been displaced. It cannot prove
which caller committed, infer noncommit from absence or retry a mutation.

## Actual storage evidence and limits

The test-only `account-checkpoint.fixture.mjs` uses two real disposable SQLite
files with WAL, `synchronous=FULL`, immediate transactions, conditional generation
checks and zero busy-wait/retry. It accepts only guarded synthetic temporary paths
and fixed fixture markers; there are no endpoints, accounts or secret inputs.
SQLite is a test adapter, not a proposed replacement for hosted PostgreSQL.

Tests exercise close/reopen persistence, competing child processes, abrupt child
exit before versus after the slot commit, exit after both commits before business
dispatch, and coherent rollback of both files against a separately retained latest
generation. Five real-storage cases run on the accepted Node24 builds; older Node
builds without `node:sqlite` explicitly skip them. The runtime coordinator has no
SQLite dependency. Windows/Linux CI must report zero skips for this acceptance.

These checks do not simulate power failure or dishonest hardware. Two files on one
test computer are not independent custody, a protected remote service or production
filesystem/ACL acceptance. Synthetic mutation transports are not a hosted database
commit/recovery test. Existing PostgreSQL account tests remain separate regression
evidence. Background processes, physical durability and runtime integration are
not inferred from passing fixtures.

Technical references: [Node SQLite](https://nodejs.org/api/sqlite.html),
[SQLite transaction semantics](https://sqlite.org/lang_transaction.html),
[synchronous settings](https://sqlite.org/pragma.html#pragma_synchronous), and
[atomic commit assumptions](https://sqlite.org/atomiccommit.html).

## Next acceptance and accessibility

Select and verify the real independently protected record/receipt backends before
any installation. Establish narrow credentials, CAS/durable commit/readback,
backups and rollback-resistant current custody, restart/fleet fencing and bounded
operational failure handling and verify the reconciliation contract against the
installed SQL/restore/old-producer barriers. Then key provenance/rotation and per-operation account/session/policy/content checks
with in-flight removal barriers. No source-only test authorizes cloud privileges,
spending, real keys, deployment or release.

There is no new interface. Future unknown/pending/paused status must use persistent
plain language, accessible keyboard/screen-reader controls and support after
sign-out. The backend deadline is not a user countdown. Avoid repeated secret entry
or hash transcription. No WCAG conformance is claimed. Account tags and operation
IDs may be linkable; real retention, access and deletion policy remain unresolved.
