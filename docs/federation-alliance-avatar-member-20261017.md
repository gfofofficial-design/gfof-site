# Alliance image member-access candidate

October 17, 2026. Disabled, unmounted source. No hosted Auth/session/database
request, schema/grant installation, password or route activation is performed.

## Member task and accessibility

An optional image belongs to the signed-in member's own profile. A browser must
not choose another account, session or profile, and a logout detected before
publication must leave the replacement unpublished. Profile moderation must not
prevent its owner from removing an image. Images remain optional; text profiles
remain sufficient. Familiar forms, password-manager support, paste, polite status
announcements, preserved text/current image on failure and read-only recovery
remain requirements for the future UI. No assistive/mobile or WCAG acceptance is
claimed by these server tests.

## Server facade and identity

`createAllianceAvatarMemberService` defaults closed and reads no environment or
secret store. Trusted construction supplies the exact Federation origin, one
20-character Supabase project origin, publishable key and the isolated server
components. No service-role key is accepted for account verification. The factory
returns a server facade, not an exported Netlify handler or browser library.

Its future path is exactly `/api/alliance-members/me/image`. PUT replaces, GET
reads operation status and DELETE detaches the current image. URL queries, other
origins/paths/methods, browser Authorization overrides and cross-site fetch metadata
refuse. Mutations require the exact Origin. This is an Origin-based CSRF boundary,
not a new CSRF-token system. Same-origin script compromise is outside that defense.

The caller supplies already bounded/parsed input separately: replacement has only
operationId, version, bytes and MIME; removal has operationId, version and explicit
remove_my_image confirmation; status has only operationId. Extra actor/session/
profile/role fields refuse. Input is copied before awaiting Auth. A future HTTP
adapter must still enforce Content-Type, inbound streamed-byte/time limits,
response security headers and serving/abuse bounds. This facade is not that adapter.

Only the exact `__Host-gf-access` cookie is used; duplicate, malformed, excessive
or refresh-only cookies refuse. A bounded, redirect-refusing Auth `/user` request
checks that cookie. The accepted token is parsed only afterward to compare subject
to the returned confirmed non-anonymous account, pin issuer/audience/role, require
a session UUID and refuse expired access. Parsing alone is never verification.
User metadata, display names, affiliation and browser IDs confer no authority.
No token/account/email/receipt/path is returned in result DTOs.

The service then calls the session-aware SQL authorization function. Actor and
session used by the flow are bound from that verified context; raw browser fields
cannot override them. There is no token refresh, cookie creation, account linking
or automatic retry here. At most two facade requests are active. Auth has an
independent eight-second/64KiB ceiling; authorization/removal is bounded at4.75
seconds around the driver's existing4.5-second limit. Existing flow limits apply.
An access-expiry timer cancels further request work; known delivery receipts can
still be recorded by the flow's separate awaited settlement phase.

## Unapplied session SQL extension

Apply only after the profile and image-ledger candidates and a separately reviewed
hosted setup. It adds no role or table. The existing NOLOGIN owner receives only
Auth schema usage and SELECT on session id/user_id/not_after, account id/email
confirmation/anonymous/deleted/ban state, and profile moderation state. The login
executor gets no Auth-table SELECT. No Auth UPDATE, DELETE or role membership is
granted. This additional read authority is source only and needs explicit review
before any hosted installation.

Private helpers require the exact session/account join, confirmed permanent
account, no deletion or current ban, no reached not_after deadline and a currently
owned profile. Positive image actions also require visible moderation state.
Self-state/cancellation/removal remain available to a held profile's live owner.
This is application profile eligibility, not a governance role, official community
representation, entitlement or wallet-control claim.

Session-aware parameterized wrappers cover authorization, self-state, reserve,
claim, publication, cancellation, removal and receipt read. Mutating wrappers
acquire the existing ledger control lock before checking current session/profile
state, then invoke the core function in that same short transaction. Each dispatch
and publication boundary checks again; a single initial Auth response is insufficient.
The execution role loses access to the earlier actor-only entry points. Internal
helpers and all new functions refuse PUBLIC/anon/authenticated/service_role access.
All helpers have fixed empty search_path and run under the limited NOLOGIN owner.

Unpublished settlement/cleanup still use trusted server-only functions after
logout/account removal so a known upload acknowledgement is not discarded.
Wrapping these credentials does not reduce their actual underlying authority;
the host must keep the executor away from browser input and narrowly expose the
facade. There is still no physical cleanup worker or new private-view policy.

## Concurrency, provider compatibility and recovery limits

Checks observe session/account/profile state at their SQL check; they do not lock
Auth rows or make logout globally linearizable with a concurrently completing
publication. An operation already committed cannot be undone by abort. A logout
completed before the publication check is denied in the fixture; simultaneous
logout/COMMIT ordering, actual Auth schema/grants/RLS, managed session expiry,
inactivity/single-session settings and deleted-account behavior need hosted review.
No strict instant-revocation guarantee beyond those observed boundaries is made.

The Auth-schema columns are platform-managed internals. Check compatibility before
installation/upgrades and fail closed when inaccessible. not_after and session
existence do not independently implement all managed inactivity/single-session
policies. Token expiry and the provider's fresh account check remain separate.
The older profile API is unchanged by this increment and does not acquire these
new session wrappers; do not infer Federation-wide revocation coverage.

Unknown database/commit or lost provider evidence still needs reconciliation.
No automatic retry, quota reset, refund, complete crash recovery or backup deletion
proof is added. The existing version fence and durable receipts remain in force.

## Evidence and remaining release work

Synthetic unit checks cover origin/identity injection, cookies, verified-token
binding, outage versus rejection, current session context, private outputs,
input copying, cancellation, stalled/oversized Auth, capacity and shutdown.
A disposable actual-driver TLS fixture verifies SQL grants and session checks,
Auth refusal cases, held-profile self-removal and logout during provider delivery:
the replacement stays unpublished while the matching receipt is retained.
Auth/provider responses and the decoder derivative in this fixture are synthetic;
real hosted Auth signature verification and Storage acceptance are not established.

Before a member route: finish bounded HTTP/body/response composition, current
private-view authorization, exclusive durable cleanup claims, uncertain-write
recovery, bounded tombstone/metadata retention and account/backup deletion without
resurrection. Then separately review hosted permissions, credentials, native host
isolation, abuse/cost/data rights/privacy/support/recovery, actual assistive/mobile
acceptance and publication. The unresolved Google preview warning remains a gate.

Primary sources checked October17: [Auth getUser](https://supabase.com/docs/reference/javascript/auth-getuser),
[session IDs and logout](https://supabase.com/docs/guides/auth/sessions),
[Auth account model](https://github.com/supabase/auth/blob/master/internal/models/user.go),
[Auth session model](https://github.com/supabase/auth/blob/master/internal/models/sessions.go),
[product security](https://supabase.com/docs/guides/security/product-security),
[changelog](https://supabase.com/changelog). Markdown changelog fetch was unsupported;
the HTML index was checked instead. Its Data API auto-exposure change, scheduled
for all projects on October30, remains relevant to the older profile REST path's
hosted review; this new session layer uses direct parameterized SQL. No SDK,
GraphQL, extension or self-hosted gateway upgrade is performed. The index check
is not a version-pinned hosted compatibility proof.
