# Profile write review — closed pilot procedure

Status: review candidate, exercised only in disposable PostgreSQL/TLS fixtures.
This is not a deployed operator service or permission to change a hosted project.
The profile API and client remain unmounted and public registration remains closed.

A confirmed save and an uncertain save both leave a durable pending receipt. The
member client can display the hold but cannot clear it. This procedure covers an
exact **known, confirmed** save. A timeout, cancellation, lost response, changed
profile, missing evidence or ambiguous transaction stays held for separate
incident reconciliation. A current profile read does not establish delivery.

## Required evidence and authority

Use the reviewed source commit and independently verified member/journal project
identities. Retain the actor/profile binding, sequence and exact input/result
SHA-256 receipts in protected operator evidence. Compare the reviewed request and
received result using PostgreSQL's canonical JSONB text with UTC/ISO timestamp
settings, as used by the candidate fence; ordinary JavaScript JSON hashing is not
a substitute. Evidence must come from the confirmed operation, not a browser's
claim or a digest copied from a later current read. Do not expose it in a public
issue, member response or application log.

Only the separate owner review context may call `review_profile_write`. Do not
install its credentials in the member runtime or grant its function to executor,
member or anonymous roles. The runtime's status reader is not an operator role.
An independently retained incident record must bind the freeze, reviewed receipt,
review result and later restart decision. Inventories and local booleans alone
are not independently authenticated evidence.

## Ordered phases

| Phase | Required action and observation | If it cannot be established |
| --- | --- | --- |
| 1. Close admission | Independently deny serving/startup, routing, scheduled work and automatic replacement. Commit member `enabled`, `creation_enabled`, `cleanup_enabled` false and journal `enabled`, `admission_enabled` false in separate transactions from review. Read them back using fresh protected observations. | Keep every path closed; do not review. |
| 2. Block new connections | Prevent all application/direct/pooler login paths and privileged alternate callers from starting work, using the provider-supported, independently reviewed controls. Verify the restriction. A strict disposable direct-login fixture uses executor NOLOGIN; this is not a hosted pooler recipe. | Stop. Do not weaken inherited grants, Auth or role isolation to make this procedure run. |
| 3. Stop and drain | Close API, creator, member, cleanup and journal workers; stop dispatch; disconnect their owned pools. Inventory all relevant sessions, active and idle transactions, prepared transactions, jobs and queues on both domains. Prove no admitted operation or alternate caller can resume. | Keep the pending receipt and admission restrictions. Aborting a request does not prove database rollback. |
| 4. Capture the closed state | After drain, capture actual member/journal inventories, deletion floor and profile/ownership/receipt state. Bind them to the freeze and protected incident evidence. Check identity, permissions, closed switches and exact known receipt again. | A mismatch is an incident, not a reason to replace the expected digest. |
| 5. Review one exact receipt | In a separate bounded READ COMMITTED transaction, with synchronous durability enabled, invoke only the owner-only function with the reviewed actor, sequence and input/result digests. The function locks closed controls, receipt, ownership and profile and verifies the current result. Commit once. | Roll back on denial or error. Lost commit confirmation is unknown; inspect under the same freeze, never automatically replay or reopen. |
| 6. Verify while closed | A fresh protected read must show the same sequence/digests, pending false, unchanged profile/ownership, closed controls and no returning application sessions. Record confirmed commit/readback and capture updated inventories. | Preserve the freeze; do not assert the hold was safely cleared. |
| 7. Separate restart decision | Retain a new authenticated checkpoint reflecting the intentional pending-flag change, preserving the original receipt and deletion floor. Complete existing paired recovery/startup review, obtain independent restart approval, then prepare a fresh runtime. Verify accounts and serving under the approved plan. | Access stays closed. A successful review is not a serving decision. |

The freeze and review must not share one transaction that also reopens switches.
NOLOGIN does not disconnect existing sessions. Idle pooled connections and idle
transactions are part of drain; a count of active queries alone is insufficient.
Check prepared transactions separately. A zero session observation is useful only
while verified admission restrictions prevent new sessions and while all other
write paths are accounted for. Do not kill a session and assume its outcome.

The owner function enforces the local receipt/current-state checks. It cannot
prove remote shutdown, pooler restrictions, queue drain, independent evidence
retention or restart approval. Those are required external controls and remain
hosted acceptance work. Keep journal/deletion work closed throughout review, and
resolve any admitted deletion before interpreting a profile as current.

## Member behavior after review

A fresh client reads only `writeState`, never operator receipts. A known hold can
clear after an explicit guarded read reports available. The client that observed
an uncertain save remains paused; this procedure does not establish that its
original response was delivered or automatically reset that client. There is no
retry, forced-clear button, automatic poll or public review endpoint.

## Disposable acceptance

`lib/alliance-avatar-server/profile-review.native.mjs` runs inside the existing
confirmed two-server runner, after a known successful browser/API save:

- Commit both domain freezes and disable both direct executor logins separately
  from review. A retained TLS transaction still answers after NOLOGIN; a new
  connection is refused. The pending receipt remains unchanged.
- Close the modeled API/creator/pools and retained transaction. Fresh owner
  observations show zero executor sessions and zero prepared transactions on both
  disposable servers.
- Execute an exact review and roll back; the pending marker remains. Commit the
  exact review separately; only pending changes, and the full current profile
  remains identical. Features/logins remain closed and no session returns.
- The drill does not reopen. The outer synthetic fixture explicitly restores its
  test-only controls and starts fresh adapters for remaining tests. Its serving
  authority and Auth/HTTP bridge are synthetic; it is not production approval.

The earlier compact helper continues to test stale/changed proofs for other
known fixture saves. The lost-acknowledgement case is never passed to owner review
and remains pending through runtime restart and archive restoration.

Required CI is the guarded disposable PostgreSQL 17.11/TLS job. A syntax check
alone cannot validate the database sequence. No hosted SQL, account, credential,
role, key, root or production setting is changed by preparing this candidate.

## Sources checked October 20

PostgreSQL 17 [explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html),
[transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html),
and [activity statistics](https://www.postgresql.org/docs/17/monitoring-stats.html)
were checked for transaction lock lifetime, fresh READ COMMITTED observations and
session/transaction inspection. The [Supabase changelog](https://supabase.com/changelog)
was checked; no new Supabase integration or API is introduced here. Actual hosted
pooler/session and privilege behavior still requires provider acceptance.
