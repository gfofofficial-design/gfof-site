# Watchtower RPC allowance — no live limits selected

The separate server-only adapter accepts only the verifier's exact purpose, one request, one-MiB response bound and two read methods. Scope must come from trusted deployment configuration. Positive daily/monthly request limits are explicitly injected; there are no default production limits or client-supplied budgets.

One PostgreSQL upsert reserves both UTC counters atomically on the environment's shared row. It uses database time and cannot roll an already newer period backward. Denied reservations change neither counter. Failed or timed-out RPC requests keep their reservation. Missing or unavailable storage returns false and the verifier does not call the provider. All production callers of this capability must share the same budget; do not create per-wallet/per-worker counters that multiply the approved allowance.

The migration and isolated CI fixture are review-only. CI races twenty reservations against daily and monthly limits, exercises day/month reset and environment separation, and rejects an older period. No live database, key, RPC call or paid budget is created. A request-count ceiling is not a provider-credit or dollar guarantee: provider method costs and any other services sharing the account still need review.

Use the adapter only through the reviewed verifier and transport, with TLS-verified server connections, narrowly reviewed table grants, database deadlines and deployment-wide approved limits. Browser clients must never receive database credentials or direct access. Production budget choice, provider plan/cost, migration/retention and live activation remain owner decisions.
