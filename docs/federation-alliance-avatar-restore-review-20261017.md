# Alliance image-ledger restore comparison candidate

October17,2026. Disabled operator-only source and unapplied read-only SQL. No
backup, deletion journal, restore, compaction, retention policy, hosted permission,
route, scheduler or service activation is installed by this increment.

This is the earlier six-table image-only comparison. The later
[paired recovery candidate](federation-alliance-paired-recovery-20261017.md)
covers profile ownership/text, preparations and independent admissions too;
this older format cannot qualify as that complete fixed-list data inventory.

## Why compare before reopening

An older backup can contain a removed image pointer, a lower version, an operation
that appears unused, a missing deletion receipt or a lower spent quota. The
database's own older tombstones cannot reveal what happened after that backup.
This candidate compares the six image-ledger tables with a separately preserved,
trusted checkpoint. A mismatch or missing evidence keeps the review quarantined.
Even a match returns **access: closed**. There is no reopen or retry method.

This is an equality check of image-ledger data, not proof of complete recovery,
deletion, schema correctness or checkpoint provenance. It cannot enforce closure
in an unintegrated deployment. The existing member/cleanup routes remain unmounted.

## Accessibility and privacy at the decision points

Future recovery UI must say “Recovery needs review; your image remains unavailable”
in plain text, rather than asking a member to repeat the upload or act against a
countdown. Keep text profiles usable independently when their own authorization
and recovery gates pass. Use familiar status controls and explicit errors that
assistive technology can announce; no new interaction pattern is required.
No browser UI, keyboard/assistive/mobile acceptance or WCAG claim is added here.

Inventory returns only fixed table names, row counts and SHA-256 digests; raw
account IDs, receipts, object paths, original images and credentials are excluded.
Counts and hashes are still internal, potentially linkable information. Keep
checkpoints private with independent access controls; a hash is not anonymization,
a signature, an encrypted backup or permission to publish this evidence.

## Data flow and bounds

1. A separately reviewed recovery controller must actually stop member reads and
   writes, cleanup and in-flight provider work. A false feature switch alone does
   not prove quiescence. Freeze identity/time and the latest checkpoint must come
   from trusted state outside the archive being assessed.
2. The operator supplies the pinned project reference, current freeze UUID/time,
   and a checkpoint containing format1, that project/freeze identity, capture time
   and the six-table inventory. Reject a different project/freeze, a capture before
   the freeze, future/ambiguous dates, extra fields or an open checkpoint before
   querying the restored target. The review copies the inventory before awaiting.
3. One existing restricted TLS driver transaction calls restore_inventory(). A
   STABLE function sees one statement snapshot, normalizes timestamps to UTC/ISO,
   hashes complete JSON rows, sorts fixed-length hashes with C collation and hashes
   the resulting sequence. Duplicates and row counts remain significant. It reads
   control, heads, operations, objects, daily and cleanup_attempts, including old
   tombstones, unknown work, receipts and spent counters. No row is omitted to make
   a restored backup appear newer.
4. Each table is inspected through LIMIT1001; more than1000 rows refuses the whole
   inventory. This is an inspection-work limit, **not** a storage/retention policy
   or permission to remove records. The existing2-second SQL and4.5-second driver
   deadlines remain. Oversized rows/work can time out and remain unknown. No partial
   inventory is accepted.
5. After confirmed COMMIT, strict copied DTOs are compared. Open restored switches,
   malformed data, a changed digest/count, failure or uncertainty remain quarantined.
   An exact match reports matches_checkpoint with access closed. One review per
   instance,4.75-second outer deadline, cancellation/close and no retries bound work.

SQL uses only six fixed internal table names, no caller SQL. It adds one private
function, no role/table/membership/flag or direct executor SELECT. PUBLIC, anon,
authenticated and service_role cannot execute it. Existing NOLOGIN roles and forced
RLS remain. This extends the existing narrow definer boundary; no Auth grants are
added. No Storage/Auth/network gateway is invoked by the comparison module.

## What a match does not establish

The source does not authenticate a caller-supplied checkpoint or prove its
independence/freshness. Matching two copies of the same stale backup proves
nothing about later deletions. A timestamp and UUID are bindings, not evidence of
a real freeze or a continuously preserved journal. A privileged attacker who can
alter the database and trusted checkpoint is outside this check's guarantees.

Before adoption, build and review an independent durable deletion/change journal
or an equivalent authoritative current checkpoint pipeline. Establish continuity
through the actual freeze, including in-flight outcomes. If the source is lost
and that evidence is unavailable, **stay closed**, even if the archive is intact.
An older checkpoint bundled with the archive is insufficient. Reconciliation of
missing history and genuinely lost provider proof is not implemented here.

The inventory covers image-ledger row contents only. It excludes Auth/users/sessions,
profile ownership/moderation/text, Storage bytes/metadata, SQL function definitions,
constraints/policies/grants, role login state, code, deployment credentials and
backup copies elsewhere. Empty-table schema changes need separate schema checks.
Feature switches can change after the statement snapshot; no global lock/freeze
or future authorization is inferred. Actual restore/replay fences and a server
startup interlock remain required. No replay expiry, purge, automatic30-day rule,
backup deletion horizon or public retention promise has been adopted.

## Verification and release gates

Unit tests exercise scope/incident/date bindings, private DTO bounds, all six
ledger mismatches, open switches, copied inputs, missing evidence, cancellation,
late reads and capacity. The disposable real-driver TLS fixture compares unchanged
data, simulates older removal/version/replay/receipt/counter/claim rows, verifies
quarantine without mutations, checks timezone formatting and oversized-table
refusal, and verifies private execution rights. Synthetic fixture copies are
removed; no real account, archive or provider is used.

Hosted installation needs separate approval. Remaining release gates include the
independent journal/freeze/startup interlock, bounded replay/retention and backup
erasure policy, schema/Auth/profile/Storage recovery, actual hosted permissions and
credential containment, member HTTP/private-view controls, abuse/cost/data rights,
native isolation, assistive/mobile acceptance, Google warning clearance and review.

Primary guidance checked October17: [PostgreSQL statement snapshots](https://www.postgresql.org/docs/17/transaction-iso.html),
[SHA-256 and binary functions](https://www.postgresql.org/docs/17/functions-binarystring.html),
[Supabase changelog](https://supabase.com/changelog). No upgrade is required or made
for this source increment; current hosted compatibility remains a separate gate.
