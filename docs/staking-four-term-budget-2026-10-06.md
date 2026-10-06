# Four-term staking funding worksheet — review only

Prepared 2026-10-06 after the owner changed the six-month proposed gross total-term token reward from 6% to 8%. No cap, funding allocation, provider, pool, opening date or transaction is approved by this worksheet.

| Completed term | Proposed gross token reward | Hypothetical sequential cohorts in one year |
| --- | ---: | ---: |
| 1 month | 1% | 12 |
| 3 months | 3% | 4 |
| 6 months | 8% | 2 |
| 12 months | 12% | 1 |

The six-month target is 8% for the full term, not an APY field. Repeating it twice gives 16% simple arithmetic before fees, without compounding; this exceeds the twelve-month 12% target. That comparison is a design tradeoff, not a provider-supported renewal schedule or an investment return promise.

## Equal-cap illustration for all four terms

This deliberately uses equal per-term capacity to expose the arithmetic without assuming an owner-approved allocation. Capacity is participant principal, not Federation funds. Every term fills once in the single-cohort column. The repeated-entry column assumes the cohort counts above, instantaneous settlement and full cap reuse, with no reinvestment. None of those provider behaviors is verified.

| Aggregate participant capacity | Capacity per term | One cohort gross reward estimate | Hypothetical full-year repeated-entry estimate |
| --- | ---: | ---: | ---: |
| 5,000,000 GFOF | 1,250,000 GFOF | 300,000 GFOF | 650,000 GFOF |
| 10,000,000 GFOF | 2,500,000 GFOF | 600,000 GFOF | 1,300,000 GFOF |
| 20,000,000 GFOF | 5,000,000 GFOF | 1,200,000 GFOF | 2,600,000 GFOF |

For the 5 million illustration: `1,250,000 × (0.01 + 0.03 + 0.08 + 0.12) = 300,000`. The repeated-entry sensitivity is `1,250,000 × (0.01×12 + 0.03×4 + 0.08×2 + 0.12×1) = 650,000`. These aggregate figures exclude position-level rounding, provider formulas, fees and required buffers, and do not prove a sufficient reward vault.

## Reconciliation of draft PR #75

PR #75 models an earlier three-term 25%/25%/50% split and a 6% six-month target. It is historical planning, not a current four-term budget. Raising only its six-month target to 8%, while retaining its old 5 million split, changes the one-cohort estimate from 387,500 to 412,500 GFOF and the repeated-entry estimate from 600,000 to 650,000 GFOF. That still omits the three-month choice. Do not merge or reuse its calculator as current liability evidence until its terms, allocations, tests and documentation are reconciled.

## Next readiness work

1. Obtain exact support for four independent completed-term payouts and whether four pools are needed.
2. Verify whether the cap is concurrent or lifetime cumulative; prove all allowed repeat entries and overlapping positions in maximum-liability calculations.
3. Prove principal exit, reward claims, depletion behavior, expiry and last-entry enforcement for the exact deployed provider program.
4. Record current mint-specific authority, unencumbered funding, final per-term caps, fee quote and position-level rounding; approve an exact allocation only after these facts exist.
5. Preserve the existing counsel, public specification, notice and on-chain evidence gates. Keep wallet connection, deposits and pool creation closed until separately authorized.

## Proposed bounded pilot funding plan — 2026-10-06

Planning recommendation: start with a smaller, single-entry cohort rather than
commit an annual replenishing program. Use **1,000,000 GFOF aggregate lifetime
accepted principal** as a review scenario, split equally among the four terms.
This is a proposed cap, not an approved allocation or verified token inventory.

| Term | Proposed lifetime accepted principal cap | Gross reward liability at full cap | Planning contingency (10%) | Reward reserve illustration |
| --- | ---: | ---: | ---: | ---: |
| 1 month / 1% | 250,000 GFOF | 2,500 GFOF | 250 GFOF | 2,750 GFOF |
| 3 months / 3% | 250,000 GFOF | 7,500 GFOF | 750 GFOF | 8,250 GFOF |
| 6 months / 8% | 250,000 GFOF | 20,000 GFOF | 2,000 GFOF | 22,000 GFOF |
| 12 months / 12% | 250,000 GFOF | 30,000 GFOF | 3,000 GFOF | 33,000 GFOF |
| **Total** | **1,000,000 GFOF** | **60,000 GFOF** | **6,000 GFOF** | **66,000 GFOF** |

The 10% contingency is an illustrative planning cushion, not a provider
requirement or proof of adequate funding. Final liability must follow the exact
program formula, token decimals and position-level rounding. Network and
platform fees require a separate budget in the asset actually charged; they
cannot be assumed paid by this token cushion.

For comparison, the existing 5,000,000 GFOF equal-cap single-cohort scenario
requires 300,000 GFOF gross rewards, or 330,000 GFOF with the same illustrative
10% cushion. Scale capacity only after unencumbered current-mint inventory and
the complete liability are verified.

### Required cap behavior

The small-cohort calculation assumes a lifetime accepted-principal cap for each
term. Exiting a position must not automatically reopen capacity. No automatic
renewal, reward compounding, cap reuse or additional funded cohort is included.
If the provider supports only concurrent caps, this worksheet cannot establish
a bound: identify enforceable cumulative admission controls or recompute the
maximum liability for every allowed entry before funding. Marketing text or a
per-wallet limit alone cannot enforce a lifetime aggregate cap.

Participant principal belongs to participants and must be accounted for
separately from issuer-funded rewards. The Federation does not need to supply
the 1,000,000 GFOF participant principal in this illustration and cannot count
it as available reward inventory. Verify how the program segregates and returns
principal even if the reward vault is exhausted.

### Inventory record to complete before a funding decision

| Required fact | Current planning status |
| --- | --- |
| Funding wallet and signing authority | Not established by this worksheet |
| Unencumbered current-mint reward balance | Not verified; old-mint balances and locks do not count |
| Migration obligations and other earmarks deducted | Not reconciled by this worksheet |
| Exact provider, program/version and vault controls | Awaiting TBB product details and independent verification |
| Four-term payout formula and enforceable lifetime caps | Not verified |
| Setup, transaction, participant claim/exit fees | Dated quote needed |
| Final token reserve and fee reserve | Calculate after the above; no transfer approved |
| Counsel disposition, required notice and public pool proof | Existing activation gates remain open |

This proposal is ready for a funding discussion once the inventory and provider
facts are supplied. It does not select a provider, create a pool, authorize a
wallet signature, promise rewards or open participation.
