# GFOF post-migration staking readiness — research memo v0.1

Date: 2026-10-01
Status: Public review draft. Research and preparation only; not a staking specification, launch approval, reward promise, APY, or instruction to deposit tokens.
Token: `2oQmHWoTZRmRLregHKjBSGJy3ueX3iRNzimy2iZCmoon`

## Owner direction and scope

The owner approved researching staking for implementation after GFOF migration and, on October 1, explicitly approved publishing this research memo in a public, review-only draft PR. The Structure Lens and Capital Path beta remain the current build priority. Approval to publish this memo does not select a platform, authorize fund movements, or adopt reward parameters.

## Recommendation

Streamflow Fund Once is the leading technical candidate for a finite, pre-funded reward pilot. It supports a pool cap, expiration date, staking duration, reward period and targeted APY. A bounded campaign lets the project measure demand and costs before taking on recurring funding obligations.

The recommendation remains conditional on the reward model, funding, participant fees, exact deployed program and audit verification, project-specific counsel review, a public specification, and recorded launch authorization. No pool has been created.

If the objective is advisory governance participation without token rewards, investigate Realms Voter Stake Registry separately. It changes voting weight through token locking; it is not a funded reward pool. Its setup can require a plugin deployment and realm configuration proposal. Existing team voting exclusions and advisory-only authority boundaries require separate review before any change.

## Migration compatibility

The current GFOF FAQ identifies Meteora DBC and a configured migration to Meteora DAMM v2, superseding the older Moonshot/Raydium description. Before implementation, verify the migration transaction, actual pool, fee authorities, position NFT and liquidity lock.

Do not assume Meteora Stake2Earn works with this migrated position. Meteora's current product index lists Stake2Earn as a legacy DAMM v1 product. An older FAQ mentions DAMM v1/v2; the conflict requires clarification from Meteora and inspection of the actual program integration. Dynamic Fee Sharing splits fees among recipients and should not be assumed to supply a holder-wide staking system.

Native Solana validator staking delegates SOL. A GFOF incentive pool would place SPL tokens into a separate program and distribute separately funded rewards; bonding does not generate these rewards automatically.

## Comparison

| Route | Function | Assessment |
| --- | --- | --- |
| Streamflow Fund Once | Pre-funded reward campaign with cap, expiration and lock settings | Leading bounded pilot candidate. Verify audit scope, all participant fees and immutable parameters before funding. |
| Streamflow Continuous Funding | Reward pool with recurring top-ups | Consider after funding and monitoring are proven. Requires explicit runway and depletion policy. |
| Realms Voter Stake Registry | Token locks modify advisory voting weight | Suitable for a governance design, not a reward substitute. Plugin security, integration and vote rules need review. |
| Meteora Stake2Earn | Fee sharing from locked liquidity to top stakers | DAMM v2 compatibility is unproven; newer docs place it under legacy DAMM v1. |
| Smithii token staking builder | Configurable reward pool | Alternative only after exact program audit, upgrade authority, withdrawal behavior, total fees and support are verified. |
| Custom Solana program | Arbitrary mechanics | Contract audit and ongoing maintenance burden. No current requirement justifies choosing this first. |

## Fees and security evidence

Streamflow's published Fund Once guide lists a 1.3 SOL pool-creation service fee. Its business fee table lists a 1.3147 SOL estimated creation total and a 0.029 SOL staking-claim total, including its estimated network costs. These are vendor figures, not a negotiated project quote or verified transaction cost. Confirm claim frequency, fee payer, subsidized claims and rent recoverability; small-holder economics matter.

Smithii's published token staking guide lists 0.008 SOL per stake on its free plan and 0.002 SOL on premium, with possible creator-added fees. A lower stated fee alone is not sufficient to select it.

Streamflow reports FYEO and OPCODES audits. The audit-index link from its SDK repository did not resolve during this review. Obtain the report for the exact staking program/version, compare the program ID and deployed code, inspect upgrade authority and admin powers, and review unresolved findings. Vendor audit claims do not establish that every selected configuration or deployment is safe.

Streamflow's guide says parameters cannot change after pool creation and users cannot withdraw until the staking period ends. Users receive a position receipt token; burning it can remove the ability to unstake. Test and explain these consequences before launch. Program escrow is different from holding spendable tokens in one's wallet even where the vendor describes its service as non-custodial.

## Existing commitments to reconcile

Current GFOF FAQ and roadmap say no staking system, schedule, APY, rates or activation trigger is authorized. The access specification parks staking for return pending its own specification. Corrections #023/#024 withdrew earlier lock tiers, multipliers, NFT boosts and passive-income copy.

The treasury disclosure describes a 10% rewards/reserve designation but no authorized distribution. It requires a public specification and at least seven days' notice before the first distribution or material change of purpose. A designation does not establish an available reward balance or authorize spending. Do not assume creator fees or permanently locked liquidity are available to fund rewards.

The owner’s new direction should be recorded through a versioned proposal and coordinated public updates before launch. Existing Dossier access policy provides that holding GFOF is never required; this memo does not adopt a token gate or discount.

The SEC's 2026 interpretation and protocol staking statement discuss network validation staking. This memo makes no legal determination about a project-funded GFOF incentive. Obtain counsel's review of the actual rewards, funding, marketing, eligibility and custody design; earlier internal-framework review does not approve a future pool.

## Owner decisions required before a launch specification

1. Benefit: funded token rewards, governance participation, consumptive utility, or a defined combination.
2. Reward asset and source: GFOF, USDC, SOL or another asset; exact available budget and authorized signer.
3. Campaign bounds: pool cap, eligibility, per-wallet limits, lock duration, start/end, allocation method, claim cadence and fee payer.
4. Depletion and closure: what happens when funds run out, stakes mature, the interface is unavailable, or the program needs replacement.
5. Public posture: review and reconciliation of treasury, FAQ, roadmap, access specification, governance specification where relevant, and corrections.

No rate, budget, tier, multiplier or duration is adopted here.

For a same-token, simple fixed-rate model, a preliminary full-cap estimate is:
`reward budget ≈ pool cap × annual target rate × lock days / 365`.
This is a planning approximation, not the contract's allocation formula or a promise. Confirm exact arithmetic, rounding, expiry handling and fees through the chosen program before publishing any rate.

## Implementation preparation and launch gates

1. Record canonical mint/program, migrated pool, position and fee authorities, liquidity locks and explorer evidence. Confirm GFOF token extensions and actual staking-program compatibility.
2. Obtain exact pricing, audit reports, program IDs, upgrade/admin controls and support commitments.
3. Model low, expected and full-cap participation; reward depletion, price sensitivity, claim fees and small-holder outcomes.
4. Test with a test token: stake, receipt custody, claims, early-withdrawal behavior, expiry, depleted rewards, receipt loss and interface outage. No mainnet deposit is part of this memo.
5. Prepare a versioned public specification, funding authorization, required notice and project-specific counsel review.
6. After approval and successful migration verification, deploy the selected bounded pool; publish addresses, funded balances, rules and risks. Verify a small full lifecycle before general access.
7. Monitor funding, contract events, participant costs and failures. Publish corrections and revise future campaigns from measured results.

Preparedness allows prompt implementation after migration when all gates are complete. Migration alone is not the launch trigger.

## Primary sources reviewed October 1, 2026

- [Streamflow Fund Once — March 9, 2026](https://docs.streamflow.finance/en/articles/10006633-create-a-fund-once-staking-pool)
- [Streamflow Continuous Funding — August 20, 2026](https://docs.streamflow.finance/en/articles/14005633-create-a-continuous-funding-staking-pool)
- [Streamflow fee table](https://docs.streamflow.finance/en/articles/9675153-individual-vs-business-costs-of-using-streamflow)
- [Streamflow SDK repository / audit-index link](https://github.com/streamflow-finance/js-sdk)
- [Realms Voter Weight Plugin](https://docs.realms.today/developer-resources/plugins-v1/voter-weight-plugin)
- [Voter Stake Registry reference implementation](https://github.com/blockworks-foundation/voter-stake-registry)
- [Smithii token staking](https://docs.smithii.io/products/tools/solana/token-tools/create-token-staking)
- [Meteora current product index](https://docs.meteora.ag/get-started)
- [Meteora older FAQ containing broader Stake2Earn wording](https://docs.meteora.ag/faq/how-do-i-create-a-new-farm)
- [Solana validator staking](https://solana.com/staking)
- [GFOF FAQ](https://galacticfederation.co/faq)
- [GFOF treasury disclosures](https://galacticfederation.co/treasury)
- [GFOF access specification](https://galacticfederation.co/access-spec)
- [GFOF corrections](https://galacticfederation.co/corrections)
- [SEC/CFTC interpretation — March 2026](https://www.sec.gov/rules-regulations/2026/03/s7-2026-09)
- [SEC protocol staking statement — May 29, 2025](https://www.sec.gov/newsroom/speeches-statements/statement-certain-protocol-staking-activities-052925)
