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

The complete host still needs durable nonce admission, actual narrow database
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
