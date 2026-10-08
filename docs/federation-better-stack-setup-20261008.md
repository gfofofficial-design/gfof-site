# Prepared Better Stack homepage checks — October 8, 2026

Status: configuration prepared only. No vendor monitor, subscription, notification or recurring check has been activated.

`config/better-stack-public-monitors.json` contains three exact-200 homepage request bodies and three optional keyword request bodies. Each `body` is a separate create-monitor payload; the enclosing file is our review format, not a bulk API request. All payloads start paused with notification channels disabled.

The proposed interval is three minutes, request timeout ten seconds, failure confirmation sixty seconds and recovery period sixty seconds. TLS verification is enabled and redirects are rejected. These are proposed settings, not observed alert timings.

The optional keyword checks search response content; they do not assert the HTML title, content type, or exact HTTP status. Those stronger combined checks remain in the manual availability checker. Running both vendor types uses six monitors; status-only uses three. Confirm the account's available monitor allowance and cost before creating either set.

Activation needs an identified Better Stack account, chosen notification destination, and configured routing. Review each created monitor's returned settings before enabling it. Use an isolated disposable test target to verify failure notification, acknowledgement and recovery; do not break a production homepage to test alerts. Record actual delivery and recovery results before treating monitoring as operational.

These homepage checks do not establish wallet, RPC, pricing, account login or staking health. Add service checks only when the corresponding service is released.

Reference: [official create-monitor parameters](https://betterstack.com/docs/uptime/api/create-a-new-monitor/).
