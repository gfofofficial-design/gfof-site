# Galactic Swap execution review — offline candidate

October 30, 2026. Source-only progress toward the existing API/Wallet Standard direction, not an activation decision. No wallet connection, mainnet signature, order request or submission was performed. No credentials, accounts, schedules, payment or provider plan changed. Production remains quote-only.

## Implemented

`transaction-envelope.mjs` reads canonical bounded base64 Solana v0 wire packets, signature slots, header/account counts, static public keys, blockhash, compiled instruction indices/data and lookup descriptors. It checks exact consumption, bounds and nonzero Ed25519 signatures using Node's crypto implementation. Signed-response comparison requires unchanged message bytes, a signature for the selected required signer, and preservation/verification of other signature slots. It never signs or submits. A valid envelope is not a valid swap.

`order-preflight.mjs` binds metadata to an explicit reviewed pair/input amount, selected taker, positive minimum output, exact50bps referral intent, expected referral/mint, explicit network-cost ceiling and a supplied current block height. It compares the envelope's signer and payer to the taker. It refuses gasless, alternative recipients, RFQ, unsupported versions, expired/invalid metadata and silent fee fallback. The initial narrow format supports aggregator v0 with one signer; this is an offline test boundary, not a decision to permanently exclude other routes. All outputs retain tradeAllowed:false, and collectionConfirmed:false. Public account ownership is NOT established by syntactically valid bindings.

There is no fetch, wallet method, sign callback, transaction submission or app import. These files remain under excluded operator tools; the static output excludes tools entirely. No new dependencies. Tests create ephemeral synthetic Ed25519 fixtures only; no user keys or retained wallets. Never export keys from a user's wallet to use this code.

## Current provider contract reviewed

Primary references checked October30:
- https://developers.jup.ag/docs/swap/order-and-execute
- https://developers.jup.ag/docs/api-reference/swap/order

Jupiter documents the taker/order/execute flow, aggregator blockheight versus RFQ timestamp expiry, optional v1 support and possible fee fallback when a referral token account is uninitialized. Those distinctions motivate explicit refusal rather than inferred acceptance. Recheck the exact API/schema and current token/program behavior before a real request. This code is not a Jupiter SDK and does not independently attest provider claims.

## Still required before a signing path

1. Use a reviewed transaction codec and instruction decoders/IDLs for the selected programs. Independently resolve lookup-table state and token accounts; bind owner, token program, mint, amounts, authority and all writable effects. The wire reader exposes unresolved descriptors but never treats them as resolved.
2. Verify the actual transaction enforces the user's minimum output, recipients, fee token account/rate, compute budget and exact spend caps. Metadata alone cannot satisfy these checks. Validate recent blockhash against current chain state and time/height freshness at every boundary; caller-supplied height is not a trusted chain attestation.
3. Validate every program/instruction and reject approvals, authority changes, arbitrary transfers or unexpected signers/accounts. Simulation is an additional check, not a substitute for instruction validation. Review token extensions deliberately.
4. Add immutable per-attempt intent/message/request bindings and a lifecycle that invalidates on edits, account/network changes, expiry, cancellation or uncertain completion. After a real wallet response, compare message/signatures again before any allowed send; never retry an uncertain send automatically.
5. Reconcile PR160's separate fee preparation and verify the selected owner's referral/project/token accounts on Dev. Inspection of native-USDC metadata here does not approve or prove USDC fee collection. Existing50bps intent remains preparation; no rate or economics are activated.
6. Wire an explicit review/confirm UI and supported desktop/mobile wallet path only after decoders pass adversarial tests. Keep wallet data separate from account login and anonymous quote browsing. Provider credentials, if required, must not be embedded in client code. No private-key wallet API is appropriate for the public app.
7. Complete separately bounded owner acceptance, execution/confirmation/uncertainty handling, fee receipts and exact release approval. Do not change TRADING_ENABLED merely because this offline suite passes.

## Validation

14 focused new cases cover envelope framing, unsupported versions, signatures, message mutation, signer isolation, metadata binding, fee fallback, spend caps, minimum-output weakening, overflow and expiry. They do not establish an independent Solana codec audit, program acceptance, live-route availability or hosted recovery. Synthetic valid metadata can still accompany malicious instructions: that is why neither module authorizes trading.


## Offline account snapshot increment — October30

`account-review.mjs` resolves supplied raw v0 lookup snapshots in global writable-then-readonly order. It requires exact lookup address/program owner, non-executable state, coherent context slots within an explicit bounded lag, active tables and a fully warmed observation. Same-slot extended and deactivating tables are conservatively refused even where some chain uses may be valid. It checks bounds/aliases and exposes per-account signer/writable flags for instruction review.

The standard165-byte SPL Token snapshot check binds token-account address, mint and token authority separately from the program owner; it checks initialized/not-frozen state, minimum integer units, absence of delegates and unexpected close authority. Token2022/extension layouts are refused. A native flag requires the fixed wrapped-SOL mint. This does not prove ATA derivation, mint decimals, referral-account ownership, rent funding or any permission to spend.

All snapshots are caller-supplied and untrusted until an independent coherent RPC adapter establishes cluster/provenance/freshness. Slot limits do not authenticate an RPC. No raw account requests were made. Result objects always retain tradeAllowed:false. Chain lookup resolution and instruction-program decoding are still release gates; offline consistency is not an on-chain audit.

Six new synthetic account cases bring the focused new suite to20cases, plus7existing packaging cases. Source references: https://github.com/solana-program/token/blob/main/interface/src/state.rs ; https://github.com/solana-program/address-lookup-table ; https://solana.com/docs/core/transactions/versioned-transactions . Account semantics were reviewed against the primary program layouts; independent codec parity remains required before production use.
