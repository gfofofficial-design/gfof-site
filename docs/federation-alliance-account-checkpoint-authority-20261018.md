# Alliance account checkpoint authority candidate

Source-only, default-off and unmounted. No provider, credentials, bootstrap,
reset, key installation, public route or account activation is supplied.

The coordinator now sends canonical next bytes, complete bounded account history
and an ordinary/resolution discriminator alongside the expected/next receipt.
The separate `createAccountCheckpointAuthority` service reads its own retained
canonical record, verifies scope/key/current receipt and derives permitted
successors using the existing handoff/resolution reviewers. It does not accept
arbitrary digest replacement as a sufficient state change. Both floors and a
pending operation remain protected; reconciliation must prove the original
conditional effect or displacement, not assert an outcome flag.

## Capabilities and commit order

Only trusted service code receives `store.read` and `store.compareAndSet`.
Clients receive the service's `read` and `advance` interface. Store reads return
exact `{bytes, receipt}`; CAS accepts `{expected, bytes}` and returns an exact
committed/conflict receipt. The backend must perform durable atomic CAS against
the current stored generation/digest, not implement a separate read then write.
Store replies are copied and canonical bytes are hashed/reviewed. Committed bytes
are independently read back before a committed service receipt is returned.
Conflict receipts are checked against a fresh read. Malformed client proof causes
no CAS; storage/protocol failure after CAS dispatch is unknown and faults this
service instance closed. There is no retry, queue, automatic initialization or
repair. At most one request is active per instance, with a maximum four-second
deadline; cross-instance serialization belongs to real atomic backend storage.

The coordinator preserves its existing order: ordinary slot commit, authority
commit, both read back, then one business mutation. A split commit or lost reply
does not authorize replay. The service does not dispatch business mutations.
Current source factories still inject capabilities; callers must not substitute
a checksum-only callback or expose the backing CAS in production composition.

## What the source evidence proves

Fourteen added tests cover semantic advancement, both rollback floors, forks,
sticky pending state, exact scope/key/proof bounds, stale expected state, two
service instances competing for one CAS, defensive copies, lost commit replies,
false receipts/changed readback, close/timeout, coordinator conditional resolution
without replay and actual SQLite close/reopen with a separately retained latest
pin. Existing checkpoint/reconciliation tests remain in the suite. The SQLite
adapter is explicitly synthetic, same-host test storage. These tests do not prove
provider authenticity, physical-power-loss behavior, independent custody or a
fleet/old-producer fence.

## Remaining production decisions

Select an independently current, authenticated authoritative backend and bind its
provider/account/region/resource identity. Raw store write/reset/delete/restore
credentials must not reach the calling application. Keep authority outside every
ordinary recovery set. A fresh service trusts that backend's current state and
the separately supplied minimum: a stale backend plus stale minimum is not made
current by this module. Provider/administrator power remains a trust assumption.
Loss of authority must close service, never load genesis from an ordinary backup.

A separate-provider DynamoDB/Lambda implementation is an investigated candidate;
a dedicated Supabase project offers a different, same-provider operational
boundary. Neither is selected, installed or quoted by this source change. Real
atomic commit/readback, denied-root restoration access, secret custody, transport
authentication, bounded input parsing/rate limits, coordinated restore and
deployment/session/in-flight-operation fences remain acceptance gates. No new
dependency, SQL, hosted role, mode flag, UI or public route changed.

Canonical records and history proofs contain linkable subject hashes and
operation identifiers, not anonymous data. A hosted authority introduces another
data flow; minimize payload/log retention and define access/deletion before real
members. No names, emails, profile text, image bytes or signing secrets belong in
this service. Future unknown/unavailable states need durable plain language,
keyboard/screen-reader access and support after sign-out, without timed secret
entry or hash transcription. No WCAG, authorization or completed-erasure claim.
