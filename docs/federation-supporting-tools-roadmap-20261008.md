# Federation supporting tools — integration roadmap

Owner direction recorded October 8, 2026: add complementary tools when they fit
the build. This plan records intended work; the tools below are not represented
as configured, verified or live.

## Priority and acceptance

| Phase | Candidate | Purpose | Evidence before activation |
| --- | --- | --- | --- |
| 1 — Monitoring | Better Stack | Watch Federation, Dossier and FCC availability and route actionable outage alerts to the designated responder. | Agreed check intervals and costs; expected success conditions; a simulated failure and recovery that deliver alerts; an actual response rehearsal. |
| 2 — Chain reads | Helius | Evaluate managed Solana RPC for Wallet radar, Lens and lock observations; assess history APIs for later features. | Compare the same public addresses and finalized source observations against current reads; measure latency, failure rate, request limits and cost; exercise timeout, malformed-response and unavailable-service behavior. |
| 3 — Error diagnosis | Sentry | Diagnose application and function failures with versioned error events. | Review data collection and retention, verify scrubbing with synthetic events, trigger and resolve a known test error, and confirm useful alerts without exposing sensitive data. |

Better Stack monitoring is the first planned addition because actionable
monitoring and response are already release requirements. Evaluate its error
tracking alongside Sentry before selecting overlapping services.

## Monitoring implementation scope

Begin with public page availability on GalacticFederation.co, Dossiertrack.co
and fcc.galacticfederation.co. Add narrowly scoped service checks as each service
is activated. A page returning 200 does not prove its underlying data provider
works.

Use lightweight checks with documented expected responses. Closed or
unpublished account/report routes are not healthy active services returning
200; their expected closed state must not become a false outage alert.
Choose intervals that respect hosting and provider budgets. Monitor data-service
availability without polling arbitrary wallets or generating repeated full
Lens reports.

Record the responder, alert channel, escalation time, failure/recovery test and
runbook before counting monitoring as complete. A configured monitor alone
does not close the monitoring/response release gate.

## Helius evaluation scope

Start with server-side read-only RPC. Preserve exact quantity arithmetic,
token-program validation, per-read source slots, explicit commitment, current
mint checks and visible unknown/error states. Keep provider credentials on the
server and redact them from logs.

Benchmark a bounded set of public fixtures and addresses against the existing
implementation before choosing a plan. Record the actual method coverage,
limits, costs and behavior under outage. If fallback providers are proposed,
test them explicitly and preserve provenance; do not label mixed observations
as one atomic snapshot.

Historical wallet charts and transaction interpretation are separate features.
A richer API does not by itself establish profit, beneficial ownership, a sale,
or staking eligibility.

## Error-reporting scope

Prefer minimal diagnostic events: component, release revision, generic error
category, time and an incident identifier. Review vendor retention and access.

Exclude access/refresh tokens, cookies, OAuth codes, credentials, request bodies,
wallet addresses and balances from diagnostic events. Disable session replay
and broad automatic capture in the initial proposal. Verify the exclusions
with synthetic error events before deployment.

Measure whether the events help diagnose a real failure. Choose one adequate
error service rather than paying for overlapping coverage by default.

## Birdeye's complementary role

Birdeye remains a candidate source of market and token-account data under its
subscribed endpoint coverage, limits and terms. Its support clarification
allows attributed public display and generally covers the proposed caching and
retention, subject to those terms.

Display **Powered by Birdeye** where Birdeye-sourced data is used. Paid analytics
must qualify through substantive computation or transformation; sorting,
formatting and caching alone do not qualify. Review each proposed paid output
against the permission boundaries before release. Do not treat raw-data
redistribution as an approved product.

## Delivery order

1. Prepare the monitoring configuration and response test for review.
2. Verify alert delivery and recovery behavior in the approved environment.
3. Benchmark Helius reads, select the appropriate limits and cost ceiling, then
   prepare a reviewable server-side integration.
4. Evaluate error-service coverage, implement minimal collection in a preview,
   and verify exclusions and incident diagnosis.
5. Apply each tool to later features only after their own acceptance.

Choose actual plans, costs, access and retention before activating services.
New tools do not substitute for the existing account, wallet, privacy, recovery,
independent review or financial-provider gates.

## References

- [Better Stack monitoring](https://betterstack.com/docs/uptime/monitoring-start/)
- [Helius Solana data APIs](https://www.helius.dev/docs/getting-data)
- [Sentry error monitoring](https://sentry.io/product/error-monitoring/)
- [Federation release checkpoint](federation-release-checkpoint-20261008.md)
- [Security release gates](federation-security-release-gates.md)
