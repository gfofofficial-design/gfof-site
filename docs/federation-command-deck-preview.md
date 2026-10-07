# Command Deck working preview

PR99 only. No production merge or financial activation.

The wallet form sends an explicitly entered public address through a bounded, same-origin POST to Solana mainnet public RPC. It accepts only a decoded 32-byte base58 address, fixed RPC methods and endpoint, and aggregates exact integer token quantities across the Token Program and Token-2022. No account cookies, wallet signatures, transactions, metadata logos, prices or account-wallet association are used. UI output uses textContent. The address is not placed in a query URL or stored by application code; hosting/RPC operational logs may still exist.

The handler accepts only the exact PR99 origin and API route, rejects direct function paths, caps request/response sizes, times out after 8 seconds, and returns no partial balance on errors. Netlify permits six requests per minute per IP/domain. This is abuse friction, not a spending cap; the public RPC can rate-limit or deny traffic and is unsuitable as a production availability guarantee. No paid provider has been configured.

Native SOL is separate from token mints. Unknown tokens are labelled unverified with their mint, zero-balance token accounts omitted, prices unavailable. These reads are not one atomic slot; locked/provider-held positions and spendability are not established. The previous sample allocation has been replaced with a neutral token count ring. History graph and leaderboard remain explicitly illustrative, not derived from live balances.

Explorer badges read the existing optional local Passport without writing or linking it to the signed-in account. They are not trustworthy evidence for a public leaderboard. Staking terms remain proposed, not open, and refer to total gross term rewards rather than APY.

Validation: five focused wallet tests cover decoded address length, exact precision, host/origin/direct-route/payload rejection without upstream calls, both-program aggregation, and fail-closed upstream errors. Browser script syntax passed. Hosted validation results will be appended after actual lookup checks.

Sources consulted 2026-10-07: https://solana.com/docs/rpc/http/getbalance ; https://solana.com/docs/rpc/http/gettokenaccountsbyowner ; https://solana.com/docs/references/clusters .
