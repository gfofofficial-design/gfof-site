# Alliance account-domain encrypted replacement rehearsal

Source acceptance candidate, October 18, 2026. Disposable synthetic clusters only.
No live account, hosted setting, credential, key custody, backup schedule or public
service is created. Existing Auth deletion remains held. This is not managed
recovery, a serving permit or proof of physical account erasure.

## Coverage and boundaries

A separate **account recovery capsule** covers the two history tables and the
independent acknowledgement singleton, including their complete private schema,
functions, constraints, forced RLS, grants and fixed application roles. The existing
sixteen-table member/content/control rehearsal remains separate and unchanged.
Together the source rehearsals cover nineteen synthetic tables; they are **not one
coordinated nineteen-table capture or a whole-Federation recovery service**.

The account capsule reuses the existing bounded encrypted byte container:
`journal-data` holds the account history archive, `control-data` the account ack
archive, and `schema-security` the explicit `alliance-account-recovery-v1` metadata.
`member-data`, Auth, Storage and real signing-key components explicitly say they
are not captured in this companion. Exact purpose, scope, metadata hash, table
inventories and original archive receipts must match before restoration.

The byte-container's synthetic trust envelope checks scope/generation provenance;
its content-journal floor fields remain genesis placeholders. They are **not** a
current account authority. The actual acknowledged account minimum is separately
retained outside the recovered capsule and applied to the restored account chain.
Neither a checksum taken from a recovered file nor an age public recipient proves
authorship/currentness. Real independent custody and signed current account evidence
remain required before hosted use.

## Rehearsal flow

1. Close both account write switches and new admission; lock all application
   logins and remove their synthetic passwords. Capture complete canonical history,
   matching ack floor, exact three-table row counts/hashes and named security state.
2. Export actual PostgreSQL custom archives from only the allowlisted account
   schema. Validate object lists, original byte lengths/hashes and table counts.
   Sources must remain unchanged across capture.
3. Encrypt the bounded components using checksum-pinned age1.3.2 and a synthetic
   memory-only identity. Make a separate same-host ciphertext copy, remove the
   primary encrypted file and clear original archive buffers. Comparison snapshots,
   receipts and the independent minimum remain in parent memory.
4. A fresh byte-only Node process decrypts the separate copy. It has no database
   connection or restore code. Verify recovered purpose/metadata and both original
   archive receipts before touching a target.
5. Initialize two fresh replacement clusters, different from both sources. Rebuild
   only literal reviewed password-free NOLOGIN roles and default function policy;
   do not execute recovered role/password/ALTER SYSTEM exports. Restore each exact
   schema/archive in one transaction into its confirmed empty target.
6. Compare every table's row hash and full name-normalized security state: owners,
   functions/search paths, grants/grantors/options, RLS/policies, column definitions,
   constraints/indexes/triggers, default privileges and effective rights. Verify
   disabled switches, locked roles and canonical history against the external floor.

The helper accepts only explicit fixed account-domain aliases, local fixture
bindings or the confirmed disposable PostgreSQL17.11 container/ports. This is not a
general database restore API or an installer for arbitrary recovered files.
`pg_restore` executes source database code; the exact original receipt and fixed
schema/security allowlists are essential. See [PostgreSQL restoration warning and
transaction semantics](https://www.postgresql.org/docs/17/app-pgrestore.html).

## Failure acceptance

- Changed or crossed archive bytes refuse before writes. An occupied target also
  refuses; `--clean` does not authorize overwriting an existing account database.
- Removing the expected target owner causes the whole schema restore to roll back.
  No partial account schema survives. A literal fixture dependency repair is
  required before another restore; no automatic retry or privilege widening.
- An accidental anonymous table grant is detected by the full security comparison.
- Restoring older history while keeping the separate current ack refuses review.
  Rolling back both restored domains still refuses the protected outside minimum.
- Original source rows/security stay unchanged after capture, all target roles
  stay locked, and exact archives, encryption scratch and both replacements are
  removed. The surrounding account fixture later reopens only its own synthetic
  source roles to finish the pre-existing capacity tests, then removes them too.

Six new native checks join the existing account-storage driver. No production
runtime, SQL candidate, dependency, UI, Netlify setting or serving code changes.
The earlier sixteen-table recovery checks remain in the combined native run.

## Remaining release work

This attended same-host rehearsal retains identity, original receipts, comparison
metadata and the current minimum in memory. It does not prove lost-host/off-device
custody, power-loss/HA recovery, managed provider administration or secure memory
erasure by JavaScript/the OS. It does not coordinate member/Storage/account backup
generations, preserve a durable unknown-operation handoff, invalidate an old fleet
or establish a current signed account witness. No RPO/RTO or backup cadence is set.

An unmounted [signed account-status issuer/reader](federation-alliance-account-witness-20261018.md)
now checks fresh challenges and both process-memory pins. Durable protected pin/
unknown handoff is still required, then account admission/removal denial across all member/content
operations. Before live use, review coordinated recovery generations, legacy/epoch
carry-forward, actual Auth/session/Storage deletion and old-copy acceptance, real
key/operator custody, privacy/retention, hosted limits and HTTP/browser/Google/
mobile/assistive/publication gates. A restored admitted account still needs fresh
authentication and every access check; an acknowledged intent is not erased data.

## Accessibility

No user interface changed. Future recovery/removal states must remain distinct,
persistent plain text, with a keyboard/screen-reader usable reconciliation route
after sign-out. Do not ask members to transcribe archive hashes or ledger IDs or
turn a background process deadline into timed pressure. Native database evidence
does not establish browser, assistive-technology or WCAG acceptance.
