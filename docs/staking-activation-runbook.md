# GFOF reward-pool activation runbook — preparation only

Prepared 2026-10-02. Owner approval covers public preparation status and correction [#039](../corrections.html#c039), not a pool, token movement, offer, rate, or opening. This is an operator checklist for the proposed GFOF/GFOF fixed-budget program with one-month, six-month and twelve-month concepts. Provider support may require one configurable pool or three separately funded pools; neither is approved. The live [staking page](../staking.html) remains closed until every launch gate below has evidence. Do not connect a wallet or create a pool from this document alone.

## Decision record to complete

| Input | Record before approval |
| --- | --- |
| Provider and exact product | Streamflow fund-once candidate; compare actual dated quote, deployed program ID, upgrade authority, contract version, audit and incident handling against a second option. No provider selected yet. |
| Stake and reward mint | Verify both as `2oQmHWoTZRmRLregHKjBSGJy3ueX3iRNzimy2iZCmoon` on finalized chain data; record token program and decimals. |
| Reward source | Candidate W-010 `Hz44vHXNX2stCULK6SMuG6P8ozDXVxhay7fpRnvy2dKC`. Verify current owner/control, spendable balance and any encumbrance. No amount is approved. |
| Program design | Verify whether one product supports three discrete terms or separate pools are required. Record cap, budget, entry opening and expiry in UTC, exact month definition, reward period, calculation and withdrawal behavior, unused rewards, eligibility, fees and payer for **each** term; check aggregate obligations. |
| Budget | Exact integer token allocation, reserve left after allocation, full-cap worst-case obligation, rounding and buffer. Verify the provider's own calculation rather than treating a simple APR illustration as its formula. |
| Participants | Counsel-reviewed jurisdictions, disclosures, terms, help path, incident notice process and whether a small claim is uneconomic after user fees. |
| Authority | Named transaction approver(s), treasury signing device and independent reviewer. Record approvals without publishing private keys, recovery phrases or credentials. |

A publishable configuration must be a single versioned record with an owner signature, counsel disposition and exact parameter values. Leave unknown fields blank and keep the page closed.

## Provider diligence before choosing one

1. Capture the current creation screen and a dated fee quote. Streamflow's August 14 cost table lists Starter from $199/month with one pool, a Business creation line of 1.30 SOL plus example network fees, and a 0.029 SOL claim line; the exact account charge and who incurs claims need confirmation. Do not assume a subscription can be cancelled immediately without affecting the live pool. [Streamflow costs](https://docs.streamflow.finance/en/articles/9675153-individual-vs-business-costs-of-using-streamflow).
2. Ask Streamflow to reconcile its fund-once guide's automatic distribution language with its FAQ's receipt/claim flow and listed claim fee. Confirm whether rewards and principal are sent automatically, must be claimed, or require a user unstake action under the exact version used. Preserve the written answer and test receipt. [Fund-once guide](https://docs.streamflow.finance/en/articles/10006633-create-a-fund-once-staking-pool), [FAQ](https://docs.streamflow.finance/en/articles/10006731-staking-faq).
3. Verify immutable fields, pause/emergency powers, vault funding and depletion behavior, receipt-token loss consequences, program upgrade control and the ability to recover unallocated rewards. Independent program and authority evidence controls over marketing descriptions. Streamflow warns locked principal cannot be withdrawn early and depleted pools can prevent reward claims. [Risk guidance](https://docs.streamflow.finance/en/articles/10272996-staking-information).
4. Compare a fixed-vault StakePoint candidate on actual participant cost, contract and audit scope, upgrade authority and exit test. Its one-time 1 SOL creation and flexible/locked options are provider claims, not a security conclusion. A lower creation price is insufficient if ongoing percentage fees consume modest rewards. [StakePoint pools](https://stakepoint.app/pools), [provider information](https://stakepoint.app/about).
5. If neither provider meets these checks, keep the preparation status; do not create a custom contract solely to meet a bond date.

## Gated sequence

| Gate | Required evidence | Result if missing |
| --- | --- | --- |
| G0 — migration | Finalized Meteora DBC migration state and destination DAMM v2 pool IDs, not a market-cap screenshot or bonding prediction. | Stay closed. |
| G1 — legal and terms | Counsel review of the actual issuer-funded arrangement and final public copy; dated terms, eligible participants, reward and lock mechanics, fees, risks, tax treatment language and complaint route. | Stay closed; do not publish a rate. |
| G2 — source and notice | Current W-010 spendable balance and authority, exact unencumbered allocation, signed treasury decision, public specification and at least seven days' notice before first distribution or material change of purpose if W-010 is used. As an operating rule, wait until notice expires before inviting deposits. The October 2 intent notice does not start that clock. | No treasury transfer or pool invitation. |
| G3 — provider acceptance | Dated quote and exact contract/program/authority review, immutable parameter proof, maximum-liability calculation, small isolated stake through exit/claim, and actual user-fee observation. | Do not create the public pool. |
| G4 — funding | Creation and full funding finalized for **each** offered term. Independently match every pool, vault, mint, cap, expiration, duration, schedule, budget, authority and signature to the approved record. A track stays closed if its own proof is missing. | Never show that track OPEN or link a deposit action. |
| G5 — publication | Second reviewer signs the comparison; official page names pool/provider, links Explorer receipts, current status and terms hash/version, displays participant cost and failure conditions. | Leave preparation page closed. |

The signer must compare the wallet prompt's mint, amount, destination, program and network to the approved record immediately before approving. Creating a pool is a funds-moving action, so obtain separate explicit authorization after the completed G0–G3 packet is reviewable.

## Acceptance and incident rehearsal

Use a small isolated test position with consenting wallets and a budget that is expendable. Record transaction signatures for pool setup, funding, stake, receipt token, reward accrual, claim/automatic payout and principal return after term. Test the latest permitted entry and full-cap obligation in the provider calculator. Confirm the method for identifying the same position across receipts. A test on a different program/version or schedule does not establish the public pool's behavior.

Before opening, rehearse: exhausted or mismatched reward vault; lost receipt token; failed claim; website or provider outage; program upgrade; discovered security issue; expired entry window. Identify who can pause **the website invitation**, contact the provider and publish a correction. Do not promise an early withdrawal or a provider rescue unless the exact program proves it. If an incident occurs after deposits, immediately mark the official page PAUSED, retain all transaction links and publish what is known and unknown; follow the actual on-chain rules for locked positions.

## Public state transitions

- **PREPARING:** current page; no wallet connection or pool address.
- **NOTICE / TERMS FINAL:** only after G0–G3, with exact budget, start and first-distribution timing; still no deposit invitation until the notice interval and G4–G5.
- **OPEN:** only after G4–G5. Link directly to the verified provider pool; the Federation site remains informational.
- **PAUSED / CLOSED:** stop new invitations, keep prior receipts and terms versions reachable, explain claim and withdrawal obligations.

Do not mix the Dossier Capital Path beta, FCC, NFT, governance, price support or access perks into this reward pool. Any such utility needs its own approval and correction.

## Remaining owner decision packet

When the gates are evidenced, present one comparison showing the chosen provider, total launch/participant costs, exact reward budget and cap, expected best/worst-case funding obligation, source balance after allocation, duration/exit, counsel disposition, notice dates, test receipts and full on-chain destination. Ask for one specific approval to create and fund that exact pool. No transaction is authorized by approval of this runbook.
