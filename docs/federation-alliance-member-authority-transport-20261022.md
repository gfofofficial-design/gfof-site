# Member authority transport candidate

Source-only, disabled and unmounted. No cloud request, credential lookup, key
generation or installation, SQL configuration, initialization or public joining.

## What this connects

The member/community application needs a signed startup decision and a signed
deletion-journal witness. Those are different protocols from the existing AWS
account-history checkpoint read/advance service. A checkpoint receipt cannot
substitute for either response.

`member-authority-transport.mjs` adds a client and a REST-v1 Lambda handler factory
for one exact `/member-authority` resource. The client implements the existing
application's `readDecision(input, options)` and `readWitness(input)` contracts.
The handler accepts only `startup` and `witness` and calls explicitly supplied
control/journal issuers; it has no arbitrary-sign, write, bootstrap or reset action.

The reviewed host still has to construct the actual anchored issuers against the
independent control/journal stores and current retained minima. Injected functions
are trusted capabilities, not an attestation that their implementation is safe.
The transport does not create a store, load an authority key or establish trust.

## Wire and authentication

The independent installation pins the standard regional execute-api host/stage,
three distinct project references and epoch, the caller's finite public descriptor,
two distinct authority verification keys, and an exact numeric version of a
separate `alliance-member-authority-*` Lambda. No `$LATEST`, mutable alias or
existing account-checkpoint function is accepted as that service. No such member
function is created by this source.

The application caller signs the protocol domain, POST method, HTTPS host,
stage/path, qualified service ARN, caller fingerprint, integer time, fresh128-bit
nonce and exact body digest. The canonical compact request also carries the exact
scope, operation and input. Startup requests bind a boot ID/challenge; witness
requests bind a challenge. Neither can supply a different minimum, key or signer.

The handler verifies actual Lambda context, exact REST-v1 API/account/stage/host/
path/method, single-valued matching signed headers, canonical body, caller key and
30-second clock window before nonce admission. A real handler must pass its actual
second context argument. Shape/context checks do not attest AWS identity, IAM,
artifact integrity or protection against trusted code fabricating its inputs.

`claims.claim` is mandatory and must atomically consume the nonce across all
instances, durably commit and return literal `true` before any issuer dispatch.
There is no memory fallback. A known duplicate returns unavailable without
dispatching or poisoning the handler; a nonboolean, failed, late or uncertain
claim closes the handler and its issuers. Rejected requests cannot reset consumed
nonces. The accepted request-window expiry is separate from DynamoDB TTL removal.

Each signed authority result is checked on both ends against the existing
canonical signature domain, public key, expected scope/challenge and fresh issue
time. Startup additionally matches the requesting boot ID. Outer replies bind the
request ID, operation and exact target version. The application then performs its
unchanged minimum, chain, serving-policy, session and SQL checks: this transport
does not grant membership or make a closed decision a serving permission.

## Bounds and failure behavior

- One active exchange per client/handler, no queue or retry.
- Client at most6000ms, handler at most5500ms; real Lambda must report at least
  handler budget plus500ms. Injected issuer/nonce calls receive cancellation and
  must retain shorter budgets when composed into a real host.
- Request/outer response at most4096 bytes, signed authority envelope at most
  2048 bytes. Fixed ASCII field schemas keep normal messages within those limits.
- Default HTTPS uses certificate validation, minimumTLS1.2, one socket, bounded
  response reading and no redirects, cookies or content encoding. Tests can inject
  a trusted transport; it is not an alternative runtime trust source.
- Key lookup, transport and issuer failures produce only generic unavailable
  errors. A late completion cannot resume dispatch or renew the same instance.
- Closing the handler closes its supplied issuers. The caller owns nonce-backend
  lifecycle; closing a local request is not proof of remote cancellation.

Only read/sign operations are exposed, but consuming a durable nonce is a write.
A lost response does not undo that consumption. This factory does not log bodies,
headers, signatures, private values or member identifiers.

## Validation

Focused tests use ephemeral in-memory fixture keys and actual existing anchored
control/journal issuers. They exercise successful exchanges, default closure,
identity/scope/purpose/clock/signature/header/body refusal, cross-instance replay,
known duplicate recovery, uncertain/late nonce results, cancellation, concurrency,
wrong caller keys, response substitution and sanitized failures. The test Set is
explicitly synthetic and is not a durable nonce implementation.

The existing complete managed SQL/TLS journey now crosses this protocol through a
synthetic REST/Lambda wire, rather than calling an issuer directly. Profiles,
revisions, directory/unlisting, journal/anchor-first removal and two-peer
collaboration therefore exercise the transport and actual database stores
together. API/Lambda runtime identity, nonce persistence, Auth HTTP and signing
key custody remain fictional in this fixture; it is not hosted acceptance.

## Next hosted composition and decision

The smallest proposed placement is to keep the member app and its caller key on
the reviewed Netlify server, while a separately reviewed AWS member-authority
function holds the two signing capabilities and reads the independent control and
journal stores. This avoids placing authority private keys in the member app.
Co-located control/journal signers would still share an AWS process/operator trust
boundary; two keys do not establish independent hosting or administrative control.

Before a concrete hosted trial, prepare the actual issuer/store/key-loader and
current-minimum composition, exact new Lambda role/nonce permissions and REST
resource policy, immutable version/endpoint manifest, request limits, cost quote,
logging/retention and old-deployment/fleet closure. The existing checkpoint
gateway/authority policies do not authorize the new function, route or database
access. Do not broaden them automatically or attach a managed administrator role.

Compare scoped encrypted server-secret loading with managed signing using the
already selected Ed25519 protocol. Exportable server secrets permit runtime code
to read those private keys; managed signing needs exact IAM, algorithm, latency,
cost and recovery acceptance. Neither approach is installed or adopted here.
The current journal executor also has write/admission rights; do not call it a
read-only signer credential. A narrower hosted read capability, if selected,
needs explicit source and permission review.

Actual complete member/community inventory, first-install/recovery reconciliation,
independently retained latest trust/checkpoint evidence and off-device recovery
remain prerequisites. The transport cannot manufacture genesis or recover a lost
minimum. Afterwards run one reviewed protected owner journey before any public
joining or release decision. Existing email acceptance and database installations
should not be repeated unchanged.

No user interface changed. The application keeps its persistent unavailable/
unknown states, familiar keyboard controls and support outside sign-in. Operator
review must use plain descriptions of access, cost and closure; neither a member
nor the owner should transcribe hashes or race a countdown. Physical-device and
assistive-technology checks remain distinct from these server tests.
