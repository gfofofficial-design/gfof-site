# Alliance account-to-profile transport candidate

October 17, 2026. Builds on the approved self-service profile foundation in PR124.
**Prepared source, not a running member service.** Neither the API factory nor the
browser client is mounted, enabled, imported by Alliance HTML or connected to real
Auth/Data API settings. The interactive Hub remains an explicitly tab-only preview.

## First usable slice

The intended member flow is sign in, read/create/edit one's profile, choose whether
to list it, read a bounded member-directory page, or explicitly remove one's own
profile. No ordinary member approval by Michael is introduced. This slice has no
avatar upload, invitation, suggestion, vote, report, email or financial action.

`lib/alliance-profile-api.mjs` exports a factory with no environment reads or route.
It defaults closed and requires trusted server configuration for one exact
Federation origin, a fixed HTTPS Supabase project origin and a publishable key.
It does not accept a service-role key or browser-supplied bearer authorization.
Future composition must retain the existing account flow's reviewed deployment
and provider configuration rather than inventing a second login system.

## Identity and data flow

1. The future page client sends a same-origin cookie request. It never reads a
   cookie/token, selects a trusted actor or stores a credential.
2. The API reads only the existing `__Host-gf-access` cookie. Missing, malformed,
   duplicate or oversized values refuse access. A refresh cookie alone is not
   authorization, and this factory does not refresh, start OAuth or set cookies.
3. A bounded `/auth/v1/user` read verifies the token against Supabase Auth. Require
   a confirmed non-anonymous account; never authorize by decoding user-editable
   claims, profile names, affiliations or browser actor IDs.
4. The unchanged ownership model receives the same verified token through the
   existing profile store. Supabase verifies its bearer context again and enforces
   grants/RLS. Self-profile RPCs take editable fields only, never a user ID.
5. Return a small profile/directory data shape. Account IDs, email, tokens,
   moderation writes and raw upstream errors are not returned. `private, no-store`,
   cookie variation, no-referrer and no CORS permission remain explicit.

Cross-origin/cross-site requests, direct function paths, unsupported methods,
unexpected query keys and invalid bodies refuse before Auth. Mutations require
the exact Origin. GETs never mutate. Inbound JSON is capped at4096 bytes/2 seconds;
Auth and the Data API each have an8-second/64KiB bound with no retry. Provider
cancellation is requested, but cannot prove a dispatched mutation rolled back.

## Accessible waits, cancellation and uncertain results

`assets/federation/fed-alliance-member-client.mjs` is a disabled, unmounted client
factory. It offers load/save/remove/directory/cancel/dispose with plain status
messages for a future semantic form and polite status region. Construction/import
does no network work. The server/client share one data contract; private and
listed profiles are distinct and publication values must agree.

Only one operation can be pending per client instance. Response bytes and the
19-second wait are bounded even if a fetch or body ignores abort. Cancellation,
disposal and a newer operation cannot restore late profile data. A cancelled or
unacknowledged write has an **unknown** outcome; further writes stay paused in
that instance. A later read can display current data but does not prove the older
mutation stopped or silently unlock retry. No automatic refresh/retry or local
credential persistence is added. Durable operation reconciliation across page
reloads and devices is still a release requirement, not implemented by this
in-memory pause.

This preserves accessible control over interrupted/slow work without a countdown
or forced transcription. The eventual page must provide native labelled fields,
keyboard operation, paste support, explicit removal confirmation, concise busy/
error announcements and a useful non-JavaScript explanation. No new UI is mounted
here, so screen-reader, phone, zoom, focus and WCAG-conformance claims are not made.

## Validation boundary and remaining work

Offline transport tests cover real Request/Response objects with synthetic Auth/
Data API responses, strict route/origin/cookie gates, invalid identity, self-only
payloads, streamed limits, cancellation, lost acknowledgements and the composed
browser-to-API-to-store path. This is not live GoTrue authentication, hosted RLS,
Netlify routing or physical-device acceptance. The existing native SQL fixture
remains separate and its synthetic claims do not authenticate a person.

Before mounting: resolve the exact Google warning; compose with the accepted
account candidate and real verified-session expiry/deletion behavior; specify
durable write reconciliation, server quotas and abuse limits; run two-account
hosted allow/deny tests and real accessible browser/phone checks; review privacy,
retention, support, costs, backup/recovery and publication. Image processing,
challenge/suggestion storage and notifications remain separate incomplete lanes.
No hosted schema, grants, credentials, signup settings or public site is changed.

## Sources reviewed

- [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser)
- [Server-side Auth advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

The requested lightweight changelog markdown index returned an unsupported-content
fetch error. Current topic guidance was read; this is not a full changelog or
dependency-security audit. No Supabase SDK or CLI dependency was added.

## Verified token lifetime across profile requests — October 20

The profile handler previously derived the verified subject/session/expiry context
only for POST. GET self/directory reads could proceed with a mismatched context in
synthetic Auth responses, and a response could be returned after the accepted
token expired during the database or final serving checks. Seven new request
regressions reproduced those failures against the preceding API.

All profile reads and saves now bind the accepted cookie to the same verified
subject, project issuer, authenticated audience/role, session UUID and safe expiry
timestamp. The pinned Auth server must accept the cookie before its claims are
decoded. This does not introduce local signature verification or authorization
from user-editable metadata.

After Auth, one request signal combines cancellation with a deadline bounded by
both the token's remaining lifetime and the existing eight-second data/guard
budget. Checks run before Data API dispatch, before/after the single load or save,
after final journal/serving verification, and after constructing the response.
The captured lifetime also has a monotonic elapsed-time bound, so a wall-clock
rollback or a blocking policy callback cannot extend it while a timer is delayed.
Expiry signals cancellation to database and creation work. A late response cannot
release profile data. Cancellation cannot prove that an already dispatched write
was rolled back.

Expiry before a save is dispatched returns sign-in-required without a mutation
claim. Once a save was attempted, expiry returns an unknown mutation outcome,
never a plain sign-in response that could encourage retry. A composed browser/API
test confirms that further writes stay paused even when a later authenticated
read succeeds. No automatic refresh, retry or removal path is added.

The existing guard's timeout/cancellation fault policy is retained; hosting must
discard a faulted instance rather than treating a new cookie as reconciliation.
Actual session-row revocation checks, provider/RLS acceptance, durable mutation
reconciliation and production concurrency/lifecycle composition remain release
work. Token expiry enforcement is not proof that a signed-out session has already
been revoked. Supabase documents that stricter sign-out rejection requires checking
the token's session ID against current session state.

Validation: 69 profile store/API/client tests pass locally, including eight new
request regressions and one client/API composition case. Existing native database
tests remain unchanged. The API remains an unmounted source candidate; no hosted
credentials, schema, access permissions, signup rule or public service is changed.

Current [Supabase session guidance](https://supabase.com/docs/guides/auth/sessions)
and the HTML changelog were reviewed. The lightweight `.md` index again returned
an unsupported-content fetch error. No SDK, CLI, dependency or provider setting is
changed by this increment.

## Current account-session checks — October 20

The profile API now also requires the trusted ledger's
`authorizeAccountSession(actorId, sessionId, {signal})` entry point. Missing
composition closes the candidate before Auth. The verified JWT's account and
session IDs supply both arguments; browser fields and user metadata cannot select
another account. The exact two-field result must match both IDs.

The unapplied session SQL candidate factors the existing account/session predicate
into a private invoker helper and adds one executor-only, fixed account-level
entry point. It checks the exact current session/account, confirmation, anonymous,
deleted and banned state, and session `not_after`. The enabled control guard is
retained. No profile is required, so first-profile creation and a missing own
profile remain possible. Existing image entry points still require a live profile.
The executor gains no direct Auth-row access; public, anonymous, authenticated and
service-role callers cannot execute the new entry point or its private helper.

Each profile request checks the session immediately before the load/save and again
after the final journal/serving review and response construction. Results are not
cached. Both checks share the request's remaining token lifetime and eight-second
data/guard budget; cancellation interrupts the wait even if a supplied transport
ignores its signal. A late result cannot release a response. Refusal or unavailable
session verification returns a sanitized unavailable response. After a dispatched
save it also retains `mutation: "unknown"`; this cannot prove rollback or unlock
retry. The creation coordinator's own transaction-time session checks remain
required, since HTTP checks cannot make SQL writes atomic with concurrent logout.

Validation: 76 profile store/API/client tests and 35 ledger driver tests pass
locally. Five new request regressions failed against the previous API. Seven new
cases cover missing ledger composition, revoked/mismatched session proofs,
revocation during final serving work or after save dispatch, a stalled final
check, and exclusive admission while that final asynchronous check is pending. Extended disposable native TLS fixtures verify profile-independent account
authorization, removed/expired/foreign sessions and blocked accounts, restricted
execution rights, and a composed profile read revoked while loading. Native SQL
results are recorded only after that CI job passes.

This is source preparation in the existing draft. The SQL is not applied to a
hosted project, and the API remains unmounted. Supported hosted permissions,
protected runtime composition, actual Auth/pooler and two-account acceptance,
mutation reconciliation and production lifecycle/concurrency work remain launch
gates. Session presence plus `not_after` does not independently enforce every
Supabase inactivity/single-session policy; those provider settings are separately
accepted. No login, credential, signup or production setting changes are included.

## Composed profile creation and two-member acceptance — October 20

The disposable two-server creation fixture now also runs the existing browser
profile client through the cookie-bound profile API and real creation service.
An initial own-profile read returns null; the first save prepares its stable ID,
obtains independent journal admission, commits through the restricted member
ledger and returns the profile. A subsequent read uses the authenticated member
role and actual profile RLS. This replaces the fixture's former direct service
call for that first successful creation.

Two separate client/API contexts then verify private own reads, isolation from
another unlisted profile, listing through the directory, and refusal of browser
owner/profile overrides and a session belonging to the other account. Editing one
member leaves the other unchanged. The directory selects only public fields.
The RLS fixture also directly attempts a targeted read of the other private row
under each member role and requires null.

A third client loses the acknowledgement only after the real creation service has
committed its SQL save. It reports unknown, dispatches the save once, retains the
changed database value on readback and keeps further writes paused even after that
read. The second member remains unchanged, and independent journal admission still
has exactly the two original profile identities. This is readback evidence, not a
new durable reconciliation mechanism or permission to retry from a fresh client.

The member/session/creation and independent journal adapters use the fixture's
actual restricted-driver TLS connections. Auth acceptance and the HTTP/Data API
bridge are synthetic: fixed SQL reads set the modeled authenticated role/claims
inside read-only transactions. Signed deletion views and serving policy are also
fixture inputs. This does not substitute for hosted Auth, PostgREST/pooler, runtime
custody, two-device sign-in or production acceptance.

Only the native integration fixture and this document change. No application
behavior, SQL candidate, dependency, deployed route or hosted setting changes.
Local validation is syntax checking; the complete composed database assertions run
only in the identity-checked disposable PostgreSQL/TLS CI job. The existing local
76-test profile and 35-test driver results belong to the preceding increment;
exact-head CI results are recorded in the PR and handoff after completion.

## Profile API lifecycle and uncertain-write pause — October 20

The callable API now owns one complete request from inbound parsing through Auth,
profile work and final verification. A concurrent request is refused immediately,
before another Auth request or body read is started; it is never queued. Incoming
headers are snapshotted for that admitted request.

`api.close()` is idempotent. It refuses future requests, aborts the admitted
request and closes the API's own view guard. Caller-owned ledger, creation,
journal and serving adapters are not closed. Their owner remains responsible for
shutdown after its services have stopped. Native fixture cleanup now follows this
order.

Caller cancellation or shutdown resolves the outer request even when inbound
bytes or Auth ignore cancellation. Late parsing/authentication cannot dispatch a
profile change or release data. Caller cancellation retires the instance, as do
body/Auth timeouts, uncertain Auth transport/context failures and interrupted data
phases. An admitted request cannot be replaced with another orphaned request in
the same instance. Known Auth refusals and ordinary validation errors retain their
existing behavior. Shutdown after save dispatch reports an unknown mutation
outcome and propagates cancellation without claiming rollback.

Any unsuccessful response after creation dispatch also latches an instance-wide
write pause. Subsequent POSTs receive `profile_changes_paused` before Auth or
creation work, even if a fresh caller bypasses the browser client's pause. Where
the instance has not been retired, reads remain possible; a successful read does
not unlock writes. The native lost-acknowledgement case now attempts this direct
retry after an actual committed save and requires one dispatch.

This latch is deliberately conservative and applies to the entire instance. It is
not durable or shared across processes and does not resolve the earlier mutation.
A host must not automatically replace a retired/paused instance to resume writes.
Durable reconciliation and an independent startup/serving decision remain release
requirements before an enabled replacement can accept changes.

Validation: 83 local profile store/API/client tests pass, including seven new
lifecycle cases. Six cases reproduced missing shutdown/admission/pause behavior
against the preceding API. Shutdown is exercised during inbound bytes, Auth and a
dispatched save; late results remain withheld. Existing native composition is
rerun in CI with explicit API cleanup and the direct uncertain-save retry check.
No SQL candidate, dependency, mounted route, credential or hosted setting changes.

## Durable profile write fence — October 20

The new **unapplied**, empty-disabled-store extension
`sql/alliance-profile-write-fence-candidate.sql` stores a profile's write sequence,
input/result SHA-256 receipts and pending-review flag in its existing creation-plan
row. The member update and receipt commit in the same transaction. The existing
session-bound finish signature now locks that row and refuses a pending receipt;
its previous implementation is private to the owner, so the executor cannot
bypass the fence. No new role, table, credential or public API is added.

The API reads the exact actor/session-bound receipt before creation dispatch.
Pending, missing-verifier, unavailable or malformed receipt verification prevents
a save. Pending review returns the existing paused message without claiming that
the newly requested mutation started. Own reads remain available. SQL independently
enforces the hold if another runtime races past a previously clear preflight.
The strict receipt DTO is shared by the API and fixed read-only ledger method.

This is deliberately an **operator-controlled pilot**, not automatic recovery.
Every committed save, including an acknowledged success, holds further profile
changes until a separate owner review. The owner-only review seam requires all
member feature switches closed, the exact sequence and both receipt digests,
unchanged current profile contents/timestamp and the same ownership mapping.
Old or changed proofs cannot clear it; the runtime/member roles receive no review
permission. Reading the current profile is not proof of delivery and does not
clear the hold. No member-facing acknowledgement or forced-clear path is added.
An established store cannot silently adopt this candidate: installation requires
no creation plans/profiles and disabled controls.

The disposable fixture explicitly performs owner review only after it has received
a known successful result. A lost acknowledgement remains pending. Fresh driver,
service and API instances refuse a later save; a direct ledger finish also fails,
leaving the committed value and receipt unchanged. Concurrent finishes must commit
exactly one receipt. The paired recovery fixture hashes every creation-plan column,
detects an attempted same-count clearing of the pending flag and restores that
flag from the actual archive. Existing table counts and recovery table lists are
unchanged.

Local validation: 85 profile store/API/client tests and 37 ledger-driver tests pass.
Two API receipt regressions fail against the preceding API. SQL concurrency,
owner permissions, restart-instance refusal and archive acceptance run in the
identity-checked disposable PostgreSQL/TLS workflow; exact-head results are
recorded only after CI completes. No hosted schema or permission change occurs.
The operator review workflow, independently retained recovery checkpoints and
member-facing recovery experience still need release acceptance before activation.

## Recovery status and operator drill — October 20

Guarded own reads and confirmed saves now return only `writeState: available` or
`writeState: review_required` alongside the sanitized profile. Missing/unavailable
receipt verification withholds the response; failure after save dispatch remains
an unknown mutation. The unmounted member client shows a known review hold and
blocks saves before HTTP. An explicit available read releases a known hold only;
readback never clears an uncertain save. The 92 profile tests cover this behavior.

The [closed pilot review procedure](federation-alliance-profile-review-20261020.md)
sets out separate freeze, admission restriction, drain, exact review, closed-state
verification and independent restart phases. A new disposable two-server drill
proves that NOLOGIN does not disconnect admitted work, drains modeled pools,
checks prepared transactions and demonstrates rollback/commit of the exact known
receipt while features and logins remain closed. It does not review a lost reply
or automatically restart. Hosted custody, full admission/queue accounting,
independent evidence and provider/pooler acceptance remain release requirements.
