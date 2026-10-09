# Manual Command Deck service checks

This candidate adds a finite service checker for the read-only Command Deck.
It is prepared for monitoring acceptance; it creates no monitor, schedule,
subscription, notification or background process.

Run with Node 24 and an explicit environment:

    node scripts/check-command-deck-health.mjs --preview
    node scripts/check-command-deck-health.mjs --production

The only supported destinations are the PR104 preview and the canonical
Federation production origin. The production command is for acceptance after
an approved release; the wallet route is not assumed to exist before release.
Each invocation makes exactly two application requests with no retries:
one public-mint address lookup and one GET for the three fixed lock records.
These routes can make upstream Solana and Jupiter requests. Do not schedule
them until operating limits, routing and the alert process are approved.

The wallet check rejects non-200 or non-JSON responses, wrong address/network,
invalid quantities, duplicate token mints and invalid context slots. It checks
a fresh observation and a usable SOL reference price from Jupiter. Missing
pricing is reported separately from complete service failure. Zero balances
on the public mint address are valid; this probe establishes neither wallet
ownership nor a populated holder-wallet comparison.

The lock check verifies fresh finalized data, the seven exact distinct accounts,
the current mint supply and authorities, Streamflow metadata layout, embedded
mint/escrow keys and supported full-cliff schedule fields. Escrow amounts must
have the expected token program, mint, decimals and integer format. It does not
assert an unchanging locked total, monitor transfers or authorize transactions.
The dashboard and dated treasury evidence remain the place to inspect totals.

Both response headers and streamed bodies share a 15-second deadline, even
when a transport ignores cancellation. Wallet JSON is capped at 256 KiB and
lock JSON at 32 KiB. Observations older than two minutes or more than thirty
seconds into the future fail validation. Output contains only fixed endpoint
URLs, time, status, generic reason and duration. No response bodies, balances,
account records, provider errors, credentials or personal addresses are logged.
Exit 0 means both checks passed, exit 1 means a failure or degraded pricing,
and exit 2 means invalid command arguments.

CI runs synthetic fixtures and fault cases only. A passing manual invocation
is one observation, not uptime history or proof that anybody received an alert.
Before Better Stack activation, inspect the existing account, monitor allowance
and actual costs, select the responder and channels, then verify failure,
acknowledgement and recovery using an isolated test target. A paused monitor
or a green homepage alone does not complete monitoring acceptance.
