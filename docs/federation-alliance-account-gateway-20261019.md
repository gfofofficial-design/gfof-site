# Alliance account authority — signed gateway candidate

October 19, 2026. Owner agreed to prepare the authenticated AWS gateway path
after providing Netlify Support's confirmation that build OIDC is not runtime
workload identity. Source-only, disabled by default and unmounted. No cloud
resource, key, IAM policy, environment value, running endpoint or account service
is created. Ordinary member joining remains owner-approved; public availability
still depends on the separate account and operating acceptance gates.

## Selected direction and remaining authentication responsibility

Keep the website on Netlify. Its server-side authority client sends signed HTTPS
requests to one exact API Gateway REST-v1 stage and `/checkpoint` resource. A
separate AWS Lambda gateway verifies the application signature and consumes a
nonce before using its execution role to invoke one pinned numeric version of
the existing authority Lambda. The inner Lambda client retains AWS SigV4,
executed-version/function-error checks, semantic receipt verification and no
retry. Authority table privileges remain inside the authority service.

The candidate uses an Ed25519 application signing key, not an AWS access key.
Netlify would hold that private application key; AWS would hold its exact public
SPKI/key fingerprint. This is a managed application credential, **not** native
Netlify workload identity, not credential-free operation and not an end-user
Google/Supabase session. An application signature does not authorize a member's
profile operation. Real server session, policy and account checks stay required.

No real key is generated, retrieved or installed by this change. Every generated
key in the tests is ephemeral synthetic fixture material. There is no credential
discovery or default AWS provider in the new gateway module. Actual AWS runtime
composition must supply the existing Lambda client with temporary execution-role
credentials; acceptance must verify their actual issuer, role and permissions.

## Protocol implemented in source

`account-gateway.mjs` exports factories only. The client offers `read`, `advance`
and `close`; it does not expose an arbitrary URL, AWS API, root CAS or reset. Its
configuration pins a standard regional execute-api host, stage and authority ARN.
The signing-key provider must return a private Ed25519 KeyObject whose public
fingerprint matches the configured caller key. Unknown or missing keys fail
before HTTPS dispatch. No key is put in a request, error or output.

Each signature covers the protocol domain, POST method, HTTPS origin, exact
stage/path, exact target function version, key fingerprint, integer timestamp,
fresh 128-bit nonce and SHA-256 of the exact compact UTF-8 request bytes. The nonce
also binds the existing correlation envelope. Both sides bound the body to
274432 bytes; authority history/record bounds and semantic successor checks are
shared unchanged with the IAM transport in `account-authority-wire.mjs`.

The AWS factory checks its actual Lambda context against its own qualified
gateway ARN/name/version and remaining time. It accepts only the pinned REST-v1
API/account/stage/domain/path/method, no query/stage/path parameters or base64
body. Required signed headers must be single-valued, consistent across REST-v1
single/multi-value maps and unambiguous under case folding. Strict UTF-8 and
canonical JSON reject malformed, duplicated or extra envelope fields.
The signature, exact key and 30-second clock window are checked before claiming
the nonce. No caller-supplied context or event identity is an IAM credential.

The mandatory trusted `claims.claim` capability receives only key ID, nonce,
request-body digest and a fixed expiration exceeding the entire accepted request
window. It must atomically insert-if-absent across every instance, durably commit
before returning literal `true`, and deny every repeat, even the same body.
False/nonboolean, uncertain, failed or late claims never dispatch the authority.
There is **no production nonce-store implementation or in-memory fallback** in
this milestone. Tests explicitly use a shared synthetic claim fixture; those
tests do not establish hosted durability, fleet-wide replay protection or TTL.

The default client uses Node certificate-validated HTTPS with TLS1.2 minimum,
one socket, fixed port443, bounded body and overall deadline. It follows no
redirects and refuses non-200, wrong MIME, compressed, cookie-bearing, oversized
or malformed replies. Responses must match the request/operation/version and a
nondecreasing receipt; committed writes must match the exact proposed receipt.
Responses are no-store JSON and carry no CORS policy. Sanitized errors contain
no credentials, profile data, history bytes or provider diagnostics.

There are no retries, queues or transparent credential-refresh retries of a
business operation. A transport failure after write dispatch remains `unknown`,
including a request that may have been rejected before execution. The client
then closes further work. A gateway failure after authority dispatch returns an
unknown write outcome and faults its authority instance. Nonce consumption is
never rolled back for an uncertain or lost response. Reusing a nonce cannot
serve a cached success receipt. An abort is not evidence that remote work stopped.
Fresh reconciliation still requires independently current authority state.

## Validation and limits

The focused suite covers signature/body/target/key/time/nonce tampering,
duplicate headers, REST integration and trusted-context mismatch, canonical JSON,
cross-instance/concurrent replay in the shared fixture, nonce-store errors and
deadlines, private-key mismatch, response corruption, retained pins, lost replies,
pre-cancel/busy/close, unknown writes and exact coordinator reconciliation. One
composition exercises the actual AWS SDK SigV4 serializer and pinned Lambda
client through an in-memory wire. The coordinator still dispatches business work
once and performs three authority writes through pending/floor/resolution.

No real API Gateway, AWS IAM, remote TLS, execution-role issuer, production nonce
store, clock discipline, private-key custody or account session is tested here.
The existing Windows/Ubuntu, disposable PostgreSQL and DynamoDB Local suites
remain separate evidence. There is no UI/layout, member upload, SQL, manifest,
provider configuration, package dependency or operating-mode change. No browser
or physical-phone acceptance is inferred from backend tests.

## Concrete activation work still required

1. Bind actual account/region/API ID/stage, both numeric Lambda versions and
   reviewed artifacts. No `$LATEST`, mutable alias, generic ANY/proxy route,
   public Lambda function URL or caller-controlled service ARN.
2. Install the gateway Lambda resource policy restricted to the exact API/stage/
   POST/resource source ARN and source account. Disable direct/function-URL
   ingress and verify denied alternate APIs, routes and callers. Event/context
   checks in this factory cannot prove that resource policy is installed.
3. Give the gateway execution role only Invoke on the one qualified authority
   version and the separately reviewed nonce-store actions/resource. No authority
   table/root/write/reset/restore/admin permission. Keep authority-store rights
   confined to the separate authority execution role; verify allowed and denied
   calls on the actual AWS account before a finite synthetic trial.
4. Implement and test the durable atomic nonce capability, exact resource/TTL
   binding, no-reuse rule, capacity/failure behavior, and restart/fleet cases.
   DynamoDB TTL deletion is asynchronous; correctness must use atomic conditions
   and signature validity, never assume expiration deletes a row immediately.
   Nonce-store rollback, administrative reset or significant clock rollback must
   close ingress until reviewed recovery/key-epoch handling excludes replay.
5. Establish dedicated application key custody, server-only scope, preview/
   production separation, public-key provenance, revocation, finite rotation and
   compromise recovery. This milestone pins one public key, not an automated
   rotation service. Compromise of the Netlify signing key permits caller
   impersonation until revocation; the gateway does not eliminate that risk.
6. Set measured global ingress/concurrency/spend bounds, payload rejection,
   platform/access log suppression and retention, account-specific costs and
   teardown. API Gateway usage-plan quotas are best effort, and an API key is
   not authentication or a hard spending cap. Invalid signatures still reach
   the verification Lambda and may incur charges. Body/key/header logging must
   be disabled or explicitly redacted before any key or member data is used.
7. Preserve independent current-root custody, initialization, restore exclusion,
   stale-producer/in-flight barriers and coordinated Auth/Storage recovery.
   Complete Google clearance, real sign-in/phone, privacy/erasure, content/rate,
   support and assistive checks separately. No authorization, completed erasure,
   RPO/RTO, operating monitoring/backup or WCAG claim follows from this source.

Primary references reviewed October19: [Lambda execution roles](https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html),
[REST proxy input/output and multi-value headers](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html),
[API-key limits](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-usage-plans.html),
[DynamoDB TTL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html),
and [Node crypto](https://nodejs.org/api/crypto.html). Netlify runtime-identity
limitation is recorded from the owner-supplied support response, not an assumed
issuer configuration.
