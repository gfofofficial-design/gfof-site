# Alliance live removal anchor candidate

Source only, October18, 2026. Both SQL extensions are **unapplied**. No real
member data, hosted access, login, key, route or public feature is enabled. This
extends [persistent startup control](federation-alliance-persistent-control-20261018.md)
with an independent lower bound for newly acknowledged profile/image removals.
It is not complete recovery, physical erasure or production-custody acceptance.

## What changes

Previously, startup policy persisted only a reviewed baseline; later deletion
witness observations lived in process memory. The new control-domain singleton
stores the latest anchored deletion sequence/hash independently of the member and
journal domains. It begins at the existing reviewed minimum, not a configured
genesis reset. A fourth restricted role starts NOLOGIN/password-free and can only
read/advance that anchor. It cannot edit startup policy, bootstrap, sign, reset,
delete or read tables directly. Existing reader gains a fixed anchor read.

Forced RLS, owner-only table policy, private helpers, empty search path and explicit
revokes cover the new table/functions. Advancement locks policy then anchor,
checks synchronous durability and validates the entire bounded canonical chain
against the current anchor prefix. It requires expected sequence/hash and exact
target. An identical already-anchored target is a confirmed no-op; a stale expected
point conflicts, while older/forked targets refuse. No queue, automatic write retry,
expiry/refund or operator floor reset is added. At most256 records/256KiB remain
finite test limits, not an adopted production retention/capacity policy.

Only the latest point is stored in this singleton. Full records cross from the
journal to the control database for verification, including linkable profile/
object/event IDs. They are not stored in the anchor table, but provider parameter/
error logging and retention need separate verification. No image, email, profile
text, private key or raw external-provider response enters this protocol.

## Acknowledgement order and explicit recovery

The new unmounted coordinator uses this order:

1. Validate the account/session and persist a stable member removal plan.
2. Verify complete journal history and commit each canonical removal intent.
3. Read the independent anchor and fetch a complete current journal chain that
   extends it. Verify every receipt matches the prepared subject/event.
4. Advance the independent anchor and require its exact committed acknowledgement.
5. Complete the local member tombstone/removal, then report the committed version.

A lost or uncertain reply never means removal completed. No automatic retry runs.
An explicit later request reuses the same plan, intent IDs and quotas and reads the
durable domains again. Even a previously committed local deletion returns its
stored plan through the new prepare function; it cannot take the old early-success
path. Missing anchor or an older restored journal prevents success on that replay.
Cancellation/deadline/late noncooperative responses cannot start local finish.
One coordinator request runs at a time without a queue.

The member SQL extension revokes the old executor prepare/finish entrypoints and
grants only the new wrapper entrypoints. Finish requires a correctly shaped anchor
proof covering its receipts. **SQL does not cryptographically verify the remote
commit**: the trusted server must obtain it over the fixed TLS/role-checked adapter
and verify the whole chain. A compromised trusted executor can forge claims; this
is not atomic cross-database commit or protection from compromised administrators.
The adapter keeps read-only and anchor-writer capabilities separate, validates
committed results, and labels uncertain dispatched writes unknown without retry.

## Live views and startup remain separate

`createAnchoredJournalWitness` reads the live anchor before and after the existing
bounded, cryptographically verified witness producer. It refuses a current chain
older than/forked from that anchor, even in a new instance configured at genesis.
The original witness still verifies its independently configured/observed minimum
and full chain; the new wrapper checks the live anchor prefix too. Movement during
the read drops the response. Cancellation, missing anchor or late work closes the
instance; no restored member copy supplies permission. The existing client/view
must consume this producer instead of the startup-only witness factory.

Startup transitions now lock the live anchor as well. A new review cannot propose
an older floor and advances the anchor to any newly reviewed higher floor in the
same local control transaction. `createAnchoredControlAuthority` additionally
requires an exact live floor for review, catching a privileged simulation that
restores only an old review-policy row. Existing serve decisions keep the stable
startup baseline while live removal history advances; live signed deny checks
remain mandatory on each sensitive response. A fresh boot still needs new review
and release, not a replayed serve decision. Deployments must compose these newer
factories; base startup-only factories are not the complete live-removal path.

These reads are point-in-time checks, not a globally atomic serving lock. A fresh
read can race a newly requested deletion; before/after checks and endpoint/session
policy remain necessary. This increment concerns **acknowledged** removals through
this coordinator. Unacknowledged/unknown requests remain unresolved; it does not
implement Auth-account deletion, override all administrator paths or guarantee
physical deletion from Storage/backups. Account-removal orchestration is still a
release gate.

## Actual verification and remaining custody

Synthetic unit tests cover profile/image/empty-image plans, exact proof/chain
validation, lost anchor/local replies, committed replay revalidation, no automatic
retry, malformed responses, wrong scopes, changed anchors, concurrency and bounded
cancellation. Native TLS/SCRAM tests use three actual disposable PostgreSQL servers
with actual member profile/image-history removal and confirmed independent writes.
They test stable replay after profile cascade, revoked old entrypoints, signed
suppression of an old profile DTO, accidental grants, older restored journal and
review refusal, actual control restart/fresh readers, and missing-anchor refusal.
The profile DTO loader is synthetic; these are not real Google/browser/provider
or production recovery tests. All data/roles/pools/servers/scratch are removed.

Protected independent minimum copies, signing-key custody/rotation and a recovery
procedure for loss of the latest trusted control copy remain unimplemented. If
policy, anchor and all external minimums are rolled back together, a new signature
cannot reveal forgotten history. Three projects under one administrator do not
prove independent custody. Never reconstruct authority from member backups or
automatically accept genesis. Real encrypted backups must now cover member9,
journal3 and control2 tables, plus schema/roles/RLS, Auth, Storage, keys and protected
minimums; none of that full recovery/custody is established by this source fixture.

No UI changes. Future status must distinguish pending, unknown, committed local
removal, unavailable and withheld without implying physical erasure. Use clear
text, native keyboard/assistive controls and paste-friendly private operator steps;
avoid countdown pressure, color-only signals and automatic destructive repair.
These automated tests establish no browser/mobile/screen-reader/WCAG conformance.

Next: protected latest-copy/minimum and signing custody; full encrypted recovery;
account-removal and privacy/retention/capacity policy; fixed HTTP budgets and real
Auth/browser/fleet lifecycle; managed-host/Google-warning/assistive/publication
acceptance. Hosted permissions, role installation/login, credentials, spending
and activation need their concrete decisions. No ongoing backup or monitoring is
claimed.
