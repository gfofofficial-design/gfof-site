# Galactic Swap: reviewed token list

October 29, 2026. Quote-preview source preparation only. Trading, signing and Federation fee collection remain disabled.

## Starting scope

The starting list is SOL, GFOF and Circle-issued native USDC on Solana. Six directed pairs are explicitly declared in `assets/federation/swap/token-registry.mjs`. A token entry does not automatically enable every pairing. The module is immutable static metadata, not a live route check, safety rating, membership register or permission to trade.

- SOL uses the wrapped SOL mint for routing, with nine decimal places.
- GFOF retains its current mint and six decimal places, matching the retained finalized mint evidence in `record/current-mint-locks-three-20261008.json`.
- USDC uses `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`, listed in [Circle's mainnet contract directory](https://developers.circle.com/stablecoins/usdc-contract-addresses). A public Jupiter Tokens V2 metadata read on October 29 returned this exact mint, six decimals and the standard SPL Token program. This is not a new independent on-chain recovery or trading acceptance result.

The current UI offers native From/To selectors and a reverse button. Changing a pair clears the amount and any pending/displayed quote. The selected routing mints, explorer destinations and Dossier research link follow the chosen canonical entries. No URL parameter, wallet asset list, ticker search or remote metadata feed can add tokens. Merely visiting the page or changing a selector makes no provider request.

## Adding an Alliance project

1. Use the existing Alliance project-introduction route. Establish an authorized representative and record consent to display the project's name and any proposed logo. Membership alone does not list a token, endorse it or guarantee liquidity.
2. Record the exact mainnet mint and public official sources. Resolve conflicting/reused tickers using the full mint, not a name match. Assign a unique stable registry ID; do not reuse another token's ID or mint.
3. Verify decimals, token program, authorities and extensions from dated chain evidence. The shared integer-only amount functions support zero through36decimals; the Solana adapter retains its u64 atomic limit. Review unusual precision and token behavior explicitly. Tokens with transfer fees, transfer hooks, restrictions or unsupported behavior need separate review before inclusion or execution.
4. Review the proposed directed routes and amounts. Record failed/no-route results honestly. Add only reviewed pair entries. A successful quote is not execution acceptance or a future liquidity guarantee.
5. Add reviewed metadata and, if used, a local permissioned logo. The native selectors now derive from the reviewed registry. Update the static fallback/copy and tests together. Do not accept arbitrary mint text or remote images as an onboarding shortcut.
6. Test mint binding, integer precision, unavailable routes, stale results, cancellation, pair changes and research/explorer destinations. Keep provider content out of HTML. Confirm no new network origins, automatic requests or wallet data in quote requests.
7. Review and approve the exact source/release scope. Token listing does not authorize fees, signing or financial execution. Live trading requires separate transaction/program/account/recipient/fee validation and bounded owner acceptance for its supported scope.

## Validation and integration limits

The six directed pair cases use synthetic provider responses. They prove request/projection binding, not six current live routes. No signature, trade, account creation, rent payment or referral setup is part of this change.

PR160's offline fee preparation remains a separate draft and is limited to its reviewed SOL/GFOF scope. This token-list change does not expand that helper's fee permissions or prove USDC referral-token accounts. Preserve the already-selected receiving wallet and verify actual account control/state on Dev before any separately approved fee setup.

Current Jupiter references: [Swap API](https://developers.jup.ag/docs/swap/index), [token metadata](https://developers.jup.ag/docs/tokens/token-information). Provider APIs and rate limits can change; recheck before execution work.
