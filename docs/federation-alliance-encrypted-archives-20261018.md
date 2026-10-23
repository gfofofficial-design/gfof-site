# Alliance encrypted database archive exercise

Source-only acceptance candidate, October 18, 2026. The bounded
[encrypted package](federation-alliance-encrypted-package-20261018.md) now has an
actual PostgreSQL archive integration in the disposable three-server test. It
uses only synthetic records, temporary test identities and local/container
databases. No hosted project, member record, real key or public feature changes.

## What the combined exercise proves

The test closes member creation/cleanup, journal admission and serving policy,
then records exact inventories, control definitions/permissions and a canonical
deletion chain checked against separately retained public trust. It captures
custom-format PGDMP archives of nine member tables, three journal tables and the
control schema with its two tables. Original byte counts, hashes and object lists
remain in guarded in-memory handles outside the encrypted copy.

Real age encryption packages those three archives with control security metadata,
public trust and explicit coverage records. A second ciphertext copy is checked;
the primary copy and all three original plaintext archive files are removed.
Mutable export buffers and the original identity buffer are cleared. A fresh Node
process decrypts the second copy, validates the package bindings and returns the
verified bytes through captured private process IPC. This child has no database
or restore capability. It prints no key or archive content to the test log.

The parent independently compares decrypted archive bytes with the original
retained receipts. Cross-domain swaps and a modified control archive refuse
before any database mutation. Only then does the test empty the exact synthetic
member/journal tables and remove the control schema. It restores the three
verified archives, each in a single database transaction, and checks exact
inventories, control catalog/owners/grants/RLS, locked roles, deletion floor and
closed policy. Fresh restricted TLS adapters and a pinned witness still work in
the surrounding fixture; coherent older-history rollback still refuses.

Exact temporary dump files, ciphertext copies, extracted tools, synthetic data,
roles, servers and scratch are removed. There is no automatic restore retry or
automatic permission to reopen serving. The three restores are separate
transactions; no cross-server atomicity is claimed.

## Coverage that remains incomplete

| Area | Observed coverage | Still required |
| --- | --- | --- |
| Member and journal | Actual encrypted data-only archives; exact nine/three table inventories restored | Rebuild schemas, functions, security and global roles on a replacement target |
| Control | Actual encrypted full schema/data archive; exact definitions, owners, rights and closed state restored | Rebuild independently protected global roles and configuration |
| Auth | Existing synthetic Auth schema/users/sessions remain in the test servers | Managed Auth export/restore, fresh login, session and account-deletion acceptance |
| Storage | Explicit `not_restored_in_this_drill` coverage record | Object bytes, integrity, ownership, privacy and retention recovery |
| Signing keys | Explicit `not_restored_in_this_drill` record | Independently saved signing-key recovery and global retirement/fencing |
| Decryption custody | Temporary synthetic identity retained in memory and supplied through stdin | Real saved key recovery, separate device/admin custody and key-loss procedure |
| Provenance | Original archive receipts, descriptor, trust hash and latest minimum retained by the test process | Protected independent catalog, latest-copy updates and lost-host recovery |
| Deployment | Explicit fixture-only source/scope metadata | Actual managed configuration and fleet recovery |

Logical components marked as unsupported are coverage statements, not recovered
Auth, Storage or keys. Both ciphertext directories and retained identities are on
the same computer. Source commit is supplied public checkout metadata, not source
attestation. This is an encrypted synthetic database round trip, not complete
managed-service disaster recovery or independent backup custody.

As in the byte-package contract, buffer clearing cannot guarantee erasure of
immutable JavaScript strings, operating-system memory, swap or provider copies.
No private identity file or secret command-line argument is created. Recovery
bytes are briefly materialized only at generated, guarded archive paths for
pg_restore; these paths are removed afterward.

## Test tools and verification

The combined test uses the same pinned age1.3.2 release hashes as the package
exercise. Tools are verified before changing source data or feature switches.
CI downloads the exact official archive. The local Linux run accepts a cached
release only with the expected platform filename, regular nonsymlink file,
40 MiB cap and identical hard-pinned SHA-256 before extraction/execution. This
does not install age globally or accept an arbitrary executable.

Local checks: 432 server unit tests and 151 actual three-server driver checks
(plus the outer cleanup wrapper). The combined exercise adds seven driver checks.
The initial local run exposed Linux Git reading a Windows worktree pointer;
explicit public source metadata removes that dependency. Another local run
stopped during tool setup before archive removal; its precise low-level cause
was not established. The successful local run used the publisher-checksummed
release cache. Failed logs are preserved and are not counted as successes.
Final-head hosted CI evidence must be checked separately before source acceptance.

See [PostgreSQL pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html)
for the single-transaction behavior and trust implications of restoring an
archive. Byte integrity does not establish safe SQL; this fixture accepts only
its own original handles and fixed disposable targets. See the
[official age release](https://github.com/FiloSottile/age/releases/tag/v1.3.2)
for tool provenance; published hashes are not a reproducible-build audit.

## Next release decisions and accessibility

The subsequent [replacement-cluster exercise](federation-alliance-replacement-recovery-20261018.md)
adds separate full-schema archives and password-free role/default-policy
reconstruction on three fresh synthetic targets. It does not change the narrower
coverage of the original fourteen-table round trip described above or establish
managed Auth, Storage or independent key custody.

Complete missing schema/global-security, managed Auth/account-deletion and Storage
coverage before treating recovery as complete. Independently saved keys, current
provenance/minima, off-device destination, actual access, costs, retention/cadence
and managed targets require concrete reviewed decisions. No Alliance backup
schedule, recovery-time commitment or public activation is configured here.

No user interface changed. Future private owner steps must identify one precise
vault item and purpose, allow password-manager paste, expose familiar native
keyboard/screen-reader controls and give clear status without countdown pressure
or repeated transcription. These source tests prove no browser, mobile,
assistive-technology or WCAG acceptance.
