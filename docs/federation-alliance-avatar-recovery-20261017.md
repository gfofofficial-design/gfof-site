# Alliance read-only recovery and retention review candidate

October17,2026. Disabled operator inspector and unapplied SQL extension. No
provider request, retry, purge, live account access, retention period adoption,
route or scheduler is added. A review result never authorizes data deletion.

## Member task and accessibility

An interrupted request must not cause the member to repeat an upload/deletion or
receive a false success. Distinguish a result already recorded in the database
from genuinely missing proof. Future member/support UI must explain these states
in plain text, preserve text profiles, avoid countdown pressure and provide an
accessible status/recovery path. Images stay optional. This server inspector has
no user interface; no keyboard, assistive/mobile or WCAG acceptance is claimed.

## Recovery from durable evidence

The existing server executor can read one cleanup claim or upload operation through
fixed parameterized functions. They work with feature switches off and after
account removal, for approved internal recovery. They are not member endpoints:
never expose arbitrary claim/operation IDs through an unauthenticated or merely
signed-in browser route. Existing Auth/session/member checks are not replaced.

Cleanup reports distinguish waiting/expired claims, unknown dispatch, missing ID,
recorded deletion and inconsistent records. Confirmed deletion requires the
claim's dispatched/finished history and the object's exact saved matching deletion
proof. Missing ID is not successful deletion; an uncertain SQL read is unavailable.
An expired claim observation is not permission for a second worker to act.

Upload reports distinguish reserved, never-dispatched, current, cleanup pending,
unsettled, deleted, missing and inconsistent state. Current requires the active
head and settled verified upload evidence. Deleted requires exact saved deletion
proof. A never-dispatched cancellation has different evidence from physical
deletion. Settled upload plus unknown deletion remains two separate facts.

For a lost finish acknowledgement, a fresh SQL client can observe a committed
deletion without contacting Storage or repeating DELETE. If no exact proof was
recorded, the report remains unknown/unsettled. The inspector never manufactures
evidence from a missing file, retries a writer, settles an upload, frees a slot,
reopens a claim or republishes an image. Lost provider proof is not solved by this
increment; provider-assisted/manual reconciliation remains a separate gate.

Reports exclude tokens, account IDs/emails, object paths, provider IDs, hashes,
raw receipts and database errors. Retention review includes only the object UUID,
reason and timestamps needed for an internal review. These records can still be
linked internally and must remain private. No original images are copied/exported.

## Read-only retention review

The caller supplies an explicit UTC cutoff, UUID cursor and page size1–20. There
is no adopted default retention period. One SQL query returns a bounded page of
objects created before the cutoff. A cursor is an observation, not a frozen
inventory or a count of all records. Revalidate everything before any future
destructive action; the current functions offer no such action.

Disposition priority:

1. **keep_current:** any current profile pointer protects the object.
2. **keep_open:** open upload/cleanup work protects it, including quarantined
   unknown attempts. Age does not expire that protection.
3. **keep_recent:** later settlement, deletion, operation/claim history or account-
   removal tombstone postpones review; old creation time alone is insufficient.
4. **review_deleted:** old terminal evidence contains the exact saved deletion
   proof and no current/open state. It is only a metadata review candidate.
5. **review_never_dispatched:** old terminal metadata has no descriptor/upload/
   deletion proof because dispatch never occurred. It is not physical-erasure proof.
6. **keep_uncertain:** everything else remains protected.

Latest-change calculation includes object creation/settlement/deletion, operation
creation/expiry, claim creation/expiry/dispatch/finish and the profile-head account-
removal timestamp. Account deletion does not turn unresolved Storage work into
erasure. The classification does not itself prove that backups or other systems
no longer retain data.

## Proposed policy decision, not an adopted retention promise

The smallest next policy is to review **resolved** recovery metadata after30days
from its latest terminal activity. That is a proposal for review, not automatic
expiry or an owner-approved public promise. Current/unresolved work remains
protected regardless of age. No real member data is introduced by this source.

Before implementing expiry, decide the public retention/support window, maximum
accepted operation/claim replay age, bounded metadata capacity and maximum backup
restore horizon. A pruner must preserve enough identity/version/deletion fences
to reject late/replayed work and apply deletion tombstones before restoring
member access. It must not turn an old backup into a new upload permission.
Unknown attempts, active heads and unresolved writers cannot simply be purged
to recover quota. Privacy and recovery requirements need a concrete joint policy.

No such pruner, automatic30-day expiry, tombstone compactor, backup purge or
restoration reconciliation is implemented or authorized here.

## Bounds and privacy boundary

createAvatarRecovery defaults closed, imports no driver and reads no environment
or credential store. One inspection runs per instance, with an independent
4.75-second maximum around the existing4.5-second driver. Abort/deadline/close
refuse late results; no follow-up mutation/provider call can occur. Strict shared
result validation refuses unexpected fields, contradictory proof, invalid dates,
wrong cutoffs and unordered/excessive pagination. Timestamps normalize to UTC.
Close does not own the injected database pool.

SQL adds three read-only private functions and two history-lookup indexes, no
table, role or flag. Same NOLOGIN owner/executor model; no member/service-role
execute or direct executor table SELECT. Existing forced RLS and Auth checks stay
unchanged. STABLE function reads use the query's snapshot; pages and later actions
can observe newer state. The inspector is an operator tool, not ongoing monitoring.

## Verification and remaining gates

Unit checks cover state distinctions, exact proof, missing/unavailable results,
strict private DTOs, copied responses, cutoff/cursor/date bounds, cancellation,
stalled/late reads, capacity and shutdown. A disposable actual-driver TLS fixture
checks fresh-client recovery of a committed deletion after a simulated lost
caller acknowledgement, no repeat Storage call, paged retention dispositions,
feature-off/account-removal behavior and private grants. Fingerprints of all six
ledger tables stay unchanged across read-only inspection groups. Synthetic aging
changes fixture timestamps only; it never resets quotas or a real clock.

Auth/provider responses and decoder derivative remain synthetic. Hosted behavior,
actual Storage evidence, full lost-proof reconciliation and backup/account erasure
are unverified. Also outstanding: bounded member HTTP/body/response composition,
current private-view policy, hosted permission/credential/provider acceptance,
native host isolation, abuse/cost/data rights/privacy/support/recovery, actual
assistive/mobile/file-picker checks, Google warning clearance and publication.

Primary guidance checked October17: [PostgreSQL transaction snapshots](https://www.postgresql.org/docs/17/transaction-iso.html),
[Supabase changelog](https://supabase.com/changelog). Markdown index was
unsupported; HTML fallback checked. No platform/SDK upgrade or TLS setting changes
are performed; hosted compatibility remains a separate review.
