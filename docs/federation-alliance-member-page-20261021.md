# Closed member-page composition

Source candidate only. The normal `alliance-profile.html` entry calls
`mountAllianceMemberPage(document)` with no enabled option. The editor/removal
surfaces stay disabled, CSP still has `connect-src 'none'` and `form-action
'none'`, and opening the page performs no account/profile/status read. No hosted
route, grant, LOGIN, signup or production setting is changed.

## Explicit host lifecycle

A separately reviewed host may create the controller with `enabled:true`, its
exact approved HTTPS origin and a transport, then call `attach(generation)`.
This counter is only a host lifecycle marker. It is not a token, verified Auth
claim, actor selector or authorization decision. The host must independently
verify its current account/session and advance the generation on replacement;
every backend request still verifies its real cookies and database session.
This source does not connect an OAuth/email callback or account-state observer.

Attachment accepts only a strictly increasing positive safe integer. It clears
the prior controller state and constructs fresh revision-edit, removal-status
and bound-removal clients, but sends nothing. A stale attach is ignored.
`detach(generation)` ignores a stale generation; an explicit current detach or
dispose cancels clients and clears fields, recorded profile, validation errors,
comparison and removal state before a later account mounts. An old response
cannot repopulate the new form or close it using a stale status callback.

The page remains closed after a backend sign-in-required result. There is no
automatic OAuth, token refresh, account lookup, remount, retry or polling. A host
must supply a new independently verified lifecycle event to attach again.
The status-only client currently reports unavailable generically; the host must
still deliver sign-out/session-change notifications promptly. Controller state
is memory-only, not a durable incident or operation store.

## Editing and removal coordination

The controller uses the real revision client/editor and exact-identity-bound
removal client/panel. Review explicitly reads current removal identity/version;
confirmation remains a separate action. The host cannot replace a pending
removal with a new version or operation automatically.

A single-flight transport admits only the three fixed member paths for the
approved origin, with no query, fragment or URL credentials. It buffers at most
32768response bytes before a client decodes them. Caller deadlines/abort signals
are preserved; a noncooperative request remains occupied until it settles,
preventing another request in that page generation from overlapping it.

An active profile request blocks removal confirmation before an operation is
created. Confirmation freezes and clears the editor before the removal request
starts. Pending/unknown removal keeps editing closed; only Check the same removal
request can reconcile it. A confirmed removal does not automatically recreate a
profile or load another version. This is per-page coordination, not a distributed
lock, global cost cap or replacement for the atomic server protocol.

Switching accounts or aborting a browser wait cannot roll back work already
accepted by a server. Unknown removal references are deliberately cleared from
the old account's UI on detach; durable server history and a reviewed support/
reconciliation path remain necessary. The closed status says earlier interrupted
requests may still need reconciliation. Do not portray detach, reload or a new
generation as evidence that an old request failed or completed.

Two existing form lifecycle defects were corrected: disposal now clears field
errors/help associations, and a fresh mount re-enables comparison acceptance.
No directory listing, image upload, Auth account erasure or physical cleanup is
introduced by this page composition.

## Verification and remaining adoption work

Local65-case suite:10 new controller cases,11 existing form cases and44 existing
removal/status/binding cases. New tests exercise default no-I/O closure, explicit
attachment, draft/profile/error clearing, stale attach/detach and late response
isolation, fresh bound removal, save/removal overlap refusal, unknown-result
reconciliation, sign-in-required closure, disposal during status read and response
byte limits. Real component/client code runs with a synthetic DOM/transport.
This is not physical-browser, real Auth/cookie, hosted database, screen-reader,
phone, high-zoom or WCAG acceptance.

Before adoption, wire and test the actual independently verified account
lifecycle, exact authenticated route composition, bound profile mode and SQL,
reviewed CSP, private response caching, independent serving/journal/anchor
custody, pending-operation support and recovery. Check keyboard/focus and real
device behavior on a cleared exact destination. Existing Google warning, managed
role/isolation and release gates remain. No broader account release follows
from passing these component tests.
