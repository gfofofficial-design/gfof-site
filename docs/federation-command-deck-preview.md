# Command Deck working preview

PR99 only. No production merge or financial activation.

The wallet form sends an explicitly entered public address through a bounded, same-origin POST to Solana mainnet public RPC. It accepts only a decoded 32-byte base58 address, fixed RPC methods and endpoint, and aggregates exact integer token quantities across the Token Program and Token-2022. No account cookies, wallet signatures, transactions, metadata logos or account-wallet association are used. UI output uses textContent. The address is not placed in a query URL or stored by application code; hosting/RPC operational logs may still exist.

The handler accepts only the exact PR99 origin and API route, rejects direct function paths, caps request/response sizes, applies an eight-second RPC-stage deadline (reference pricing has a separate four-second deadline), and returns no partial balance on errors. Netlify permits six requests per minute per IP/domain. This is abuse friction, not a spending cap; the public RPC can rate-limit or deny traffic and is unsuitable as a production availability guarantee. No paid provider has been configured.

Native SOL is separate from token mints. Unknown tokens are labelled unverified with their mint, zero-balance token accounts omitted, unsupported prices unavailable. These reads are not one atomic slot; locked/provider-held positions and spendability are not established. The previous sample allocation has been replaced with a neutral token count ring. The priced allocation chart now derives from fetched quantities and available Jupiter reference prices. Historical performance is unavailable; the leaderboard remains explicitly illustrative.

Explorer badges read the existing optional local Passport without writing or linking it to the signed-in account. They are not trustworthy evidence for a public leaderboard. Staking terms remain proposed, not open, and refer to total gross term rewards rather than APY.

Validation: five focused wallet tests cover decoded address length, exact precision, host/origin/direct-route/payload rejection without upstream calls, both-program aggregation, and fail-closed upstream errors. Browser script syntax passed. Hosted validation results will be appended after actual lookup checks.

Sources consulted 2026-10-07: https://solana.com/docs/rpc/http/getbalance ; https://solana.com/docs/rpc/http/gettokenaccountsbyowner ; https://solana.com/docs/references/clusters .

## Hosted checks

The deployed page loaded its read-only form and actual no-saved-Passport state. A lookup of the public GFOF mint address (not a holder wallet) returned SOL 0.0010668 and zero token accounts, with a displayed observation time and unverified ownership label. The System Program address lookup returned service unavailable; no old or partial balances were displayed. This verifies a hosted success and failure path, not production uptime or populated-holder coverage. Eight focused backend/frontend tests pass, including invalid inputs without requests and Clear suppressing a late response. Public RPC availability remains a launch concern.

## Reference pricing update

Jupiter Price V3 is queried once, without an API key, for SOL and up to 49 token mints. The request has a four-second timeout and 100 KB response cap. It sends mint IDs, not the owner address. Missing, non-positive, malformed, decimal-mismatched or out-of-window prices are excluded. The freshness window is at most 9,000 blocks behind the SOL balance slot, with up to 150 blocks ahead allowed for separate query timing. It is a conservative display check, not an exact age or execution-price guarantee. Unsupported or beyond-limit assets remain visible as quantities.

The estimated subtotal and allocation bars cover priced nonzero holdings only. They do not represent historical returns or necessarily the full portfolio. Reference dollar arithmetic is approximate; exact token quantities are unchanged. A pricing outage does not discard the balance response. Public RPC and keyless Jupiter limits still preclude a production availability guarantee.

Validation: 12 focused tests pass, including price omission, freshness/decimal checks, one-request/50-mint cap, outage behavior and priced allocation retaining unpriced quantities. Hosted API returned 200 with SOL quantity and a supported Jupiter SOL price for the public GFOF mint-address test. Official documentation: https://developers.jup.ag/docs/price and https://developers.jup.ag/changelog/developer-platform .

## Personal mission collection

The dashboard now renders the existing eleven Passport missions as badge cards with remembered/unknown/explore text, an optional local progress meter, next incomplete mission and replay links. Read and Refresh never enable saving, write progress, associate badges with sign-in or call a backend. Unavailable storage is explicitly unknown. Saving preferences remain in Explorer Passport. Rank language is replaced with Passport progress; public leaderboard sample entries remain fictional. All mission links were matched to existing journey HTML files on the review branch. Fourteen focused wallet, price and dashboard tests pass, including local progress without writes/network and unavailable storage.

## Visit-only SOL history

Manual successful reads of the same address now add up to twelve distinct timestamped native SOL quantities to a table and SVG line. The x-axis reflects observation timestamps and the y-axis the observed SOL range; a flat balance remains a flat line. A single reading does not fabricate a line. These are balance observations, not return calculations: transfers and fees can alter the balance. No automatic polling, browser persistence or cloud record is introduced. Reload, Clear, address change or lookup failure resets the series. History excludes token balances and provider-held positions. Sixteen focused tests pass, including actual repeat reads, Clear, address separation and failure resets.

Hosted history check: two manual reads of the public GFOF mint address at 15:16:08 and 15:16:27 CDT both returned 0.0010668 SOL. The page showed both exact observations and a flat line, explicitly labelled balance change rather than investment profit. The first reading alone showed no fabricated line.

## Proposed-term calculator

The Staking Bay now compares the same 1-month/1%, 3-month/3%, 6-month/8% and 12-month/12% gross total-term planning targets as the staking page. It uses integer arithmetic with rewards rounded down to six decimal places. The example principal is user-entered, unrelated to the wallet, and no account, provider, signature or transaction request occurs. It presents no APY, dollar forecast, compounding, eligibility, lock proof or reward guarantee. Invalid input clears the results and hides the proportion meter. Three calculator tests pass covering term comparison, invalid-input clearing and exact downward rounding.

## Request cancellation hardening

A regression test reproduced old results returning after Clear during asynchronous JSON decoding. The UI now rechecks its request generation after decoding, not only after response headers. Address input changes abort the current request, clear balances/valuation/history and release the button immediately. A separate 20-second client deadline aborts stuck fetch/decoding and displays a timeout. Twenty-one focused dashboard/wallet/price/calculator tests passed after the fix; the additional injected-timer deadline regression passed separately, bringing the covered total to 22. These are usability/privacy correctness checks, not a full security audit or production launch approval.

## Optional Phantom address import

The page adds a user-triggered `window.phantom.solana.connect()` flow to read the provider's public key and submit the existing read-only balance form. There is no eager reconnect, message signing, transaction request, seed/private-key handling, cross-account association or ownership proof. Missing-provider and rejection paths preserve manual entry. Account changes clear previous displayed data through the existing input event and require a manual read of the newly selected account. Clear during an unresolved permission request suppresses its eventual result and attempts disconnect. Disconnect preserves manually entered watch addresses. Disconnecting is distinct from revoking Phantom trusted-app permission; the UI directs users to manage that inside Phantom.

Five provider-mock tests passed: explicit-only connection; unavailable/rejected fallback; late-result cancellation; account switching without automatic lookup; and disconnect/watch-address behavior. These do not verify actual Phantom approval UI, extension behavior, mobile injection, or provider domain reputation. A real dev-computer Phantom approval, rejection, account switch and disconnect check remains required before this feature is considered validated for public launch. No wallet was connected by the agent and no financial action occurred.

Official docs consulted 2026-10-07: https://docs.phantom.com/solana/establishing-a-connection and https://docs.phantom.com/solana/detecting-the-provider .

## Consolidated readiness check

All 27 focused dashboard, wallet, reference-price, staking-calculator and Phantom-provider tests passed together after moving the pricing helper to `netlify/lib/wallet-prices.cjs`. Only the wallet handler is a function entry point; pricing remains an internal dependency.

### Dev-computer checks remaining

1. Open the PR99 preview with Phantom available. Confirm no wallet prompt on page load, then explicitly import a public address. Approve only address access; this feature should never request a signature or transaction.
2. Reject an address-access request and confirm manual entry remains usable. Clear while approval is pending and confirm a later result cannot restore the cleared address.
3. Switch Phantom accounts and confirm previous quantities and history disappear; manually read the new account. Disconnect and check the address source clears while a manually entered watch address is preserved.
4. Compare SOL and populated Token Program / Token-2022 quantities with an independent explorer. Unknown mints must stay visibly unverified. Check empty, unpriced and unavailable states.
5. Check a narrow phone viewport for readable chart labels, usable term buttons, address input and mission cards.
6. Complete the separate local account-registration test and recovery evidence already tracked in the account review. Public signup remains disabled; this dashboard does not associate wallet addresses with signed-in accounts.

These checks are pending, not completed evidence. The leaderboard is illustrative, staking rates are proposed total-term targets, and lending remains a private prototype. Real-provider checks, account launch gates, availability/cost decisions and approved financial terms remain required before public activation.

## Keyboard and responsive-layout improvements

Added a first-stop skip link to the focusable main dashboard, enlarged panel links to at least 44 pixels, labelled each priced-holdings meter with its asset/share/value, and exposed the token-count text as a labelled group rather than hiding it inside an image role. Narrow-screen CSS now reduces the title seal, allows the title column to shrink, stacks calculator results and wraps long labels/buttons.

All 27 existing focused tests passed after the changes. On the hosted desktop preview, Tab focused the new skip link first and DOM measurements found no dashboard links below 44 pixels. Token-count text appeared in the accessibility tree. Browser credential-protection restrictions prevented observing the final Enter activation of the skip link; that activation and an actual narrow phone viewport remain pending manual checks. Responsive CSS changes are implemented, not yet a completed phone visual check.

## Required security release review

The owner agreed on October 7 to the [Federation security release gates](federation-security-release-gates.md). The 27 focused checks are existing evidence; real wallet/device behavior, administrator MFA, account restrictions, complete recovery, monitoring and independent financial-integration review remain outstanding. This preview does not constitute a security audit or financial-release approval.

## October 7 focused wallet security review

Six new synthetic regressions failed before the changes and passed afterward:

- A late `accountChanged` event could restore the public address after disconnect.
- An account event could populate an address while permission was still pending.
- A failed disconnect cleared the display but retained an active address source, allowing later events to change its state/message.
- A late connection rejection could overwrite the message after Clear.
- Numeric token amounts could be coerced and silently rounded instead of rejected.
- Missing, negative or unsafe balance context slots could be accepted.

Account events now require an active accepted address source and an idle connection flow. Disconnect clears that source immediately, including on failure, while allowing a retry and preserving manually entered watch addresses. Stale connection rejections are ignored. The balance handler requires string integer token amounts and safe nonnegative context slots for every RPC result. Invalid reads fail closed without partial quantities.

These are reproduced application-level edge cases with mock providers/RPC data; they do not demonstrate an exploit against an actual Phantom wallet or a funds-moving function. All 33 focused dashboard/wallet/price/calculator/Phantom tests passed together.

A separate hosted check found that the clean `/command-deck` URL had inherited the broader legacy response-header policy while `/command-deck.html` had the strict policy. The HTML's restrictive meta policy still existed; the response-header difference was nevertheless unintended. The Netlify header rule now covers both. Both deployed URLs returned 200 with `X-Frame-Options: DENY`, private/no-store caching and a CSP without inline allowances and with `frame-ancestors 'none'`. The deployed Phantom script matched its expected Git blob.

Hosted API validation after the code change: a public mint-address lookup returned 200 with quantities and reference pricing; an incorrect Origin returned 403; the direct function URL returned 404. Netlify boundary/header/redirect checks passed. No real wallet was connected and no financial action occurred.

This was a focused review of the read-only wallet preview, not a full website/account/provider audit. The existing security release gates remain partial or pending, including actual wallet/device tests, administrator MFA, recovery, monitoring and independent review.

Primary references: https://docs.phantom.com/solana/establishing-a-connection ; https://solana.com/docs/rpc/http/gettokenaccountsbyowner ; https://docs.netlify.com/manage/routing/headers/ .
