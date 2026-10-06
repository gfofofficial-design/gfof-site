# GFOF staking readiness — proposed program v0.1

Status: **design for owner and counsel review; no pool, rewards, or signup live**. Prepared 2026-10-02. The owner approved public preparation status on 2026-10-02. Corrections entry #039 identifies the earlier “staking not committed” wording and the new status. This document remains a proposed program design; provider, budget, terms, and pool are pending. The [access design](../access-spec.html) expressly excluded staking for yield within its own scope; it does not authorize this separate program. The separate program must preserve the access design’s narrower scope and obtain review of actual reward terms before opening.

## Purpose and boundary

**2026-10-06 superseding status:** The current mint is `Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV`. The Meteora DBC threshold below belongs to the former mint and is no longer a launch trigger. Any current-mint pool needs fresh specifications, verified unencumbered new-token funding, provider and counsel review, and a recorded authorization. No pool is open.

The original proposal was an optional, externally funded GFOF token reward pool after the former mint's Meteora DBC curve reached its configured quote-reserve threshold and DAMM v2 migration was verified. That is now historical design context, not a current requirement or proof of readiness. GFOF is an SPL token; depositing it into a reward pool does not stake SOL to a validator or produce Solana protocol inflation rewards. A reward can be paid only from tokens specifically placed into the pool. A holder who does not participate receives no pool reward.

The program does not confer Dossier access, governance authority, a buyback, a price floor, or a claim on Federation revenue. Dossier's read-only Structure Lens and Capital Path have separate release gates. Neither can be represented as part of the reward.

## Proposed initial route

**Candidate: Streamflow fund-once GFOF stake and GFOF reward structure**, subject to the acceptance gates below. The public page now shows proposed one-month, three-month, six-month and twelve-month commitment choices. Verify whether the exact no-code product supports these as discrete terms in one pool, a duration range with distinct weights, or requires four separately funded pools. Do not imply one pool can deliver four isolated choices until its creation screen and program prove that behavior. The Federation already uses Streamflow for treasury locks, but those locks are not a staking pool or proof that a new pool is safe. A fixed allocation for each actual pool or reward obligation is more auditable than an uncapped promise to top up from future fees. Four pools may multiply creation charges and require separately bounded vaults. Do not use the continuous-funding mode for the first launch; later top-ups would be a new, disclosed decision. Do not write or deploy a custom staking contract for this first pool.

Streamflow's published fund-once guide says the pool cap, expiration, duration, reward period, and target APY are set on creation; settings cannot be changed afterward, stake cannot be withdrawn until the selected duration ends, and receipt tokens must be retained. Its cost page dated 2026-08-14 says staking pool creation is unavailable on the free Individual plan, Starter starts at $199/month for one pool, and the Business table lists 1.30 SOL per pool plus network fees and 0.029 SOL per claim. The actual account quote and participant fees must be captured immediately before creation. The FAQ and newer continuous-funding documentation differ on top-ups; use the exact contract version and creation screen as the final source. Source: [fund-once guide](https://docs.streamflow.finance/en/articles/10006633-create-a-fund-once-staking-pool), [pricing](https://docs.streamflow.finance/en/articles/9675153-individual-vs-business-costs-of-using-streamflow), [staking risks](https://docs.streamflow.finance/en/articles/10272996-staking-information).

**Cost fallback for review: StakePoint same-token fixed-vault pool.** Its current first-party page lists a 1 SOL one-time creation fee, no subscription, 2% platform fee on staking transactions, optional zero lock, and an up-front reward vault. It identifies an upgradeable program and a multisig authority and links an audit. Those are provider claims, not independent validation. Before choosing it, review the actual audit findings, on-chain program and upgrade authority, current fees, withdrawal behavior and a small reversible test. The 2% fee may be material for a modest reward program. Source: [StakePoint for projects](https://stakepoint.app/for-projects) and [audit PDF](https://stakepoint.app/audit.pdf?v=2). No provider has been contracted or approved by this document.

## Funding worksheet — fill in before signing

| Field | Required evidence |
| --- | --- |
| GFOF mint | Current `Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV`; independently verify mint and token program. The former mint is historical and is not a staking input. |
| Funding authority | Candidate: disclosed W-010 community and holder-benefits reserve, `Hz44vHXNX2stCULK6SMuG6P8ozDXVxhay7fpRnvy2dKC`. Its 2026-09-09 snapshot was 26,854,995.530832 GFOF, **not** a current available balance or an approved staking allocation. Recheck ownership, balance and encumbrances, then record the owner's signed allocation and source transfer. [Treasury register](https://galacticfederation.co/treasury). |
| Reward source | Unencumbered GFOF already controlled by the Federation; no assumption that locked allocations, DBC pool inventory, migration proceeds or future trading fees are available |
| Reward budget `R` | Exact amount per term/vault and total, integer precision and percent of current total supply |
| Stake cap `C` | Maximum GFOF accepted per proposed term and in aggregate; never describe it as circulating supply removed |
| Entry window and term `D` | UTC open/close times and exact definition of the proposed one-month, three-month, six-month and twelve-month terms; settlement and withdrawal rules per term |
| Rate | Derived from actual funding and pool configuration; no rate or APY marketing until the signed pool proves it |
| Fees | Provider subscription and creation cost, network fees, participant stake/claim/exit fees and who pays |
| Residual policy | Who may recover unallocated rewards and when, with verified authority and public receipts |
| Emergency case | Provider pause, depleted vault, upgrade, exploit, pool delisting, lost receipt token, failed automatic distribution |
| Public proof | Pool and vault addresses, program ID, creation/funding signatures, wallet instructions and independent Explorer links |

At full cap, a simple fixed annual-rate illustration would require at least `C × rate × D / 365` reward tokens for a single term, before rounding, provider-specific calculations and a buffer. This is **a planning equation, not a quoted reward or the provider's formula**. Run its actual calculator against 100% of the stake cap, latest possible entry and all permitted terms. Reject any configuration that can promise more rewards than the vault has. Publish the actual cap, funded budget, term, fee schedule and scenario assumptions as a versioned record.

## Activation sequence

1. **Reconcile public commitments.** Publish a dated correction/new specification explaining the change from “no staking for yield” and “not committed.” Obtain counsel's review of the exact program and copy for the jurisdictions served. The SEC's March 2026 interpretation discusses **protocol staking**; it is not an automatic classification of an issuer-funded GFOF reward pool. Do not infer legality from the word “staking.” [SEC release](https://www.sec.gov/newsroom/press-releases/2026-30-sec-clarifies-application-federal-securities-laws-crypto-assets).
2. **Verify current mint and ownership.** Confirm the current GFOF mint on finalized Solana data, and verify actual reward inventory, custody and authority for this mint. The former Meteora DBC path and prior Moonshot/Raydium creator-fee design are historical and cannot supply current-mint funding.
3. **Approve a bounded budget and give notice.** W-010 is a candidate source, not an automatic funding authorization. Recheck its current balance and control, sign the exact allocation with the treasury owner, and establish that tokens are liquid and unencumbered. Its published register requires a public specification and **at least seven days' notice before the first distribution or material change of purpose**. Publish the final amount, terms, intended source and first-distribution window with a dated notice; the clock starts on that publication, not on this draft. Ensure provider fees leave an acceptable operating reserve. Never unlock a documented allocation early to fill the pool.
4. **Validate the provider.** Capture dated pricing, contract version, program ID, audit and upgrade authority, withdrawal behavior, participant fees and incident process. Use a separate small test with consenting wallets, then inspect stake and completion receipts. A test is not the public pool.
5. **Create and fund once.** Use the official provider interface and treasury signing controls. Independently verify GFOF mint, pool, vault, amount, cap and term on Solana Explorer before any public “open” label. Avoid a custom custody or wallet connection on the Federation site.
6. **Publish the evidence card and open.** Replace the page's “preparing” state only after the required seven-day notice has elapsed, the full funding transaction is final and the acceptance record is signed. The Federation site should link to the verified provider pool; it should never route a wallet to an unverified pool address.
7. **Monitor and close.** Track vault balance, claims/automatic payouts, remaining obligations, expiry and incidents. Publish corrections to terms or evidence; do not quietly replace the linked pool.

## Public wording prepared for review

> We are preparing an optional GFOF token reward pool for after the token's Meteora bonding curve completes and the migrated pool is verified. The program is not open. No APY, reward amount, lock term, launch date, or provider is final. Before anyone is invited to participate, we will publish the funded reward vault, pool address, fees, withdrawal rules, risks and independent transaction links. GFOF pool rewards would come from a defined allocation; they would not be Solana validator staking rewards. We will update the corrections record as the design is approved.

This text describes preparation, not an offer of a specific return. Public correction #039 records the new preparation status. The actual reward terms, provider and funded pool remain subject to separate review and approval. Use the [activation runbook](staking-activation-runbook.md) to assemble the exact launch evidence before requesting any treasury transaction or wallet invitation.

## 2026-10-06 term update

Owner requested proposed total-term gross rewards of 1% for one month, 3% for three months, 8% for six months and 12% for twelve months. These are not APY settings or funded offers. Verify support and funding for all four terms before opening; no pool or funds movement is authorized by this update.

The six-month working target was raised from 6% to 8% on 2026-10-06. Budget and maximum-liability estimates must use 8%; earlier three-term worksheets remain historical until reconciled to the four-term design. This numerical change does not satisfy any activation gate.

## Provider comparison follow-up — 2026-10-06

The owner is requesting details from the TBB owner about the staking product
reportedly used there and its claimed zero project cost. Streamflow remains a
candidate only; no provider has been selected. The Jupiter/TBB lead is pending
verification and does not establish support for GFOF or the four proposed terms.

Collect the exact official product and pool URL, deployed program ID and version,
audit scope and upgrade authority; confirm support for current GFOF mint
`Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV` and each discrete term.
Obtain a dated breakdown of project setup/subscription costs, participant
transaction/claim/exit fees, and who funds and holds the token reward inventory.
Verify principal return, early-exit restrictions, full-cap reward liabilities,
repeat entry and emergency controls against the actual product.

A zero platform charge does not establish a funded reward budget or cost-free
participation. Keep the public page in preparation, with no wallet connection,
until provider verification and the existing funding, legal and launch gates
are satisfied. Do not infer a launch from bonding or from another token's pool.
