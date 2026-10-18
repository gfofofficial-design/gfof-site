# Alliance account-history contract

Source protocol candidate, October 18, 2026. **Structure verification only.**
The pure `account-history.mjs` module is unmounted and has no writer, database,
credential, signature service, authentication, removal endpoint or serving switch.
The existing Auth-removal hold remains unchanged. Nothing is installed or enabled
on a hosted project. This contract does not establish durable storage or account
erasure and is not a completed account-removal service.

## Account subject and privacy

An account subject is a SHA-256 tag over the fixed ordered JSON fields
`memberProjectRef`, `epoch`, and `authUserId`, prefixed by the separate domain
`GF-ALLIANCE-ACCOUNT-SUBJECT-V1` and a NUL byte. All inputs have strict ASCII
formats. The account identifier is the verified Auth user UUID, not an email,
Google identifier, wallet, profile, browser-selected ID or mutable metadata.
The helper computes a tag; it does not verify the caller or ownership.

The ledger stores the tag, not the raw UUID. **This is not anonymization:** someone
with the UUID and public scope can compute the same tag; admission and removal
records remain linkable within that scope. No secret salt or new signing key is
invented here. Disclosure, access, retention and recovery handling require review
before use with real accounts. No new real-data retention policy is adopted.

An account needs no profile to be represented. A different, separately consented
Auth UUID has a different subject and no inherited admission or content access.
This is identity-specific history, not a person/email ban. Reusing an old UUID
cannot erase that subject's removal. Epoch/project changes create different tags:
they must never be used to discard denial history. Migration across epochs,
existing accounts without admission, and lifetime-limit rollover remain closed
until a reviewed carry-forward and recovery protocol exists.

## Separate events and capacity

The account namespace is separate from the existing profile/image journal. It
does not reinterpret a profile ID as an account or change the content v1 format.
Each event has exactly `id`, `kind`, `subject`. The kind is `account_admitted` or
`account_remove_requested`. Its stable SHA-256 ID uses the separate
`GF-ALLIANCE-ACCOUNT-EVENT-V1` domain over ordered kind/subject fields. Stable IDs
identify intended effects; they do not authorize replay, retries or a write.

Each record contains format 1, member/journal project refs, epoch, sequential
position, previous hash, event and its own hash. The distinct record domain is
`GF-ALLIANCE-ACCOUNT-RECORD-V1`. Canonical fixed field order is used; this is not a
general JSON canonicalization standard. Unknown fields and cross-scope records
refuse. No email, session token, name, image or profile fields are accepted.

The finite candidate permits 128 lifetime admissions and 256 total records.
An admission reserves one later removal slot, so 128 admissions can still all
record removal. A removal requires its earlier admission. Duplicate admission,
duplicate removal and re-admission of a removed subject refuse; removals do not
replenish admission capacity. A future store must serialize capacity reservation
and insertion transactionally and prove this under concurrency. A pure verifier
is not that store. The input bound is 256 records / 262,144 UTF-8 bytes.

## Independent acknowledgement and rollback

Every review requires the full bounded chain and three externally supplied points:

1. The independently authenticated **current head** of account history.
2. Its independently authenticated **current acknowledged floor**, confirmed by
   the separate control authority before reporting a removal acknowledged.
3. A **protected minimum** retained outside the restored member/history copy.

Each point has an exact sequence/hash. The minimum cannot exceed the acknowledged
floor, which cannot exceed the head. The verifier checks both named prefixes,
every predecessor/hash, event ordering and exact final head. A restored short
chain or same-length fork refuses against the current external points. A new
intent past the acknowledged floor is still removal-pending and must deny work.

**Self-consistent hashes do not authenticate those points or prove freshness.**
Passing the old backup's own head and minimum could validate old structure. The
module deliberately returns `verified_structure`, not a signed/current proof.
It performs no network I/O and issues no live permit. Its result is an immutable
snapshot, with no freshness lease; it must not be cached as permission to serve.
Independent current reads, signed challenges/provenance, durable acknowledgement,
fault latching and all-instance fencing still need a reviewed implementation.

## Status without premature promises

The query returns one of five textual evidence states:

| State | Meaning for the future coordinator |
| --- | --- |
| `not_admitted` | No account admission in this complete supplied history; refuse work. |
| `admission_pending` | Admission is recorded but not acknowledged; refuse work. |
| `admission_acknowledged` | Admission is in the supplied acknowledged prefix; current authentication, session, policy and content checks are still required. |
| `removal_pending` | Removal intent is recorded past the acknowledged floor; deny further work and reconcile the pending result. |
| `removal_acknowledged` | Removal intent is in the supplied acknowledged prefix; continue denial, without claiming physical erasure. |

Every result explicitly states authorization and erasure are `not_established`.
Malformed, inconsistent, unknown-scope or incomplete evidence throws the same
unavailable error. There is no success/allow/delete operation. No lost write reply
may be inferred from a local checksum; a future coordinator must leave it unknown
until independent reconciliation, without automatic replay or new IDs.

## Remaining implementation and acceptance

A separate disabled [transactional store/acknowledgement candidate](federation-alliance-account-store-20261018.md)
now implements that next source gate, with synthetic concurrency/lost-reply and
old-history-row acceptance. It supplies no current signed authority or serving
integration, and its new tables are not yet in the encrypted recovery inventory.
Account admission must precede activation;
pending profile/upload work must share the account fence. A fresh verified owner
request must establish who may request removal. Browser claims cannot do this.

Then coordinate content intents, exact Storage cleanup, Auth/session removal and
fleet fencing. No cross-service atomic transaction is assumed. Managed provider
behavior, already-issued tokens, older Auth/Storage restore and a new unrelated
identity require disposable, specifically authorized acceptance. The
[account-removal boundary](federation-alliance-account-removal-boundary-20261018.md)
lists these gates. Existing serving code does not call this module; the hold must
not be loosened on the strength of these pure tests.

## Accessibility and verification limits

No interface changes. Future status text must distinguish pending, unknown,
access removed and erased, persist through navigation and remain usable without
color, motion or an expiring toast. Use familiar keyboard/screen-reader controls,
plain explanations and a reconciliation/support route after sign-out. Never ask
users to transcribe hashes, account tags or internal state names. Account scope
must be described even when the user has no profile. These are design requirements,
not browser/assistive-technology or WCAG acceptance.

Synthetic unit cases cover accounts without profiles, scope separation, reserved
capacity, pending acknowledgement, old-identity denial with current supplied
history, rollback/fork/truncation/tampering refusal and immutable evidence.
They do not prove a hosted write, real authentication, current external authority,
cross-instance denial or physical deletion. No PostgreSQL schema changes or new
database-native behavior are introduced by this increment.
