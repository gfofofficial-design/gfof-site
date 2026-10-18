# Alliance account restart handoff candidate

October 18, 2026. Source-only preparation for draft PR #124. No hosted
installation, account permission, running store or public service is provided.

## What this adds

`lib/alliance-avatar-server/account-handoff.mjs` defines a separate bounded,
canonical restart record for account history. It binds three distinct project
references, epoch, the pinned account-witness verification key, generation,
predecessor digest, observed history head, acknowledged minimum and an optional
unresolved operation. It does not reuse the content/profile trust-record format.

`reviewAccountHandoff` requires an independently retained exact digest, minimum
generation, scope and verification key. There is no missing-file/genesis fallback.
Duplicate JSON keys, noncanonical bytes, malformed points, changed scope/key and
older generations are refused. SHA-256 detects changed bytes against a trusted
receipt; it cannot authenticate a receipt supplied by the same restored copy.

`reviewAccountHandoffSuccessor` checks one exact successor generation and a complete
canonical account history extending BOTH earlier minima. An unacknowledged removal
head cannot disappear while acknowledgement remains unchanged. Key rotation and
epoch migration are deliberately not accepted through this function.

## Interrupted and unknown work

A proposed history append records its operation ID, exact canonical event and
expected head. An acknowledgement advance records its operation ID, expected
acknowledgement and target head. Staging either requires unchanged minima in its
own successor generation; admission ordering and reserved removal capacity are
checked before a history intent can be accepted.

The unresolved operation is sticky. It cannot be removed, replaced, assigned a
new ID or called successful merely because later observations advance. It must
remain after a restart, cancellation or lost reply, including when the expected
event subsequently appears in history. There is intentionally no resolution,
retry, replay or dispatch entry point in this candidate. Missing results are not
proof that the database did not commit.

## Storage and execution gates still required

These functions review bytes; they do not save or install them. A later reviewed
coordinator must durably record the intent and receive an independently protected
commit/readback receipt BEFORE dispatching a mutation. It must checkpoint new
observations before releasing evidence, use compare-and-set against the latest
protected generation, serialize competing writers, enforce deadlines and fencing,
and preserve unknown outcomes across crashes. A separate reconciliation protocol
must prove which exact operation committed before any pending state can change.

The record and its latest trusted digest must not be rolled back together.
Protected external custody, durable storage semantics, administrator threat model,
restart loading, key provenance/rotation and multi-process/fleet coordination are
unimplemented. No runtime automatically wires this record into existing authority
or acknowledgement factories. An externally accepted record can supply their
head/ack minima, but does not establish currentness, authorization, admission,
instant revocation or physical erasure. Never use `pending: null` as permission.

This is not a completed durable-store gate. SQL, hosted permissions, real keys,
archive formats and the existing account hold remain unchanged.

The [checkpoint coordinator candidate](federation-alliance-account-checkpoint-20261018.md)
now orders two injected CAS/commit/readback capabilities before one mutation and
tests real synthetic storage interruption/restart. Production backend/custody,
unknown resolution and runtime integration remain separate acceptance gates.

## Observed acceptance

Focused tests cover canonical boundaries, external pins, generation/key/scope
changes, complete-chain continuity, both rollback directions, legal intent staging,
capacity, sticky unknown work and isolation from mutable inputs. A fresh reader
with restarted minima rejects an older correctly signed account response.

A synthetic fixture flushes and renames a record, then reads it in fresh Node
processes against a receipt held outside that file. Interrupted replacement,
truncated/missing files and an old coherent copy refuse; the retained unresolved
operation survives a successful restart. Fixture filesystem flushing is not a
production durability, Windows ACL, directory-fsync, external-custody or crash
simulation claim. The fixture deletes only its own temporary directory.

Existing signed-status and database/recovery tests remain separate evidence.
There is no new network access or provider probe in these tests.

## Accessibility and privacy

There is no new user interface. Future interrupted-operation status must use
persistent plain-language text, distinguish pending from failed or complete, and
remain available through keyboard and assistive technologies without countdowns,
hash transcription or repeated secret entry. Support must remain reachable after
sign-out. These backend tests establish no WCAG conformance.

Account tags and event identifiers can be linkable. No email, raw Auth UUID,
password, token or private signing key belongs in this record. Real retention,
access, deletion and recovery-custody policy remains a release decision.
