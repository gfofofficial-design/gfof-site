# Alliance installed account-contract verification candidate

October 18, 2026. Local source and disposable database tests only. No hosted
installation, access expansion, enabled coordinator or public account route.

## What is checked

Every history/ack adapter call now checks a fixed reviewed catalogue contract
before calling a private account function and again in a fresh autocommit snapshot
after the business transaction's COMMIT. The second check happens before returning
evidence. Reads retain their coherent repeatable-read transaction; the post-COMMIT
check avoids relying on that earlier catalogue snapshot for persistent drift.

`account-contract-data.mjs` contains exact fingerprints derived from the unchanged
SQL candidates: four common helpers and four domain-specific functions per domain.
Unit checks compare those fingerprints with all source definitions. Runtime uses
a private copy of the fixed manifest, never a caller-supplied allowlist or a value
learned from whatever database happens to be installed. There is no SQL file or
credential lookup at runtime.

The bounded read-only catalogue query checks:

- Exact function inventory, signatures, argument names, return types, languages,
  source SHA-256, owner, definer/invoker, volatility, search path and execution
  properties. Only CRLF-to-LF normalization is permitted in source hashing;
  comments, spaces and other edits require a new reviewed fingerprint.
- Exact function and schema grants, including grantor and grant options. PUBLIC,
  anonymous, unknown and extra helper/operator/writer access refuse.
- All four account roles remain nonprivileged, NOINHERIT and isolated in both
  membership directions; the function owner also remains NOLOGIN.
- Exact table inventory/ownership/kind, enabled and forced RLS, no direct or column
  grants to other roles, and no user triggers.
- PostgreSQL17/18 only and a `pg_catalog` session search path set through explicit
  client startup options. Existing verified TLS, channel binding, identity,
  dedicated-domain, narrow-rights and durability-setting checks still apply.

At most nine function rows, four table rows and nine ACL entries per selected
object are returned. Unexpected inventory therefore fails rather than expanding
the contract. Catalogue envelopes are bounded to32KiB; existing operation,
statement/lock deadlines, pool bounds and no-retry behavior remain.

## Failure semantics

Pre-dispatch mismatch returns the existing sanitized `not_started` failure. The
account function and COMMIT are not dispatched. The post-COMMIT read uses a fresh
catalogue snapshot: persistent drift withholds read evidence and makes a dispatched
write outcome `unknown`. It cannot undo or prove away a business commit that has
already happened. Checkpoint pending state and independent reconciliation remain
necessary. No raw SQL source, catalogue record, password or underlying error is
returned in the public error.

The validated adapters supply the history/ack reads used by signed status and
conditional reconciliation. A persistent changed contract therefore blocks that
evidence path too. Arbitrary caller-provided JavaScript callbacks are not attested
by this mechanism and do not inherit the database guarantee.

## What this does not fence

Catalogue observations do not freeze privileged DDL. A privileged actor can change
and restore a definition between checks, change built-ins/system catalogues, or
restore an older database while old producers remain active. This candidate does
not detect every transient change, eliminate check/use races or provide global
fleet/restore fencing. It verifies persistent observed catalogue state under the
existing trusted-server assumption. Quiescent DDL, protected deployment authority,
installed-version and old-producer barriers remain release requirements.

The [account-table layout extension](federation-alliance-account-layout-20261018.md)
now checks the specified columns/defaults/generated flags/constraints/indexes/
policies and future-object grants too. This remains observed catalogue state,
not an exhaustive managed-platform audit. Administrator behavior, physical storage
truth and cross-domain recovery invariants remain separate. Strict mode refuses
provider memberships; the explicit managed profile below permits only its fixed
creator-management edges. Hosted compatibility is unproved.

## Observed verification

Unit cases check source-manifest correspondence, accepted versions, source/helper
changes, inventories, metadata/grants/roles/table protections, immutable expected
state, pre-dispatch refusal and post-COMMIT unknown outcomes. Existing account
store tests now supply catalogue fixtures and assert the new call order.

The confirmed disposable TLS driver changes actual main/helper bodies, volatility,
anonymous execution and column grants, RLS, an extra overload, a user trigger and
owner membership. Each must refuse before account dispatch; each exact change is
restored before the next case. Another case introduces benign persistent drift
after a real COMMIT: the caller gets unknown, and an independent read after
restoration confirms one committed event. No automatic retry is performed.

All drift belongs only to owned synthetic databases. This is not authorization to
change a hosted project, accept extra memberships, install a public function, open
signup or enable reconciliation. No SQL candidate, dependency or real credential
is changed. There is no running attestation/monitoring service.

## Next release work and accessibility

Prepare the real protected record/outside-receipt backend and custody decision,
with deployment/DDL/restore/old-producer barriers. Then verify key provenance,
per-operation account/session/policy/content enforcement and in-flight removal.
Coordinated managed Auth/Storage recovery, privacy/retention/capacity/HTTP/Google,
browser/mobile/assistive and publication acceptance remain.

An [explicit managed-host profile](federation-alliance-account-managed-20261018.md)
supplements the unchanged strict default. It permits only its fixed provider
schema and ADMIN-only creator-edge contract; no hosted compatibility or grant is
inferred from the local managed-shape fixture.

No interface changed. Future unavailable/unknown states need persistent plain text,
keyboard and screen-reader access and support after sign-out. Never ask users to
transcribe fingerprints or retry an uncertain write to make an error disappear.
These tests do not establish WCAG conformance, authorization or erasure.

References: [PostgreSQL function catalogue](https://www.postgresql.org/docs/17/catalog-pg-proc.html),
[locking](https://www.postgresql.org/docs/17/explicit-locking.html),
[Supabase functions](https://supabase.com/docs/guides/database/functions),
and [node-postgres client options](https://node-postgres.com/apis/client).
