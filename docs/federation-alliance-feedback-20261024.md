# Alliance ideas, support and private reports candidate

Source candidate, October 24, 2026. Nothing in this change installs SQL, enables
login, mounts a production route, opens enrollment, sends mail or publishes an
Alliance service. The existing tab-memory preview keeps its current behavior.

Members need to retain useful ideas between visits, express support without
ambiguous toggle retries, remove their own ideas, and privately flag a member,
idea or participant-bound challenge. A recorded report does not remove content,
claim a moderator has reviewed it, or establish a staffed moderation service.
There are no token rewards, League scores or project-lead privileges here.

## Data and permissions

The explicit `createAllianceFeedbackApplication` composes the existing verified
cookie/Auth boundary, SQL session binding, signed deletion history and a new
feedback-aware startup gate. Older member/community applications do not route
feedback. The new factory defaults off and has no deployment or secret lookup.

The candidate adds four private tables in `alliance_feedback`: a default-off
control, ideas, supports and reports. It reuses the existing locked owner and
executor; it creates no role or login. All tables force RLS. Only four fixed,
fingerprinted SECURITY DEFINER entry points are granted to the restricted
executor. Auth/public/service roles and the executor receive no table access.
The owner has the existing profile-ID reference grant. The atomic installer
requires closed member/community controls, verifies unchanged Auth row counts,
and removes temporary owner membership before commit. A separate inspection
rolls back its temporary access. Hosted installation needs a separate decision.

Ideas use an immutable UUID and author binding. Exact repeated posts reconcile
the same active idea; changed requests and removed IDs are refused. Author
removal clears its title/category/detail, removes support and idea-report rows,
and retains an ID/author tombstone until profile deletion. Support submits an
explicit desired boolean state, rejects self-support, and respects hiding.
Removing one's existing support can work without reading hidden content.

Reports retain only reporter/target-owner IDs, kind, target ID and timestamp.
They have no peer listing/read endpoint. Duplicate IDs are bound to the same
reporter and target. Reports do not copy private text or account details.
An idea removal deletes its reports; profile deletion cascades all rows tied
to that profile. Challenge-report metadata otherwise remains until relevant
profile deletion or a separately designed retention/review process; automatic
challenge deletion, moderation staffing and report resolution are not supplied.

Pilot counters cap positive use at 128 created ideas, 512 support additions,
256 reports and 1,024 state-changing operations. Counts do not refill when rows
are removed. These are deliberately finite pilot limits, not production sizing
or an external billing cap. At the mutation ceiling, further changes refuse;
existing profile removal remains the separate member capability.

## Browser boundary and accessibility

Unmounted paths are `/api/alliance-members/feedback/ideas`, `/idea` and `/change`.
They use same-origin requests and the existing HttpOnly cookie, reject supplied
bearer credentials/actor IDs, bound bodies and pagination, and return private
no-store responses. Internal deletion-evidence IDs include the author and every
persisted supporter, including hidden supporters. Fresh signed deletion review
checks those IDs before disclosure; the browser receives only an idea, a count
and its own support state. Reports return a private recorded receipt with
`removed:false`.

Uncertain writes are explicit `unknown`, never success or an automatic retry.
Late/cancelled work cannot release private content or reopen the instance.
Explicit support state and stable post IDs support understandable confirmation
and reconciliation. The live dashboard panel is not wired in this change;
keyboard/screen-reader, touch/mobile, focus/status announcements and author
removal/report wording still require implementation and human acceptance.
Automated boundary tests do not establish WCAG conformance.

## Recovery

Checkpoint format 4 separately binds member9, community5, feedback4 and journal3
table inventories, with an independent digest domain. The feedback inventory
must match before and after the complete existing member/community/journal
review. Only `authorizeFeedback` can grant the new capability. Old formats and
old profile/community gates cannot silently omit these four tables.

Recovery package format 3 requires ten ordered components, including a separate
feedback dump and the full format-4 checkpoint. Older archive readers reject it.
The synthetic native drill exports actual member/community/feedback PGDMP data,
uses real checksum-pinned age encryption, recovers through a fresh byte-only
process from a separate same-host ciphertext, then restores onto a different
disposable PostgreSQL cluster. It compares all 18 table digests and checks
ownership/support/removal and surviving independent deletion evidence.
Journal/control/Auth/storage/signing/deployment components are explicit
stand-ins in this drill, not proofs of their managed-service recovery. This
does not prove off-device custody or a scheduled production backup.

The existing fixed Lambda package list includes only the new read-only recovery
module and shared contract needed by the expanded startup gate. It does not
include feedback SQL, the store, service, HTTP handler or an activated route.

## Validation and remaining release gates

Run `node --test feedback.test.mjs feedback-recovery.test.mjs` in the server
directory, `node --test tests/alliance-feedback-http.test.mjs
tests/alliance-member-application.test.mjs` at the repository root, and the
existing full server suite. The native runner includes the disposable feedback
permission and encrypted restore scenarios. Required CI results are recorded
in the pull request; source tests alone do not prove hosted acceptance.

Remaining: hosted disabled installation decision/verification, adopted current
serving/recovery evidence covering the new tables, finite protected member and
image/community/feedback journeys, report-handling/retention decisions, durable
dashboard client/panel and assistive-device acceptance, non-owner enrollment,
revocation/operations and explicit release/rollback approval. No completed email
test or finite authority rehearsal is reopened by this source work.

Primary references reviewed: [Supabase database functions](https://supabase.com/docs/guides/database/functions),
[PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html),
[PostgreSQL 17.11 changes](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)
and [announced HTTP CBC cipher removal](https://supabase.com/changelog/cbc-tls-ciphers-deprecated).
The latter explicitly excludes direct PostgreSQL/pooler connections; it does
not justify a TLS or provider change in this candidate.
