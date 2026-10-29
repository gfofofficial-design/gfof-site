# Alliance/dashboard: current-production integration review

October 29, 2026. Source preparation only. No merge to main, deployment, hosted rehearsal, credential, database or cloud-permission action is authorized by this receipt.

## Inputs and purpose

- Existing top Alliance/dashboard draft: PR169, `53068eded0f8e1afb7cb2ab4b4f6a7d7cf169d04`.
- Published main after PR170: `4238bee2c9e64bf91bf2b59f365230659f1c0e28`.
- Main now includes the PR165 overview, PR167 document keyboard entry and PR170 SOL/GFOF/native-USDC quote preview. The existing protected candidate predates those releases.

The two inputs merge cleanly. This review preserves both histories and adds only authoring-time tool-copy reconciliation. It does not replace or rebuild the earlier protected member implementation. Its parentage includes PR169 and current main; the original stacked PR dependencies still matter. Do not treat the top draft as standalone full-release approval.

## Result

All sixteen incoming main files are byte-identical to published-source main. The newer swap registry, request/projection checks, From/To/reverse UI, five-document skip/main patch and overview remain intact. Runtime/config directories `netlify`, `supabase`, `workers`, `config` and root `netlify.toml` are unchanged from PR169.

The authoring catalog imports symbols from the explicit quote-pair registry so the dashboard describes SOL, GFOF and USDC rather than an older two-token scope. Its action says “Check a token quote.” Generated markup stays checked in; no new browser script, network origin or dependency is introduced. Registry-only changes now trigger the existing Alliance copy checks in both pull-request and main contexts.

## Validation

- 350 focused local swap, wallet, dashboard, account-page, Alliance, constellation, catalog, bounded-read and static-publication cases passed; none skipped.
- Static publication built 641 public files. Operator tools, scripts, tests, server/config implementation, installed dependencies and CI source remain excluded from that artifact.
- 332 internal link references across twelve priority pages resolved, including fragments and exact Netlify rewrites. No missing target or fragment was found in that sample. This is not a full-site audit or hosted acceptance result.
- Native desktop browser inspection confirmed the dashboard's four starting actions, explicit closed states and updated token scope fit the existing layout. No wallet address, sign-in email or protected action was submitted.
- Local static preview cannot establish server/API availability. Its unavailable dynamic reads do not demonstrate a production outage. Physical-phone, assistive, enlarged-text and actual protected-host journeys remain separate acceptance work.

## Preserved gates

Signup and private member features remain closed; Google sign-in is deferred. Galactic Swap still has `TRADING_ENABLED=false`, with no signing, execution or Federation fee collection. PR160's fee preparation remains separate and limited to its reviewed SOL/GFOF scope. This source reconciliation does not verify referral ownership, USDC fee accounts or live transaction behavior.

The October28 owner Dev handoff remains authoritative: independent retained fictional52-table restore and the original encrypted B2 roundtrip passed; do not repeat them. Control revision11 was closed. Corrected complete hosted capture/offsite evidence, operating backups/expiry/retention/alerts, complete managed recovery and protected member/owner journeys remain open. No private Dev files or new hosted result were accessed here. The existing six-month staking copy discrepancy is preserved for dated decision-record reconciliation; no numerical financial terms are changed by this review.

Dev order remains Alliance, dashboard/sign-in, then Galactic Swap. Reconcile this source with actual private receipts before an attended run. Do not reuse closed prompts/tokens, repeat consumed signing/key trials, infer that skipped CI jobs passed, or open access from a public copy change.
