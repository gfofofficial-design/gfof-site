# October 8 dev-computer acceptance

The Command Deck is a draft, not a public account or staking release.
Test the isolated PR #99 preview with the existing owner pilot account.
Keep new-user signup closed and Apple disabled.

- Account: https://deploy-preview-99--gfof.netlify.app/account
- Dashboard: https://deploy-preview-99--gfof.netlify.app/command-deck.html
- Draft: https://github.com/gfofofficial-design/gfof-site/pull/99
- Tested functional revision: `4f3cad408e85ca13a0a8470ee4774dc4f76bb459`.
- Automated account, wallet, lock, pricing and staking suite: **111 passed, 0 failed**.
  Boundary, signup-role and signup-auth CI jobs all passed in run
  https://github.com/gfofofficial-design/gfof-site/actions/runs/37805719222.

## Work-computer checks completed

Anonymous HTTP probes on October 8, 2026 at approximately 11:07 AM Chicago.
No credentials, OAuth start, provider login, wallet connection, signup setting
or financial action was used.

| Check | Observed result |
| --- | --- |
| Preview account and dashboard pages | HTTP 200; private/no-store, no-referrer, nosniff, frame denial |
| Page content-security policies | Same-origin scripts/styles/connections; no inline scripts or script attributes; frames, objects, workers and form actions denied |
| Preview account config | HTTP 200; enabled; Google only; no session cookie present |
| Production account config route | HTTP 404; account route not deployed |
| Anonymous session lookup | HTTP 401; no signed-in identity |
| Refresh with foreign Origin | HTTP 403; origin rejected |
| Direct Netlify function config address | HTTP 404; account route unavailable |
| Wallet GET | HTTP 405 |
| Wallet invalid-address POST | HTTP 400; no fabricated zero balance |
| Treasury query parameters | HTTP 400 |
| Treasury request with foreign Origin | HTTP 403 |
| Current treasury read | HTTP 200; finalized slot 454593532; current mint; 30-second shared-cache policy |

Account responses were private/no-store; the tested endpoints did not return
Access-Control-Allow-Origin. These observations cover the named requests and
headers, not every route, provider, browser or abuse scenario. They do not prove
managed signup enforcement, rate-limit activation, operational recovery or an
independent security audit.

Actual anonymous desktop UI checks also confirmed:
- A publicly disclosed lock wallet returned SOL, GFOF and USDC; two supported
  prices and one missing price produced partial coverage, **2 of 3** by asset count.
- GFOF quantity stayed visible despite its missing price.
- Tiny USDC reference value displayed **< $0.01**, rather than $0.00.
- Clear removed wallet results, visit history and price coverage, while leaving
  the separate public lock panel intact.
- Proposed staking comparisons use 1%, 3%, 8% and 12% for the full respective
  terms. Invalid amounts hide the graphs and clear calculated results.

## Tonight: owner acceptance sequence

Use two account tabs in the **same browser profile**. Separate browsers do not
share the cookies or locks this check needs.

1. **Existing Google sign-in.** In tab A, sign in with the existing owner pilot
   identity. Reload and verify it remains signed in. Open tab B at the account
   page and verify the same account appears. Record pass/fail.
2. **Logout across tabs.** Sign out in tab B. Tab A must hide its signed-in
   identity and sign-out button; revisit/reload both tabs and verify neither
   restores that identity. Record whether remote revocation was confirmed.
3. **Provider cancellation.** From signed-out state start Google sign-in and
   cancel before completing it. The account page must remain signed out and
   allow a later attempt. This does not test successful-code replay.
4. **Natural access expiry.** Sign in again and note the time. After the access
   cookie naturally expires (at most one hour), revisit both tabs together.
   Verify refresh/recheck succeeds without conflicting sessions. Then repeat
   logout. The refresh cookie lasts 24 hours; a next-day return may require
   a new sign-in. Do not count a routine reload as an expiry test.
5. **Phantom public address.** On the dev browser with the intended extension,
   use the dashboard's Phantom button and review its public-address request.
   Confirm the returned address matches the extension and displayed quantities
   match the same address. This flow must request no message signing or
   transaction. Test Clear/disconnect and manual address entry.
6. **Real phone.** Open the same preview on the phone. Check navigation, Google
   return, inputs, term selection, graph labels, Clear and public lock links.
   Verify narrow-screen layout and touch/keyboard use. Desktop results do not
   satisfy this step.

Record browser/device, time, functional revision, expected vs observed behavior,
and pass/fail. Use a failure description rather than copying callback codes,
session cookies or credentials. A new commit affecting the tested behavior
requires rechecking that behavior.

## Still separate release gates

Successful-code replay, real provider expiry/failed refresh, managed new-Google
signup versus direct Email/password/OTP rejection, owner recovery preservation,
and managed hook deadlines remain separate integration evidence.
Follow [the account operations matrix](federation-account-data-operations.md#isolated-acceptance-matrix),
[tab coordination acceptance](federation-account-tab-coordination-20261008.md)
and [security release gates](federation-security-release-gates.md).

The one-owner encrypted restore drill is not a repeatable/off-site operating
backup program. Monitoring, privacy/deletion procedures and required independent
review remain release work. Sign-in does not prove wallet ownership or grant
financial eligibility.

No staking pool is open. The six-month 8% is a proposed gross **full-term**
planning target, not APY. Provider selection, funding, fees, caps, eligibility
and exits are unresolved. The three public Streamflow locks are not evidence
of a funded staking pool. Lending remains a private prototype.

Keep PR #99 draft until its required evidence and release decision are complete.
