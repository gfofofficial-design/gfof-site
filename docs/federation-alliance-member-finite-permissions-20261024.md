# Finite permissions proposal for the member authority

Source-only review aid, October24,2026. This prepares the policies needed for a
bounded member-authority test. It creates nothing, reads no credential, enables
no role or handler, and performs no AWS or SQL request. The separately reviewed
closed Lambda entry and older account gateway policies are unchanged.

## What the reviewer can inspect

`memberAwsTrialPolicyBundle` accepts the existing exact member installation,
canonical trust-record bytes with independently supplied digest/generation,
two public secret ARN/version bindings, a dedicated member role name, the two
original closed key policies and one explicit UTC window of at most ten minutes.
The window must fit the caller's declared validity with the existing37-second
expiry margin. There is no clock lookup or claim that a prepared window is fresh.
Unexpected fields, values, accounts/regions/purposes, mutable aliases, old account
nonce tables and changed original management/denials refuse.

It produces a proposed role identity policy and matching customer-managed
permissions-boundary document; a Lambda-only trust; two finite KMS key policies
with the exact original policies retained for reviewed restoration; and a
version-qualified API Gateway invocation permission/resource-policy expectation.
An artifact reviewer binds every field and condition to its inputs. These are
JSON proposals, not an IAM evaluator, installer, adoption or effective-access
attestation. No output is applied automatically.

The [committed example](examples/alliance-member-aws-trial.synthetic.json) uses
only public synthetic identities and a fixed historical test window. Never use
that example as a real installation or recreate the owner’s actual resources
from it. Real public bindings belong in the private operating record.

## Intended permission boundary

- Get only the two exact secret ARNs, with both `secretsmanager:VersionId` and
  `secretsmanager:VersionStage=AWSCURRENT` conditions. No discovery, list, batch,
  write, rotation, replication or private export. The runtime still validates the
  private canonical payload and scope before constructing pools.
- Describe only the member nonce table/TTL, and get/put only the bound caller's
  nonce-key prefix, with a non-null LeadingKeys condition. The application keeps
  its conditional no-overwrite claim. IAM does not inspect that expression or
  enforce how many claims are made. No scan, query, update or delete permission.
- Get the public keys and sign only with the two exact purpose key ARNs. Sign
  permits `ED25519_SHA_512` with `RAW` message type. IAM cannot determine which
  purpose domain or message content the code signs. Existing source factories
  and a real hosted test must supply that evidence.
- Each direct allow requires the reviewed unqualified Lambda source ARN, region,
  secure transport and the same inclusive-start/exclusive-end window. Explicit
  denials cover early, expired or missing time, and source/region/transport drift
  on every directly granted runtime action. No IAM, STS, log, provisioning or
  resource-management allow is supplied.

The direct source/network denials are intentionally scoped to those runtime
actions. A blanket `Action:*` source-condition denial can affect a forwarded
service request such as Secrets Manager's managed-key decryption, where the
context differs. No direct `kms:Decrypt` grant is added: the proposal assumes
the same-account AWS-managed Secrets Manager encryption key and its existing
service-only behavior. Customer-managed secret encryption is outside this
profile. Actual forwarded-service/boundary evaluation remains a hosted gate.
The time denials still cover all actions by this role outside the chosen window.

## Signing policy and ingress details

The original KMS management statement is preserved exactly. The original deny
continues for other cryptography, import and runtime-grant creation. Only Sign
is separated into an exception for the exact member role, finite RAW/Ed25519
allows and explicit early/expired/missing-time sign denials. Other principals
remain explicitly denied Sign. This does not remove the administrator's existing
ability to change a key policy; that power remains part of the trust boundary.

KMS grants target an IAM role ARN, not a role-session ARN or wildcard Allow
principal, so the role's permissions boundary remains relevant. A KMS key policy
cannot use `lambda:SourceFunctionArn`; source provenance belongs in the role
identity/boundary instead. AWS uses an unqualified source ARN and cannot pin
outbound credentials to a numeric function version. Code/version review and
trusted Lambda context remain necessary. Key-policy Resource `*` means the
single key to which that policy would be attached, not every account key.

The proposed inbound permission binds one numeric member function version to
one account/API/stage/POST/member-authority route. No alias, Function URL, older
checkpoint route or wildcard stage is accepted. This is a grant proposal only:
it does not create an API, route, integration, deployment or authentication rule.

## What this does not finish

Expiration fences downstream AWS permissions; it does not disable invocation,
remove an API route, terminate an existing SQL session, erase a fetched value,
enforce request/signature counts or establish a spending cutoff. Lambda/API
throttles are not a hard billing cap. A later bounded procedure still needs
exact code/entry/version bindings, current role/key/table/secret metadata and
fresh policy analysis, effective runtime/managed-key/SQL acceptance, concurrency
and ingress closure, session termination and independent cleanup evidence.

The existing deny-all role policy must be handled explicitly in that reviewed
procedure; adding an Allow does not override it. A permissions boundary is a
managed IAM policy that would need separate approved creation/attachment, not
an inline JSON file that is already in force. Existing customer KMS grants,
secret/table resource policies, aliases, function URLs and unexpected invocation
grants must be checked rather than inferred absent from these proposed files.

This source change is not a request to activate anything. The stored reader
passwords remain unused until their installation/login test is separately
reviewed. Full managed recovery, retained current trust/deletion evidence,
protected ordinary-member journeys, physical-device/assistive-technology checks
and final publication remain distinct release gates.

No public control changes or new private-entry task are introduced. Failure
remains explicit unavailable instead of an empty directory or apparent sign-in
success. Offline policy tests do not establish WCAG conformance or actual user
acceptance. Preserving existing controls and avoiding repeated key transcription
supports the Federation accessibility direction.

## Primary references reviewed October24

- [Lambda source-function conditions](https://docs.aws.amazon.com/lambda/latest/dg/permissions-source-function-arn.html):
  identity-policy placement, unqualified ARN and request-context limitations.
- [Secrets Manager action/condition reference](https://docs.aws.amazon.com/service-authorization/latest/reference/list_secretsmanager.html):
  GetSecretValue resource, VersionId and VersionStage condition support.
- [DynamoDB action/condition reference](https://docs.aws.amazon.com/service-authorization/latest/reference/list_dynamodb.html):
  item operations, metadata actions and LeadingKeys.
- [KMS condition reference](https://docs.aws.amazon.com/kms/latest/developerguide/conditions-kms.html)
  and [Sign](https://docs.aws.amazon.com/kms/latest/APIReference/API_Sign.html):
  single-valued algorithm/message conditions and RAW Ed25519 requirements.
- [IAM role principals](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html):
  role/session distinction and boundary interaction.
- [Secrets Manager encryption](https://docs.aws.amazon.com/secretsmanager/latest/userguide/security-encryption.html):
  AWS-managed service-only encryption and forwarded requests.
