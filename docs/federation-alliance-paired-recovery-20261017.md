# Alliance paired recovery coverage candidate

Source-only, October 17, 2026. The SQL extensions are **unapplied**. This adds
read-only inventories and an operator comparison for the preparation/admission
candidate. It installs no hosted backup, schedule, credential, login or public
route. Every result, including a match, keeps service access **closed**.

## Explicit coverage

| Member store: nine tables | Independent journal: three tables |
| --- | --- |
| `public.alliance_member_owners` | `alliance_journal.control` |
| `public.alliance_profiles` | `alliance_journal.admissions` |
| `alliance_avatar.control` | `alliance_journal.entries` |
| `alliance_avatar.heads` | |
| `alliance_avatar.operations` | |
| `alliance_avatar.objects` | |
| `alliance_avatar.daily` | |
| `alliance_avatar.cleanup_attempts` | |
| `alliance_avatar.creation_plans` | |

The member inventory covers profile text/ownership, tombstones, receipts, spent
counters, cleanup attempts and stable prospective identities. The journal
inventory covers its current scope/epoch/tip, permanent reservation slots and
complete deletion records. The new format refuses the earlier six-table image
inventory; the old source remains available for its narrower historical tests.

Each fixed table returns its row count and SHA-256 over sorted complete-row
digests. Counts include duplicate rows where possible; order and caller time/date
settings do not affect the result. UTC/ISO serialization is pinned. No raw rows
or profile text are returned. Member tables cap at 1,000 rows each (preparations
at 256), and journal tables at 256. Oversized, absent, reordered or malformed
coverage refuses rather than silently supplying a partial inventory.

These are **data inventories**. They do not prove schema, constraints, RLS,
permissions, roles, Auth users/sessions, Storage bytes, encryption/signing keys,
external serving-floor custody, provider configuration or other backups. An
empty-table row hash cannot detect an altered column definition. Those require
separate pinned schema/permission checks and recovery acceptance.

## Frozen checkpoint comparison

The trusted operator must independently establish actual quiescence and
authenticate a complete checkpoint captured after the current freeze. The
checkpoint binds both project references, journal epoch, freeze ID and capture
time, plus both inventories. The constructor separately requires an authenticated
minimum deletion sequence/hash; never derive that authority from the member
backup or replace it with a restored genesis value.

The disabled comparison performs at most five read-only calls within 25 seconds:

1. Read the member inventory and independent journal inventory.
2. Fetch the entire bounded deletion chain through that journal tip. Recompute
   canonical record hashes, scope, order, uniqueness and links; verify the
   separately supplied minimum occurs in it. A missing/older/forked floor refuses.
3. Read both inventories again. Any changing snapshot refuses.
4. Compare both complete inventories with the authenticated checkpoint. Missing
   preparations/admissions or same-count row changes refuse. An exact match
   returns only `matches_checkpoint` with `access: closed`.

All creation, cleanup, admission and master switches must be closed. The reader
does not freeze writers, repair rows, advance a floor, sign evidence, restore a
database, retry or grant startup permission. One inspection runs per instance;
there is no queue. Cancellation, late/noncooperative reads, malformed results or
unavailability cannot start a later phase after the inspection ends.

Two snapshots are not a distributed atomic snapshot or proof of quiescence.
Matching two stale copies cannot reveal forgotten history. A checkpoint hash is
not a signature, and an operator-supplied freeze ID does not stop workers. Real
checkpoint authentication, persistent independent floor/custody and the startup/
restore interlock remain release gates. A match is not a complete recovery proof.

## Actual synthetic archive test

The guarded native fixture uses two disposable PostgreSQL servers and synthetic
data. It makes separate custom-format **data-only** archives for the exact nine
and three table lists, checks every table-of-contents entry, file-size bounds and
byte hashes, and restores each in one transaction into its own prepared fixture
schema. It tests missing prospective IDs, missing reservations, same-count
corruption, a regressed deletion journal and changes during comparison. Restoring
one domain leaves the other domain unchanged.

The helper accepts no URL/password or arbitrary archive path. Handles belong to
one exact domain/helper; the member archive cannot overwrite the journal. It
uses no schema/drop/create or trigger-disabling restore option. Both source and
target schemas and fixture identities are checked independently. Archives are
unencrypted **synthetic test artifacts**, kept only in protected temporary
directories/containers and deleted on teardown. No real account backup, cloud
export, encryption-custody or managed restore is performed. Do not use this helper
as a production backup command or restore an untrusted archive.

PostgreSQL data-only dumps omit schema/dependencies; separately install and verify
the exact trusted schema and required Auth identity dependencies before a real
restore. Archive selection and same-domain checks are not a sandbox against
malicious source superusers or arbitrary dump contents.

## Privacy, accessibility and next acceptance

Even digest/count manifests can reveal membership/activity and remain internal.
Preparations/admissions retain potentially linkable identifiers; retention,
deletion and backup-erasure policy are unresolved. No physical-erasure promise
or public retention period is established.

There is no UI change. Future operator/user recovery interfaces need clear text
for matched, changed, incomplete, unavailable and still-closed results, usable
keyboard/assistive controls, no color-only status and no countdown pressure or
automatic destructive repair. These tests are not browser, mobile, screen-reader
or WCAG acceptance.

Before activation: real encrypted backup/export and independent-copy custody;
schema/role/RLS/Auth/Storage recovery; checkpoint authenticity and persisted
floor/startup interlock; account-removal and retention policy; production capacity
and HTTP/recovery UI lifecycle; managed hosting, Google-warning, assistive/mobile
and publication acceptance. No ongoing backup or monitoring is claimed here.

References: [PostgreSQL pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html)
and [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html).
