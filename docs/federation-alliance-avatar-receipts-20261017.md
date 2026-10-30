# Alliance durable image receipt candidate

October 17, 2026. **Disabled, unapplied candidate SQL.** No hosted database,
Storage bucket, credential, public upload/read route or cleanup job is enabled.
This extends the existing ownership ledger and private gateway contracts.

## Member task and accessibility

A lost connection or reload must not erase whether an image is still processing,
was confirmed, or awaits physical deletion. The server can recover those facts
from durable records rather than asking a member to remember a code or repeat an
uncertain action. Images remain optional; text profiles and the current image
must remain usable when a replacement fails. Actual native forms, status
announcements, keyboard, assistive-technology and phone acceptance remain open.

## Data flow and evidence

Before dispatch, `claim_upload(actor,operation,descriptor)` records the derivative's
exact PNG byte count, dimensions, MIME and SHA-256. Bounds match the gateway:
45–307200 bytes, positive integer dimensions at most 256, image/png, lowercase
64-character hash. Unknown fields, missing values and wrong JSON types refuse.
A replay cannot replace the descriptor or dispatch another upload.

The trusted gateway then performs the one write outside the database transaction.
`commit_upload(actor,operation,result)` accepts only its exact `stored`, settled,
verified result, with a receipt matching that descriptor, profile, object and
derived immutable path. It persists the provider ID and receipt with database
settlement time before atomically updating the current image/version. Matching
replays do not increment the version. A conflicting receipt or reused provider
ID refuses, including against retained deletion records.

`settle_unpublished(operation,result)` accepts matching `stored` or
`stored_unverified` gateway results for cleanup. It never publishes an image and
can operate after account removal or while new operations are disabled. An
unknown result, timeout, abort or absence-only finding cannot settle a writer.
Once cleanup is chosen, a later verified result cannot restore that image.

Cleanup batches recover the exact stored receipt. `ack_deleted(object,result)`
requires the gateway's matching `deleted`, settled result and receipt, no active
pointer and a cleanup-ready object. The deletion proof and database deletion
time remain durable; an identical replay is harmless. A lost deletion response
stays unresolved rather than freeing space on a later 404. A never-uploaded
cancelled slot cannot be relabelled as physically deleted by fabricating a proof.

The server-only `operation_receipt(actor,operation)` read recovers the object's
identity, immutable path, descriptor, upload/deletion receipts and status for
that actor's live profile. It is not the browser DTO and must not be forwarded
wholesale. After account removal, the cleanup worker uses its bounded cleanup
read rather than pretending the deleted account can authenticate.

## Privileges, concurrency and privacy

The same two NOLOGIN roles and five forced-RLS tables remain. New validation
helpers are private; only the explicit execution role can call transition and
recovery functions. Receipt-free overloads are absent. API roles cannot enter
the schema, and the executor has no direct table privileges. No new profile
content, moderation or account-row permission is granted to the function owner.

The SQL still trusts a future authenticated server's actor and gateway result.
JSON validation is not authentication, a provider signature, or independent
proof that a real external write/delete occurred. Never accept these results
from a browser or expose the functions as public RPCs. Actual service credentials
and Storage policies need their own access review and hosted acceptance.

Short control-row transactions serialize reservations, receipt transitions and
deletion. Network calls and image decoding stay outside the lock. The future
parameterized connection adapter must supply query/lock deadlines and handle
unknown database acknowledgements; this SQL alone does not implement that adapter.
An active image requires a settled, verified receipt; settled objects require
receipt/time, and deletion proofs can belong only to deleted settled objects.

Only derivative metadata, provider/object/profile IDs, hashes, states and database
times are retained. Original image files, names, source URLs, credentials, raw
provider errors and account email are not receipt fields. These pseudonymous
records still need a reviewed bounded retention policy. No pruning job exists;
do not enable real data until idempotency/tombstone, unresolved-file escalation,
account erasure and backup/restore-without-resurrection behavior are accepted.

## Verification and remaining gates

The disposable native fixture checks malformed descriptors, field/identity/hash
tampering, provider-ID reuse, unknown/unverified outcomes, actor boundaries,
immutable replays, retained deletion proof, default closure and exact grants.
It retains earlier lifecycle, expiry, quota and account-removal tests.

Separate committed connections race matching upload acknowledgements and deletion
acknowledgements; both finish with one image version and one exact durable proof.
Fresh client processes recover those records. The actual JavaScript gateway's
upload and deletion outputs are fed into native SQL using four in-memory provider
responses and synthetic pixels. This proves contract composition, not real Auth,
Storage, a database crash restart, backup recovery or deployed host behavior.
The runner verifies rollback and removes its separately committed race fixture.

The [disabled server connection adapter](federation-alliance-avatar-server-20261017.md)
now prepares fixed parameterized transactions, restricted-identity/TLS checks and
unknown-COMMIT handling, with real-driver disposable TLS acceptance. It is not
mounted or connected to a hosted project.

Next connect bounded authenticated orchestration; implement live
viewer/current-image/listing/membership policy and durable profile mutation
reconciliation; finish unknown-write recovery, physical cleanup claims and bounded
retention; accept native host isolation, abuse/cost and backups/deletion. Reviewed
hosted setup, Google warning clearance, real account/phone/assistive checks and
public release review remain separate gates. Nothing is activated by this draft.

Primary guidance: [PostgreSQL JSON types/operators](https://www.postgresql.org/docs/17/functions-json.html),
[transactions](https://www.postgresql.org/docs/17/tutorial-transactions.html),
[Supabase Storage API deletion](https://supabase.com/docs/guides/storage/management/delete-objects),
[Supabase changelog](https://supabase.com/changelog). Existing HTML changelog was
checked after the lightweight Markdown endpoint was unsupported. No observed
change removes the stated acceptance requirements.
