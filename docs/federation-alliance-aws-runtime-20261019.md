# AWS Lambda runtime credential candidate

October 19, 2026. PR #124, source-only and disabled/unmounted. No real credential
is read, generated, copied, stored or installed. No AWS/Netlify/IAM configuration
or resource is changed and no hosted provider is called. GitHub CI runs synthetic
in-memory SDK wires and the existing isolated database/emulator fixtures.

## Explicit compatibility contract

Lambda documents access key ID, secret access key and session token for its
execution role; those environment fields do not establish an expiration Date.
The gateway Invoke and nonce clients retain their default `expiring-sts` profile:
a temporary ASIA key, token and finite expiry within their existing allowed
window are still mandatory. Missing expiry is refused, not replaced with a
locally invented time. An extra STS AssumeRole call is neither added nor assumed
to preserve source-function context.

A new `lambda-execution-role` profile must be selected explicitly. It requires
`createLambdaExecutionRoleProvider`, an independently configured exact
`credentialSource` (account, Region, function name, numeric version), and an
injected AWS-side `readRuntime` callback. Gateway Invoke and nonce adapters accept
only a gateway-kind provider. The authority root adapter accepts only an
authority-kind provider, with the same source account/Region as its target table.
The root adapter's prior default explicit-provider contract stays unchanged;
it does not gain a new implicit expiration or issuer guarantee.

The runtime reader returns exactly `context`, `region` and `credentials`.
It must obtain the context from the current Lambda invocation and credentials
from the actual Lambda execution environment. It must not take them from event,
HTTP, body, user choices or the expected manifest. The provider validates the
exact qualified source ARN/name/version, Region, sufficient remaining invocation
time and the exact three credential fields. It permits temporary ASIA keys with
a session token; it rejects AKIA, missing/malformed fields and extra expiration
or source fields. It makes a fresh immutable snapshot without format conversion,
caching or persistence. Reader failures, deadline, cancellation and changed
context quarantine the provider; late results cannot open an SDK client.

These shape/context checks and the private WeakMap registration are **wiring
checks, not AWS attestation**. A trusted injected callback can fabricate its
inputs. ASIA syntax does not prove the role, issuer, age, expiration, permission,
revocation or source-function condition. AWS remains responsible for validating
actual credentials. The reviewed installation, authentic runtime adapter,
effective IAM policy and real allowed/denied tests are still required.

## No stale SDK credential reuse

Smithy's identity memoization may treat an identity with no expiration as
constant. The runtime profile therefore does not hand a reusable SDK client an
expirationless credential callback. For every SDK send, it:

1. Reads and validates a new runtime snapshot within the request's cancellation
   and deadline budget; missing credentials cannot fall back to an earlier one.
2. Creates one SDK client with that immutable snapshot, the existing pinned
   regional HTTPS endpoint, certificate validation, minimum TLS1.2, one attempt
   and bounded connection/request deadlines.
3. Sends the one fixed command, then destroys its client/agent. The next send
   repeats lookup and creates another client. At most two sends are in flight
   for the table metadata pair; Invoke permits one. No client or snapshot is
   reused by a subsequent send.

Fresh snapshots are not zeroization and cannot prove their AWS-side expiration.
No fake expiration, automatic refresh retry, provider chain, metadata fetch,
STS hop, previous-value fallback or new business retry is introduced. This
source chooses extra connection overhead over hidden credential caching;
actual latency/cost must be measured before a hosted trial.

The outer protocols retain exact executed-version/receipt checks, conditional
nonce insertion/strong readback and root CAS. A write that might have dispatched
still returns unknown on loss/failure. Runtime credential failure after a nonce
or root write cannot grant a successful receipt or roll back consumption.
The nonce store faults after uncertainty; the authority coordinator retains its
own failure/reconciliation rules. Aborting local work is not proof of remote
cancellation.

## Validation and remaining delivery

Synthetic tests exercise explicit selection and exact bindings, credential
changes between requests, absent credentials with no fallback, no fabricated
expiration, malformed tokens/keys/context, deadline/cancel/close, bounded work,
sanitized failures, actual AWS SDK SigV4 serialization for Invoke/nonce/root,
conditional duplicate denial and lost-write uncertainty without replay.
The pre-existing STS refusal tests now explicitly include a missing expiry.
The package test command includes the new focused suite. Exact CI results are
recorded in PR #124; no local execution environment was available for this
increment.

The runtime adapter and expected public AWS installation manifest remain
unmounted. No Lambda environment reader, deployment handler wiring, key vault,
secret scope, new STS access or IAM resource has been installed. The next concrete
delivery work is to prepare the reviewed composition/installation plan and
separately accept actual identity/IAM, ingress/version exclusions, table/TTL/
current custody, independent initialization/restore barriers, bounded trial
traffic/cost/logging, signing-key custody and recovery.

Existing public account release gates remain: Google clearance, real sign-in/
phone acceptance, member sessions/policy/content/abuse/privacy and coordinated
Auth/Storage recovery. No public registration or live-account service is opened.

Primary sources reviewed October19:
[Lambda environment credentials](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html),
[AWS service-role temporary credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_manage-assume.html),
[JavaScript custom credential providers](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-credential-providers/),
[Smithy identity memoization source](https://github.com/smithy-lang/smithy-typescript/blob/main/packages/core/src/legacy-root-exports/util-identity-and-auth/memoizeIdentityProvider.ts),
and [Lambda source-function ARN](https://docs.aws.amazon.com/lambda/latest/dg/permissions-source-function-arn.html).
