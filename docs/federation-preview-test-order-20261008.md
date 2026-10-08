# October 8 preview acceptance run sheet

Use the existing owner pilot on the dev computer. This is a test sequence for the
draft Command Deck, not a release approval.

- [Account preview](https://deploy-preview-99--gfof.netlify.app/account)
- [Command Deck preview](https://deploy-preview-99--gfof.netlify.app/command-deck.html)
- [Draft PR #99](https://github.com/gfofofficial-design/gfof-site/pull/99)

## Current code evidence

Functional revision: `b8b211e8837af62a401425b0290d94229acdb22c`.
The combined account, dashboard, wallet, pricing, lock and staking suite passed
**127 tests, 0 failures** locally. Boundary, signup-role and signup-auth jobs
passed in [CI run 37818297302](https://github.com/gfofofficial-design/gfof-site/actions/runs/37818297302).
The Netlify preview build succeeded.

Desktop preview checks confirmed asset filtering and Show all assets using a
publicly disclosed wallet. Filtering changed the visible table rows while
preserving the priced subtotal and coverage. These checks do not substitute for
real Google sign-in, Phantom or phone acceptance.

The earlier [acceptance record](federation-dev-acceptance-20261008.md) describes
its own historical revision and observations. Its 111-test count is historical;
use the functional revision above for this run.

## Run the longest wait first

| Order | Action | Pass condition |
| --- | --- | --- |
| 1 | Sign into account tab A with the existing owner Google identity. Note the time; open account tab B in the same browser profile. | Both show the expected account after reload. |
| 2 | While the session ages, open the dashboard and use Phantom's public-address connection. | The displayed address matches Phantom. The request is for an address only; no signature or transaction is requested. |
| 3 | Read balances, filter by GFOF and a mint fragment, then choose Show all assets. | Matching rows appear; all rows return; subtotal and coverage do not change because of filtering. An unmatched query says no matching assets. |
| 4 | Use Clear, manually enter an address, refresh, edit the address and disconnect Phantom. | Old wallet results and visit history clear on edits or Clear. Clear explains whether a Phantom connection remains open; Disconnect ends it or shows that disconnection could not be confirmed. |
| 5 | Check the three public locks and four proposed terms. | Locks remain separate from personal holdings. The six-month illustration uses 8% for the full term; invalid amounts clear calculated results. |
| 6 | On a real phone, open the preview and test navigation, Google return, inputs, filter, terms, Clear and lock links. | Controls and labels are readable and usable with touch and the phone keyboard. No sideways page scrolling is needed for the main form. |
| 7 | After natural access expiry, revisit both account tabs together. | Both recheck/refresh without contradictory account states. Record elapsed time; a routine reload before expiry does not satisfy this check. |
| 8 | Sign out in tab B; revisit/reload tab A and B. | Neither restores the signed-in identity. Record the displayed result of remote revocation. |
| 9 | From signed-out state, start Google sign-in and cancel before completing it. | The page stays signed out, and another attempt remains available. |

Account tabs must use the same browser profile for the shared-cookie and tab
coordination check. The phone is a separate session; its sign-in does not prove
desktop tab coordination.

If a failure stops a step, record it and continue independent checks. Do not
count the blocked step as passed. If a deployment changes relevant behavior
during the run, repeat the affected checks on the new functional revision.

## Record each result

Copy this small record for each step:

- Step:
- Browser and device:
- Functional revision:
- Chicago date/time and elapsed time, when relevant:
- Expected:
- Observed:
- PASS / FAIL / NOT RUN:

Record behavior, not credentials, callback codes, session cookies or recovery
secrets. A screenshot may show the public dashboard state; redact private
account details before sharing it.

## What this run can establish

These results close only the named hands-on acceptance checks. They do not
complete the separate provider, recovery, monitoring, privacy or independent
review gates in [security release gates](federation-security-release-gates.md)
and the [original acceptance record](federation-dev-acceptance-20261008.md).

Keep PR #99 draft. Staking remains a planning illustration pending bonding and
provider details; lending has no live service. A passing dashboard check does
not authorize deposits, signup expansion or production release.
