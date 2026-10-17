# Alliance exclusive image cleanup candidate

October17,2026. Disabled one-object maintenance source and unapplied SQL extension.
No hosted access, bucket, login, credential, route, schedule or cleanup service is
activated. This is not complete erasure, retention or crash-recovery acceptance.

## Member task and accessibility

Removing an image must detach it without later restoring it; physical deletion
needs honest evidence. A member must not be told storage was cleared merely
because a request failed or a file could not be read. Future UI must distinguish
image removed from profile, cleanup pending, unknown and confirmed deletion using
plain status text rather than color/icons alone. Preserve the text profile and
provide a usable status/recovery route; do not ask the member to upload again to
resolve uncertainty. Images stay optional. No UI/assistive/mobile test or WCAG
conformance is claimed here.

## Durable state and dispatch permission

The extension requires the profile/avatar/session candidates. It reuses the same
two NOLOGIN roles and adds one private forced-RLS table for cleanup attempts,
plus a default-false cleanup_enabled field on existing control. The member feature
flag and cleanup flag are independent; cleanup can serve removed/deleted accounts
while member access is closed, but only after a separately reviewed activation.
There are no Auth-schema, role membership or Storage metadata writes here.

A caller supplies a fresh server-owned claim UUID. One committed claim picks at
most one settled cleanup object, never an active head or unsettled writer. The
existing global control lock serializes selection; a partial unique index allows
only one claimed/dispatched/unknown attempt per object. At most two such attempts
exist globally. Exact-object head lookup has a partial index. No transaction spans
Storage work. Browser input cannot select a claim or object.

An unused claim expires after two minutes. Its old claim ID remains an expired
tombstone; a new claim can select that object. Only a committed begin_cleanup
changes a live claim to dispatched and permits one provider call. Repeated claim
or begin calls return state without a second dispatch. Dispatched/unknown attempts
never expire into eligibility: a late worker may still be completing a DELETE.

The final gateway policy read rechecks the committed attempt, cleanup flag, exact
receipt, settled writer and absence of a current head. Claim/dispatch output is
copied before asynchronous boundaries. A late policy result after its Storage
deadline cannot authorize follow-up work. This protects normal application paths;
privileged manual database edits or arbitrary executor code remain outside the
worker's trust boundary. Actual credential rights must be independently reviewed.

## Evidence, uncertainty and capacity

The existing gateway performs one exact-path deletion and one exact-object
absence check. Only a matching provider ID/key deletion acknowledgement followed
by the expected object-missing result is a deletion proof. Generic/masked404s,
unknown writes, mismatched evidence, cancellation and transport errors do not
release capacity. Later absence cannot prove an uncertain upload/deletion settled.

finish_cleanup binds that exact proof to its dispatched/unknown claim and invokes
the existing receipt-checked deletion acknowledgement in the same transaction.
The object must still be settled cleanup with no current head. Matching proof
replay preserves deletion; conflicting proof refuses. The executor loses direct
access to the old receipt-only acknowledgement and cleanup batch-selection paths.
Helpers/table remain private; no member or service-role function access is added.

A known deletion can be recorded after cancellation or cleanup switch-off in a
separate awaited finite phase. Lost COMMIT acknowledgement stays unknown and never
repeats the physical DELETE. Unknown marking is conservative: even a gateway
not_started result after a committed dispatch keeps the slot pinned. Unknown
attempts count against the global two-attempt bound and can block maintenance;
there is no automatic retry, lease renewal, reassignment or quota refund.

The trusted operator may later record an already-held exact deletion proof for
an unknown attempt. This is proof replay, not permission to perform another DELETE.
Unknown-write reconciliation and recovery when the proof was lost are not yet
implemented. Do not substitute a newly observed missing file for the saved proof.

## Disabled worker bounds

createAvatarCleanup defaults closed and processes one claim per explicit run.
It reads no environment/credential store and has no batch loop or scheduler.
One call per worker instance runs at a time; the SQL bound covers multiple hosts.

The default total deadline is25seconds, reserving4.5seconds for final recording.
Committed claim/begin and policy calls have4.75-second outer limits around the
driver's4.5-second limit; Storage has an8.25-second outer limit around its existing
eight-second whole-operation limit. Remaining total time may shorten each stage.
All dependencies retain their own abort/deadline gates. Results arriving late
cannot start a subsequent stage. Close aborts current work and refuses new runs,
but known proof may still be recorded within its finite awaited final phase.
Injected database resources must separately be closed by their owner.

The disabled factory and SQL flag do not revoke a DELETE already authorized or
in flight. Immutable cleanup state and exact proof prevent ordinary application
paths from republishing that object. No absolute cross-service cancellation or
exactly-once network-delivery guarantee is made: uncertain dispatch is quarantined.

## Evidence and remaining release gates

Unit checks exercise commitment order, replay, receipt mismatch, policy denial,
uncertain dispatch/finish, cancellation, late non-cooperative stages, finite final
recording, copying, capacity and shutdown. A disposable real-driver TLS fixture
checks actual SQL concurrency, expired unused claims, quarantined uncertainty,
wrong-proof refusal, current/unsettled object protection, late upload settlement,
global bounds, switch-off, forced-RLS/grants and worker/gateway composition.
All provider responses are in memory; no hosted Auth/Storage call is made.

Claims, expired claim IDs, receipts and object/operation tombstones are currently
retained; no metadata purger is installed. Bounded retention/idempotency windows,
backup/account deletion without resurrection, operator recovery/support and a
safe unknown-write reconciliation procedure remain required before real data.
A default-closed one-shot worker is not a running erasure/monitoring service.

Also remaining: bounded member HTTP/body/response composition, current private-view
policy, reviewed hosted credentials/permissions/provider behavior, native host
isolation, abuse/cost/data rights/privacy/recovery, assistive/mobile/file-picker
acceptance, Google warning clearance and publication review.

Primary guidance checked October17: [PostgreSQL explicit locks](https://www.postgresql.org/docs/17/explicit-locking.html),
[row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html),
[Supabase changelog](https://supabase.com/changelog). The Markdown index was
unsupported; HTML fallback checked. Announced HTTP TLS cipher deprecation starts
November10 at earliest; actual hosted clients/provider compatibility still need
review. This increment changes no SDK, HTTP TLS policy or direct database setting.
