# Explicit account-session bridge candidate

The account email delivery, owner sign-in, reload and logout journey passed on
production October21. This bridge is a separate source candidate for Alliance.
The normal member-page entry and its CSP remain closed; this module is not
imported or enabled by that entry and installs no hosted routes or permissions.

An explicitly enabled host supplies the member-page controller and approved
origin, then calls `verify()` in response to an explicit account check. The
bridge first detaches old profile state. It acquires the account page's existing
`gf-account-session` browser lock and makes one same-origin, credentialed GET to
`/api/federation-account/session`. No OAuth, OTP, refresh, retry, polling, actor
selection, token reading or browser-storage lookup is performed. Browsers without
the shared lock refuse enabled configuration rather than racing cookie changes.

Only a successful bounded JSON session response with `signedIn:true` and a UUID
account identifier permits a fresh controller generation. The identifier and
email are not returned by the bridge or passed to member clients. This UI state
is not backend authorization: every member route must still verify its current
cookie, account/session, serving state, journal and anchor. A successful check
does not authorize enabling an unverified backend.

Visibility changes, pagehide, explicit close/disposal and the account page's
`gf-account-status` signed-out hint detach immediately and clear the real member
components. Channel messages can close but never open a page. Reopening requires
another explicit server check. This can discard an unsent draft, so the host must
explain that behavior before adoption. A hidden page never silently reopens.
Session changes that generate no hint or lifecycle event are not continuously
detected; subsequent backend requests must reject stale sessions independently.

The request/body deadline is at most12seconds and response limit4096bytes. A
noncooperative transport stays occupied until it settles, even after the caller's
deadline. Late replies cannot attach after closure. Cancelling a browser wait
does not undo any previously accepted profile mutation or resolve uncertainty.

Tests cover default closure, exact endpoint and shared lock, explicit generation
changes, 401/provider/malformed/oversized/invalid-UTF8 refusal, channel/lifecycle
invalidation, stalled transport/body and cleanup. A composed test runs the real
member-page/form clients and proves a logout hint clears loaded profile data and
unsent edits. These are synthetic component/transport tests, not live Alliance
database, phone, assistive-device, runtime custody or production adoption proof.

Before mounting: review host UI and CSP, backend session/role routes, protected
runtime and independent custody, operation reconciliation, public signup,
privacy/support/abuse and actual browser acceptance. No public-registration,
financial-service, member-write or production-release authorization follows
from passing this bridge's tests.
