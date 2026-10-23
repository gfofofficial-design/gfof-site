# Alliance account-table layout contract candidate

October 18, 2026. Source/local disposable database work only; no hosted DDL,
credentials, project, signup, provider call, public route or purchase.

## What changed

Both strict and explicit managed account adapters now verify the table layout and
future-object grants together with the existing fixed function/role/ACL contract.
The same check runs before private dispatch and again in a fresh autocommit
snapshot after COMMIT, before releasing evidence. Definitions are fixed reviewed
source data, not a baseline learned from the database at runtime.

`account-layout-data.mjs` is deeply frozen; the runtime verifier keeps its own
private clone. Its source hashes pin the three unchanged SQL candidates with
CRLF-to-LF normalization only. Initial layouts were captured from exactly those
files in two guarded disposable PostgreSQL clusters and reviewed against the
declarations. Runtime never opens SQL files or rewrites this manifest.

## Checked fields

- Exact ordered columns, including physical position, name, builtin type owner
  OID/schema/name, type modifier, dimensions, nullability, identity/generated flags,
  dropped/local/inherited flags, fast-missing-value flag, options, collation and
  default/generated expression. Extra and dropped column slots refuse too.
- Exact CHECK/primary/unique/foreign/exclusion constraint inventory, names, keys,
  deparsed definitions, deferrability, initial deferral, validation, local/inherited
  state and no-inherit flag. The current candidate has no FK or exclusion.
- Constraint safety also refuses foreign/domain/parent linkage, unvalidated,
  deferred, inherited or unenforced constraints and temporal-key behavior. PG18
  represents NOT NULL both in pg_attribute and pg_constraint; its redundant names
  are excluded from the cross-version inventory, while column nullability and
  safety of those constraint rows are checked. PG17 lacks that extra catalogue
  representation. Version-specific optional flags are inspected via JSON rather
  than referencing a column absent in PG17.
- Exact indexes and definitions, uniqueness/primary status, validity/readiness/
  liveness, immediate enforcement, replica identity, NULLS NOT DISTINCT behavior,
  access method, owner and index options. Unexpected expression/partial indexes
  also refuse.
- Exact row-policy names, commands, permissiveness, role lists, USING and WITH
  CHECK expressions. Forced RLS and table/function rights remain separately pinned.
- Ordinary permanent heap tables with no partitioning, inheritance in either
  direction, table options, altered replica identity or rewrite rules. Existing
  checks continue to reject user triggers and unexpected table kinds.
- Exact default ACL rows for the account owner or the private account schema,
  including creator, global/schema scope, object kind and bounded grantor/grantee/
  privilege/grant-option lists. This covers changed future grants, not only current
  object permissions.

The expected default ACL is owner-only EXECUTE for new owner-created functions;
there are no extra table/schema-specific default grants. Bootstrap type-owner OID10
is stable when the managed fixture renames the bootstrap role, so strict and managed
paths share the same reviewed table layout without accepting arbitrary type owners.

Catalogue arrays are bounded:17 column/constraint rows,9 index/policy/default-ACL
rows and9 policy roles/ACL entries. These exceed the known small inventories so
extra rows cannot be silently truncated into an expected match. Existing32KiB
response, statement/lock/deadline and pool bounds remain. Default expressions are
deparsed with a pinned pg_catalog search path and compared exactly; no whitespace
normalization or expression-equivalence guess is used.

## Failure and actual evidence

Before dispatch, a mismatch prevents the private function and COMMIT. Persistent
drift seen only after a business COMMIT withholds read evidence or marks a write
unknown and destroys the connection. It cannot undo a commit or justify retrying
the operation. Protected pending state and independent reconciliation still apply.

Eight new unit tests cover source hashes, field/inventory changes, future grants,
policy and index behavior and immutable expectations. Real disposable SQL tests
change15 actual table/default/policy/index properties, refuse both reads and writes
before business mutation, and independently compare unchanged original history
and acknowledgement after each exact repair. Cases include weaker and NOT VALID
CHECKs, deferred uniqueness, an FK, expression index, restrictive policy, future
grants, an unlogged table, inherited child and INSERT rewrite rule. A real committed
event followed by a changed default yields unknown; independent read proves the
single event, then exact synthetic teardown restores the original baseline.

The managed fixture additionally tests changed private default and RLS policy,
using the same shared contract. No table data or role on a hosted project changes.
All local scratch, synthetic records and grants are disposable and removed.

## Remaining limits and next work

This verifies the listed observed catalogue fields for three account tables. It
is not an exhaustive audit of every PostgreSQL catalogue, managed schema, extension,
operator, locale, storage device or administrator action. A trusted privileged
actor can still change and restore state between observations; these checks are
not a DDL lock, ABA-proof barrier or global producer fence. Raw row contents still
require their existing canonical full-chain checks. Unchanged catalogue metadata
does not prove privacy, authorization, erased backups or current independent trust.

Next: a realistic managed-provider baseline and installer/runtime rehearsal,
cross-database rights, independent current-receipt backend/custody and actual
deployment/old-producer/restore barriers. Coordinated managed Auth/Storage recovery,
key provenance, fresh per-operation account/session/policy/content and in-flight
removal enforcement, retention/capacity/HTTP/Google/mobile/assistive/publication
remain. Local checks do not authorize buying projects or enabling signup.

No user interface changed. Future unavailable/unknown status needs persistent
plain text, keyboard/screen-reader access and recovery support without timed hash
transcription or repeated secret entry. No WCAG conformance is claimed.

References: [PostgreSQL columns](https://www.postgresql.org/docs/17/catalog-pg-attribute.html),
[PG18 constraints](https://www.postgresql.org/docs/18/catalog-pg-constraint.html),
[indexes](https://www.postgresql.org/docs/17/catalog-pg-index.html),
[policies](https://www.postgresql.org/docs/17/catalog-pg-policy.html) and
[default ACLs](https://www.postgresql.org/docs/17/catalog-pg-default-acl.html).
