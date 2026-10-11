# Deleted-account recovery planning — offline draft

An older backup can contain an account deleted after capture. Before a restored
service is connected, reconcile a complete external deletion ledger against an
isolated inventory. The [planner](../scripts/plan-federation-auth-reconciliation.mjs)
prepares exact user/identity candidates for operator review using normalized
metadata. It performs no I/O and is not a deletion executor or launch gate pass.

## Inputs and custody

The exported `planAuthReconciliation(input)` function accepts schema version 1:

| Field | Required metadata |
| --- | --- |
| sourceProjectRef / targetProjectRef | Exact distinct project references; never restore onto the source. |
| backup | Source project reference, UTC capture time and encrypted archive SHA-256. |
| inventory | Target project reference, UTC observation time, users with only `id`, identities with only `id` and `userId`, and session/refresh-token row counts. |
| ledger | Source project reference, operator-reviewed complete-through UTC cutoff and entries containing only project reference, case reference, exact user UUID, recorded UTC time and outcome. |
| isolation | Explicit signup-closed, outbound-delivery-closed and production-connected booleans. |

Real records and returned UUIDs belong in restricted operational storage outside
this repository and public logs. No emails, passwords, password hashes, tokens,
provider payloads or request correspondence belong in this input. Unknown fields,
noncanonical identifiers and malformed metadata are rejected with fixed codes.
There is no command-line reader/exporter and no connection or credential input.
Each input collection is capped at 10,000 rows; larger recovery jobs need a
reviewed design rather than silently dropping records.

Isolation, cutoff completeness, source attribution, case authorization and
archive integrity are operator attestations. The planner cannot independently
verify any of them, and an archive hash does not prove its contents are correct.
Inventory counts alone cannot prove a restore. A real ledger's access controls,
retention and backup custody still need review and acceptance.

## Results and refusal behavior

Only `confirmed_deleted` entries produce removal candidates. Identical repeated
case entries and repeated confirmations for the same user are idempotent;
different identities/outcomes for one case are rejected. Already absent users
need no candidate. Identity matching uses exact UUIDs, never email similarity.

The result is `blocked`, with no candidate UUIDs, if registration or delivery
is open, the target is connected to production, session/refresh rows remain,
the ledger does not cover the inventory cutoff, there are orphan identities,
or a deletion case is pending/failed. An account present despite a confirmed
deletion predating the backup is a contradiction that also blocks review.
Project mismatch, duplicate inventory IDs and entries beyond the cutoff are
refused. None of these failures triggers a delete or a hosted retry.

An otherwise consistent result is `reviewable_removal_plan` or
`reviewable_no_removal`. These mean metadata is consistent enough for review,
not that deletion, recovery or release is verified. Candidates include exact
user UUIDs and only their linked identity UUIDs. The input is not mutated.

## Acceptance still required

Nine synthetic tests cover exact identity selection, retained users, repeated
requests, already absent accounts, project confusion, unconfirmed/failed
cases, isolation, sessions, orphan/duplicate identities, stale or contradictory
cutoffs, malformed metadata and raw-secret field refusal. They run in the
account boundary workflow. No real ledger, provider delete, database restore
or user sign-in is exercised by these tests.

Before launch, separately rehearse a verified disposable deletion request,
revocation/deletion, restoration of an earlier recovery point, external-ledger
reconciliation, independently observed absence and fresh/old-session rejection.
Keep the target isolated throughout and preserve the existing owner account.
Repeat source/target and fresh-cutoff checks before any operator action.
No restored service is activated by a successful planning result.

The [disposable native rehearsal](../tests/federation-auth-recovery-native.md)
adds a real Auth/Postgres older-dump, exact-deletion and retained-user sequence
to draft CI. It requires observed source/target rejection through the actual
Federation handlers as well as Auth. Until its exact-head job completes,
this is a prepared test, not passed evidence. Even a pass would remain synthetic
and would not establish real requester verification or external ledger custody.

Supabase [User Management](https://supabase.com/docs/guides/auth/managing-user-data)
explains that deleting a user does not immediately invalidate an existing JWT,
and storage ownership can prevent deletion. The broader
[data-operations procedure](federation-account-data-operations.md#prevent-deletion-reversal-during-recovery)
remains controlling. The current first release has no implemented cloud wallet
association or application-record feature; reassess reconciliation when one is added.
