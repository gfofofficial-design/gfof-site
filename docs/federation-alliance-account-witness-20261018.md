# Alliance signed account-status evidence

Disabled source candidate, October 18, 2026. The issuer and reader have no mounted
route, Auth/session verification, key lookup, persistent-pin installation, retry,
fleet registration or permission to serve/remove an account. No hosted setting,
key, credential, public signup or Auth-removal hold changes.

## Signed request and independent interpretation

`account-witness.mjs` introduces a separate `GF-ALLIANCE-ACCOUNT-WITNESS-V1` signing
domain. Fixed canonical bytes bind exact format, member/history/ack project refs,
epoch, reader boot ID, fresh challenge, account subject, current history head,
acknowledged prefix, account state and timestamp. Unknown fields, malformed scope
or states and inconsistent points refuse. Account tags remain potentially linkable;
the witness contains no raw Auth UUID, email, token or profile content.

The issuer uses an injected signing capability and a pinned Ed25519 public key.
It reads the complete bounded history and independent acknowledgement, verifies
both against configured/observed minimums, signs, then reads both again. A removal
or acknowledgement change during signing discards the response and latches that
issuer unavailable. Wrong/partial/late signatures or unavailable evidence never
produce a response. There is one active request, no queue/retry, and a finite
maximum3.5-second operation. Uncertain signer completion cannot overlap a retry.

The reader generates a random32-byte boot ID and a fresh32-byte challenge for every
review. It verifies request/scope/subject binding, signature, age and pinned head/
acknowledgement, then independently fetches the full history. Its canonical chain,
exact head, acknowledged prefix and derived subject state must match the signed
decision. A signature alone cannot invent an admission or removal state. A new
intent observed by the later history read refuses the older signed head.

Both sides retain **two** process-memory pins: observed head (including an intent
not yet acknowledged) and acknowledged prefix. A shorter history, same-height
fork or failure to extend an earlier prefix refuses. New instances must receive
protected outside pins and the correct public key; missing pins are not initialized
from the restored database or a first response. Explicitly supplying stale/genesis
configuration is not independently protected trust, however, and remains an
operator/custody issue this module cannot solve.

## Evidence is not an access permit

The five states remain `not_admitted`, `admission_pending`,
`admission_acknowledged`, `removal_pending`, `removal_acknowledged`.
Every successful check explicitly establishes neither authorization nor erasure.
The future coordinator must deny non-admitted/pending/removed accounts and still
perform current session, owner, policy and content checks for an admitted account.
No method in this increment opens a route or grants a permission.

A returned view is bound to one subject and lasts at most five seconds from
request start/issuance checks, with monotonic elapsed-time and wall-clock age
validation and one-second future-clock tolerance. It becomes unavailable after
another review, parent cancellation, view/reader closure or an observed fault.
It is **not instantaneous cross-database revocation**: an already returned view
can remain fresh briefly while a later removal commits. It must not be cached as
a session-wide grant. Future per-operation integration and coordinated in-flight
revocation barriers remain required. Reader boot binding prevents response reuse;
it does not register, revoke or fence an old running fleet.

## Verification

Nineteen focused unit cases cover canonical domain/scope, default closure, separate
external pins, signing readback races, unacknowledged-head rollback, wrong/partial
signatures, replay across challenges/boots, independent state interpretation,
changed history after signing, bounds/encoding, expiry/cancellation and mutation of
the transport's request copy. Keys are ephemeral test objects, never real vault
values or files. JavaScript/OS secure memory erasure is not claimed.

Five actual PostgreSQL/TLS checks compose the existing two account databases with
an in-memory test signer and two consumers. Removed/admitted states differ; replay
refuses; a committed removal during signing discards the in-flight response; fresh
reads retain denial before/after acknowledgement. Coherent rollback refuses both
observing instances and fresh externally pinned issuer/consumer construction.
Only exact synthetic race records/floor changes are restored to the surrounding
fixture baseline; all views close and its outer fixture removes the databases.

## Next release gates

Implement protected durable head/ack pin and unknown-operation handoff, signed-key
provenance/rotation, and current account checks across every member/content path.
The [restart handoff candidate](federation-alliance-account-handoff-20261018.md)
now defines canonical externally pinned records and sticky unresolved operations;
it does not install durable storage, dispatch work or resolve unknown outcomes.
Do not keep a five-second view as authorization or treat an unavailable witness as
permission. Real issuer endpoint access/abuse controls and privacy must be reviewed:
this source does not authorize arbitrary public queries about account subjects.

Coordinated backup generations and older-fleet behavior, off-device/operator key
custody, legacy/epoch carry-forward, managed Auth/session/Storage removal, retention,
capacity/HTTP/browser/Google/mobile/assistive/publication acceptance remain. The
[account recovery companion](federation-alliance-account-recovery-20261018.md)
does not itself supply a current witness or protected runtime pin. No running
signer/monitor, account-erasure service, managed recovery or RPO/RTO is configured.

## Accessibility

No interface changed. Future unavailable/pending/unknown/access-removed/erased
states must be persistent plain text with a keyboard/screen-reader usable support
path after sign-out. Never expose boot IDs/challenges as transcription tasks or
translate the background freshness deadline into timed pressure on a user. These
tests are not browser, assistive-technology or WCAG conformance evidence.
