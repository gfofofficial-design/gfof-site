# AWS account runtime composition and acceptance

October 19, 2026. Source-only continuation of PR #124. Factories remain default
off and unmounted. No real environment credential, signing key or member record
was read; tests use fabricated role credentials and ephemeral fixture-only keys.
No cloud resource, policy, environment value, handler setting or registration
state was installed or changed. This is a reviewable candidate, not hosted proof.

## What is now composed

`account-aws-runtime.mjs` exports separate gateway and authority factories, each
returning only `handler` and `close`. It exports no live Lambda entry point and
performs no work at module import. Literal `enabled: true` and an independently
prepared public installation manifest are required to construct an enabled
candidate. An environment flag or request body cannot turn it on.

The gateway composes the existing signature verifier, dedicated DynamoDB nonce
store and one numeric-version Lambda Invoke client. Its execution-role provider
is gateway-kind. The authority composes its own authority-kind provider, root
store, semantic checkpoint authority and IAM Invoke handler. The gateway does
not receive the authority store/CAS capability. Effective AWS isolation still
depends on the real reviewed IAM installation, not a JavaScript role selector.

The manifest has exactly `format: 1`, `configuration`, `scope`, `verificationKey`,
`minimum` and `callerKey`. `configuration` uses the existing exact offline policy
generator contract: gateway API/stage, bridge/authority qualified versions,
dedicated nonce/root identities and keys, role names and public caller-key ID.
The actual Ed25519 caller-key descriptor must match that fingerprint and retain
its finite validity window. Scope, verification key and independent minimum
receipt are validated before clients are constructed. The public review digest
checks manifest integrity; it proves no installed/current IAM policy or custody.

The expected manifest must be independently assembled from reviewed deployment
evidence, never derived from the same runtime context/event being checked.
`minimum` must come from the separate current-root custody process; it must not
be copied from a convenient current table read or reset to generation one.
The existing synthetic policy JSON is a fictional example, not an installation
manifest or authorization to apply policies. No real resource IDs are filled in.

## Invocation and credential lifetime

`lambda-invocation-runtime.mjs` uses AsyncLocalStorage to bind each SDK lookup to
the actual context passed as the second Lambda handler argument. It admits one
invocation at a time in this process. It verifies exact account/Region/function/
numeric version and remaining time before reading environment metadata. Busy,
closed, alias, wrong-version and low-budget calls cannot read credentials.

An invocation's scope is retired when its handler settles or closes. A callback
retained by an old invocation cannot read environment values outside that scope
or borrow a later invocation's active context. Close cancels local admission;
it is not proof that a remotely dispatched write stopped. The underlying gateway
and authority instances persist across warm invocations, preserving their
observed minimum receipts and existing fault behavior. No fault causes automatic
client re-creation, root initialization, consumed-nonce reset or business retry.

The concrete environment reader supports **standard Node.js24 on-demand Lambda**
only. It first validates AWS_REGION, AWS_EXECUTION_ENV, AWS_LAMBDA_FUNCTION_NAME,
AWS_LAMBDA_FUNCTION_VERSION and AWS_LAMBDA_INITIALIZATION_TYPE. Only after those
checks does it read AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_SESSION_TOKEN.
It enumerates no environment and has no file, metadata endpoint, default provider,
region fallback or STS hop. Managed Instances, provisioned concurrency, custom
runtimes and other Node versions require separate support/acceptance.

The existing explicit execution-role provider validates each fresh temporary
credential snapshot and the current context. Every SDK send gets a fresh client
and its own credential copy; the provider does not invent expiry or reuse an
earlier value. No AWS credential is sent to Netlify. The supported runtime and
ASIA/context checks remain wiring checks, not attestation of the issuer, role,
effective permissions, expiration or revocation. Administrators and trusted
injected test/composition capabilities can fabricate inputs.

Fixed composition budgets, in milliseconds, are:

| Layer | Budget |
| --- | ---: |
| Signed gateway handler | 5500 |
| Nonce claim | 1000 |
| Authority Invoke | 4000 |
| Authority Lambda handler | 3500 |
| Semantic authority operation | 3000 |
| Each root-store operation | 800 |

The gateway needs at least6000 ms remaining at admission; the authority needs
4000 ms. Inner phases fit beneath the parent budgets and the existing6000 ms
HTTPS client ceiling. These are refusal bounds, not latency promises or AWS
timeout settings. Credential lookup/client construction/connection overhead,
clock discipline, cold starts and real table latency must be measured; timeout
after dispatch still means unknown. No hosted timeout setting was changed.

## Concrete hosted acceptance procedure

1. Record the actual AWS account, Region, Node24 runtime and on-demand mode,
   qualified gateway/authority versions, immutable code hashes, API/stage/method/
   path, separate execution-role ARNs and reviewed public installation digest.
   Bundle the pinned npm dependencies; do not silently use Lambda's bundled SDK.
   Keep ingress closed and keep the website/public registration unchanged.
2. Inventory actual identity/resource/session policies, boundaries, SCPs,
   PassRole/deployment rights, function URLs, aliases/old versions, table policies
   and producer/restore paths. Validate the exact proposed policies with AWS
   tooling and review the results. The source's exact artifact comparison is not
   an IAM simulator. SourceFunctionArn uses unqualified source ARNs and does not
   fence old function versions.
3. Independently verify the dedicated nonce table's exact ARN/TableId, ENABLED
   expiresAt TTL, key schema, capacity mode and deletion protection. Verify the
   authority table's exact ARN/TableId/root key/custody, DISABLED TTL and current
   canonical root against independently retained current evidence. There is no
   root bootstrap/restore/reset command in this candidate. Never use the nonce
   table for authority roots or regard TTL as immediate deletion.
4. Before any finite hosted trial, review its exact resource/cost/concurrency/
   traffic/time limits and teardown, application-key custody and server-only
   scope, platform/access-log suppression/redaction/retention, and authorized
   test principal. Actual installation and the trial remain separately gated;
   this document contains no cloud mutation/probe command. Do not paste secrets
   into source, chat, screenshots, build output or acceptance records.
5. In a separately authorized synthetic trial, prove the allowed path using the
   actual Lambda-supplied context and role credentials. Do not log credential
   fields, request bodies, private keys or signature headers. Record only public
   version/resource bindings, sanitized outcomes and independent state receipts.
6. Verify actual denials for another principal/account/Region/source function,
   another destination version/alias/API/stage/method/path, unauthorized nonce
   prefix/root key and unauthorized table/administrative operations. Check the
   gateway cannot access root data and the authority cannot claim nonces or
   invoke arbitrary functions. A mocked denied call is not this acceptance.
7. Exercise real cold/warm invocation changes, credential refresh/unavailability,
   concurrent replay, retained consumed nonce, uncertain commit/reply, restart,
   deadline, rollback/currentness and old-producer/restore exclusion. Verify
   no business replay, no invented receipt and fail-closed recovery. Measure
   maximum work/log/cost bounds and teardown the exact trial resources.
8. Separately complete real Netlify signing-key custody/runtime binding, effective
   branch/secret scope, early revocation/rotation and old deployment/in-flight
   exclusion. Then complete Google clearance, real sign-in/phone, member session/
   policy/content/abuse/privacy, coordinated Auth/Storage recovery and assistive
   acceptance before opening public registration. Ordinary self-service joining
   remains owner-approved; no per-member Telegram/operator intake is added.

## Evidence and limits

Tests compose signed HTTPS with actual AWS SDK SigV4 serializers for nonce,
Invoke and root operations entirely through memory-only handlers. They verify
distinct role snapshots, conditional replay refusal, warm retained minimums,
lost root-write uncertainty, close/busy admission and wrong-context refusal.
Adapter tests verify eight explicit fields only, metadata before credentials,
no lookup outside/after an invocation and no borrowing a new invocation context.
The concrete process-environment path is tested in a child supplied only an
explicit synthetic environment; the test inherits no parent environment.

Those fixtures prove source behavior, not AWS identity, IAM, hosted durability,
real clocks/latency, old-fleet exclusion or deployment readiness. The existing
isolated PostgreSQL/TLS and DynamoDB Local CI exercises remain separate evidence.
Exact source/test/preview results are recorded in PR #124. No authorization,
completed erasure, RPO/RTO, operating backup/monitoring or WCAG claim is made.

Primary sources reviewed October19: [Lambda environment variables](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html),
[Node.js Lambda context](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html),
[Lambda Node runtime and bundled SDK](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html),
and [Node AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage).
