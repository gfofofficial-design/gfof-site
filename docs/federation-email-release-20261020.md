# Email-first account release candidate — October 20, 2026

Owner direction: prepare email sign-in as the account launch path while Google
work continues. This candidate is closed by default. It does not open signup,
clear a Safe Browsing warning, mount Alliance profiles or launch financial services.

## Implemented candidate

The account page can request an eight-digit email code and submit it in the same
browser. The server calls the fixed Supabase OTP/verify endpoints with a
publishable key, then independently verifies the confirmed, non-anonymous user
and matching email before issuing the existing Secure, HttpOnly, host-only cookies.
No access or refresh token is returned to page JavaScript. Codes are not placed
in URLs, localStorage, application logs or response bodies.

A random challenge binds the page's request to its ten-minute HttpOnly flow
cookie. Missing, mismatched, duplicate, expired, future or OAuth flow cookies
refuse before verification. One code attempt clears the page's challenge; failed
or uncertain verification asks for a reload rather than retrying automatically.
Provider-side one-time use, expiry and rate limits still require live acceptance.
A cookie is not a durable server attempt counter. Edge throttles are not a global
hard cap and do not prevent callers from reaching the public Auth API directly.

`FEDERATION_AUTH_EMAIL_ENABLED=true` enables this method only in the exact
account context. `FEDERATION_AUTH_EMAIL_SIGNUP_ENABLED=true` separately permits
new-user creation; its default is false. Neither flag is set by this source change.
Existing Google/Apple flags and OAuth flow remain separate. The page stays a
closed test preview until release copy, managed policy and acceptance match.

## Current evidence and limits

The initial email candidate passed 91 local account tests, including 15 new email
handler/page tests. The October 20 Dev reconciliation then passed 100 focused
account tests at commit 5845258; its runtime files are unchanged by the separate
unapplied [email admission candidate](federation-email-admission-20261020.md).
Coverage includes the fixed provider destination, no client signup/redirect
option, origin and direct-function boundaries, neutral eligibility response,
rate limits, flow expiry, wrong/unconfirmed user, malformed session refusal,
HttpOnly-only session issuance, email-only page behavior and stale response refusal.
These are synthetic provider and VM tests. They do not prove real SMTP delivery,
actual OTP one-time use, cookie timing on a real phone, hosted signup-hook behavior
or production acceptance. No email was sent during these tests.

An earlier read-only account-project observation on October 20 found custom SMTP
disabled, a Pro organization and a scheduled backup about thirteen hours old.
Reconcile the later work-computer setup before proposing another sender change;
that earlier observation is not a fresh readback. Older Free/no-backups statements
describe prior observations; the new
backup display alone does not establish restorable Auth coverage, deletion
reconciliation, independent custody or an adopted recovery procedure.

## Required before public email accounts

1. **Sender:** read back the existing sender first, then configure any missing
   independently verified sender and protected custom SMTP credentials under its
   approved scope. Supabase's default mail service is not a public production
   sender. Check SPF/DKIM/DMARC and inbox/spam delivery using an approved test
   address. Do not reuse another product's sender/key without reviewing its scope.
2. **Templates:** install the reviewed `supabase/templates/federation-email-code.html`
   content for both signup confirmation and magic-link email templates, with
   eight-digit OTPs matching the candidate and the reviewed expiry. Suppress
   tracking/link rewriting. Verify the managed project's actual code length;
   the source change does not configure it.
3. **Signup policy:** the existing unapplied `google_only` hook rejects new email
   accounts. Do not attach it or simply enable public signup for this launch.
   Prepare and test its replacement against the actual managed Auth routes.
   Email/password and email OTP use the same email provider: an email-provider
   allowlist must not be described as blocking every direct password signup.
   Phone/anonymous/other-provider rules, confirmation and abuse policy need exact
   acceptance, including hook errors, timeouts and missing privileges.
4. **Abuse and usage:** review Auth send/verify limits and the new ten-per-minute
   per-IP/domain edge rules on both email routes. If CAPTCHA is selected, add and
   test its token/widget path before enabling it; this candidate does not yet
   forward CAPTCHA tokens. Adopt usage thresholds and an operator stop procedure.
5. **Warning:** continue the existing Safe Browsing review independently. Do not
   bypass an interstitial or move the account flow to another hostname to evade
   the warning. Email removes the OAuth dependency, not the site-safety issue.
6. **Actual acceptance:** on a cleared, exact destination, test owner and approved
   disposable new-user sign-in, wrong/expired/replayed code, resend and older-code
   rejection, email normalization, account identity/linking, cancellation/late
   responses, reload, expiry, refresh, logout across tabs and intended phone.
   Verify account-deletion and restored-deletion behavior using the adopted
   protected procedure. Do not log codes, tokens or private account identifiers.
7. **Production:** review the exact commit, canonical origin, managed policy,
   sender, notices, support/retention/backup custody and closed/open flags. Change
   only approved production values, redeploy and repeat actual acceptance before
   exposing account links or inviting users. Preserve public read-only tools.

Alliance member writes also retain their independent database-role, admission,
operator-evidence and restart acceptance. Email-only account login does not
resolve those requirements, open League enrollment or authorize staking/lending.

## Primary references checked

- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/changelog
