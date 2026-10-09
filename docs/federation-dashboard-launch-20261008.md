# Federation dashboard — Google-first launch packet

Prepared October 8, 2026 for draft GFOF PR #99. The owner asked to prepare the
dashboard for release. **This packet is not a release approval.** Production
account routes and public registration remain off; the applicable requirements
in [the security release gates](federation-security-release-gates.md) still apply.

## First release scope

- Google sign-in and a Federation account record, with a clear privacy notice.
- The Command Deck's explicit public-wallet balance read, supported reference
  prices, asset filter and visit-only observation history.
- Read-only current-mint lock records and a calculator for proposed staking
  terms. No staking pool or lending service is opened by this release.
- Local Explorer Passport progress. Sign-in does not synchronize that progress
  or attach wallet addresses, balances, entitlement or financial positions to an
  account. A public address read does not prove ownership.
- Optional Phantom permission to share a public address, without signatures.

Apple is deferred. Dossier remains a separate public tool; a Federation account
does not save, unlock or authorize its reports. The first release has no payment
checkout, automatic trading, token movement or wallet-ownership association.

## Evidence available

The preceding draft head `9363217665ea7009c979f82988c8bd522ac43b1c` passed the
combined 140 focused account, wallet, pricing, locks and proposed-term tests.
On October 8–9 the exact PR #99 preview also completed owner Google sign-in,
two-tab view, cross-tab logout/reload, provider cancellation and natural refresh
after more than one hour. These are one-profile observations, not public-user
or production-domain acceptance.

The owner reported that the wallet input, asset table and term controls were
usable on a physical phone, with Phantom installed. The owner later reported
that public-address permission, balance read and disconnect worked inside
Phantom's browser with no signature request. That normal-path report does not
prove rejection, cancellation, account change or independent quantity parity.
The private recovery
drill restored a current encrypted Auth export to a separate Supabase project
and verified a fresh source/target password login and owner-ID match.

This draft corrects the preview-only wallet host restriction: the handler now
accepts only the PR #99 preview and `https://galacticfederation.co`, with each
request's Origin confined to its own serving host. Regression tests reproduce
the old production rejection and reject cross-host, direct-function and
lookalike-host calls before RPC work. No production request is claimed tested
until the approved code is actually deployed there.

The revised local suites passed **141 tests**: 133 account/dashboard/wallet/
pricing/locks tests plus eight bounded-server-read regressions. This is local
code evidence, not managed signup, production or real-wallet acceptance.

One subsequent bounded trial in the separately approved temporary managed
Auth project passed new Google creation, PKCE/user read, consumed-code
rejection, refresh/user match, local logout and old-refresh rejection on Auth
v2.197.0. Ten instrumented Auth calls were made. Registration was closed within
the approved window and independently verified; the receiver was stopped.
Aggregate postflight showed one Google user/identity and no public tables.
This closes the managed allowed-path portion only. Non-Google creation denials,
fault/deadline behavior and the remaining release gates are still unfinished;
see [the isolated trial record](federation-managed-signup-trial-20261008.md).

## Cost and availability decision

The signed-in Supabase organization checkout on October 8 shows **$25 due
today and an estimated $35/month** with the Account Pilot and Restore Drill
both active. No upgrade was confirmed and no payment method was added.

Supabase lists Pro from $25/month, includes $10/month of compute credits, and
charges separately for each active project. The additional retained recovery
project explains the checkout estimate. Project compute is not covered by its
spend cap. A new temporary managed-signup project would add usage for its
active time and needs its own bounded cost/creation approval; do not describe
$35 as a guaranteed all-in ceiling for extra projects or usage.

Pro avoids Free's inactivity pausing and adds daily recovery backups, but a
subscription does not prove a restore, deletion reconciliation or monitoring.
Before payment, the owner must approve the shown recurring amount and complete
the private billing fields. This packet does not authorize a card charge.

**Later verified state:** the owner reported that the upgrade was already
completed. A fresh organization read and billing-page reload confirmed Pro,
both existing projects healthy and the spend cap enabled, with $34.94 projected
for the current cycle. The assistant submitted no payment. Do not repeat the
purchase. The current project-cost tool quotes $10/month for an additional
active project; [the isolated trial packet](federation-managed-signup-trial-20261008.md)
requires separate creation/cost approval.

References: [pricing](https://supabase.com/pricing),
[compute billing](https://supabase.com/docs/guides/platform/manage-your-usage/compute),
[Free pausing](https://supabase.com/docs/guides/platform/free-project-pausing),
[backups](https://supabase.com/docs/guides/platform/backups).

## Remaining release work, in order

1. Review the exact combined commit and hosted preview, including the production
   wallet host fix and privacy link. Record current checks and any findings.
2. Complete the remaining physical-device Phantom rejection, cancellation,
   account-change and quantity-parity checks, plus a separate phone Google
   round trip. The owner-reported normal address/disconnect path passed; no
   signatures or token transfers are needed.
3. Finalize the operating plan and check current billing. Verify administrator MFA for
   GitHub, Netlify, Supabase and domain/DNS access without collecting recovery
   codes. Establish a backup cadence, custody and deleted-account reconciliation.
4. In a **separately approved disposable managed Auth project**, prove the
   Google-only signup rule and restricted grants. Keep both existing projects
   and the live site unchanged. The detailed acceptance matrix is in
   [data operations](federation-account-data-operations.md#isolated-acceptance-matrix).
   A new Google account must be created successfully; direct Email/password and
   OTP creation, forged provider metadata and hook failures must create neither
   users nor mail. Existing sign-in must remain usable. Record the managed Auth
   version, actual timeout behavior and exact rights, then close signup first
   and remove only the approved test target/settings.
5. Rehearse verified deletion requests and recovery reconciliation, finalize
   the retention/response procedures, and configure minimal actionable alerts
   with a tested failure and recovery notification. Prepared monitor files are
   not a running service.
6. Prepare exact production Google credentials, callbacks, origin, cookie and
   provider settings. Keep registration closed while verifying the canonical
   production setup; preserve rollback and existing owner access. Only then
   request the exact public release and registration approval.

## Production configuration to review

The site's account function already requires the configured serving origin and
uses same-origin POST checks, bounded provider calls, PKCE/state and Secure
HttpOnly host cookies. Production Netlify Functions would need:

| Variable | Production value / handling |
| --- | --- |
| `FEDERATION_ACCOUNT_ENABLED` | `true` only in the approved production activation; absent/false otherwise |
| `FEDERATION_ACCOUNT_ORIGIN` | `https://galacticfederation.co` |
| `FEDERATION_AUTH_URL` | Exact reviewed Supabase Auth project origin |
| `FEDERATION_AUTH_PUBLISHABLE_KEY` | That project's publishable key, set in Functions configuration; no admin/service-role key |
| `FEDERATION_AUTH_GOOGLE_ENABLED` | `true` after the reviewed Google configuration works |
| `FEDERATION_AUTH_APPLE_ENABLED` | absent/false for this release |

Supabase's production redirect allowlist should add only
`https://galacticfederation.co/api/federation-account/callback?state=*`.
Google's client redirects to that Supabase project's exact
`https://<project-ref>.supabase.co/auth/v1/callback`, not directly to the
Federation page. Keep preview configuration scoped to the exact PR #99 origin;
do not use wildcard site domains or expose a Google secret to browser code,
Netlify, Git or this packet. The published Google app/audience and production
client need review; a test-only client is not general public login readiness.

Before opening signup, record the deployed revision, successful production
owner sign-in/logout and origin rejection, the attached Google-only rule and
its permissions, monitoring, recovery point and current spending baseline.
If any check fails, close signup first, disable production account entry and
return to the last reviewed configuration. Do not disable the owner's tested
recovery route or change financial services as part of this rollback.
