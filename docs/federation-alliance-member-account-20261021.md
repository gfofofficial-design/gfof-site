# Account-to-member page composition

Source candidate, default closed. The normal profile entry now calls
`mountAllianceAccountMemberPage(document)` without an enabled option. It composes
the existing real editor/removal controller but starts no request, channel or
account listener. The account link and check button stay unavailable. The page
keeps `connect-src 'none'` and `form-action 'none'`; no route, cookie setting,
provider, managed role or production feature is activated by this source.

## Explicit account check

A reviewed host must explicitly supply `enabled:true`, an exact allowed HTTPS
Federation origin matching the document, and the real authenticated account and
member routes. The button makes one read-only, same-origin, no-store GET to
`/api/federation-account/session`. No config discovery, OAuth, email send, cookie
refresh, bearer header, browser-selected actor or automatic initial read.

The request uses the dashboard's existing `gf-account-session` exclusive Web
Lock when available. Without Web Locks it still performs only a read; it never
exchanges a rotating refresh token. Redirects are refused. Headers and streamed
body share a maximum12-second deadline and32768-byte bound. Cacheable, malformed,
oversized, unavailable and unsigned account replies keep the editor closed.
An uncooperative request retains the overlap latch until it actually settles;
timeout is not evidence that upstream work was cancelled. The UI explains when
reloading is needed. There is no automatic retry.

A successful account response only permits local controls. The confirmed account
ID stays in a private closure to bind draft visibility; it is never displayed,
persisted, broadcast or sent as an actor. An increasing opaque generation attaches
the existing editor/removal clients. Every member request still performs its own
server verification and active SQL-session/journal checks. The session response
is not a replacement for those checks or proof that a previously issued JWT is
immediately revoked after logout.

## Drafts, sign-out and interruption

The explicit check button warns that it clears the current draft first. Normal
tab switching instead hides the entire member surface, including from the
accessibility tree. On return, one bounded read rechecks the previously confirmed
account. Only the same account reveals the existing form; its draft and any
unknown-removal reconciliation remain intact. A changed account closes/clears
the old controller and requires an explicit new check, with no automatic remount.
Failure or uncertainty also clears it. This foreground read is not background
polling and performs no sign-in/refresh.

Focus returns to the former field only after same-account verification and only
if focus was abandoned to the document body; a new user focus is not stolen.
`gf-account-status` signed-out hints can only clear local content, never establish
identity. Page navigation/back-forward restoration and disposal also clear it.
Cross-tab hints and browser lifecycle events are not distributed authorization
or a guaranteed immediate notice of every server-side revocation. The server
continues to govern every actual read/write. A hidden/disposed page cannot undo
an accepted mutation; earlier interrupted operations may still need support.

## Accessibility and evidence

Native labelled controls, a descriptive account-page link, visible privacy
instructions and polite status text. No password/code memory challenge, countdown,
automatic provider navigation or focus-stealing identity announcement. No profile
request or mutation is automatically initiated after a session check.

Seventy relevant local cases cover the new account bridge and existing real
editor/removal components: default closure, exact origins, signed-out/bad/cacheable
responses, byte/deadline limits, queued/noncooperative work, sign-out/late replies,
same-account draft/focus preservation, changed-account isolation and preservation
of unknown removal without another mutation. A further two-step contract case uses the actual account dashboard session handler
with in-memory transport and synthetic credentials; no provider or email is used.
The latest work-computer `main` (16f3740) includes the closed account foundation
and public Arena/request-intake release. This draft reconciles both, and the
contract case now imports the handler in this same repository and runs in CI.
The merge and affected-interface suite passes236 cases locally. This remains
source-level acceptance, not a hosted combined member route.

An actual local Chrome fictional fixture checks keyboard order, same-account
draft preservation, changed-account clearing, sign-out, narrow360px reflow and
new44px-or-larger targets. Fixture identity/visibility/transport are synthetic;
this is not an actual Google/email login, real cross-tab provider/cookie test,
screen-reader, physical-phone, high-zoom or WCAG-conformance claim.

Before public use: compose the real account/member server routes and exact host,
review CSP and lifecycle/cookie/active-session behavior on the cleared destination,
verify independent serving/journal/anchor authority and recovery, and complete
remaining member-feature, privacy, assistive-device and publication acceptance.
No existing managed credential or release permission is broadened here.
