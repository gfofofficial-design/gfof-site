# DeFi education and tool priorities — November 23, 2026

Adds stablecoins, collateral/liquidation, bridges and token-control lessons to the existing public Learn page. Sources are linked per lesson: ethereum.org/stablecoins, ethereum.org/bridges, Aave health-factor documentation and Solana token-extension documentation. Educational examples do not activate Federation lending, staking, bridging or funded Swap. No wallet, account, storage, provider or paid API is needed.

The new local collateral-shock tool holds debt and threshold fixed and demonstrates a liquidation boundary, without recommending a safe borrowing level. Static text preserves its explanation without JavaScript.

## Member and project tool priorities

1. Extend the existing Swap quote evidence into a side-by-side total-cost worksheet: quote timestamp, minimum received, fees and gross account funding. Keep executable trade and price forecasts out of the educational result. Reuse the current cost/cap work rather than another trading UI.
2. Extend Dossier Lens explanations to map known token authorities/extensions to plain-language consequences. Keep unsupported fields unknown; do not infer safe from revoked mint authority. No paid provider is required for the educational glossary.
3. Prepare a project disclosure worksheet covering token controls, treasury roles, unlock evidence, liquidity dependencies, change authority and dated corrections. Reuse existing public-record/treasury standards instead of generating a safety score.

These are prioritized follow-on proposals, not shipped tools. The education change is a separate review draft on current public main, independent of the held Dashboard stack. Before release: current CI, keyboard/visual/narrow-width review and applicable release allowance. No production merge/deployment or paid subscription is performed here.

## Recent releases and research reviewed from Work

Reviewed November 23, 2026. These are candidates and design requirements, not installed or activated Federation services. Publication dates below come from the publishers; existing Birdeye work is not a new completed feature.

| Finding | Evidence and relevance | Decision / bounded next step |
| --- | --- | --- |
| Birdeye Data Skills, November 17 | Twenty read-only research workflows; estimates and saved-result reuse can reduce repeated requests. Live access still depends on endpoint entitlement. | Evaluate a saved-evidence import into the existing Dossier preview, rather than expose a second live research interface. No upgrade recommendation until endpoint access, billing and acceptance are established. |
| Solana Microscope, October 5 | Open-source, self-hosted program/optional Squads monitoring; distinguishes program activity from datasource health. Requires a program ID/IDL and an operated stack. | Candidate for project operations, not a general wallet/holder tracker. Inventory a genuinely relevant program and owner first. No deployment or new monitoring subscription from this review. |
| LI.FI agent-wallet report, November 17 | Small-sample tests identify hazards around units, expired quotes, uncertain failures and destination arrival. This is vendor research, not a wallet ranking or Federation test. | Extend existing Swap/Agent acceptance: preserve units and deadlines; distinguish unknown from failed; verify destination amount and partial/refunded status; do not automatically resend after timeout. Funded Swap stays paused. |

### Birdeye source caveat and acceptance proposal

The current upstream README describes pre-1.0 development version 0.4.0 with no tagged release baseline, source/tarball distribution, Node 22.16+ and WSL for Windows (native Windows unvalidated). Its `--max-cu` limits documented estimates, not confirmed billing; retries and unknown costs need independent controls. A skill installer alone does not install/configure the CLI. This makes an unreviewed global install on Work a poor next step. No CLI or third-party skill was installed.

A proposed offline saved-evidence adapter must identify source/version, acquisition time, chain and exact token/wallet; list missing fields and bounded-page coverage; distinguish provider labels/heuristic scores from verified facts; reject malformed, oversized or stale inputs explicitly; display imported text without executing it; and make zero network requests. Existing Birdeye entitlement/setup/bounded acceptance remains separate. This is a specification, not an implemented adapter.

### Monitoring and transaction acceptance proposals

For any later Microscope trial, document which program and IDL are covered, who owns datasource credentials, retention/cost and how a deliberately stale datasource is shown as unknown rather than quiet activity. This does not clear Alliance/backend acceptance or reopen access.

For a later offline Swap/Agent fixture extension, include an expired quote, a unit mismatch, a timeout with an existing transaction hash, and a partial/refunded bridge result. Acceptance requires no automatic transaction retry and an explicit distinction between source broadcast and destination completion. These requirements do not authorize new provider calls, wallet connection or execution.

### Primary sources

- Birdeye announcement (November 17): https://birdeye.so/data-api/blog/detail/birdeye-data-skills-on-chain-crypto-research-skills-for-ai-agents
- Birdeye source README, reviewed current main (mutable): https://github.com/birdeye-so/birdeye_cli/blob/main/README.md
- Solana Microscope announcement (October 5): https://solana.com/news/solana-microscope
- LI.FI report (November 17; one standard sample per wallet, collected October 22–30): https://li.fi/knowledge-hub/testing-12-agentic-wallets-where-agent-payments-break-and-how-to-fix-them

No live tool was installed, paid query issued, wallet connected, infrastructure changed, email sent or release gate cleared during this research.

## Work browser verification follow-up

Local Cloud Chrome verified the fictional calculator results 1.60 (0%), 1.28 (20%) and 0.96 (40%). Enter submits and retains button focus. Tab reaches the lending disclosure; Enter opens/closes it, and Shift+Tab returns to the calculator button. A visual check found unstyled calculator controls; the fix reuses the existing liquidity form styles, with a labelled/described form, grouped label/select and a separate result row. After the fix, select and button both measured 44px high with 16px text. Desktop document width 1348px fit the 1363px viewport. This is local development evidence, not hosted, narrow-screen, physical iPhone or spoken VoiceOver acceptance. Those gates remain open.

## Enlarged text and narrow reflow

Cloud Chrome local QA on November 23: 200% zoom measured viewport 681px/document 674px. At 400%, viewport 340px/document 337px. No horizontal overflow was present in either measurement. At 340px, selecting 40% and submitting with Enter produced 0.96 and retained button focus; Tab/Enter opened the lending disclosure with visible focus and wrapped text. Browser zoom was restored to 100%. Developer Tools were unavailable under browser policy; no policy was changed. These checks use ordinary page zoom, not mobile device emulation, and do not establish 320px, Safari, physical iPhone or spoken VoiceOver acceptance.
