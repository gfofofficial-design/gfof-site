# Alliance and account runtime security maintenance

The [October21 Node security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
fixes TLS/hostname, DNS, Brotli and other issues in maintained release lines.
An affected version alone is not evidence of a reachable exploit or compromise.

Alliance review workflows now select exact **24.22.1**, and existing account/static
review workflows keep their22 major with exact **22.23.4**. Major-only selectors
could resolve to an earlier cached patch. This change updates no dependency,
cloud privilege, application mode, credential or UI. Existing tests and actual
TLS/PostgreSQL fixtures run against the selected versions; acceptance must use
their current-head results rather than earlier green runs.

Netlify's repository build configuration selects24.22.1 for future builds. This is
a build-version pin, not proof that a deployed Function uses that exact patch.
The managed Functions runtime follows the selected supported build major unless
overridden, and provider runtime patching must be confirmed separately. No
AWS_LAMBDA_JS_RUNTIME setting is added or changed here. See
[build dependency version selection](https://docs.netlify.com/build/configure-builds/manage-dependencies/)
and [Functions runtime selection](https://docs.netlify.com/build/functions/configuration/#nodejs-version-for-runtime).

Production publication and actual managed-runtime security acceptance remain
separate release steps. The change introduces no interaction, timer, telemetry
or secret-entry burden. Existing account/member cancellation, readable error and
draft-preservation behavior remains subject to its normal acceptance; a runtime
patch cannot establish assistive-device compatibility or WCAG conformance.
