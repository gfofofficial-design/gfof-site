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

The host must supply the freshly authorized **removal version**, not the profile
text edit revision. The standalone panel does not fetch or authorize that value.
Account/session composition, a reviewed current-version read and actual page
mounting remain integration requirements. A stale version must refuse through
the existing SQL protocol; it must never be replaced automatically.

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
