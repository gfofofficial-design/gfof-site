# Fixed first operating period

The optional first-period authority entry accepts one reviewed window of at most
30 days. It must end at least 37 seconds before the existing caller expires.
The default AWS package and CLI still produce a closed entry.

`prepareFixedPeriodAwsMemberPackage` requires a complete public installation,
independent trust pin, exact secret-version references and a matching policy
digest. The generated module exports only the handler. Events and environment
flags cannot supply activation settings, clocks, factories or replacement policy.

Admission checks precede credential access and request inspection. Warm entries
use both wall and monotonic deadlines, refuse concurrent work and withhold late
responses. Timer intervals stay below one day to avoid the platform's long-timeout
overflow; each tick checks the same fixed deadline. No tick renews authority.
Expired cold entries stay closed without opening a runtime.

The policy limits existing nonces, reader-secret versions and signing keys to the
reviewed region, source function, TLS transport and dates. IAM still cannot limit
the signed message contents, enforce a request count, or pin outbound provenance
to one Lambda version. Date expiry does not itself disable invocation.

These are uninstalled source capabilities. Separate reviewed work must register
the caller, bind the numeric cloud version, install and verify permissions and
expiry alerts, coordinate daily closure/recovery, and complete hosted acceptance
before member access opens. Daily member processes retain their 26-hour maximum
and require fresh startup review and a newer serve transition after maintenance.
