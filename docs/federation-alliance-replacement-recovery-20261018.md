# Alliance replacement-cluster recovery exercise

Source candidate, October 18, 2026. This extends the
[encrypted archive exercise](federation-alliance-encrypted-archives-20261018.md)
to three freshly initialized disposable PostgreSQL clusters. It uses no hosted
project, actual member record, saved private key or provider API. Application
routes remain unmounted and no public Alliance feature is enabled.

## Recovery boundary

The three original fixture clusters stay closed and unchanged. The test captures
schema/data archives for the member's public/Auth/avatar schemas, the independent
journal schema and the control schema. Member coverage is eleven tables: the
existing nine member tables plus two **synthetic Auth dependency tables**. Journal
and control coverage remains three and two tables. These sixteen synthetic tables
are not sixteen production data sources or managed Auth acceptance.

The full-schema archives and a normalized schema/security snapshot pass through
the existing bounded age package. Exact original size/hash/object-list receipts
and expected trust/checkpoint remain in parent memory outside the ciphertext.
After removing original plaintext archives, the primary ciphertext and mutable
export buffers, a fresh byte-only process decrypts a separate same-host copy.
Only exact receipt-matched bytes can enter the guarded replacement restore.

Fresh clusters have none of the API/application roles or Alliance/Auth schemas.
All six source/target cluster system identifiers are checked as distinct; three
databases sharing the original cluster would not meet this fixture boundary.
The test recreates only fixed, reviewed role names and nonprivileged attributes,
with no passwords, memberships or login access. Global default function privilege
revocations come from literal reviewed candidate policy, not recovered arbitrary
role SQL or an assumption that a schema-selected dump covers global policy.
Provider administrators, credentials, role settings and managed configuration are
not imported. The database administrator and system roles are supplied by initdb.

Each restore is a separate transaction. The helper checks an empty target, locked
password-free nonprivileged roles, no memberships, original archive identity,
domain, hash and object list. `--clean --if-exists` is restricted to this empty
target so the archive can replace initdb's empty public schema inside the restore
transaction. It is not authority to overwrite a used database. An occupied target
or cross-domain archive refuses before restoration.

The archive is rendered into a bounded in-memory SQL buffer and executed with
`psql --single-transaction --file=-` and `ON_ERROR_STOP`. The same transaction
restores the literal reviewed public-schema usage baseline while keeping public
schema creation denied. A focused PostgreSQL test reproduced the missing usage
grant after a plain clean restore and confirmed equality with that explicit
baseline. Generated SQL buffers are cleared; no SQL script is retained by the
combined recovery exercise. This remains restricted to the original, reviewed,
synthetic archive; a checksum cannot make untrusted SQL safe.

## Evidence required before acceptance

- Compare every fixed table's canonical row hash/count, not just a total.
- Compare name-normalized schema/table/column/function ACLs, including grantor,
  grantee and grant option. Raw ACL OIDs differ between clusters and cannot serve
  as portable security evidence.
  Expand a null ACL with PostgreSQL's `acldefault(type, owner)` before comparison;
  null represents implicit defaults, not an empty grant set. Explicit equivalent
  defaults after restoration must compare equally without hiding changed grants.
- Compare constraints through PostgreSQL's canonical pretty deparser. A focused
  test demonstrates that parsing a dump can flatten redundant nested `AND`
  grouping from `BETWEEN` without changing the condition; the canonical display
  matches while names, conditions and column enforcement remain checked.
- Compare function bodies, owners, security/search-path settings, constraints,
  indexes, triggers, column types/defaults, RLS/forced RLS/policies and effective
  table rights. Compare global role attributes, memberships and default ACLs.
- Deliberately omit the member owner: the transactional restore must fail without
  leaving partial Auth/Alliance schema or profile data. Only a separate explicit
  fixture repair may precede another attempt; there is no automatic restore retry.
- Verify the new member/journal inventories against the protected checkpoint and
  the complete canonical deletion chain against the external acknowledged minimum.
  Serving, creation, cleanup and admission must stay closed.
- Introduce an anonymous profile grant, detect the changed security snapshot,
  remove that exact grant and recover the original snapshot.
- Remove archive files, byte buffers and all three fresh clusters, independently
  verify cleanup and confirm that original source data/security remain unchanged.

The test uses existing checksum-pinned age tooling and fixed local/container
identities. It accepts no production URL, credential or arbitrary restore path.
It creates no global tool installation or running backup service.

Local acceptance: 432 server unit tests and 158 actual driver checks, plus the
outer cleanup wrapper. Seven new checks cover this replacement exercise. Final
local PostgreSQL18.6 checks pass; independent readback finds no fixture scratch
or listeners55488–55494. Hosted final-head CI must be inspected separately.
Earlier failed runs and focused ACL/constraint diagnostics remain in private
operational evidence; they are not successful rehearsals. No cloud, key or
public-release action was required.

## Limits and next release work

This proves neither a cross-version upgrade nor managed Supabase reconstruction.
Source and target PostgreSQL versions match within each run. API roles, Auth rows,
sessions and helper functions are test substitutes. Fresh Google login, logout,
revocation, account deletion and older-copy resurrection protection still need
real managed acceptance. No Storage object, bucket policy, signing capability or
managed deployment setting is recovered here.

Private decryption identity, expected archive receipts and latest trust/minimums
remain in synthetic process memory, and all clusters/copies share one computer.
There is no independently saved key recovery, off-device custody, protected
lost-host catalog, provider/administrator independence or distributed atomic
restore. Known capability limits, package byte limits and memory-erasure limits
from the prior contract remain. Observed source equivalence is not an independent
audit of every permission or proof of provider-specific safety.

Next prepare managed Auth/account-deletion and Storage acceptance, independent
key/current-provenance custody and fleet fencing. Real target/access/destination,
cost, retention/cadence and publication need their concrete reviewed decisions.
No Alliance backup schedule or recovery-time/loss commitment is configured here.

No user interface changed. Future owner recovery steps must name one precise
vault item and purpose, support password-manager paste and familiar native
keyboard/screen-reader controls, and give clear status without countdowns or
repeated transcription. Source/database testing establishes no mobile,
assistive-technology or WCAG acceptance.

References checked October 18: [PostgreSQL pg_dump scope and restore trust](https://www.postgresql.org/docs/17/app-pgdump.html),
[pg_restore transaction and clean options](https://www.postgresql.org/docs/17/app-pgrestore.html),
[global default privileges](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html),
[ACL interpretation](https://www.postgresql.org/docs/17/functions-info.html),
[psql transactional script execution](https://www.postgresql.org/docs/17/app-psql.html),
and [Supabase backup limits](https://supabase.com/docs/guides/platform/backups).
