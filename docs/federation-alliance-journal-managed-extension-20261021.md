# Closed managed journal extension candidate

This source prepares an atomic upgrade of the existing, independent managed
journal. It creates no project, role, credential, runtime login or hosted change.
`managedJournalExtensionSql()` is an offline builder; hosted use requires a separate
reviewed decision. The normal application and dashboard remain closed.

## Purpose and data flow

The member creation service already requires a committed reservation for each
possible later removal in the independent journal. The original journal has no
reservation entrypoints. This upgrade composes the existing admission and recovery
inventory candidates so the member service can use those same durable rules.
It adds the private admissions table and default-off admission switch, makes the
old append routine a private helper, and exposes only the seven fixed executor
entrypoints. It does not configure an epoch/member scope or activate either switch.

Admission retains event/profile/optional image UUIDs and a capacity slot, never
profile text, email, image bytes or credentials. Identifiers can still be linkable.
The existing 256-reservation/four-image limits remain finite test candidates,
not an adopted production capacity or retention policy. Reservations do not expire
or refill when content is removed. Production capacity/epoch and privacy/recovery
policy remain release requirements.

## Fixed baseline and atomic permissions

The source-generated `journal-managed-shapes.json` records only synthetic schema
metadata derived from the three hash-pinned SQL candidates. It is not learned from
a live provider. Before installation, catalogue comparison requires the original
tables, columns/defaults, constraints/indexes/policies, function body fingerprints,
owners/settings and exact schema/table/column/function ACLs. Extra grants or
unexpected functions/objects fail closed. Aggregate Auth/Storage emptiness and
absence of other Alliance domains/public application tables are also required.
Column NOT NULL is compared through `attnotnull` on both supported versions;
PostgreSQL 18's additional named NOT NULL constraint rows are excluded from the
separate constraint list. This is a documented catalogue representation difference,
not a provider-derived permission exception. See the
[17](https://www.postgresql.org/docs/17/catalog-pg-constraint.html) and
[18](https://www.postgresql.org/docs/18/catalog-pg-constraint.html) catalogues.

The existing administrator temporarily receives owner SET within the transaction.
The empty, disabled, unconfigured genesis is checked as the owner before extension.
Only the two existing locked/password-free journal roles are used. The explicit
SET grant is removed before commit. Final catalogue, permission and closed/empty
row checks must pass or the entire extension rolls back, including the original
append rename and new control column. No automatic retry or repair is provided.

The same two provider-created ADMIN-only management edges remain, with INHERIT
and SET false. Existing administrator `pg_read_all_data` may imply schema USAGE
without a direct schema grant; no direct administrator schema grant or CREATE
is allowed, and no read-all membership is granted. This protects application-role
boundaries, not data from the trusted administrator/provider.

`managedJournalClosedInspectionSql()` checks the extended shape, temporarily
switches to the owner to verify both switches off, null scope/epoch, zero tip and
empty entries/admissions, then rolls the entire inspection back. Fresh metadata
must independently verify the absence of its temporary grant. It never configures
the scope merely to call the runtime inventory function.

## Verification and remaining work

Disposable PostgreSQL/TLS fixtures use a nonsuperuser managed-style administrator
with the fixed bootstrap creator edges and inherited read-all role. They cover
the original catalogue, unsafe baseline refusal, atomic rollback of helper/API/
column grants, RLS/schema/mode faults, successful disabled extension, successful
and refused inspection rollback, and refusal to reinstall. Restricted TLS sessions
then exercise admission, independent reads/recovery inventory and later removal
after new admission closes; the private unreserved append remains inaccessible.
All identities, credentials and content are synthetic and the owned server is removed.
The independent PostgreSQL 17.11 CI result must be checked before proposing hosting.

No new UI, gesture, countdown or repeated secret entry is introduced. Existing
accessible saved-draft, paused/capacity and uncertain-outcome paths are retained;
these database tests do not establish physical-device, screen-reader or WCAG
conformance. Real managed runtime/authority/custody, coordinated recovery/privacy,
remaining durable member features, account/mail/Google, operating/security and
publication acceptance remain separate release gates.

See [admission rules](federation-alliance-journal-admission-20261017.md) and
[member application](federation-alliance-member-application-20261021.md).
