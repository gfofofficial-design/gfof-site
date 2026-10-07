# Command Deck working preview

PR99 only. No production merge or financial activation.

The wallet form sends an explicitly entered public address through a bounded, same-origin POST to Solana mainnet public RPC. It accepts only a decoded 32-byte base58 address, fixed RPC methods and endpoint, and aggregates exact integer token quantities across the Token Program and Token-2022. No account cookies, wallet signatures, transactions, metadata logos or account-wallet association are used. UI output uses textContent. The address is not placed in a query URL or stored by application code; hosting/RPC operational logs may still exist.

The handler accepts only the exact PR99 origin and API route, rejects direct function paths, caps request/response sizes, times out after 8 seconds, and returns no partial balance on errors. Netlify permits six requests per minute per IP/domain. This is abuse friction, not a spending cap; the public RPC can rate-limit or deny traffic and is unsuitable as a production availability guarantee. No paid provider has been configured.

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
