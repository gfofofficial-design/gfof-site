# Alliance independent deletion-journal protocol candidate

October17,2026. Disabled, read-only verifier and pure record encoder; no hosted
journal, append writer, durable store, signing key, member route, permission,
retention period, scheduler or startup interlock is installed. Existing image
and account services remain closed. This is a protocol component, not a running
independent deletion service or completed recovery guarantee.

## Member task and accessible failure behavior

A deletion request must not be forgotten when an older database backup is restored.
Keep removal intent outside that backup and consult it before any future image
delivery. Record intent separately from confirmed physical deletion: a request to
stop showing an image does not prove that Storage or backups erased its bytes.

If independent evidence cannot be verified, keep the image unavailable and give
one plain-text status with a support path. Do not ask a member to repeat an upload,
transcribe a key or race a countdown. Images remain optional; independently
authorized text profiles should remain useful. Future UI needs semantic controls,
announced status/error messages and keyboard, assistive and physical-device tests.
This server component adds no UI or WCAG acceptance claim.

## Smallest practical architecture

1. **Independent append authority, not yet implemented.** Store an append-only
   sequence of minimal deny intents and its monotonic tip outside the member
   database's backup/restore boundary. It needs atomic conditional append, durable
   acknowledgement, an idempotent event-ID lookup and recovery after a lost reply.
   A member backup must not overwrite this store or its current epoch/tip.
2. **Independent witness, not yet implemented.** A server-held Ed25519 key signs
   the authority's current tip and a verifier-generated random challenge. The
   witness must read its own authoritative current tip, never sign a tip supplied
   by an untrusted caller. Signing a stale store with a fresh challenge is still
   stale evidence. Keep the signing key out of member backups, browser code,
   project files, chat and the read-only verifier. No real signing key is created
   here. Provider selection, durability, key custody, costs, rights and approval
   remain gates; no vendor or free allowance is assumed.
3. **Trusted startup floor, not yet installed.** Pin project, epoch, public key
   and a minimum accepted sequence/hash independently of the restored archive.
   Preserve monotonic evidence across process restarts and account for the latest
   acknowledged deletions. A genesis floor from a member backup cannot replace
   an existing floor. Epoch changes require reviewed continuity of all denials;
   there is no automatic reset or unblock operation.
4. **Bounded consumer, implemented as disabled source.** Generate one fresh
   32-byte challenge, verify one signed witness, fetch one bounded complete chain,
   and build a deny-only in-memory review. No retries or follow-up writes occur.
5. **Member/startup integration, not yet implemented.** A verifier result is an
   additional denial input. It never replaces current Auth/session/ownership,
   moderation, SQL, Storage or actual freeze/startup checks. Missing, stale or
   failed evidence must block delivery rather than fall back to the database.

## Record format, integrity and privacy

Records have an exact fixed field schema: format1, project reference, epoch UUID,
sequence, previous SHA-256, event and SHA-256. The event contains only its unique
UUID, profile UUID, kind and object UUID or null. Supported kinds are
profile_remove_requested and image_remove_requested. Profile intent blocks that
profile's images; image intent blocks the immutable object UUID even if an older
database assigns it to another profile. No event grants access or unblocks data.

The pure deletionRecord encoder uses a fixed ASCII schema/order and a versioned
domain prefix. It is not a general JSON canonicalization standard, append service,
authorization check or durable acknowledgement. A complete chain must start at
the zero digest, have consecutive unique event IDs, match all hashes and the
trusted floor, and end at the signed tip. No missing prefix, gap, duplicate,
reordering, edited event or truncated tail is accepted. Do not trim old records
to pass a bound or silently compact away denials.

The signed witness binds format, exact project/epoch, sequence/hash, fresh
challenge and explicit UTC issue time with a separate versioned domain. The
verifier accepts only the configured raw32-byte Ed25519 public key, never a key
sent in the response. Maximum age is30seconds with at most1second future clock
skew. A monotonic elapsed-time bound also applies. Once observed expired, a view
stays unavailable even if the wall clock moves back. Starting another review or
closing the consumer invalidates all its prior views. These are protocol-work
bounds, not a public retention policy or a member countdown.

Within an instance, a signed lower tip or same-height fork faults the reader.
Newly witnessed higher tips are remembered even if record fetching fails. A
subsequent chain must extend that floor. This memory does not persist across a
process restart; independently preserved startup state remains required.

No images, emails, Auth IDs/tokens, URLs, free text, raw Storage receipts or
credentials belong in these events. Profile/object/event UUIDs remain private,
linkable identifiers. Neither hashes nor a signature anonymize them or prove
erasure. The verifier returns no raw events/IDs; its check accepts a private
profile/object pair and reports blocked, not_listed, invalid or unavailable.
**not_listed is not permission, safety or deletion proof.**

## Work and concurrency bounds

The consumer defaults closed, reads no environment/files/credential store and
imports no database or transport SDK. Its two injected read adapters are not
implemented network endpoints. Future adapters must bound response streams
before buffering and obey the supplied abort signal.

One review per instance makes at most one witness read (2048bytes) and one chain
read (256KiB), with an independent8-second total deadline. Strict byte/UTF-8/JSON,
field and scope checks apply. At most256 records are accepted, including genesis
as a distinct empty-chain case. Exhaustion refuses rather than dropping history.
This cap bounds this first verifier; it is not an adopted production capacity or
permission to expire a tombstone. A scalable checkpoint/compaction scheme must
retain all relevant denials and needs a separately reviewed policy.

The short-lived view is for internal review. It does not guarantee immediate
revocation for a deletion arriving after its witnessed tip. Future serving must
obtain fresh authoritative evidence at the required pre/post-delivery checks and
coordinate concurrent deletion/in-flight work. A globally linearizable revocation
guarantee is not established by this code or by a30-second view.

## Required deletion/restore ordering before activation

Authorize the member and bind the exact profile/object first. Durably append its
deny intent and preserve an independent current tip before acknowledging a
removal that a later restore could forget. Only then detach the database pointer;
separately queue physical cleanup and retain exact provider proof. If the journal
write is uncertain, keep serving closed and reconcile by its event ID instead of
blindly appending or repeating a provider action. An acknowledged intent followed
by a database failure remains a conservative denial requiring recovery.

All deletion paths must participate: image removal/replacement, profile removal,
account removal, moderation and any administrative/provider path. The current
candidate profile SQL includes direct authenticated deletion paths; those would
bypass such an external pre-intent step. Before activation, replace/restrict
those paths through separately reviewed server/session permissions and test the
bypasses. A SQL outbox that is restored together with the same database is not an
independent deletion journal. An Auth deletion outside this protocol is not covered.

During recovery, keep member reads/writes, cleanup and in-flight delivery stopped.
Verify independent journal continuity/current tip and reconcile all deny intents
against the restored head/operation/receipt/quota history. Preserve unknown writers
and unresolved cleanup. Validate Auth, profile bindings, schema/roles/credentials,
Storage and other backups independently. Missing history or uncertain quiescence
means stay closed; an intact old archive is insufficient. No retention/replay age,
backup-erasure horizon, automatic30-day expiry or physical purge is adopted here.

## Verification and remaining decisions

Tests use real Ed25519 signatures from ephemeral synthetic keys held only in test
memory. They cover replayed witnesses, wrong keys, altered/truncated/reordered
chains, signed rollback/forks, pinned-prefix continuity, clock expiry, byte/event
bounds, privacy, cancellation and no late follow-up work. A disposable actual-driver
TLS fixture restores a synthetic old active head and removes its database tombstone;
an independently signed intent still reports blocked. The journal reader changes
no ledger rows. Only the fixture simulates/restores rows; no hosted account,
Storage request, real backup or actual independent durable store is used.

Next implement and review the conditional durable append/witness/floor boundary
and required member/startup interlock, then test crash/lost-ack/concurrent append
and all delete bypasses before seeking an exact hosted setup decision. Also finish
retention/replay/backup policy, member HTTP/private viewing, actual hosted Auth and
Storage/credential acceptance, abuse/cost/data rights/privacy/support, native host
isolation, assistive/mobile acceptance, Google warning clearance and publication.

Primary reference checked October17: [Node crypto verification and public keys](https://nodejs.org/api/crypto.html).
Only existing stable crypto APIs are used; no new package, account or upgrade.
