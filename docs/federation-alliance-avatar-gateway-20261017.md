# Alliance private image gateway candidate

October 17, 2026. **Disabled, unmounted server source.** No bucket, credential,
database connection, upload/read route or cleanup service is installed or running.
The page remains a tab-only preview; member uploads are not available.

## Member task and accessibility

Images remain optional. Text profiles work without them. The future interface
must preserve the current image and typed text on failure, distinguish an
unconfirmed write from a rejected upload, and show removal separately from
physical cleanup. Native controls and polite status text must support keyboard,
screen readers and low-bandwidth use without a countdown or repeated codes.
This increment has no UI change and establishes no screen-reader/phone acceptance.

## Prepared transport and trust boundaries

`lib/alliance-avatar-storage.mjs` supplies an explicit server factory. Disabled
calls perform no transport or policy work. Enabled configuration binds one exact
HTTPS Supabase project origin and the fixed `alliance-member-images-v1` bucket.
Trusted server configuration supplies separate API-key and bearer-token headers;
these format checks do not authenticate them or establish their effective rights.
Nothing reads environment variables or a credential store. No browser input may
choose the origin, credentials, bucket, object key or policy implementation.

The three methods use only these operations:

| Method | Maximum intended Storage calls | Required evidence/result |
| --- | --- | --- |
| upload | One POST, one authenticated GET | Server-derived immutable profile/object UUID path; bounded derivative copy; matching provider key/ID; exact PNG length, dimensions and SHA-256 readback |
| read | One authenticated GET | Valid durable receipt and server policy approval before and after the read; exact bytes; private no-store PNG response |
| remove | One single-key DELETE, one authenticated GET | Settled writer, irreversible cleanup authorization, matching deleted object name/ID, then exact `NoSuchKey`/404 response |

There is one total eight-second deadline per invocation, including headers,
streamed bodies and policy callbacks. A stalled or non-cooperative operation
cannot hold the caller indefinitely or start another request after expiry.
Transport cancellation is not a guarantee that the provider stopped processing.
Responses are byte-bounded even without Content-Length. Redirects are refused;
there is no automatic retry, upsert, listing, public URL or signed-URL operation.
No original file, filename or external source URL is stored by this adapter.
The existing decoder must produce the derivative before the ledger authorizes
one upload dispatch. PNG envelope checks here do not replace native decoding.

## Honest settlement and deletion

An upload is `stored` only after a matching successful acknowledgement and exact
binary readback. A matching acknowledgement with failed verification is
`stored_unverified`: the writer settled, but the image must not be published.
It may enter cleanup once the durable ledger authorizes that transition.
An error, conflict, malformed acknowledgement, lost response, timeout or abort
after dispatch stays `unknown`, with no settlement claim or automatic retry.
A later GET/HEAD finding or missing file cannot settle that earlier writer.

Deletion must be authorized from durable cleanup state with no active pointer
and no possible late writer. A caller-supplied boolean or browser actor is not
authority. An empty deletion response is insufficient: it might mask missing
permission or follow an earlier lost acknowledgement. The exact matching API
deletion receipt is required before the missing-object check. A missing bucket,
HTML 404, legacy ambiguous not-found, or access error cannot release quota.
Lost deletion acknowledgements stay unknown and require separate reconciliation;
this source deliberately provides no unsafe recovery shortcut.

The future orchestrator must persist receipts and settlement transitions before
changing a pointer or releasing capacity. Current candidate SQL does not persist
the provider ID/checksum/dimensions receipt, so it must be extended and accepted
before this adapter can be connected. In-memory receipts are not durable proof.
Neither this file nor its tests call ledger commit/ack functions or run cleanup.

## Private reads and privacy

A future authenticated server policy must validate the live viewer/account,
current image pointer, profile listing/moderation and viewer membership; an owner
may read their own current image. It runs before and after fetching bytes and
must return exactly true both times. Loss of visibility during the read refuses
the response. An injected callback alone is not Auth, RLS or a membership system.
The resulting response contains PNG bytes and private/no-store headers, never
provider credentials, raw errors or a durable image URL. The HTTP host must apply
these headers without adding public caching or leaking receipt fields.

These are checks at specific instants, not an atomic guarantee against every
simultaneous policy change. Already returned/downloaded images cannot be recalled.
Reusing this unmounted module inside an unauthenticated route would be unsafe.
Supabase service keys bypass Storage RLS; a wrapper's narrow methods do not
narrow the credential itself. Effective credential scope, containment and private
bucket/policy acceptance remain separate reviewed cloud-access decisions.

## Verification and remaining release gates

In-memory tests exercise exact receipt/byte binding, mutable input, uncertainty,
errors, redirects, stalled streams/fetch/policies, late completion, private read
revocation, deletion and refusal to release capacity on ambiguous absence. No
provider call or actual Auth/Storage policy acceptance is implied. The additional
Windows/Ubuntu CI workflow needs no package installation or credentials.

Next: persist receipts and implement the parameterized ledger/orchestrator with
real durable ownership and cleanup claims; accept retry/reconciliation and bounded
metadata retention without resurrection; implement real account authorization,
abuse and serving limits; prove provider response shapes and credentials/policies
in an approved isolated test. Native host isolation, backup/deletion reconciliation,
Google warning clearance, accessible UI/phone checks, costs/privacy/support and
publication review remain release gates. No new dependency, service or plan is
adopted, and no trial is started by this source change.

## Primary references checked October 17

The lightweight changelog Markdown fetch was unsupported; the HTML changelog was
read instead. The October 12 HTTP TLS-cipher deprecation reinforces current-client
acceptance; no relevant new Storage guarantee removes the gates above.

- [Supabase changelog](https://supabase.com/changelog)
- [Standard uploads and non-overwrite behavior](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
- [Private downloads](https://supabase.com/docs/guides/storage/serving/downloads)
- [Storage API deletion](https://supabase.com/docs/guides/storage/management/delete-objects)
- [Error codes, including permission-masked absence](https://supabase.com/docs/guides/storage/debugging/error-codes)
- [Service-key rights](https://supabase.com/docs/guides/storage/security/access-control)
- [Official Storage client HTTP conventions](https://github.com/supabase/storage-js/blob/master/src/packages/StorageFileApi.ts)

This is a transport candidate based on current documented contracts, not proof of
the current Federation project's effective Storage behavior or a security audit.
