# Alliance member AWS composition candidate

Source only, October 23, 2026. This connects the existing
[member authority service](federation-alliance-member-authority-transport-20261022.md)
to its restricted database readers, execution-role credentials, member nonce
adapter and purpose-specific KMS signers. It installs no resource, opens no
database login and exports no live Lambda entrypoint. The separate account
checkpoint service and its root/history protocol are unchanged. A separate closed
staging entry and ZIP target are included; they never construct an enabled service.

## Exact inputs before access

`createAwsMemberAuthorityRuntime` defaults off. A string activation flag refuses.
Disabled construction and handling inspect no connection secrets, read no runtime
environment and open no pool or SDK capability. Enabled construction requires:

- An exact format-1 installation with `binding`, `nonce` and `signing` fields.
  Binding fixes the API/stage, numeric member Lambda version, four-part project
  scope, caller public descriptor and distinct control/Journal verification keys.
- A member-specific nonce table name, immutable table ID and configured epoch,
  in the same expected account/region. The old account nonce namespace refuses.
- Two different exact KMS key ARNs in that account/region, never aliases.
- Canonical trust-record bytes and **separately supplied** expected digest and
  minimum generation. The source parser checks scope, generation and purpose
  keys before any connection secret or provider capability is inspected. Pins
  are not accepted inside the installation or learned from incoming requests.
- Explicit private Control and Journal connection inputs. These contain only
  the expected direct hostname, reader password and certificate authorities.
  There is no password discovery, environment fallback or credential output.

`reviewAwsMemberInstallation` is a pure configuration review. Its digest describes
the supplied public installation; it proves neither currentness nor effective
AWS permissions. The protected trust pins still need owner-reviewed independent
custody outside restored databases/archives. A caller that obtains pins and record
from the same stale archive defeats that protection; this constructor cannot
establish where arbitrary injected inputs came from.

## Composed capabilities and data flow

The invocation adapter checks the real Lambda second argument against the
reviewed numeric identity before entering the service. Request/body fields cannot
replace that context. The execution-role provider reads supported Node24/on-demand
runtime credentials only within that invocation. Each SDK send owns a fresh
snapshot; no old credential snapshot survives to another send or invocation.

Signed member requests first pass the fixed member transport and nonce protocol.
The Dynamo adapter validates the expected table and TTL, performs conditional
nonce consumption and confirms it. It shares the reviewed algorithm with the
older account adapter but retains a separate member namespace and credential
brand. No table creation, reset, expired overwrite or retry occurs.

The control-policy and removal-anchor stores use `alliance_control_reader`, with
anchor writes explicitly off. The Journal uses `alliance_journal_reader`, exposing
only tip/history. These adapters retain certificate/hostname/channel-binding,
managed-role isolation, read-only transactions, identity/permission checks and
bounded commit handling. Neither the member executor nor the Journal writer is
opened by this composition.

The existing control and witness issuers perform their before/after continuity
checks and invoke the matching KMS factory. That factory checks the actual public
key identity and message purpose before signing, then independently verifies the
signature. A history witness remains readable while Journal writes are paused;
it does not grant serving, Auth or profile permission. Protected member actions
still require their fresh serving/session checks.

The accepted service budgets remain unchanged: handler5500ms, nonce1500ms,
issuer3000ms, nested signer1200ms and reserve1000ms. Invocation admission requires
at least6000ms remaining. Failure, uncertainty, low time or invalid context returns
only the standard unavailable response. This is bounded refusal, not proof that
actual provider latency will fit; managed-host timing still needs acceptance.

## Lifetime and failure

The composition owns its invocation adapter, credential provider, three reader
pools, two signer handles, nonce adapter and service. Partial construction closes
already-created resources. Closing aborts admitted work and starts reverse-order
capability closure; asynchronous pool shutdown is awaited and idempotent. Busy
invocations refuse without dispatching another operation. No diagnostic includes
connection strings, request data, runtime credentials or raw provider errors.

The caller still owns the process/deployment and privately supplied connection
material. Closing this object does not lock hosted roles, revoke IAM, fence other
processes, erase the caller's copies or establish fleet-wide shutdown.

## Closed staging artifact

`member-aws-lambda-entry.mjs` exports only the default-off member handler. The
existing strict package builder accepts `member-authority` as a separate target.
Its root `index.handler` imports that closed entry. Module files retain their
`lib/alliance-avatar-server` paths and the two fixed shared public contracts retain
their `assets/federation` paths. This preserves original relative imports without
rewriting source or escaping the ZIP root. The explicit allowlist excludes tests,
fixtures, SQL, installation records and private configuration. The older account
gateway/authority package targets retain their original file set and entrypoints.

Independent ZIP extraction/import checks must show that the member artifact
returns unavailable without external source paths, credentials or runtime lookups,
even when request input resembles activation. No AWS upload is performed by the
builder. An enabled entry/secret loader and real hosting/access decision remain
separate work; this staging artifact cannot activate through an environment flag.

Scoped Git attributes preserve LF bytes for the reviewed modules, shape records,
shared contracts and SQL bodies. Windows checkout conversion must not change a
function-body hash or a reproducible package. Source/dependency symlinks remain
refused; use an ordinary locked dependency installation rather than weakening the
packager's path checks.

## Acceptance and remaining work

Focused unit tests compose the actual source factories with synthetic PG and AWS
responses, real ephemeral Ed25519 keys/signatures, separately pinned canonical
trust and signed request/reply validation. They exercise wrong protocol/resource/
purpose/pin refusal, replay, warm credentials, invalid trusted context, partial
initialization, shutdown and cancellation. They make no cloud calls.

The existing disposable three-domain managed application fixture now uses this
composition and the restricted Journal reader. Its PostgreSQL/TLS/session and
profile/community operations are actual disposable database work; Auth HTTP,
API/Lambda context, AWS table replies and KMS replies remain synthetic. Passing
that fixture cannot establish effective hosted IAM, durable real Dynamo storage,
production key loading or physical-device acceptance. Record each actual local
and CI run separately; no inherited/native-provider acceptance is implied.

Before hosting: review exact real numeric Lambda/API/table bindings, a private
connection-material loader, least-privilege IAM/KMS policies, actual packaged
entrypoint, ingress/cancellation/fleet behavior, provider latency/capacity and
costs. Obtain the appropriate resource/access/finite-test decisions. No source
manifest or constructor authorizes those actions. Complete managed recovery,
latest independent trust/deletion custody, ordinary protected member journeys,
accessibility/operating acceptance and publication remain separate release gates.

No user-facing controls changed. The interface preserves explicit unavailable
results and requires no new owner key transcription. Source/unit/native checks
do not claim assistive-technology or WCAG conformance.

Provider references checked during preparation: [Lambda runtime environment
variables](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html),
[KMS Sign](https://docs.aws.amazon.com/kms/latest/APIReference/API_Sign.html) and
[Lambda package quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html).
These describe provider interfaces and limits, not this installation's effective
permissions or a reviewed hosting price. AWS recommends a dedicated secret
service for sensitive database credentials; its actual loader/access/cost decision
is still separate from this injected-capability source composition.
