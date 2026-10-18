# Alliance preparation before creation

Source candidate, October 17, 2026. The SQL is **unapplied**, all new controls
default closed, and server factories remain unmounted. This connects the draft
profile writer and member image reservation to the independent journal admission
protocol. It does not activate member profiles, Storage, signup or a public route.

## Order of work

1. Verify the exact access cookie with Auth. Derive the account/session only from
   that accepted token, pin its issuer, audience, role, subject, session and expiry.
   SQL separately checks the current confirmed, unbanned account and live session.
2. Check the serving/startup permit. Commit a bounded member-side preparation
   containing only prospective subject identities. Concurrent profile preparation
   chooses one stable profile ID per account; image operation IDs bind one stable
   prospective image ID and expected version. No profile, owner, image object,
   processing quota or provider upload is created by preparation.
   Preparation/activation require synchronous commit, fsync and full-page writes;
   the parameterized member adapter pins synchronous commit for its transactions.
3. Recheck the permit. Commit the exact deterministic future-removal admission in
   the separate journal and validate its exact response. Closed/full/removed or
   ambiguous admission cannot start member activation. No transaction remains
   open across the remote call.
4. Recheck the permit. Activate only that prepared identity in a new member
   transaction, under the global control lock, current SQL session and removal
   fences. Profile input is validated; existing moderation is retained. Image
   activation preserves the existing version, concurrency and daily limits and
   spends processing quota once. Only then can the existing decode/claim/upload/
   publication flow proceed. Publication still rechecks its live session/fences.
5. Recheck the serving permit before returning a confirmed result. Profile output
   additionally retains signed deletion-history checks before/after its load.

The new extension refuses installation over existing member/profile/image data
or an enabled member store. It adds one private forced-RLS preparations table,
default-off creation switch and narrow fixed executor functions. It revokes the
old authenticated profile-save/direct-column write paths and the executor's old
image-reserve entrypoint. Helpers remain private. It reuses the existing two
locked roles; it creates no login, password, project or Storage bucket. Applying
its proposed owner grants would require a separate reviewed hosted decision.

The old profile store RPC remains historical source but cannot write after this
extension. The unmounted profile handler refuses POST without the creation bridge;
the member facade likewise refuses replacement before Auth without that bridge.
The standalone low-level flow and test seams are not public authorization paths.

## Uncertain results and finite limits

Each bridge instance accepts one active operation, no queue, up to 14 seconds.
The outer profile-response guard retains its shorter eight-second deadline and
forwards cancellation into creation. The image flow retains its 30-second total
budget, reserving at most 14.25 seconds for the cross-domain reservation stage.
These are request budgets, not user countdowns or guaranteed cloud latency.

Preparation, remote admission or activation can commit even if a reply is lost.
The caller reports uncertainty and faults that bridge instance. It does not
retry, refund, erase the preparation or start processing after a late reply.
An explicit separate read-only inspection uses the saved preparation and remote
admission lookup; it never activates, uploads, refunds or automatically resumes.
An admitted status confirms capacity only, not whether activation/upload finished.
Fresh reviewed requests use the same stable identity; committed image reservation
replay returns dispatch false and does not spend quota or upload again. A browser
recovery/status interface and its manual-review lifecycle are still unimplemented.

There are at most 256 preparations and four lifetime image identities per profile,
including abandoned preparations. The journal has matching finite admission
bounds. Preparations/admissions never expire, refund or transfer. These are test
limits, **not adopted production capacity, replacement or retention policy**.
An abandoned attempt can exhaust future capacity; production policy is unresolved.
Closing creation does not erase metadata or prohibit read-only inspection.

## Trust, restore and privacy limits

The trusted server validates the remote journal acknowledgement over the pinned
TLS adapter before supplying the exact event to member activation. Member SQL
validates local binding but cannot independently contact the remote journal or
cryptographically prove that admission committed. A compromised executor or
administrator is outside this protocol's protection; do not present the event
argument as a signed capacity certificate.

This is a two-commit protocol, not a distributed atomic transaction. Local removal
preparation fences activation; an independently recorded removal closes later
admission and blocks restored creation. Cross-domain instantaneous revocation,
provider/admin independence and disaster recovery are not guaranteed. The real
persisted authenticated serving floor, signing custody and startup/restore freeze
must still be implemented and accepted before activation.

Preparations retain account UUID, profile/image/operation UUIDs, expected version
and activation state. These are potentially linkable personal metadata, not
anonymous data. No profile text, source image, email or credential is stored in a
preparation. Retention and account-deletion policy remain unresolved. The
subsequent [paired recovery candidate](federation-alliance-paired-recovery-20261017.md)
adds complete fixed-list data inventories and a synthetic two-domain archive test
including preparations/admissions. Real encrypted exports, schemas, Auth/Storage,
keys and hosted recovery remain unaccepted; no recovery-completeness claim follows.

## Accessibility and verification

No UI changes in this increment. Existing text-first preview, keyboard controls
and user-controlled actions are unchanged. Future unavailable/uncertain/capacity
messages must explain the next step in text, preserve suitable user work and avoid
timed transcription, repeated secret entry or silent write retries. No screen-reader,
mobile, WCAG or hosted acceptance follows from source/database checks.

Unit/composed handler tests cover default closure, Auth-bound identity, ordering,
malformed responses, changing permits, cancellation, late replies and read-only
recovery. Actual TLS fixtures use two disposable PostgreSQL servers and synthetic
Auth rows/provider responses to exercise preparation, remote admission, activation,
lost replies, fresh-client recovery, legacy denial and journal-first removal. The
decoder/gateway retain their separate native suites. Hosted Auth, Storage and
provider behavior still need their own bounded acceptance.

Remaining gates include production capacity/retention policy, browser recovery,
account-removal bridge, persisted floor/startup/restore and backup coverage,
unknown provider-proof reconciliation, bounded HTTP/UI lifecycle, real assistive
and mobile acceptance, Google-warning resolution and publication review.

References: [PostgreSQL transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html),
[Supabase database functions](https://supabase.com/docs/guides/database/functions).
