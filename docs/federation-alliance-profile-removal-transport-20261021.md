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
eight-second maximum deadline and returns only `state`, the member's own `profileId` and `version`.

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
profile identity is a precondition, never actor authority. The opt-in identity
binding below closes the earlier version-only recreation gap. Legacy paths do
not gain that guarantee. All hosted and page flags remain off.

Updated local evidence:37 focused removal/status/panel/composed cases and25
unchanged member-service cases pass. The composed path uses actual status
client/HTTP/member/read-guard code, then the separately confirmed existing
coordinator. Auth HTTP, SQL ledger, journal storage/serving authority remain
synthetic. This adds no new native database or hosted acceptance claim.

## Exact profile-identity precondition

The status DTO now includes the member's own profile UUID, already part of the
own-profile contract. It is potentially linkable metadata, not an Auth ID,
credential or anonymized value. It stays out of the displayed confirmation text,
URLs, storage and journal additions. Version-only status responses refuse.

Explicit `profileBinding` options select the browser panel/client, HTTP adapter
and anchored coordinator; `profileBindingEnabled` selects the member facade.
Defaults remain false. In bound mode the removal input has exactly operation ID,
version, profile ID and confirmation. The server still derives actor/session
solely from verified cookies. The requested profile ID is only an expected-state
precondition; it cannot select another account. No flag is inferred from a URL,
browser storage, metadata or request field, and there is no fallback to the old
three-field request when bound mode refuses.

The unapplied `alliance-profile-bound-removal-candidate.sql` adds one narrow
private owner function, with empty search path and no public/anon/authenticated/
service-role execution. The restricted executor gets the fixed parameterized
wrapper only. It uses the existing global control lock and live removal-session
check. Before new operation/quota work it requires the current session's profile
ID to equal the expected ID, then invokes the existing anchored preparation in
the same transaction. It writes no independent journal itself. SECURITY DEFINER
retains the existing private owner/executor separation; the executor receives no
table access or owner-review authority.

For an existing operation, it instead verifies the operation's original actor,
profile, kind and version. A committed replay returns its original prepared plan,
even after that profile is gone. The coordinator checks that plan's exact profile
binding before any journal append, and still revalidates the independent anchor
before finish/replay acknowledgement. A new profile cannot replace the old plan
or become the target of its reconciliation. New intentions need a new explicit
read/confirmation; the browser never switches a pending operation automatically.

The extension preserves legacy grants for older image/removal candidates. It is
an opt-in path, not universal enforcement against a trusted executor choosing an
older procedure. Before adoption, host composition must require bound profile
mode and review/refuse legacy profile routes; source defaults are not proof of
installed permissions. Administrative database changes remain outside the
application protocol. No hosted installer, role LOGIN, route or page is enabled.

Local evidence now totals83 tests:44 focused removal/status/panel/composed cases,
25 existing member-service cases and14 existing anchored-removal cases. New
composed cases cover a removed/recreated profile at the same numeric version,
lost committed reply followed by recreation, mismatched prepared identity and
missing/forged preconditions. They use real coordinator/facade/transport logic
with synthetic Auth, SQL ledger and independent stores.

The guarded PostgreSQL17.11 CI fixture additionally installs the SQL in its owned
disposable member domain. It is prepared to test the new fixed driver call under
restricted TLS, changed-profile/version denial, anchored committed replay after
cascade, and a rollback-only restricted-role old/new profile exercise proving
rejected identity consumes no operation/quota. Public execution is checked. Do
not claim that native result until the matching CI actually passes. The control
schema-recovery drill then includes the installed private function. None of this
is a managed Supabase or real-device acceptance test.

PostgreSQL17 explicit-locking guidance and Supabase database-function privileges/
search-path guidance were checked October21. The current changelog's HTTP TLS
cipher notice does not change this SQL protocol or establish hosted compatibility.
