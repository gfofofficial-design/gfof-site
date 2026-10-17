# Alliance private image ownership and quota candidate

October 17, 2026. **Disabled, unapplied SQL source.** No bucket, login, password,
Data API exposure, hosted schema, cleanup service or upload route is enabled.
Builds on the profile and native image-processing candidates in this draft.

## Member task and accessibility

An image remains optional. Members can keep their text profile, replace an image
without losing the current one on a failed upload, or remove it without a late
response restoring it. A reload must recover pending-operation status from the
server; progress must not depend on remembering a code or racing a countdown.

The intended native file control and polite status region must distinguish
processing, unconfirmed upload, replacement complete, and image removed with
physical deletion pending. Keep typed text on failure. Offer a clear text-only
path and explicit retry after reconciliation; never auto-retry an uncertain
write. Limits must have plain explanations, not just error codes. Removal has a
separate budget so failed image processing does not consume removal allowance.
Actual UI, assistive-technology, phone and file-picker acceptance remains open.

## Architecture and trust boundaries

`sql/alliance-avatar-ledger-candidate.sql` is a reviewed DDL candidate, not a
CLI-generated/applied migration. It creates a private schema, five RLS-enforced
tables and two locked NOLOGIN roles. The table/function owner can read only
profile IDs and their account bindings, not profile bio/content or mutation
fields. The executor has specific function execution only; no table access,
helper-function access, inherited memberships, superuser or RLS bypass.

The future server must verify a live confirmed non-anonymous account through the
accepted account flow and derive the actor ID itself. **The SQL executor trusts
that server-supplied actor ID; it does not authenticate a browser or validate a
JWT.** Never accept actor IDs from request payloads or expose these functions
through the Data API. Public/anon/authenticated/service-role schema access is
revoked. Security-definer functions have a dedicated limited owner and empty
search paths. No public-schema security-definer function is added.

Expected data flow:

1. Bound the HTTP body and authenticate/authorize its owner. Reserve a unique
   operation/version in a short database transaction; commit before decoding.
2. Only the first reservation result permits processing. Decode original bytes
   using the separate processor; never store originals, filenames or source URLs.
3. Claim one upload of the bounded derivative to a server-generated immutable
   `v1/<profile-id>/<random-object-id>.png` key. No overwrite/upsert and no browser
   upload capability. Replays cannot dispatch again.
4. A future private Storage gateway writes the PNG. It must bind exact key,
   checksum/length/type and definitive provider acknowledgement before committing
   the reference. A database function cannot prove that an external write occurred.
5. A successful current-version commit changes the image reference atomically.
   The old file becomes cleanup work. A stale completion never changes the head.
6. A future cleanup worker deletes through the Storage API and verifies absence
   after all writes are settled, then acknowledges deletion to release capacity.

Gateway credentials, bucket access policies, parameterized SQL connection,
private image serving, authorization on every read, and checksum/receipt checks
are **not implemented or provisioned here**. Supabase service keys bypass Storage
RLS; do not assume a narrowly coded wrapper narrows such a key's actual rights.
Credential scope/containment needs a separate reviewed access decision. No service
key or secret is requested, installed or read by this candidate.

The first serving design should proxy authorized image bytes with private,
no-store responses, checking the current profile's listing/moderation and the
viewer's membership on every request. An owner may read their own image; other
members may read only currently listed, visible profiles. Do not expose a public
bucket or long-lived signed URL that outlasts unlisting. Previously downloaded
images cannot be recalled from someone else's device.

## Durable state and limits

| Control | Prepared pilot value / behavior |
| --- | --- |
| New processing attempts | 10 per account per UTC day; 200 globally per UTC day |
| Pending processing/upload dispatches | At most one per profile and two globally |
| Outstanding object slots | Two per profile, 100 globally, including uncertain/cleanup files |
| Object byte allowance | Reserve the maximum 300 KiB per slot; at most 29.3 MiB accounted object allowance |
| Removal metadata operations | Separate 20/account/day and 500/global/day; replays do not charge twice |
| Reservation | Two minutes by database clock; expiry is a backend limit, not a UI countdown |
| Cleanup/expiry batches | Explicit calls, each at most 20 records; no scheduler installed |
| Failed/cancelled processing | No refund of consumed daily attempts |
| Changed/deleted profile | Version fencing and immediate pointer detachment; physical cleanup remains tracked |

These are proposed pilot bounds, not a published membership policy or proof of
provider storage/billing. A single database control-row lock serializes decisions
across server instances. Keep transactions short with query/lock deadlines; never
hold this lock during decoding or network calls. At this small cap, indexed
owner/cleanup lookups and bounded object counts favor simple consistent locking
over more complicated distributed accounting. Larger scale needs review.

Readback returns current version/image ID and at most two pending operation
statuses, never account email or a public storage URL. Replaying an operation is
read-only and never repeats decoding/upload. Reusing it across owners or for a
different action/version refuses. Account-based counters survive profile removal
and recreation; daily state is never reset to retry a failed operation.

An expired never-dispatched reservation can release its slot. A timed-out or
cancelled **dispatched** upload remains unknown. Expiry/account removal cannot
pretend the file was deleted. Unknown writes stay outside physical-deletion
dispatch until the gateway definitively settles them; a single HEAD/404 or abort
does not prove an earlier write cannot arrive. Once settled, an unpublished file
can enter cleanup without being republished. Old references stay until a confirmed
replacement, and removal invalidates any late pending replacement.

This ledger accounts for operations made through the reviewed gateway only. It
does not discover arbitrary bucket files, stop compromised privileged credentials,
cap native decoder memory, or implement edge/auth-request abuse protection.
Unknown uploads can deliberately exhaust capacity rather than silently overrun
limits. Recovery needs a finite, tested provider reconciliation procedure.

## Deletion, retention and release gates

The profile-deletion trigger runs even when new image operations are disabled.
It detaches the head, cancels never-dispatched reservations, and retains pending
physical cleanup. It does not delete `storage.objects` rows: SQL metadata deletion
would not remove actual Storage files. Cleanup also works while activation is off.
No cleanup or monitoring is claimed to be running.

Before activation, add and accept a bounded metadata-retention policy: daily
account identifiers and finished operation/deletion tombstones should have a
short reviewed retention period (initial proposal: 48 hours). Pruning must preserve
idempotency/version guarantees and must never erase unresolved objects merely to
free quota. Reconciliation deadlines, deletion-failure escalation, backup handling,
account erasure and restore-without-resurrection need explicit acceptance. No
retention job or automatic purge is present, so this candidate cannot yet handle
real member data. Account deletion remains a separate path from image rate limits.

No route or browser client is mounted. Production activation still requires an
exact migration/access decision, private bucket/policy audit, real Auth/ownership
acceptance (including direct API denial), the native host-isolation decision,
provider receipt/deletion tests, privacy/support/cost review, accessible UI checks,
Google warning clearance and the established public release review.

## Verification and references

The disposable PostgreSQL fixture checks permissions/RLS/default closure, replay,
cross-owner denial, byte limits, current-image preservation, successful replacement,
remove/late completion, expiry, account/profile deletion, uncertain-write quarantine,
daily/global/object/concurrency limits and non-refunded attempts. Two actual
concurrent connections must admit exactly one dispatch and consume one attempt.
Separate races across different accounts check the last global concurrency slot
and the final daily processing allowance.
The fixture verifies rollback and removes its separately committed race fixture.
Fixtures use synthetic actor claims, not real Supabase authentication or Storage.

Primary documentation checked October 17:

- [Supabase changelog](https://supabase.com/changelog): upcoming TLS cipher retirement
  reinforces current-client/TLS acceptance; no newly observed Storage change
  removes these gates.
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Private/public buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Delete objects through the API](https://supabase.com/docs/guides/storage/management/delete-objects)

No new provider, SDK, subscription or account is adopted by this source work.
