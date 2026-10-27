# GFOF swap: wallet integration decision

The quote preview remains functional, wallet-free and closed to trading. No runtime package, wallet permission or hosted configuration was changed by this review.

## Recommendation: option A

Continue the existing Jupiter Swap API V2 interface with a small Wallet Standard connection layer. Build the next increment as an opt-in, address-only wallet preview before adding signing or execution.

The reviewed connection candidate pins `@wallet-standard/app`, `@wallet-standard/base` and `@wallet-standard/features` to 1.1.1. Registry integrity matched all three tarballs. Lock-only resolution succeeded with lifecycle scripts disabled; the dependency check reported zero known advisories. The review lock and metadata are retained alongside this document.

This covers discovery/connection support only. It does not audit wallet extensions, transaction codecs, application logic or a complete swap, and zero reported advisories is not a safety guarantee. GFOF would maintain more wallet lifecycle, transaction-review and failure-handling code than with a full widget.

## Option B: wait for an acceptable full widget

Keep the wallet-free quote preview and official external trading link while a maintained Jupiter Plugin build is reviewed. The 1.0.16 candidate's dependency graph reported 116 findings, including two critical. Application reachability remains unassessed; these are not findings against the deployed GFOF quote page. Its report is in `jupiter-plugin-candidate-20261026.json`.

The published package and inspected repository head differ in version. Dependency remediation, exact source/build parity, dynamic remote assets, default auto-connect and network origins still need acceptance. The full-widget graph and a connection-only layer are different scopes; their advisory counts are not a like-for-like security comparison.

## Scope proposed after choosing A

1. Discover compatible installed Solana wallets and let the visitor choose a wallet explicitly. Do not auto-connect or treat a registered name/icon as a trust certificate.
2. Preview the connected public address locally, with clear disconnect and account-change behavior. Keep wallet addresses out of the existing quote requests and separate from Federation sign-in.
3. Clear stale state on account changes, disconnection, navigation or uncertain/late connection results. Make no signing or trade-submission request in this increment.
4. Review the eventual transaction components, order binding, fees and enforced protections separately. Complete hosted, browser/mobile, failure and owner-run small-trade acceptance before proposing live trading.

The decision is whether to take on the leaner API-based integration or wait for the full widget. It does not approve deployment, financial transactions, new fees or a paid service plan. Trading remains closed through implementation and acceptance.


Owner decision, 2026-10-26: Michael approved Option A (“proceed with A”). Implement the self-hosted Wallet Standard address-only preview; this does not authorize transaction execution or deployment.
