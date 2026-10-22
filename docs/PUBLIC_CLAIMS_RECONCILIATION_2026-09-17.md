# Public Claims Reconciliation — 2026-09-17

## Purpose

Reconcile public GFOF surfaces with the verified launch mechanics and current authorization boundaries. This pass changes public claims and status labels only. It does not execute AWS work, deploy FCC intake, activate token utility, move assets, or transfer authority.

## Controlling facts

- Canonical token: `2oQmHWoTZRmRLregHKjBSGJy3ueX3iRNzimy2iZCmoon`
- Live trading venue: Meteora Dynamic Bonding Curve
- Verified pair: `3y4NNTfU3y1KzCChAJyQUv5RmX3zuZNxVbXer2vjASGE`
- Quote token: USDC
- Configured migration threshold: `66,040.882531 USDC` quote reserve
- Configured migration destination: Meteora DAMM v2
- Creator migration liquidity: 100% permanently locked
- Live reserve/progress: unavailable unless a canonical reserve source is present
- Market capitalization and FDV are not migration-progress inputs

## Authorization boundaries

- Migration does not activate staking, NFT utility, rewards, reserve distributions, or binding governance.
- The Realms deployment remains advisory. No treasury, repository, site, or token authority is routed through it.
- No Founding Member NFT snapshot, claim, or launch is authorized.
- The prior Moonshot/Raydium creator-fee design is superseded and inactive.
- Dossier paid tiers remain closed. Venue-specific revenue routing is inactive.
- Federation Record standing remains permanently non-economic under commitment #029.
- FCC public intake remains blocked unless a recorded authorization opens it.

## Surfaces reconciled

| Surface | Change |
| --- | --- |
| Home | Removed $73K/Raydium framing and FDV-derived progress; added fail-closed DBC status |
| FAQ | Replaced obsolete launch, staking, NFT, governance, and routing claims in visible copy and JSON-LD |
| Roadmap | Replaced bond gate with the verified DBC threshold; marked fee/access designs superseded in part |
| App | Removed market-cap progress calculation and corrected the migration card |
| Intel | Removed promotional bond/NFT claims, failed progress closed, and set `noindex` |
| Command preview | Corrected launch and authority claims and set `noindex` |
| AI policy | Replaced stale facts and prohibited treating superseded mechanisms as current |
| Whitepaper | Updated to v1.2 and regenerated the PDF |
| Creator-fee spec | Preserved as historical, marked superseded and inactive |
| Access spec | Preserved as historical, marked partially superseded and inactive |
| Governance spec | Removed automatic post-migration authority and NFT assumptions |
| Corrections log | Added correction #035 without altering historical entries |
| RSS / machine-readable text | Added #035 and updated current facts |
| Sitemap | Updated dates and removed the internal Intel updater from indexing |

## Live preview QA follow-up

The first Netlify deploy preview exposed four issues that static validation did not: the current Command home still named Moonshot, retained a buy-pressure CTA, used pre-bond status labels, and allowed decorative/off-canvas elements to create horizontal page overflow. The same pass also found a stale Raydium question label in FAQ structured data, a stale post-bond governance metadata promise, and the retired legacy homepage still reachable at `/index.html`.

The review branch now names Meteora DBC and pre-migration status on Command, links the verified Meteora pool as a verification action, clips off-canvas decoration at the document boundary, removes the stale FAQ and governance metadata claims, and redirects `/index.html` to the current Command home. The historical file remains in the repository for review, but it is no longer a separately reachable Netlify surface.

## Historical material preserved

Older corrections entries and dated research posts are intentionally not rewritten. They are evidence of what was stated at the time. Correction #035 supplies the superseding record.

## Follow-up work not authorized by this change

1. Build a canonical on-chain reserve reader before restoring any live migration percentage.
2. Replace the creator-fee specification only after current Meteora fee mechanics and custody paths are verified and reviewed.
3. Reconcile Dossier correction #006 on the Dossier property before paid access is reconsidered.
4. Review reserve and wallet terminology for any remaining implication that a designation authorizes distribution.
5. Resume FCC staging only after the AWS Lambda concurrency quota is actually raised and re-verified.
