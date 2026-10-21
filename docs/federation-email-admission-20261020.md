# Email account admission candidate

Status: unapplied source and disposable-test candidate. No hook is attached by
this change; signup, provider settings, sender, limits and account flags are
unchanged. The old Google-only migration is preserved. Existing-account email
sign-in and new-user admission are separate release decisions.

## Proposed creation rule

`sql/federation-email-signup-candidate.sql` defines a new private schema and
`email_provider_only(jsonb)` function. It accepts the documented Auth event only
when the provider and provider list identify email, the user is explicitly
non-anonymous, an email is present, and no phone is present. It ignores
applicant-controlled user metadata for admission authority. It returns the same
generic denial for malformed, missing, phone, anonymous or other-provider events.

The email check is a small shape guard, not a complete email-address validator;
Auth's own validation remains required. The candidate does not normalize or
rewrite addresses. The provider-list shape is pinned to the documented new-user
contract; a managed variation must stop acceptance and be reviewed rather than
silently broadening the rule. An accented local-part fixture does not prove
delivery, SMTP internationalization or support in the current page's validator.

The function has an empty search path and SECURITY INVOKER. Only the existing
Auth role receives schema USAGE/function EXECUTE; public, anon, authenticated and
service_role receive neither. No table, new login, network call, key lookup or
application-role grant is introduced. Existing-schema collisions fail instead of
replacing unknown objects.

## What this does not enforce

Email OTP and native email/password creation share the email provider. The hook
cannot infer which request path was used from this event. It is **not an
OTP-only barrier**, invitation list, total account quota, account linking policy
or ongoing session authorization. Client user metadata is never a role grant.
Administrative account-creation paths and existing-user updates/linking require
separate acceptance; do not assume this creation hook covers them.

Before public email accounts, the owner must explicitly accept the policy for
direct email/password routes or approve a separately proved alternative. Keep
managed email confirmation enabled and require confirmed non-anonymous users in
the server session check. A new user is not confirmed when the creation hook
runs, so the hook does not demand a pre-existing confirmation timestamp. Public
signup stays off until this distinction and all acceptance gates are resolved.

## Abuse and delivery boundaries

Keep `FEDERATION_AUTH_EMAIL_SIGNUP_ENABLED` false for existing-account tests.
The server passes `create_user:false`; clients cannot override it through the
page request. This application flag alone cannot stop requests made directly to
the public Auth API. Managed signup restrictions and provider rules are separate.

The documented per-IP Auth limits see the server's outbound address when requests
are proxied. The current publishable-key handler does not qualify for privileged
IP forwarding. Do not add a secret key or increase provider limits merely to
avoid throttling. The edge ten-per-minute rule is not a shared provider spending
ceiling. Adopt actual sender limits, cross-route usage thresholds and an operator
stop procedure before enabling new-user admission. If CAPTCHA is selected, the
current handler needs a reviewed token path and accessible fallback first.

Actual SMTP/sender and eight-digit code settings must be read back against the
work-computer setup before proposing changes. Do not create replacement keys or
repeat setup based on a stale observation. Align provider expiry with the page's
ten-minute flow, accounting for recovery/invitation links sharing that setting.
No live email or API call was made during these source tests.

## Acceptance and rollout order

1. Keep both managed signup and the application's new-user flag closed. Review
   the chosen admission policy, exact project identity, existing hook and sender.
2. Run the candidate rule/ACL fixture on disposable PostgreSQL17.11 in CI. Local
   PostgreSQL18.6 is supporting evidence, not managed Auth proof. No actual Auth
   service is available in the local fixture.
3. Prepare a separately bounded real Auth/mail-sink acceptance covering OTP and
   password routes, unconfirmed access, replay/expiry, malformed requests, fake
   metadata, unsupported providers, existing-account continuity and hook
   error/timeout/missing-grant behavior. Count actual inserted users and mail;
   an HTTP error alone is not sufficient evidence. The old Google-only Auth
   fixture is not evidence for this different candidate.
4. Only after exact-target approval and current backup/recovery checks, install
   and attach the reviewed function while managed signup is closed. Independently
   verify grants, configured hook and unchanged existing accounts/settings.
5. Run only the specifically approved temporary acceptance window and cleanup.
   Google's warning must be resolved on the exact destination before real sign-in
   testing. Do not bypass an interstitial or change hostname to evade it.
6. Review mobile/assistive behavior, email/code sender identity, linking/deletion,
   restored-deletion protection, retention/support notices, usage budgets and
   current release evidence before a separate production/signup decision.

On failure, close managed signup first; then inspect and reconcile the exact
hook/state before an approved rollback. Removing a hook while signup is open can
remove the admission restriction. Do not automatically recreate users or retry
uncertain email verification. No cloud rollback is authorized by this source.

## Accessibility and current evidence

The policy does not add a puzzle or a new user step. Preserve code paste,
autocomplete, keyboard labels, readable errors, cancellation and the existing
late-response safeguards. Generic eligibility messaging avoids revealing account
existence; provide a clear non-enumerating support path. Automated/SQL checks do
not establish screen-reader, mobile, deliverability or WCAG conformance.

The fixture evaluates39 provider/shape cases plus SQL NULL under restricted Auth
execution, least privilege, four public/application-role denials, two missing
permission denials, restored grants and complete transaction rollback. Local
unit checks cover offline loading, safe default refusal and the explicit method
limitation. Current matching CI and managed Auth results must be recorded after
they actually run; this document does not claim them in advance.

Primary references checked October20,2026:

- [Before User Created hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [Passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Auth rate limits and IP forwarding](https://supabase.com/docs/guides/auth/rate-limits)
- [Auth hooks permissions and errors](https://supabase.com/docs/guides/auth/auth-hooks)
