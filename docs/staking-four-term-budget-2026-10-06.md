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
