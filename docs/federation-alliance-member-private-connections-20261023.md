# Private connection loading for the Alliance member authority

Source candidate, October 23, 2026. Default off and not connected to a hosted
service. The closed staging entry remains unchanged: request or environment
values cannot turn it on. No secret, permission, login or cloud resource is
created by this code.

## What changes

`createAwsMemberAuthorityRuntime` accepts either existing injected `connections`
or public `connectionSecrets` bindings. Supplying both is refused. The latter
uses `createMemberConnectionSecrets` with the actual member execution-role
credential adapter and a pinned AWS SDK client. No default credential chain,
profile, metadata lookup, environment password or filesystem fallback is used.

The public binding contains one complete secret ARN, immutable version ID and
reviewed CA bundle for each of `control` and `journal`. Names have distinct
`alliance-member-control-reader-` / `alliance-member-journal-reader-` prefixes;
account and region match the member function. Aliases, partial ARNs, missing
versions, another account/region, crossed purposes and invalid CA text refuse
before any provider request.

Each private value is canonical JSON with exactly `format`, the four existing
scope fields, `purpose`, `databaseRole` and `password`. The only roles accepted
are `alliance_control_reader` and `alliance_journal_reader`. Hostnames are derived
from the separately validated project scope; private content cannot redirect
the database, choose an administrator, replace TLS settings or change the CA.
The existing database adapters still enforce restricted identity, direct TLS,
hostname/certificate checking, channel binding and their managed ACL checks.

## Request and data flow

1. Verify the separately retained trust record and public installation at
   construction. Import/default-off performs no credential/provider lookup.
2. Check the real Lambda second argument, then the existing API envelope,
   caller signature, timestamp, body, operation and scope. Request fields cannot
   replace the trusted invocation context.
3. Consume the existing durable nonce before reaching an issuer. Invalid,
   unsigned or replayed requests do not fetch a private connection value.
4. On the issuer's first read, retrieve exactly the two pinned secret versions
   in parallel. Requests specify both version ID and `AWSCURRENT`; a retired
   version or provider identity/stage mismatch refuses. Each SDK send uses a
   fresh execution-role snapshot and client, explicit regional TLS endpoint,
   one attempt and bounded request time. There is no write/rotation/list API.
5. Validate both private values before constructing any pool. Policy, anchor
   and Journal readers share one load within this invocation. Existing signed
   policy/history rules determine whether a reply may be produced.
6. Close all invocation-owned pools before returning. A later accepted request
   retrieves the values again. No password/pool is intentionally cached between
   invocations; public binding/CA references remain available. JavaScript and
   SDK strings cannot promise secure memory erasure; references are released,
   not claimed to be zeroized.

An asynchronous invocation scope isolates the lazy readers. Late callbacks
cannot borrow another invocation's session. Closing or cancelling refuses
late construction/signing; partially constructed pools are retired. The
existing direct-injection path remains supported for controlled embedding and
provider replacement. It is not a fallback if private retrieval fails.

## Bounds, failure and operating implications

The loader's total deadline is at most 700 ms inside the existing issuer budget;
it does not extend the 5.5-second authority handler or weaken the current Lambda
remaining-time check. Cold-network/secret/DB latency still needs actual hosted
measurement. Slow or unavailable dependencies produce the existing unavailable
response, with no partial credentials, raw provider errors or retry in the same
request. A new independently admitted request may make its own bounded reads.

Two accepted authority exchanges mean four secret reads. Invalid signed inputs
may consume a nonce without a secret read; unauthenticated ingress still needs
appropriate API/runtime throttles. Count and fleet-cost limits are separate
deployment controls, not guaranteed by an SDK timeout. A response that is refused
after admission must not reuse its consumed nonce.

No logger, persistence/export hook, URL with a password or secret-value hash is
provided. AWS records the retrieval operation in CloudTrail; names/ARNs are
nonsecret configuration, while values stay out of application diagnostics.
Do not copy this private payload into source, a build artifact or an AI-readable
record. Runtime retrieval is server-side; the browser receives no credentials.

## Validation and remaining release work

Unit checks cover provider identity/version/purpose, duplicate/noncanonical JSON,
private scope/role/host override, caller credential branding, refresh across
invocations, abort/deadline/closure, zero-fetch invalid/replay and pool retirement.
All provider replies and test credentials are explicitly synthetic. The existing
complete disposable SQL journey now uses this path and checks two synthetic
secret reads per actual signed authority exchange. It verifies real restricted
Postgres operations and teardown, not effective hosted Secrets Manager/IAM.

The pinned dependency is `@aws-sdk/client-secrets-manager` **3.1152.0**; the lock
and strict package dependency allowlist include it. Closed packages still exclude
fixtures, private configuration and activation inputs. The already staged
immutable version is not changed by editing or packaging this candidate.

Before activation, review actual secret creation/custody/version pins, least
privilege `GetSecretValue` grants, database reader passwords/expiry, ingress and
nonce resources, effective key policy, an explicit enabled entry, costs and one
bounded end-to-end hosted acceptance. Full coordinated recovery, independent
latest-trust/deletion custody and member/device/operating/publication acceptance
remain separate release gates. Do not silently create resources to fill them.

This backend change adds no interface or owner transcription task. The member
interface keeps the existing explicit unavailable result, without replacing it
with an empty directory or a successful sign-in claim. Keyboard/screen-reader/
mobile acceptance is not established by these source tests, and no WCAG
conformance is claimed.

## Primary references checked during preparation

- [AWS GetSecretValue](https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html):
  complete ARN/version/stage selection, required read permission and sensitive
  response handling. The vendor's example logs a whole response; this source
  deliberately supplies no such log.
- [AWS JavaScript retrieval](https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets-javascript.html)
  and [Lambda secret guidance](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html).
- [Secrets Manager access policies](https://docs.aws.amazon.com/secretsmanager/latest/userguide/auth-and-access_iam-policies.html)
  support individual-resource grants; actual grants remain unapproved.
- [Published pricing](https://aws.amazon.com/secrets-manager/pricing/) lists
  $0.40/secret/month and $0.05/10,000 calls in its examples. Two future stored
  credentials would therefore be about $0.80/month before tax plus requests,
  not a current purchase, account quote, allowance or enforced spending cap.
- [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres)
  distinguishes encryption-only `require` from server verification; existing
  reviewed CA/hostname checks remain. The current
  [changelog](https://supabase.com/changelog) links
  [HTTP CBC retirement](https://supabase.com/changelog/cbc-tls-ciphers-deprecated)
  and [Postgres 17.11 security changes](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).
  No new schema, Auth/Data API behavior or downgrade is introduced here.
