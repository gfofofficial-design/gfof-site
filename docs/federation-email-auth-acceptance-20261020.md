# Disposable email Auth acceptance

This is an isolated CI fixture, not a hosted rollout or production sign-in test.
`tests/federation-email-signup-auth.mjs` installs the **unapplied** email-provider
candidate into its own empty PostgreSQL17.11 database, then runs actual Supabase
Auth v2.197.0 and Mailpit v1.31.4. A BusyBox1.37.0 static server supplies a minimal
eight-digit code template. All three child containers use one newly created
internal Docker network, no published ports and no outbound mail relay. Images
are explicitly versioned; the image pulls happen before that isolated run.

The runner refuses absent confirmation, any database/image/version mismatch,
pre-existing Auth/candidate objects or roles, public addresses, published ports
and unexpected networks. It accepts only the CI PostgreSQL container ID, not a
database URL, real password, API key or account. Generated fixture credentials,
codes and session tokens stay in memory or disposable services, never output
payloads or artifacts. Reserved `example.invalid` recipients are used. Mail is
read only from the sink and bound to one exact recipient and one eight-digit code.
The fixture permits at most400 HTTP calls including bounded readiness/mail
observations and120 SQL submissions; signup/verification operations are not retried.

## Checks

The finite sequence checks actual API status **and** aggregate users/identities,
mail deliveries, confirmation and session effects:

- Attach the rule with signup closed; direct new password signup stays refused.
- With fixture signup open, malformed email and unavailable phone/Google requests
  cannot create accounts or mail. Other-provider payload decisions are separately
  tested by the native SQL fixture; this is not real Google/Apple OAuth acceptance.
- New email OTP creates an unconfirmed synthetic account and delivers one real
  sink message. A wrong code creates no session. The received code confirms the
  exact account; replay creates no extra session. Applicant role/provider metadata
  cannot change Auth's authoritative provider or authenticated role.
- Direct password signup is also admitted by this provider rule, but cannot log
  in until email confirmation. The actual confirmation code and subsequent
  password login work. **This does not implement or prove an OTP-only policy.**
- An unconfirmed fixture account's sent timestamp is explicitly backdated601
  seconds. Its actual code is rejected by the ten-minute expiry predicate without
  session creation or confirmation. This is not a ten-minute wall-clock test.
- With signup closed again, the existing OTP account can request a code using
  `create_user:false`, confirm the same identity and log out. An unknown address
  creates no account or email. No global admission opening is needed for this
  existing-account path.
- The confirmed password account receives recovery mail while signup is closed.
  The recovery code works once, password update succeeds, old password fails and
  a fresh login with the replacement succeeds. Logout rejects refresh reuse.
- The actual application handler then talks to these same services through an
  injected test transport. Only its fixed synthetic Supabase origin and five
  reviewed Auth paths map to the owned internal service; no real hosted request
  occurs. Received code verification, independent user lookup, host-only Secure
  HttpOnly cookies, session/refresh/logout and refresh rejection pass through the
  unchanged handler. Unknown-address start remains neutral/no creation or mail.
  An explicitly advanced test clock refuses an expired flow before provider I/O.
  Foreign-origin/direct-function/unsigned failures make no provider call.
- Missing function EXECUTE, schema USAGE or the selected function, and a synthetic
  runtime error all fail closed. A fixture-only two-second PostgreSQL statement
  deadline cancels a three-second hook and creates no user/mail. This explicit
  cancellation does not establish managed Auth's default hook deadline.
- Restore the exact source function and admit one final synthetic OTP request;
  close signup and verify four users/identities and eight sink messages total.
- Remove and independently inspect absence of the three child containers and
  internal network. The dedicated PostgreSQL service is removed by CI teardown.

Local contract tests check the target/network/recipient/code guards and default
refusal. Actual Auth execution requires Docker in CI; a source/unit pass alone is
not reported as an HTTP/mail pass. Matching commit/run outcomes are recorded only
after completion, not inferred from an earlier Google-rule run.

## Remaining production and accessibility gates

The template and generated users are synthetic. This proves neither inbox delivery
nor a real sender/domain's reputation, hosted eight-digit/expiry settings, abuse
limits, account linking, restored deletion protection or SMTP recovery. Reconcile
the existing sender configuration before duplicating keys or asking for resets.
The actual handler is invoked, but simulated events/cookie headers do not prove
a browser accepts the attributes, applies cookie expiry or interoperates with
real device storage/assistive technology. Actual composed browser acceptance remains.
No managed hook, signup setting, feature flag or cloud account is changed here.

Keep the exact destination's Google warning unresolved until actual clearance;
never bypass its interstitial or use another hostname to evade it. A hosted
installation or temporary signup test needs its own exact-target decision with
current backup/recovery, identity, usage, retention and stop/cleanup evidence.
Review native password routes explicitly before public new-user admission.

The plain synthetic mail keeps the code in selectable text; it is not the final
email design or an assistive-technology test. The real page must preserve paste,
autofill, labels, keyboard focus, clear non-enumerating errors and cancellation.
Do not announce success before confirmation or restore data after cancellation.
Screen-reader/mobile/zoom and actual inbox checks remain; no WCAG claim follows
from SQL, fixture HTTP or unit tests.

Primary contracts checked October20,2026:

- [Supabase passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Before User Created event](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [Pinned Auth configuration](https://github.com/supabase/auth/blob/v2.197.0/internal/conf/configuration.go)
- [Pinned code verification](https://github.com/supabase/auth/blob/v2.197.0/internal/api/verify.go)
- [Mailpit API](https://mailpit.axllent.org/docs/api-v1/)
