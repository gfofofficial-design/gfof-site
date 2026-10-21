# Profile removal confirmation and bounded transport

Default-off, unmounted source candidate. No page imports these modules, no route
is deployed, and no SQL, role, Auth user or hosted setting is changed.

This removes an Alliance profile and detaches its image access through the
existing journal-first member service. It does not erase the sign-in account,
physically clean up provider objects or erase retained backups. The account-wide
history/deletion protocol remains separate and unresolved.

The confirmation panel provides Review, an ordinary scope checkbox and an
explicit Remove action. Keep my profile returns focus to Review. Review focuses
the checkbox. Status is persistent text in a polite atomic live region. Pending
or unknown outcomes expose Check the same removal request, without asking the
member to transcribe IDs or re-confirm a different intention. No automatic
request, retry, polling, browser storage or page-load read is introduced.

The host may supply a freshly authorized **removal version**, or use the new
explicit `readVersion` callback described below. Neither path uses the profile
text edit revision. Authenticated host/page mounting remains separate. A stale
version must refuse through the existing SQL protocol; it is never replaced
automatically during confirmation or reconciliation.

The client generates one operation UUID only on explicit confirmation. It sends
only that ID, version and fixed `remove_my_profile` confirmation to the existing
same-origin DELETE `/api/alliance-members/me/profile` contract. Cookies remain
browser-managed. It sends no bearer token, actor or profile selector. The fixed
origin allowlist, no redirects/cache, 35-second wait and 1024-byte streamed result
limit constrain the transport. Completion requires exact committed shape and
version+1. Unknown, cancelled, late or malformed outcomes retain the same request
for an explicit reconciliation action. Disposal clears it and suppresses late
status updates. Reload loses this in-memory reference; production needs a reviewed
support/recovery path and must not suggest that reloading resolves uncertainty.

The HTTP adapter accepts only the exact path/method, same-origin JSON and a
512-byte streamed body with exact operation/version/confirmation fields. It
refuses bearer overrides and identity injection before the member service. Its
34-second deadline and one-active-request limit bound each adapter instance.
Timeout/closure retires that instance and suppresses late dispatch or completion.
An operation already accepted downstream may still commit; the response remains
unknown. The adapter does not close caller-owned services or pretend its limit
is a global admission or spending ceiling. The existing authenticated member
facade and journal-first coordinator retain account/session and mutation authority.

Local evidence: 22 passing tests cover validation, byte limits, confirmation,
reconciliation, cancellation, late replies, disposal, deadline/overlap handling
and the actual client -> HTTP adapter -> member facade -> removal coordinator
path. Composed cases verify journal-before-finish ordering, exact-operation replay
after a lost member reply, complete-chain reconciliation after a lost journal
reply, and Auth refusal before journal/SQL work. Auth HTTP, SQL ledger and journal
storage are synthetic here; journal hashing and coordinator logic are real.
No new native database, real SMTP, hosted Auth, physical device or screen-reader
acceptance is claimed. Existing native checks remain separate evidence.

Before adoption: review account-bound current removal-version reads, authenticated
host/page composition, CSP, accessible focus and pending/support journeys, exact
native/hosted permissions, independent journal/anchor custody, privacy/retention,
and recovery/startup acceptance. Hosted feature and LOGIN gates stay closed.

## Explicit current-version read candidate

The optional `removalVersionEnabled` member-service flag defaults false. When
explicitly selected, GET `/api/alliance-members/me/profile/removal-status` accepts
no input fields. The existing exact-cookie Auth lookup derives account/session.
`createProfileRemovalVersionView` checks serving authority, current SQL session,
independent profile denial evidence and two matching session-scoped `mineSession`
reads, with fresh journal/session checks between them. Pending image work,
malformed data, changed versions/pointers, profile denial, expiry or unavailable
evidence refuse. Version zero without an image is supported. The guard has an
eight-second maximum deadline and returns only `state` and `version`.

The separate default-off status HTTP adapter accepts only that GET and an
explicit same-origin Origin or Fetch Metadata signal. It rejects query/body,
bearer overrides and cross-site requests before Auth. It has a seventeen-second
maximum wait and sanitizes all output. Private no-store/CDN no-store and Vary
Cookie headers prevent the normal shared response-cache path. The status client
performs one explicit same-origin GET, bounded to nineteen seconds and1024bytes;
it starts no read, retries or removal operation on construction.

The panel's `readVersion` option defers that call until Review. Successful read
then opens the existing confirmation. Keep my profile discards the selected
version; another Review explicitly reads again. A failed read never opens
confirmation. Disposal aborts the read and suppresses a late result. Once a
removal starts, the same operation/version are retained; no later status read
automatically changes them. Neither the helper nor this read issues SQL writes,
new grants, credentials, physical provider cleanup or account erasure.

This is point-in-time preflight, not a lock or a confirmation capability. The
existing mutation independently validates the then-current owner/session and
version. A version alone does not bind the read to a stable profile identity:
removal/recreation could produce the same numeric version for a new profile.
Before mounting, add and prove an exact profile-identity precondition enforced
atomically by the mutation. Do not describe this read as solving that race or as
authorizing a deletion. All hosted and page flags remain off.

Updated local evidence:37 focused removal/status/panel/composed cases and25
unchanged member-service cases pass. The composed path uses actual status
client/HTTP/member/read-guard code, then the separately confirmed existing
coordinator. Auth HTTP, SQL ledger, journal storage/serving authority remain
synthetic. This adds no new native database or hosted acceptance claim.
