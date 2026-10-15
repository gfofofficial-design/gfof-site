# Federation public-page checker

Owner-requested operations-bot foundation, October 13, 2026. Run manually:

```sh
node scripts/check-federation-pages.mjs
```

The checker performs exactly one credential-free GET to each fixed public homepage: galacticfederation.co, dossiertrack.co and fcc.galacticfederation.co. It checks HTTP 200, HTML content type and a canonical Command Deck anchor. Each request has a ten-second deadline and one-MiB body ceiling; redirects are refused. No retries, RPC, pricing, Auth-provider, account-session or AI calls are made. Output contains sanitized results, never page bodies or cookies.

The output explicitly leaves security verdict and account acceptance unassessed. A successful page check does not clear a Safe Browsing warning, prove login, audit scripts or assess financial readiness. A missing link is a failed page check, not an accusation of compromise.

This change installs no schedule and sends no alert. Before adding a recurring job, choose an operator, cadence, escalation channel and retention. Reuse the existing Command Deck service checker only when its separate provider-read budget is explicitly intended; do not silently attach service reads to this page checker.

Tests use synthetic responses and cover missing/cross-domain links, cancellation-resistant stalls, oversized bodies, invalid deadlines and fixed credential-free destinations. The Voss changes update its dated briefing and common reviewed replies; they do not make it a live retriever or change model credentials, rate limits or model selection.
