# Protected member HTTP composition

Source candidate, default closed. `createAllianceMemberHttp` in
`lib/alliance-member-http.mjs` composes the existing profile API, verified-cookie
member facade, bound removal preflight and journal-first removal HTTP adapters.
It is outside `netlify/functions`; it exports no default handler or route config.
No host, environment, credential, database, key or account setting is discovered
or activated. The existing account endpoint and closed page entry are unchanged.

## Exact request paths

A reviewed server host must explicitly provide `enabled:true`, one allowed
Federation HTTPS origin, pinned Auth origin/publishable key and the trusted
ledger, journal, current serving authority, revision-capable creation service,
anchored removal service and existing processor/storage interfaces.

| Path | Methods | Existing implementation |
| --- | --- | --- |
| `/api/alliance-members/me` | GET, POST | Own-profile revision read/write API |
| `/api/alliance-members/directory` | GET | Authenticated, journal-filtered directory |
| `/api/alliance-members/me/profile/removal-status` | GET | Separately authenticated profile identity + removal-version read |
| `/api/alliance-members/me/profile` | DELETE | Explicit operation, profile identity, removal version and confirmation |

Other methods/paths, image routes and legacy DELETE `/me` have no fallback.
Proxy headers cannot replace the configured origin. Each existing adapter keeps
its original origin, fetch-site, body, cookie and input checks. No CORS permission
or client-selected actor is introduced. Text revisions and removal versions stay
separate; the HTTP composition does not translate one into the other.

## Account and authority flow

The browser explicitly checks the existing dashboard session route, then uses the
member paths. That preliminary check only opens local controls. Member APIs
independently verify the cookie with the pinned Auth server, bind its subject,
issuer and session, check current SQL-session authority, and require current
serving/journal evidence. User metadata grants no authority. Account acceptance
cannot substitute for those checks, including when an access token outlives logout.

Profile writes use the existing admission/revision coordinator. Removal retains
the independent journal record and anchored acknowledgement before the member
ledger finish. The caller must supply the reviewed anchored service; this factory
does not manufacture keys, a checkpoint, a ledger connection or a weaker fallback.
It cannot establish that arbitrary injected dependencies are correctly hosted or
bound; the managed runtime/custody/recovery acceptance remains necessary.

All responses have private/no-store and CDN no-store, Cookie variation, no-referrer,
nosniff and noindex headers in code. There is no token/cookie renewal, log, mail,
automatic retry, provider cleanup or background job. Existing profile DTO boundaries
continue to withhold hidden account fields.

## Interruption and resource ownership

One request owns the composition until its adapter promise settles; a concurrent
request to a different member path is refused rather than queued. This is an
instance-local guard, not a distributed lock; SQL and independent authority still
govern other instances and tabs.

A maximum40-second outer deadline covers the entire composed request, including
inbound bytes. The original adapters retain their shorter body/Auth/service limits.
The relay owns cancellation of the inbound stream: aborting a Request signal alone
does not promise cancellation of a reader already waiting for bytes. Timeout,
client cancellation or explicit close retires the whole composition and its owned
adapters. Late verification cannot start another member operation. POST/DELETE
interruption remains conservatively uncertain; cancellation never claims rollback
or physical erasure. No automatic new instance or repeat operation is created.

Injected database, journal, creation, removal, storage and authority dependencies
remain caller-owned. The host must cancel/close them during its own shutdown and
must not treat a new factory instance as clearing an unresolved durable operation.
A future deployed adapter must support this request budget and propagate the real
client/deployment lifecycle. None is mounted by this source change.

## Verification and accessibility

Twelve focused composed cases pass. They join the actual account handler and
page host to this HTTP composition, real revision/admission and anchored removal
coordinators, signed journal reads and synthetic in-memory ledger/authority/transport.
The ordinary create → repeat edit → unlist → preflight → remove path passes without
owner review. Other cases cover revoked sessions before/after writes, forged actor
fields, refused cookies, route/Origin restrictions, cross-route overlap, cancellation,
stalled inbound bodies, lost removal acknowledgement and explicit reconciliation.
The original slow-body case failed, exposed incomplete cancellation, and passes
after the bounded relay repair. The final six-file affected regression suite passes
**117 cases**. Syntax/diff checks pass. These are source-level tests, with zero real
provider, mail, hosted SQL, AWS or wallet calls; the ledger/admission fixture is not
a new proof of managed SQL correctness or live custody.

Existing native PostgreSQL/TLS suites remain in CI; no SQL changed. The page remains
closed with its original CSP. Existing accessible labels, focus, draft comparison,
explicit confirmation and uncertainty messages are reused; no new gesture or timing
task is imposed on the member. This server increment adds no screen-reader or phone
acceptance and makes no WCAG-conformance claim.

Current provider references checked: [Auth user verification](https://supabase.com/docs/reference/javascript/auth-getuser),
[changelog](https://supabase.com/changelog) and the announced
[HTTP TLS cipher deprecation](https://supabase.com/changelog/cbc-tls-ciphers-deprecated).
No SDK API, TLS fallback or database security setting changed. Actual destination
runtime patch/cipher compatibility remains part of release acceptance.

Next: compose this handler with the reviewed managed authority/connection factories
and a future explicit runtime adapter; preserve the closed default until real account,
custody/fleet/recovery/privacy/assistive/operating and publication acceptance. Complete
the remaining durable invitations, contributions, ideas, support/reports/blocking and
optional-image workflows. Resend's pending clarification is a separate mail gate.
