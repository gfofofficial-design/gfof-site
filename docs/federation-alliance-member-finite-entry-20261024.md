# Finite member rehearsal package

Source preparation, October 24, 2026. No deployment or access change is included.
The existing closed member entry, closed packager and its CLI remain closed.
There is no environment switch or request field that enables them.

## What this prepares

`prepareFiniteAwsMemberTrialPackage` is a separate explicit offline builder. It
requires the reviewed finite policy bundle, its independently supplied expected
digest, original policy inputs and exact public connection references including
CA certificates. Both secret ARN/version pairs must match the policy proposal.
The validator refuses password fields and unexpected private configuration.
The canonical trust bytes and external trust digest/generation are revalidated.

The resulting ZIP contains a distinct generated `index.mjs` with only fixed
public configuration. It exposes only a Lambda handler. It does not accept an
activation flag, configuration path, factory, clock or secret from an event,
context, environment or resource-discovery request. The manifest marks its mode
`finite-reviewed-trial` and records the exact policy digest, window and generated
entry hash; source/dependency files retain their individual provenance hashes.
It must never be mistaken for the closed package or deployed under that approval.

## Request and expiry behavior

Before the window, and with less than 6.5 seconds left to begin a complete
request, the handler returns an explicit unavailable response without reading
the event/context or opening runtime clients. At the exclusive end it refuses.
Once admitted, only one request can be active in an execution environment.
Construction or dispatch failure permanently closes that environment's entry;
there is no initialization retry. The runtime continues to require the numeric
Lambda identity, signed caller request and durable nonce admission before
private-value reads or database work.

An admitted environment tracks both wall time and a monotonic deadline. A
backward or invalid clock closes it. Frozen wall time cannot extend its admitted
duration, and a response finishing after expiry is withheld. The expiry timer
requests runtime closure, which aborts owned work and retires clients/pools;
late construction is retired before dispatch. The timer is unreferenced so it
does not keep a local test process open.

This does not establish a global request limit or reliable scheduling while
Lambda is frozen. Warm or new environments cannot extend the fixed absolute
window, assuming the host clock is correct. Fresh AWS role credentials and IAM
time fences remain necessary. Expiry does not remove ingress, replace database
roles, terminate all server-side sessions or cap the bill. A separate reviewed
operator procedure must close ingress/concurrency first, lock database roles,
remove passwords, terminate exact sessions, restore original AWS policies and
independently verify those outcomes.

## Evidence and remaining acceptance

Unit checks exercise early/exclusive-end admission, the complete-request reserve,
configuration mutation and pin refusal, overlapping calls, late results,
monotonic expiry, backward/invalid clocks, close during construction and failure
without retry. The package test independently extracts and hashes the ZIP and
imports its expired entry in a child with credential/runtime reads blocked. It
verifies no request or credential inspection occurs on that expired path.

Those checks prove local source/package behavior. They do not prove effective
IAM/KMS evaluation, Secrets Manager payload correctness, hosted database access,
timer behavior in Lambda, or an authenticated ordinary-member journey. Existing
composition tests supply synthetic dependency and disposable SQL/TLS evidence;
real hosted acceptance is still separate. No prepared example is authority to
invoke a service or install a password.

Before proposing a hosted run, retain exact current resource identities, original
policies, code/version guards, table/TTL and secret metadata, database expiry and
session cleanup, bounded request budgets, failure stop rules and independent
cleanup checks. A new resource or permission and any associated cost need the
owner's reviewed decision. This source work requests no such action.

No public interface or new private-entry step is introduced. Failures preserve
the existing explicit unavailable state. Owner instructions must allow enough
time for accessible review and password-manager use before opening the window;
do not turn the short runtime window into a private-entry countdown. Physical
device and assistive-technology acceptance remain release requirements, and
these tests do not establish WCAG conformance.
