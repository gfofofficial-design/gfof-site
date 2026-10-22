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

This does not establish real managed connections, runtime keys/current authority,
provider billing bounds or durable fleet fencing. Fresh read-only hosted catalogue
inspection found no Alliance member schema in the Account Pilot and only the
original journal functions in the Journal Pilot. The journal/control roles remain
locked. Existing strict member/journal drivers also refuse creator-management
memberships; they must not silently learn a weaker baseline from a live database.
An exact reviewed managed installation/profile is still needed before runtime use.

Existing accessible member controls, comparison, confirmation and uncertainty
messages are reused. No new user timing/gesture task, telemetry or UI is added.
No screen-reader, physical-device or conformance acceptance follows from these
server tests. Remaining durable community features, recovery/privacy/operating,
runtime maintenance, mail/Google and publication gates remain.
