# Federation release checkpoint — October 8, 2026

This checkpoint separates completed work from acceptance still required for the
draft Command Deck and account pilot. It is not a release approval or audit.

Review branch revision: `c826e68ac1ddf32b83dcc3c2ea00857be7b64886`.
Latest functional dashboard revision: `b8b211e8837af62a401425b0290d94229acdb22c`.
Production remains at `50be6258473374b46887da9605f177cc98d3c757`.

## Completed from the work computer

The functional revision passed **127 combined tests** locally. The later
documentation-only revision passed
[CI run 37818935134](https://github.com/gfofofficial-design/gfof-site/actions/runs/37818935134)
and its Netlify preview build.

Anonymous hosted checks completed at approximately **2:38 PM Chicago** on
October 8. No OAuth flow, credentials, wallet permission, signup setting or
financial action was used.

| Request | Observed result |
| --- | --- |
| Dashboard `/command-deck.html` | 200; private/no-store; no-referrer; nosniff; frame denial; restrictive same-origin CSP |
| Dashboard `/command-deck` alias | 200; same protections |
| Account page | 200; same protections |
| Pilot account configuration | 200; Google available; no session cookie supplied |
| Anonymous session | 401; private/no-store |
| Refresh with foreign Origin | 403; private/no-store |
| Wallet API via GET | 405; private/no-store |
| Production account configuration | 404; account API remains unpublished |

None of these responses exposed an Access-Control-Allow-Origin header. These
observations cover only the named requests. They do not prove administrative
MFA, live-provider behavior, all abuse scenarios, or an independent audit.

Earlier desktop preview checks confirmed public wallet reads, partial price
coverage, asset filtering with unchanged totals, Clear, source links, public
locks and the proposed-term calculator. Fictional leaderboard entries remain
labelled; no live staking or lending service is implied.

## Tonight: actual device acceptance

Use [the current run sheet](federation-preview-test-order-20261008.md), starting
sign-in before the other checks so the session can age naturally.

| Item | Evidence still needed |
| --- | --- |
| Google sign-in | Existing owner sign-in, reload and cancellation on the current preview |
| Sessions | Natural access expiry, simultaneous tab rechecks and cross-tab logout |
| Phantom | Real address permission, rejection, pending cancellation, account change and disconnect; independently compare the same address's quantities |
| Phone | Real touch/keyboard layout, provider return, inputs, filters, graph labels and clearing behavior |

Record actual results as PASS, FAIL or NOT RUN. A successful ordinary reload
does not prove expiry. Synthetic provider tests do not prove real extension
behavior.

## Separate release requirements

The [security release gates](federation-security-release-gates.md) remain the
authority for release scope. Administrative access/recovery confirmation,
privacy and deletion procedures, sustainable recovery and availability,
monitoring and response, and the applicable integration review still require
evidence. Public registration additionally needs the isolated managed signup
allow/deny and existing-owner recovery checks.

Tonight's device tests alone do **not** complete those requirements.
If a narrower initial release is proposed, define and review that exact scope
before approving its commit; do not silently waive account or financial gates.

Staking waits on bonding and provider details, including funding, fees and exit
terms. The six-month 8% remains a proposed full-term planning target. Lending
has no live service. The Streamflow disclosures do not establish staking
positions or a funded reward pool.

## Decision

Keep [PR #99](https://github.com/gfofofficial-design/gfof-site/pull/99) draft.
Complete applicable evidence, resolve blocking findings and obtain the specific
production release decision before merging or changing account settings.
