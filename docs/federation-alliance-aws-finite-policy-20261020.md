# AWS finite-trial policy preparation

October20,2026. **Offline proposal only; no policy installed, role opened,
provider called, real resource/key read, trial authorized or feature enabled.**
The existing gateway/authority runtime factories and baseline policy generator
remain unchanged. The new helper is not imported by the runtime or closed ZIP.

## Purpose and exact scope

The existing request deadlines and finite application-key window are useful
controls, but they do not themselves expire an execution role's AWS permissions.
`gateway-aws-trial-policy.mjs` prepares an additional, separately reviewed trial
artifact from the existing exact policy configuration and an explicit UTC window
of at most600seconds. It has no clock, credential reader, SDK or installation path.

`gatewayAwsTrialPolicyBundle` requires exactly `configuration` and `window`.
The latter contains `notBeforeUtc` and `notAfterUtc`: canonical whole-second UTC
strings with `.000Z`, positive duration and no more than ten minutes. Impossible
dates, offsets, extra fields and invalid baseline resources are refused. Historical
dates can be reviewed offline; a matching artifact is **not a freshness claim**.
The future operator must separately validate actual time and available execution/
cleanup budget before any approved installation, without moving the window forward
automatically to recover a failed or delayed run.

Every existing Allow in both runtime identity policies and their matching
permission boundaries gains `DateGreaterThanEquals` on the start and `DateLessThan`
on the end, both using `aws:CurrentTime`. Existing exact resource/action, source
function, region, transport and partition-key conditions remain. Each of those
four documents also gains explicit Deny-all statements for time before the start,
time at/after the end, and a missing time context. The proposed interval includes
the start and excludes the end. The wildcard appears only in explicit Deny
statements, never as an expanded Allow.

The denials apply to the identities/boundaries on which they would be installed,
including other grants to those principals. Therefore a future install must
independently verify the exact dedicated roles and every function/producer using
them. This is not a safe change to a shared general-purpose role. Administrator
policy changes or other principals outside these documents are not fenced.

Execution trusts, gateway AddPermission/resource-policy artifacts and all other
bindings remain exactly those of the existing baseline generator. The helper
does not invent a date Condition supported by Lambda AddPermission, create an API
resource policy, restrict public ingress or grant a test caller access.

`reviewGatewayAwsTrialPolicyBundle` performs an exact structural comparison and
returns a deterministic public digest. It refuses missing/extended/changed time
conditions, changed actions/resources, removed denials, extra grants, changed
trust/ingress artifacts and a different input window. It is neither an IAM
simulator nor proof of installed/effective policy or real request admission.

## Important limits for the first hosted decision

- IAM evaluates the time of a request; this does not cancel an already accepted
  Lambda invocation, DynamoDB write or other operation at the end of the window.
  Lost replies remain unknown. Existing cancellation, reconciliation, independent
  closure and exact cleanup requirements are not replaced.
- Caller-key expiry, fixed request counts and provider-side policy windows are
  distinct controls. Neither the key nor the root is initialized by this helper.
- API Gateway throttles/quotas are best-effort targets, not guaranteed ceilings.
  These role policies do not stop incoming API/Lambda requests or their charges.
  A monthly alert budget also is not a hard spending cap. No total-bill cap or
  bounded public-ingress claim follows from a ten-minute policy window.
- A full trial still requires actual immutable versions/code, exact IAM validation
  and allowed/denied tests, dedicated domain/current-root/custody evidence, ingress/
  concurrency/request/cost/log limits, an independently usable cleanup path and a
  specific owner decision. Existing closed AWS resources stay closed.

## Validation and accessibility

Focused tests verify preserved baseline permissions, all four documents, exact
start/end seams, missing clock, invalid dates/durations/resources, removal or
weakening of each fence, stable digest and mutation isolation. The small date
condition characterization is not an AWS authorization evaluator. Actual AWS
policy validation/propagation/session behavior and expiry tests remain unrun.

Operator review uses readable UTC start/end and a durable stop/unknown outcome.
The policy window is a backend restriction, not a timed user credential puzzle.
No member-side control or sign-in interaction changes, and no assistive-technology
or WCAG conformance is inferred.

Primary references reviewed: [AWS date-based policy example](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_examples_aws-dates.html),
[date and Null operators](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html),
[aws:CurrentTime](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-keys.html#condition-keys-currenttime),
and [API Gateway throttling limits](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html).
AWS documents CurrentTime as always included in the request context. The missing
time denial is defensive artifact design, not evidence that AWS omits that key.
