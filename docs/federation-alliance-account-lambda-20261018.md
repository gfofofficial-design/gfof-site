# Alliance checkpoint authority — Lambda transport candidate

Status: source-only, default off, no exported deployed handler or public route.
October 18, 2026. This connects the reviewed coordinator/authority interfaces;
it does not establish an operating AWS service or authorize cloud access.

## Boundary and data flow

The app's `createLambdaAccountCheckpointAuthority` exposes only `read`, `advance`
and `close`. A trusted credential-provider function is mandatory. There is no
environment/profile/default-chain lookup. Provider results must have a temporary
access-key shape, session token and a finite expiry with at least the operation
deadline plus one minute remaining, no more than one hour ahead. Shape checks do
not authenticate the issuer: AWS verifies credentials; the actual host's issuer
and scoped role still need separate acceptance. Do not insert administrator keys.

The exact AWS SDK Lambda client3.1152.0 sends one synchronous IAM-signed Invoke
to a pinned account, supported US Region, function name and **numeric published
version**. It does not use an alias, `$LATEST`, function URL, queue, async invoke,
client context, returned logs or durable execution. Regional HTTPS endpoint,
certificate verification/TLS1.2+, one socket, one SDK attempt and explicit
connection/request/overall deadlines are fixed. No SDK credential fallback.

The request has a fresh random correlation ID, exact service ARN, operation and
bounded input. Canonical record bytes use strict base64. Records/proof limits
remain256 history records/262144 JSON bytes and4096 canonical record bytes;
the complete request is capped274432 bytes. These are data-shape bounds, not a
global rate/billing limit. Invalid local requests perform no Invoke.

`createAccountAuthorityLambdaHandler` is a factory only. It must eventually be
mounted exclusively behind reviewed AWS IAM Invoke permissions. Lambda-provided
context must match the exact qualified ARN, name and version and have enough
remaining time. **Do not accept context from an HTTP request or trust an event's
claimed identity.** There is no application authentication hidden in this factory;
the future IAM policy must enforce the caller. Runtime role/table credentials and
raw store CAS stay inside the trusted authority service.

The handler validates/copies the input before calling the existing semantic
authority. It returns only allowed states/receipts, not canonical stored bytes,
history rows, errors, context or credentials. The response is bounded1024 bytes
at the client. The client checks SDK HTTP status/attempts, synchronous status,
executed version, absence of function errors/logs, correlation/service/operation,
result shape and nondecreasing pinned receipt. A committed receipt must equal
the proposed next record; HTTP200 alone never means committed.

An Invoke transport failure after dispatch is conservatively `unknown` for a
write, including an error that may actually have prevented execution. No retry,
replay or automatic reset. Unknown/unavailable/cancelled remote results fault the
client closed. Handler uncertainty/deadline closes its authority instance. An
abort does not prove that remote execution stopped; a fresh process must reconcile
against independently current authority data before resuming business work.

## Local acceptance

Twenty-two focused tests include actual SDK serialization, SigV4 signing with dummy
STS credentials and response deserialization through an **in-memory request
handler**, not a real network/TLS endpoint. They test version/credential/payload
rejection, HTTP/function errors, retained pin, conflict, write-then-lost-reply,
deadline/close, actual SDK retryable-error refusal, sanitized teardown failure, semantic floor protection and the actual existing coordinator.
That composition stages one pending operation, dispatches business work once,
then refreshes its floor and resolves it: three authority writes, generation4.
An initial test incorrectly expected two writes; the source flow was inspected
and the assertion corrected. No business dispatch was duplicated.

The full local suite passes631 tests, zero failures/skips. This does not prove
AWS caller IAM, hosted TLS, issuer tokens, resource identity/current custody,
provider durability, regional latency or global traffic controls. Synthetic
memory history/ordinary slot are not production storage.

## Before a hosted trial or release

- Establish a supported short-lived identity for the **actual app runtime**.
  AWS OIDC support, GitHub CI identity and user Google/Supabase sign-in are not
  proof that the app workload can acquire a suitable token. No issuer configured.
- Review exact `lambda:InvokeFunction` permission for only one qualified version;
  runtime only exact DynamoDB metadata/GetItem/PutItem scope, no administration.
  Verify denials as well as allowed calls; test stale versions/old credentials.
- Pin deployed artifact/configuration, function/table identity, external current
  root and initialization ceremony. Keep ordinary restores from restoring root.
- Define global ingress/cost bounds, deadlines, log suppression/retention,
  capacity, revocation, in-flight barriers and a finite synthetic-trial teardown.
  No telemetry/log statements are included here; AWS platform logs are separate.
- Obtain fresh account-specific cost/continuity evidence and owner approval.
  Do not infer perpetual operation from remaining introductory credits.

Managed cross-database/account installation, independent custody, privileged
restore/fleet/old-producer barriers, real signing keys, fresh per-operation
account/session/policy/content checks, coordinated Auth/Storage recovery,
privacy/erasure, manual assistive testing and public review remain open.

Hashes/operation IDs are linkable. Keep identities, profile text/images and keys
out of request records; define provider/log/backup access before real members.
No UI changed: future unavailable/unknown states need persistent plain-language,
keyboard/screen-reader-readable messages and recovery help outside sign-in.
No short timed transcription requirements for members and no WCAG claim.

Primary references: [Invoke API](https://docs.aws.amazon.com/lambda/latest/api/API_Invoke.html),
[Node context](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html),
[OIDC federation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_oidc.html).
The first two describe separate function-error/version signals and trusted
runtime context; neither makes an event envelope an authentication mechanism.


## Netlify runtime decision — October 19

The owner supplied Netlify Support confirmation that Functions has no runtime
OIDC token and approved preparing the [signed gateway candidate](federation-alliance-account-gateway-20261019.md).
Netlify would authenticate with a dedicated server-side application signing key;
the AWS gateway would use temporary execution-role credentials for this exact
pinned Lambda client. The new candidate changes the calling boundary, not this
client's temporary-credential requirement. No real key, issuer, role, gateway,
nonce store or cloud permission is installed. Durable replay protection, caller
key custody/revocation, actual IAM ingress/denial and existing account/authority
acceptance still precede any hosted trial or release.
