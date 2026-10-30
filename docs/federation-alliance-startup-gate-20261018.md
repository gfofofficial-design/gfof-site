# Alliance startup interlock candidate

Source only, October 18, 2026. Disabled and unmounted. No hosted setting, role,
credential, signing key, service, schedule or public route is created. The existing
hosted journal pilot remains locked. This is a **consumer of independently signed
control decisions**, not an implementation of their persistence or custody.

The later [persistent control candidate](federation-alliance-persistent-control-20261018.md)
adds unapplied third-domain storage, a read-only runtime adapter and signer factory.
Its actual restart tests do not establish independent minimum/key custody or
authorize a hosted installation/release.

## Why startup needs a separate decision

Restored member data must not authorize itself. Even matching data inventories
cannot establish that deletion history is complete or that it is appropriate to
reopen. The candidate requires a pinned control verification key, separately
provisioned minimum revision and deletion sequence/hash, and an independent
authority that signs fresh decisions. Missing authority never falls back to a
cached approval, the member backup or genesis.

Each instance generates a random boot ID. Each authority read uses another fresh
random challenge. A strict, domain-separated Ed25519 decision binds those values,
both exact project references, journal epoch, control revision, review/serve/closed
state, freeze ID/time, complete checkpoint digest, deletion floor and issue time.
Responses cap at 8 KiB and must be less than 30 seconds old, allowing at most one
second of future clock skew. The full fixed checkpoint schema/order is hashed;
arbitrary JSON, earlier incomplete formats and unknown fields refuse.

The control key must be held outside both data domains and must not be a database
or member credential. Production key custody, rotation and independent durable
control storage are **not implemented or accepted**. A valid signature proves
possession of the pinned signing capability, not operator honesty, complete
history, correct provider identity or a physical freeze. This module cannot detect
a signer whose own persistent floor was silently rolled back and then freshly
signed. That requires an independently protected monotonic authority and recovery
procedure; process-local revision/floor memory is insufficient across restarts.

## Preparation stays closed

One preparation attempt is allowed per instance:

1. Copy and validate the supplied full nine-member/three-journal-table checkpoint.
2. Obtain a signed `review` decision matching its digest and freeze. The signed
   floor must equal that checkpoint's journal tip and cannot regress below the
   separately provisioned minimum. Thus the external authority must have durably
   accepted that tip before authorizing review; this code does not advance it.
3. Run the existing actual paired-inventory and full-chain comparison. Both data
   domains must report all switches closed, with unchanged complete snapshots.
4. Read a new challenge-bound signed decision. Its complete policy binding,
   including revision, must still match the first decision.

Only then return `prepared` with `access: closed`. Total preparation is bounded to
25 seconds, with at most two control reads and the existing five data reads. Each
control read has a 3.5-second maximum. This module does not stop writers; the
operator/control service must establish actual quiescence separately. The data
comparison still omits schema/RLS/roles, Auth, Storage bytes and encryption keys.

## Separate permission to serve

The existing profile/image/creation/removal interfaces already require
`serving.authorize`. This candidate supplies that interface without mounting it.
Every call makes one fresh authority read; there is no cached `true` permission.
It requires a separately signed `serve` decision at a revision strictly newer than
the prepared review, with the same freeze, checkpoint and floor. Observed revision
or floor regression, changed binding, explicit closure, invalid signature,
unavailability, cancellation or timeout latches the instance closed. It cannot
automatically reopen or retry preparation. A deliberate new instance still starts
closed and must satisfy a fresh review; an old boot response cannot be replayed.

Permissions are point-in-time checks, not a distributed atomic lock or revocation
barrier. Callers retain before/after checks, current Auth/session/RLS/visibility,
live signed deletion reviews, database switches, quotas and bounded operations.
Trusted composition must pin the live deletion reader to the same logical scope,
epoch and at least the prepared floor; the gate does not configure another object
or make an unrelated reader trustworthy.
Changing database contents, physical restore, freeze, policy revision or floor
requires a reviewed control transition. Advancing deletion history is still
checked by the separate live deletion reader; this gate's floor is the startup
baseline, not a substitute for continuously advancing deletion evidence.

One call per instance runs at a time with no queue. Busy/pre-aborted calls return
closed without disturbing the active call. Unknown work is aborted where possible;
late noncooperative results cannot start another phase or grant permission.
The module has no route, environment lookup, transport, key provisioning, database
mutation, automatic retry, physical restore or switch-opening operation.

## Evidence, accessibility and next work

Synthetic tests exercise signature/scope/boot/challenge replay, complete checkpoint
binding, fresh review around the real comparison, revision/floor regression,
one-shot preparation, closure, timeouts, cancellation and actual profile response
suppression. The native two-server fixture composes real TLS-backed inventories
and same-count corruption with an ephemeral signing key and **in-memory** control
policy. It never installs a persistent authority or changes hosted data. A protocol
fixture is not a production authority or end-to-end hosted recovery proof.

No UI changes. Future interfaces must explain “prepared, still closed,”
“unavailable” and deliberate release in plain text, without color-only signals,
countdown pressure, repeated secret entry or automatic reopening. Keyboard,
assistive technology, mobile, low-bandwidth and browser acceptance remain required;
these automated tests establish no WCAG conformance.

Next: choose and test independent durable revision/floor storage and signing-key
custody; authenticated freeze and controlled release across all instances;
schema/role/Auth/Storage and real encrypted independent-copy recovery; account
removal and metadata retention; HTTP lifecycle, managed hosting, Google-warning,
assistive/mobile and publication acceptance. The consumer alone is not activation
authority. No additional cloud purchase or access is authorized by this draft.
