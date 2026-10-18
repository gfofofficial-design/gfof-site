# Alliance complete recovery acceptance plan

Prepared October 18, 2026. **Plan, not full recovery acceptance or an enabled
backup service.** No real key, archive, account permission, hosted restore,
subscription, schedule or public feature is created by this document.

## Current evidence

The disposable TLS fixture restores nine member and three journal data tables.
The added control test now makes a custom-format archive of the entire reviewed
`alliance_control` schema, including its two data tables, functions, constraints,
owners, grants and row-level-security policies. It closes the control policy,
closes existing fixture consumers/pools and locks all four control roles first.
The archive helper requires that state, an exact guarded server and a bounded
same-domain archive with an unchanged hash and table-of-contents list.

An occupied target, unlocked role, copied handle or second dump is refused.
After an actual schema drop, an injected DDL failure proves the single restore
transaction leaves no partial control schema. A separate explicit restore then
recovers exact policy/anchor contents, function definitions/owners/search paths,
constraints, effective schema/function/table permissions and forced RLS. Global
role attributes remain unchanged and locked. Fresh actual restricted TLS readers
and a pinned journal witness work afterward; the restored closed policy cannot
serve or reuse a previous boot approval. All synthetic archives/servers are removed.

This fixture is unencrypted, contains synthetic data, and restores into the same
disposable server with its existing global roles. It does not recover a lost
cluster, secrets, managed Auth, Storage objects or an independent trusted pin.
The paired member/journal archive remains data-only. Do not call these results a
complete recovery package, an off-site copy or a production restore.

## Required package and proofs

Every component below needs an explicit manifest entry, source scope/version,
capture boundary and tested restoration outcome. Missing, unknown or mismatched
components leave access closed; a successful checksum alone is insufficient.

| Component | Required contents and acceptance | Current evidence |
| --- | --- | --- |
| Member data | All nine fixed tables: ownership/profile, control, heads, operations, objects, daily counters, cleanup attempts, creation plans; compare IDs, flags and hashes | Actual synthetic data-only restore |
| Journal data | Control, admissions and permanent entries; exact sequence/hash and full canonical chain extending the independently protected latest minimum | Actual synthetic data-only restore |
| Control data | Closed startup policy plus live removal anchor; preserve revision, scope, generation relationship and later acknowledged minimum | Actual synthetic schema/data restore |
| Schema and security | Reviewed function bodies/search paths/owners, constraints, triggers, RLS/forced RLS/policies, schema/table/column/function grants, global default privileges and role memberships; no unintended API bypass | Control schema tested as above; complete member/journal/global reconstruction pending |
| Managed Auth | Required identities/account mappings and live session rules, provider configuration and explicit recovery method; account deletion/revocation cannot be undone by an older copy | Earlier separate Account Pilot drill is not Alliance acceptance |
| Storage | Exact retained object bytes, bucket/privacy policy, object IDs/hashes/receipt bindings; missing and deleted objects handled distinctly | Provider object recovery pending |
| Signing | Separate control and journal signing capability recovery, public fingerprint match, revocation and rotation/fleet procedure | Ephemeral test keys only |
| Archive decryption | Dedicated recovery identity, verified privately from its independent saved copy; encryptor uses only its public recipient | Real Alliance identity/round-trip pending |
| Independent trust | Current public record, expected SHA-256 and minimum generation from protected custody outside the restored archive; latest independent journal/control evidence | Strict source consumer and synthetic rollback tests only |
| Deployment | Reviewed source commit, migrations and package locks, runtime/endpoint configuration and credential references; no raw credentials in the ordinary manifest | Hosted rebuild/recovery pending |
| Fleet and access | Confirmed old workers/readers/signers fenced; restored roles initially locked; scheduled writes and Storage access remain closed until review | Disposable fixture lifecycle only |

PostgreSQL database dumps do not contain cluster-global roles. A table selection
alone also does not provide a complete dependency/schema restore. Keep reviewed,
password-free role/security reconstruction separate from data and verify its
effective rights before access. A dump can execute source-provided code during
restore, so only reviewed, provenance-checked artifacts enter an isolated target.
See [PostgreSQL pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html) and
[transactional pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html).

Supabase states that database backups contain Storage metadata, not object bytes,
and do not retain custom-role passwords. Hosted backup availability therefore
cannot replace the Storage and credential checks in this package. A cross-project
Auth restore also needs a real fresh login/session/deletion test, not just row
counts. See [Supabase backup limits](https://supabase.com/docs/guides/platform/backups).

## Encryption, integrity and custody

Proposed first version: independently encrypt the bounded database/security,
Auth-configuration and object components with a dedicated Alliance age recipient.
The owner holds the private decryption identity separately; the export process
needs only its public recipient. This follows the existing tool's public-key
workflow; no new encryption format is proposed. The key is distinct from both
signing keys, wallet keys, OAuth secrets, database passwords and the Watchtower
backup key. See [age usage](https://github.com/FiloSottile/age#usage).

Use a versioned encrypted manifest binding exact component names, domain scopes,
source commit/migration versions, frozen checkpoint, plaintext/ciphertext sizes and
hashes, recipient/public signing fingerprints and the public trust record. Opaque
outer inventory should contain only what is necessary to identify/decrypt the
package. Never put secrets in filenames, arguments, logs, source, chat or a
plaintext operational manifest. Plaintext handling, quotas and interrupted-export
cleanup need a tested implementation; this document does not provide one.

Successful decryption proves access to that encrypted content; hashes prove byte
integrity. Neither proves its source is authorized, its contents are safe SQL or
that it is the latest copy. Obtain expected trust digest/generation and latest
acknowledged removal evidence independently. Keep at least one encrypted copy
outside the primary device and database account, and verify recovery from that
specific copy. Availability on the Work and Dev PCs alone is not independence.

Do not assume a new provider, hardware module or paid recovery tier is necessary.
First review existing hosting/vault/device capabilities, their export/access
limits and exact costs. Choosing any new project, access, key storage, recurring
service or destructive retirement requires its concrete owner decision. Existing
native tooling can support the first isolated test; no upgrade was made here.

## Restore order and stopping conditions

1. Fence the old serving fleet and all writers; verify signup, schedules, credentials
   and provider access are closed. Capture and reread the same frozen boundary.
2. Retrieve protected current trust independently. Verify package provenance,
   approved source/schema versions, exact component coverage and byte integrity;
   privately test decryption. Do not execute an unreviewed recovered dump.
3. Prepare exact isolated targets with reviewed locked/password-free roles and
   approved managed-service dependencies. Restore each schema/data transaction
   separately. There is no cross-database atomic restore; one failure quarantines
   the whole set and stops automatic retry or release.
4. Verify table/inventory and security equality, full deletion chain and all external
   minimums. Recover only permitted Storage content and verify byte hashes. Test
   current versus removed ownership, Auth accounts/sessions and denied object views.
5. Privately prove both signing handles and decryption custody from independent
   saved copies; match public fingerprints. Restore no login permission from a
   backup. New credentials/access need explicit scoped configuration and review.
6. Perform a new boot-specific review and a separate later release through the
   pinned authority path. Verify real HTTP/browser/assistive journeys before public
   activation. Preserve minimal secret-free evidence and exact test cleanup.

An unknown latest acknowledged minimum must remain unavailable. An older member
copy, restored control policy, new signature or daily backup cannot supply missing
authority. Do not reset the epoch/floor, refund admission capacity, silently retry
an uncertain write or reopen deleted data to make a drill pass. Any quarantine,
discard or incident recovery policy needs its own reviewed decision.

## Smallest next implementation and acceptance

Build the bounded encryption/manifest runner using synthetic components first;
test independent-copy decryption, missing/mixed components, swapped scope/keys,
tampering, interrupted export/restore, security reconstruction and old deleted
content. Keep all managed features off. Only then prepare the exact limited hosted
drill: named targets, data limits, lifetime, access, cost cap, backup/restore proof
and cleanup. An Alliance backup cadence, retention, maximum data loss and restore
target still need a specific decision; the Watchtower daily target does not adopt
one for Alliance or permit losing deletion evidence. No running schedule is claimed.

Operator steps must name the one required vault item and purpose, allow paste and
use familiar keyboard/screen-reader-compatible controls. Provide progress and a
clear stopping status without countdown pressure, repeated secret entry, color-only
meaning or automatic destructive repair. Secret confirmation stays private; evidence
contains public fingerprints and sanitized outcomes. Actual assistive-technology,
mobile, encrypted independent-copy and hosted acceptance remain outstanding.
