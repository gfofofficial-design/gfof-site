# Supporting Solana instruction policy — offline only

October30 source candidate. This is an explicit side-effect decoder/policy increment, not a swap-router decoder or trading integration. No RPC, provider, user-wallet, live signature or transaction was invoked.

The reviewer resolves the raw v0 envelope through the existing offline account resolver. Its selected owner must be the single signer and writable payer. It recognizes only System transfer, Compute Budget limit/price and standard SPL TransferChecked. Every other program or instruction refuses, including Jupiter routing, approvals, authority changes, unchecked token transfers, account creation/ATA setup, minting, burning, closing and native synchronization. A real swap will remain refused until its router instructions and all necessary setup/cleanup instructions have independently reviewed policies.

Every SOL transfer must target an explicit recipient, within both per-recipient and transaction-wide lamport ceilings. Every TransferChecked must match source/destination/mint/decimals and the owner authority; repeated transfers aggregate against the same units ceiling. Unsupported multisig and extra instruction accounts refuse. This is intent-shape review: the raw source/destination/mint accounts still need independently established state and ownership.

Compute-unit limit and price must both be explicit, with no duplicate settings. The requested unit limit cannot exceed the supplied bound or the candidate's1400000 ceiling. Priority fee is calculated as ceil(limit*microLamportPrice/1000000) with integer arithmetic and checked against an explicit policy ceiling. This is not the total fee: base signature fees, rent, other charges and provider/referral deductions require separate binding and on-chain/receipt verification. No global slippage/spend/fee defaults or owner-approved launch limits are invented here.

Output is always tradeAllowed:false, even when supporting effects match. It does not authenticate the RPC, approve aggregator programs or inspect CPI effects, establish expected output, prove referral ownership or replace simulation/codec parity. Client adapters for other chains must implement their own instruction/calldata review; this module is Solana-specific.

Six synthetic cases cover allowed supporting effects, aggregate spend ceilings, destination/decimal changes, forbidden permissions, compute-price rounding/caps and malformed accounts/data. Added to the retained20offline review and7packaging cases for33focused cases. Operator tools remain excluded from public output. Primary reference layouts reviewed: https://github.com/solana-program/token/blob/main/interface/src/instruction.rs ; https://solana.com/docs/core/fees/compute-budget ; https://solana.com/docs/core/fees/fee-structure .


## Router source review — October 30

The official instruction-parser main revision inspected was
`e6f77951377847c579112e6a16d8c17c5c092485` (commit dated November 5, 2024).
The official CPI main revision inspected was
`12bc5f67b94a2c3edc74d6e721a19442124a0bad` (January 10, 2024), with
IDL Git blob `5018becdfb4006d8f8ab058b54fec7d686892e5e`.
These dates do not establish compatibility with transactions assembled today.

Pinned primary sources:
- https://github.com/jup-ag/instruction-parser/tree/e6f77951377847c579112e6a16d8c17c5c092485
- https://github.com/jup-ag/jupiter-cpi/blob/12bc5f67b94a2c3edc74d6e721a19442124a0bad/idl.json

The CPI IDL distinguishes exact-input, exact-output and token-ledger routes,
with different amount fields and account positions. It must not be treated as
one fixed byte-offset layout. Do not accept an instruction merely because its
program address is Jupiter's address. The added regression covers that address
with five synthetic route discriminators; every case refuses. These are rejection
fixtures, not successful provider transaction samples or decoder parity evidence.

Smallest next implementation gate: obtain and pin a current provider-supported
interface and nonsecret transaction fixtures for the selected execution API;
match its codec, account positions, explicit input, enforced minimum output,
fee recipient and route plan against independent decoding. Unknown variants,
remaining accounts and CPI effects must continue to refuse until reviewed.
No router decoder or signing permission was added by this source investigation.
