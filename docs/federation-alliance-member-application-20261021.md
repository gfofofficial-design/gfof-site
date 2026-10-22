# Explicit startup and member application

`createAllianceMemberApplication` composes the existing signed startup gate,
deletion-journal reader, admission/revision service, anchored removal and protected
HTTP handler. It has no mounted/default function, ambient connection/secret lookup,
automatic preparation or authority transition. Normal page and account defaults
remain closed.

The reviewed host provides the already constructed member ledger, independent
journal store and anchor store; exact member/journal/epoch scope; pinned minimum
and public verification keys; explicit origin/Auth configuration; expected Netlify
installation; and the existing signing runtime plus authority transports. The Auth
origin must match the member project containing the active-session ledger. No
arbitrary creation or unanchored removal substitute is injected: the application
constructs those services against the same scoped dependencies and startup gate.

## Preparation and current permission

An explicit `prepare(checkpoint, trustedContext)` compares the complete member and
journal inventory through the existing challenge-bound signed startup protocol.
Successful preparation returns `prepared / access:closed`; it does not change the
control service to serve. A separately authorized current serving decision is
required before any member Auth read. Serving withdrawal or uncertain evidence
closes this application without automatic repair or reopening. A changed deployment
cannot use an earlier prepared application. The trusted context must come from the
real handler's second argument; matching fields are wiring checks, not independent
attestation against malicious application code.

Each signed exchange runs inside its own existing Netlify signing scope. The
member request does not occupy one signing scope for its whole lifetime: the
signer's shorter exchange deadline remains intact. Expected installation data is
fixed source configuration, never learned from the incoming request. Signed bytes,
fresh challenges and floors are verified by the existing startup/journal code.

Unsupported and cross-site member requests are refused before spending an
authority exchange. A single operation owns preparation/request scope at a time.
Preparation is bounded to25 seconds; the entire member call, including its first
serving check, to40 seconds. HTTP/body/Auth and signing components retain their
shorter individual limits. Shutdown/cancellation invalidates owned components and
late results. Interrupted mutations remain uncertain; no rollback or erasure is
claimed. Caller-owned stores/signing runtime retain their own shutdown responsibility.

## Evidence and limits

Eight new in-memory composed tests join actual startup signatures, actual
Netlify key-scope checks, signed journal review, admission/revision and anchored
removal with synthetic inventory, SQL/Auth/transport and ephemeral private keys.
The profile create/edit/unlist/removal path passes after explicit preparation and
a fictional serving transition. Wrong deployments, changed checkpoint, closed
authority, unsupported/cross-site input and late shutdown fail closed. No signing
secret is saved, logged or used with a provider. The affected seven-file suite
passes125 cases. Prior actual SQL/TLS suites remain separate CI evidence.

The fixed [managed member profile](federation-alliance-managed-member-install-20261021.md)
and [independent journal extension](federation-alliance-journal-managed-extension-20261021.md)
now supply the required installation candidates. Their explicitly approved hosted
installation and restricted-connection acceptance are separate operational records;
the earlier observation that those schemas were absent is superseded. Neither
construction of this application nor a local test enables hosted logins or modes.
The strict member driver still refuses creator-management memberships; a reviewed
host must select `supabase-managed` explicitly. No driver learns a weaker baseline
from the current database.

## Complete managed-database journey

`member-application.native.mjs` joins this application, the actual browser clients,
managed member ledger, independent journal, control reader/anchor writer and signed
startup/witness implementations against three disposable TLS database servers.
It uses the same source-generated managed installation candidates and modeled
provider creator edges/default grants. It checks closed preparation, explicit
fictional serving, profile creation, a second ordinary edit, directory visibility,
unlisting and identity-bound journal/anchor-first removal. No routine operator
approval substitutes for those ordinary member actions. Final SQL verifies the
profile/owner and cached saved text are gone; journal and anchor each advance once.

The same journey deletes the fictional SQL session while its mocked Auth server
still accepts the cookie: the SQL guard refuses, HTTP returns generic profile
unavailability with no profile, and an explicitly restored fixture session can
read the unchanged revision again. A later signed serving withdrawal prevents
further Auth/profile work. The API does not label a SQL refusal as a definitive
Auth-server rejection. Every pool/fixture is retired in `finally`.

The guarded local PostgreSQL18.6/TLS run passes; the native runner also includes
this journey in its PostgreSQL17.11 CI path. A CI result must be observed before
claiming that version passed. Auth responses and authority transport are simulated;
keys are ephemeral and no actual provider is called. This is source integration,
not email/Google sign-in, real key custody, deployed IAM/runtime or browser proof.
There is no default function, live serving transition, cloud mutation, account
registration or public feature activation in this change.

Remaining hosted acceptance includes runtime keys/current authority, credential
custody, provider billing bounds, durable fleet fencing and coordinated recovery.

## Explicit combined profile and collaboration application

`createAllianceCommunityApplication` is a separate opt-in factory. It requires
the complete format3 checkpoint and the community store, and maps one combined
current startup permission to both profile operations and `authorizeCommunity`.
The existing profile-only factory never admits the new routes or upgrades its
checkpoint. Neither factory mounts a Function or discovers configuration.

The combined application adds four exact same-origin, cookie-only paths under
`/api/alliance-members/community`:

| Path | Method | Request |
| --- | --- | --- |
| `/challenges` | GET | Optional unique `after` UUID and `limit` from 1 to 5 |
| `/challenge` | GET | Exactly one `id` UUID |
| `/change` | POST | The exact shared collaboration command; no caller identity |
| `/visibility` | POST | Exactly `target` and boolean `hidden` |

The adapter refuses bearer headers, cross-site requests, duplicate cookies,
unknown query/body fields and oversized bodies before Auth. It verifies the
cookie at the pinned Auth server before checking its subject, issuer, audience,
session and expiry binding. The injected collaboration service independently
checks the current SQL session, both participants' deletion evidence and the
combined serving permission before and after access. Every response is private
and noncacheable. No public list or shared publication path is introduced.

Cancellation retires the HTTP instance. Late Auth cannot start service work;
an interrupted dispatched mutation remains explicitly unknown. Reply shape and
operation/challenge bindings are checked before returning private content.
An old command replay after a later revision is a conflict requiring a fresh
read, rather than a stale success. There is no automatic retry or service repair.

The native journey also composes this factory with the actual three managed-role
TLS databases. Two fictional peers create profiles, invite, consent, contribute,
acknowledge, replay, hide/unhide and read through the protected HTTP paths. Real
SQL session revocation and signed serving closure withhold access. Auth HTTP and
signing transport are still fictional; the actual browser collaboration controls
and reviewed hosted runtime mount remain separate acceptance requirements.

The opt-in `createAllianceCollaborationClient` uses only these same-origin cookie
routes, with no token/actor input, browser storage, startup request or polling.
Replies must be bounded, exact, nonredirected JSON marked no-store. A lost save
keeps its original intention in memory and pauses new writes even after a later
read. `checkOrFinishPrevious` explicitly resubmits that exact command: it can finish
the original change, so it must never be described as a read-only check or run
automatically. A later-revision conflict requires reading that exact challenge
before another intention. Cancellation retains the actual flight latch until
ignored work settles, and late private data cannot be emitted after disposal.

The native two-peer journey also runs the actual collaboration browser client
through this HTTP/application/SQL stack. This proves transport composition with
fictional Auth/signing, not visible controls, keyboard or assistive-device access.
The eventual controls must provide plain status text, explicit cancellation and
an accurately labelled earlier-save action without timing or gesture demands.

Existing accessible member controls, comparison, confirmation and uncertainty
messages are reused. No new user timing/gesture task, telemetry or UI is added.
No screen-reader, physical-device or conformance acceptance follows from these
server tests. Remaining durable community features, recovery/privacy/operating,
runtime maintenance, mail/Google and publication gates remain.
