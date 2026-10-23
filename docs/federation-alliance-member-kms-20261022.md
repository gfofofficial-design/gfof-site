# Disabled managed-signing candidate

The member authority needs two fixed signatures: startup decisions and deletion
witnesses. `createMemberKmsSigner()` can supply either purpose using a pinned
Ed25519 KMS key. It is default-off and unmounted; importing it does not find
credentials, import/generate keys or contact AWS.

## Boundary and protocol

The signer requires an explicit numeric `alliance-member-authority-*` Lambda
installation. The existing invocation adapter checks the actual qualified
context plus the supported standard Node24/on-demand runtime before reading
the three platform credential fields. The execution-role provider's separate
`member-authority` brand prevents substitution of the account-checkpoint
gateway/authority credential capabilities. These source checks are wiring
guards, not independent AWS identity/IAM or artifact-integrity attestation.

Only canonical, bounded, fresh messages in the configured purpose and scope are
accepted. Startup decisions and witnesses use their existing separate domains;
there is no arbitrary JSON signing, request-selected key, alias or digest mode.
The exact account/region/key UUID ARN is independent public configuration.

Each accepted operation first requests the public key and checks its exact
Ed25519 SPKI, key type/usage, key ARN and supported algorithms against the pinned
verification key. Then it calls Sign with `ED25519_SHA_512` and `MessageType:RAW`,
and verifies the returned 64-byte signature locally. The prehashed algorithm
cannot substitute for this protocol. Current API semantics are documented in
[KMS key specs](https://docs.aws.amazon.com/kms/latest/developerguide/symm-asymm-choose-key-spec.html)
and the [Sign API](https://docs.aws.amazon.com/kms/latest/APIReference/API_Sign.html).

Each SDK send receives a fresh explicitly bound platform credential snapshot,
owns one TLS-validated client/socket and destroys it afterward. No default
provider, retained SDK credentials, redirect or retry is selected. There is one
active signing operation, a maximum1200ms total budget and shorter per-send
budgets. Failure, cancellation or uncertain/late work closes that signer; it
cannot silently retry. Stopping locally does not prove AWS canceled a dispatched
Sign or erase an audit event. Generic errors expose no provider diagnostics.

## Separate offline installation proposal

`preparePendingMemberKmsKeys()` prepares two single-region EXTERNAL-origin key
containers with pinned, distinct existing public identities and purpose aliases.
It does not create a key or import anything. The proposed policy retains only
existing account-management delegation and explicitly denies cryptography,
import-parameter/material operations, runtime grants and enablement. The account
administrator can replace a key policy, so this is not independent operator trust.
Policy-lockout safety checks remain enabled. No user/role or runtime permission
is created by the plan.

An EXTERNAL key starts PendingImport and cannot perform cryptographic operations
until material is imported; see [AWS's creation procedure](https://docs.aws.amazon.com/kms/latest/developerguide/importing-keys-create-cmk.html).
Its expected-public-key tag is an intention, not proof of imported material. The
readback reviewer requires the exact current account/region/description, origin,
PendingImport/disabled state, single-region flag, purpose alias, policy and tags.
Do not use a mutable alias as the runtime identity or reuse another product's key.

Creating these containers would add ongoing key-storage costs at published AWS
rates (currently$1/key/month prorated hourly), with no automatic cutoff. Later
asymmetric API use is separately billed and excluded from the general KMS free
request allowance. See [current pricing](https://aws.amazon.com/kms/pricing/).
Existing credits do not establish permanent free hosting. Creation, import,
runtime use, account-plan changes and public release need their concrete reviewed
decisions; no purchase follows from this source.

## Evidence and remaining work

Tests use ephemeral in-memory keys and actual SDK command types behind injected
SDK-response fixtures. They verify RAW Ed25519 protocol interoperability with the
actual anchored issuers, exact key/public metadata, scope/purpose/clock refusal,
role/invocation separation, signature substitution, cancellation and late work.
The fixture preserves inner sanitized errors for assertions; production's outer
invocation adapter still sanitizes rejected operations. No real private value,
cloud KMS call, import or deployed signing acceptance is included.

The complete host still needs deployed durable nonce admission, actual narrow database
secret loading, reviewed issuer budgets, current independently retained trust
and first-checkpoint/recovery reconciliation, immutable version/IAM/ingress and
fleet controls. KMS keeps private signing material out of that function's process
after an accepted import, but an allowed runtime can still misuse Sign and both
issuers may share an operator/process. Existing exportable owner copies remain
part of the recovery and compromise model.

No member UI changes. Clear unavailable/help states outside sign-in remain.
Operator approval names the cost/access/state in plain language; preparing empty
containers needs no private-key copying or repeated key creation. Actual import
and recovery must retain private entry and accessible, untimed instructions.

## Separate member request admission

`createDynamoMemberAuthorityNonceStore()` supplies a default-off capability for
the member authority. Its table namespace is `alliance-member-nonce-*`, distinct
from the existing `alliance-account-nonce-*` gateway. Only a provider branded for
the exact numeric member-authority Lambda version can be wired to it; gateway
providers, plain temporary credentials and foreign account/region bindings are
refused before SDK work. The private shared algorithm keeps the existing account
gateway interface and credential modes unchanged. These wiring checks are not
independent AWS identity attestation or IAM enforcement.

The reviewed manifest must pin the actual table UUID, account, region and caller
key. Table checks require the exact active on-demand protected table, simple
string primary key and enabled expiry cleanup. A conditional put consumes
`callerKeyId#nonce`; changing the configured custody epoch never resets that
namespace. A strongly consistent exact read and a second identity check are
required before an issuer can proceed. Expired rows cannot be overwritten. An
uncertain write closes that store without retry; a separate handler still refuses
the retained request. TTL cleanup is asynchronous, not a request deadline.

Tests join the real signed member transport and anchored issuers to this adapter
with an injected in-memory Dynamo command backend. Separate handlers cannot
reissue a consumed request, and a lost write response never reaches an issuer.
These are local protocol checks, not actual Dynamo, IAM or deployed Lambda
acceptance. No table, role, permission or runtime is created or enabled here.
The complete host still needs reviewed resource provisioning, bounded retention,
credential loading, latency acceptance, current checkpoint/recovery continuity
and protected member journey acceptance. No member UI changes or new timed input
steps are introduced; existing unavailable/help paths remain required.
