# Gateway policy and signing-key custody candidate

October 19, 2026. Source-only continuation of PR #124. No real key is generated,
read, exported, installed or rotated. No AWS/Netlify permissions, environment
values, function configuration, routes or public registration are changed.

## Reviewable AWS policy artifacts

`gatewayAwsPolicyBundle` is an offline generator for exact configured account,
Region, API/stage, numeric function versions, two role names and separate nonce/
authority table identities. `reviewGatewayAwsPolicyBundle` rejects any difference
from that exact artifact and returns a public digest. It is an artifact checker,
not an IAM evaluator, policy installer or proof of effective/installed permissions.

The [synthetic bundle](examples/alliance-gateway-aws.synthetic.json) is a concrete
review example using fictional resources and the AWS example account number.
**Do not apply it.** It contains no real account binding, public signing key,
credential or infrastructure claim. Actual resource IDs must be independently
read and reviewed before generating a live proposal.

- The gateway identity policy permits Invoke on only one qualified authority
  version, metadata reads on only its nonce table, and GetItem/PutItem only for
  partition keys under the configured caller-key fingerprint. The authority
  identity policy permits metadata and GetItem/PutItem on only its own root table
  and exact root key. Neither receives the other table's data privileges.
- Every runtime statement requires the exact Region, secure transport and the
  appropriate `lambda:SourceFunctionArn`. Item statements use `ForAllValues`
  LeadingKeys conditions and reject a missing/null key set. The nonce prefix
  wildcard is confined to one caller fingerprint; resources/actions are exact.
- Matching permission-boundary documents are proposed alongside identity
  policies. Execution-role trust permits only the Lambda service. This is not a
  grant for the deployment operator to PassRole or edit policies.
- The AddPermission input and expected gateway resource-policy statement bind
  API Gateway to one exact source account/API/stage/POST/checkpoint resource and
  one numeric gateway Lambda version. No mutable alias, ANY/proxy route, function
  URL or public principal is proposed. Same-account authority invocation uses
  the gateway identity policy; no authority/table resource-policy grant is added.
- The bundle proposes no Create/Update/Delete/Scan/BatchWrite/restore/admin,
  Secrets Manager, STS AssumeRole, logging or IAM operations. No broad managed
  execution policy is silently attached. Redacted operational logging/retention
  still needs its own exact design before a trial.

AWS's source-function condition explicitly uses an **unqualified** source ARN;
versions/aliases are unsupported there. Destination Invoke is version-pinned,
but that source condition is not an old-version/producer fence. The deployment
operator's PassRole rights, other policies, direct resource/session grants,
boundaries, SCPs and existing function URLs must be inventoried independently.
An Allow artifact does not subtract another principal's permission. Boundaries
do not prove universal denial, and resource-based session grants have distinct
evaluation rules. Validate the generated policies with AWS tooling and perform
real allowed/denied calls before acceptance; this source has done neither.

PutItem permission cannot force a caller to use this module's conditional
expression. Trusted runtime/artifact integrity, scoped roles, independent current
custody and restore/fleet exclusion remain part of the boundary. TableId/epoch
metadata are not IAM-enforced table-generation or administrator restrictions.

## Finite public signing-key policy

The gateway caller-key descriptor now requires exactly `keyId`, SPKI, canonical
`notBeforeUtc` and `notAfterUtc`. The key must be Ed25519 and match the exact SPKI
SHA-256 fingerprint. The configured authorization window must be positive and no
longer than30 days. This limit does not establish the private key's actual age,
choose a production rotation cadence or authorize a30-day launch trial.

Both the sender and AWS verifier check the window using their current clocks.
The sender needs sufficient lifetime for its request deadline and replay window
before loading a key. The verifier also requires the signed timestamp to fall
inside the key window. Expiry during nonce work prevents authority dispatch;
expiry after authority dispatch withholds committed evidence and returns unknown
for a write. No retry or automatic replacement key follows. The nonce window and
the key's authorization window are separate controls.

An expired key is refused by the verifier even if a caller retains its private
KeyObject. This is not immediate revocation: stopping a compromised key before
its configured expiry requires closing ingress/removing the key on every active
gateway deployment and excluding old versions/producers/in-flight work. A source
edit, new config epoch, changed descriptor or Netlify redeploy alone does not
establish that old AWS deployments stopped accepting the key.

## Server-only provider candidate

`createGatewaySigningKeyProvider` is default off and has no environment/filesystem
reader, default key, private export or key generation. The future private-store
adapter must explicitly return a KeyObject; strings, buffers, public keys and
foreign private keys are refused. It checks the public fingerprint and finite
window before returning the key. It loads fresh on each call and creates no key
cache or plaintext copy. Node process-memory/GC behavior is not a zeroization or
hardware-backed custody guarantee.

An independent public expected-installation manifest binds exact Netlify site,
deploy ID and deploy context. A trusted runtime adapter must extract those fields
from actual Netlify context; it must not use a browser request, URL/header, local
role selector, or the same runtime object to manufacture the expected values.
Checks run before private lookup and again afterward. A changed deployment,
deadline, cancellation, mismatched key or loader failure faults that provider;
late keys are ignored and errors are sanitized. The provider does not authenticate
the platform cryptographically and cannot establish its injected adapters' origin.

Netlify documents SITE_ID, DEPLOY_ID and CONTEXT as public build metadata. A future
reviewed build can preserve only those public fields in a server manifest, then
compare actual function context at runtime. No build command/manifest injection,
context adapter or private-store loader is mounted here. Branch/secrets scoping
must be independently verified; deploy-context checks alone are not branch
attestation. Do not place signing material in the build manifest or expose it to
the browser, build logs, screenshots, chat or PRs.

## Installation/cutover acceptance still required

1. Verify actual AWS account/Region/resource IDs, caller fingerprint and code
   artifacts; produce and review an exact plan. The synthetic bundle is not that
   approval. No cloud creation/apply command is included in this increment.
2. The [AWS runtime candidate](federation-alliance-aws-runtime-20261019.md) now
   supplies an explicit Lambda execution-role profile without fake expiration,
   an STS hop or stale SDK-client reuse. The existing expiring-STS profiles stay
   strict. Synthetic SDK wires cover Invoke, nonce and root adapters. The actual
   runtime reader/context manifest remain unmounted; real execution-role issuer,
   effective IAM/source-function conditions and hosted acceptance remain open.
   No AWS keys go into Netlify.
3. Establish independent key custody/recovery and an exact private-store adapter.
   If using Netlify environment storage, require a secret value scoped to runtime
   Functions and the reviewed exact context/branch, with distinct preview and
   production keys. Verify actual metadata without exposing values. This source
   reads/changes no Netlify environment variable and proves no stored-secret scope.
4. Provision a finite synthetic trial only after exact IAM/resource/ingress,
   temporary credentials, table/TTL/currentness, cost/log bounds and teardown are
   reviewed. Verify wrong roles, accounts, Regions, API stages/methods/paths,
   versions, nonce prefixes/root keys and unauthorized table operations really
   fail. Exact local artifact checks do not substitute for those tests.
5. Rotation is initially a separately reviewed close/change/verify/reopen
   procedure. Retire old API integrations, qualified grants, role sessions and
   producers; retain consumed nonces through the valid replay/in-flight window.
   Set a newly approved finite key descriptor on both ends and verify the old key
   is denied. No automated renewal, overlap, dual-key reader, instant revocation
   service or old-deployment fence is implemented here.
6. Preserve separate current-root custody, initialization/restore exclusion and
   account/session/policy/content/abuse checks. Google clearance, real sign-in/
   phone, coordinated Auth/Storage recovery, privacy/erasure/support and assistive
   acceptance still precede public joining. No public signup or live resource is
   enabled by these tests.

## Evidence

Tests cover policy binding and broadened-artifact rejection, independent runtime
checks before/after key loading, no private export, malformed/foreign keys,
bounded validity, cancellation/deadline and expiry before/after authority work.
Fixtures generate ephemeral local-only keys; no real key is read or exported.
The existing actual DynamoDB Local gateway composition now uses finite public
key validity too. Its namespace/emulator boundaries remain unchanged.

The first broad local run had three failures in older short-deadline tests under
file-level concurrency. The58 tests in those files passed in isolation. Test-file
concurrency is now explicitly1; production deadlines and within-test concurrency
races are unchanged. Final exact-head results are recorded in PR #124. No IAM,
key-vault, platform identity, hosted rotation/revocation, erasure, operating backup,
RPO/RTO or WCAG acceptance is claimed.

Primary references reviewed October19: [Lambda source-function ARN](https://docs.aws.amazon.com/lambda/latest/dg/permissions-source-function-arn.html),
[AddPermission](https://docs.aws.amazon.com/lambda/latest/api/API_AddPermission.html),
[IAM boundaries](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html),
[DynamoDB fine-grained conditions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/specifying-conditions.html),
[Lambda environment credentials](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html),
and [Netlify public build metadata](https://docs.netlify.com/build/configure-builds/environment-variables/).
