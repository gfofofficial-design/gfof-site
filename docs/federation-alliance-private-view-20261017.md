# Alliance current self-image viewing candidate

October 17, 2026. Draft source integration; not a mounted or enabled route. No
hosted settings, permission, credential, table or provider request was changed.

## Member task and accessible behavior

A member can eventually view their own current optional profile image after
sign-in. Text profiles must remain usable if the image is unavailable. The
future page needs a meaningful alternative description, a clear text unavailable
status, keyboard-accessible controls and no forced retry/countdown. This source
increment changes no UI and establishes no screen-reader/mobile/WCAG acceptance.

## Exact request and authority

The existing member facade now recognizes GET at
`/api/alliance-members/me/image/content` with exactly `{operationId}` as its
already-bounded internal input. `viewEnabled` is separately false by default.
There is no query string, browser actor/profile/path/provider URL, bearer override
or cross-site request permission. The operation identifies a known replacement
receipt; it is not authorization. HTTP body/parser integration is still unmounted.

The exact cookie is verified by the pinned Auth service, then its subject/session
and expiry are bound to live SQL checks. Before any Storage read, the coordinator
requires a trusted startup/restore serving gate, the current own head and a
committed verified upload receipt matching that head, profile and descriptor.
No active head, stale receipt, unverified upload or prior deletion proof can select
an image. A held-profile owner can view their own image; this grants no directory
or other-member image access.

The actual gateway invokes the bound policy before and after its one download.
Each invocation requires the serving gate, fresh independently signed complete
deletion history, live matching SQL session/profile and the unchanged version/
object pointer. Journal `not_listed` is only one necessary check; it never grants
access itself. The proof view must remain valid through bounded byte consumption
and a final serving-gate check. Any denied, unavailable, expired or changed state
discards the image. No automatic retry or stale image fallback is performed.

## Response and resource bounds

At most two reads are admitted, with no queue, a 30-second total response deadline
and earlier token-expiry/cancellation. The coordinator requires both gateway
policy checks to succeed. It bounds bytes to the exact receipt (at most 300 KiB),
verifies SHA-256 and the PNG envelope, and builds its own response headers. A
provider response cannot forward cookies, redirects or arbitrary headers.

Responses are `private, no-store`, including Netlify CDN no-store, Cookie variation,
no-referrer, nosniff, noindex/nofollow and a restrictive image CSP. A browser/device
may retain bytes already shown; no-store is not remote erasure. The implementation
has no public URL, signed URL, directory image endpoint or original-file delivery.

Dependencies are owned by the host, not closed by a request. Late results are
discarded/cancelled; a noncooperative dependency cannot be forcibly stopped by a
JavaScript deadline. The host still needs concurrency/abuse/source budgets and
actual network isolation. There is no provider polling or background task.

## Evidence and remaining release gates

Unit checks compose the real gateway and signed reader against synthetic data.
The disposable TLS fixture composes the actual member facade, ledger, signed
reader and gateway, proving private output, deletion denial over an active head,
logout and pointer movement during download. Auth, provider responses, startup
permit and signing keys are fixtures. Exact temporary session/pointer changes
are undone before subsequent tests. No real account, provider or hosted data is
involved. This is integration evidence, not hosted acceptance.

The serving-gate interface is required but does not itself install an authenticated
persisted startup floor or restore interlock. Real key custody, independent current
journal transport/floor, all-path removal intent before mutation and bypass
prevention remain. Separate reads cannot prove a globally latest/linearizable
decision: a change after the final check can still race response delivery. No
unconditional guarantee of immediate revocation is claimed.

Finish bounded HTTP/private-output handling, default-closed deployment wiring,
deletion routing, retention/replay/backup policy, real hosted Auth/Storage/roles/
cost acceptance, privacy/support and assistive/mobile checks. Clear the recorded
Google warning without bypass, then complete publication review.

Current [Supabase session documentation](https://supabase.com/docs/guides/auth/sessions)
confirms that a live `auth.sessions` lookup is necessary for stricter sign-out
checks beyond token expiry. The [changelog](https://supabase.com/changelog) was
reviewed; the Markdown index was unsupported. No SDK, schema or provider feature
upgrade was introduced, and hosted schema/version compatibility is still unproven.
