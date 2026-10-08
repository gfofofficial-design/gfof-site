# Current-mint lock reader reliability — October 8, 2026

The deployed current-mint treasury page showed its dated 100M snapshot correctly,
but direct browser RPC reads failed in the preview browser. This change routes
live reads through a read-only same-origin endpoint.

The endpoint accepts GET only, no query parameters, and rejects a different
Origin when present. It always reads exactly the three metadata accounts,
their three verified escrows, and the current mint using finalized
getMultipleAccounts. No user input can select an upstream URL, RPC method,
account or credential. It has an eight-second upstream deadline, response size
check, rate limit (30 per IP/domain per minute), 30-second shared cache and
noncacheable generic errors. No secrets, new providers or dependencies.

The browser shares one response per refresh across all three cards. It retains
metadata program/version/mint and escrow owner/mint/decimal checks, caps at
remaining scheduled principal, and reports partial/unavailable data explicitly.
It rejects responses with invalid or more than two-minute-old observation times.
The read timestamp shows the server observation and finalized slot. The mint
supply and six decimals must match the 1B denominator; changes require review.

Validation: 13 Node tests passed locally: fixed-account joint read/headers,
request boundaries, HTTP failure, timeout rejection, upstream errors, missing
accounts, wrong supply/decimals, oversized response, one shared browser request,
100M principal/10%/August 18 Chicago next unlock, offline/stale response and
wrong escrow mint. VM tests use saved RPC evidence and a stub DOM, not a real
wallet or browser. A dedicated GitHub workflow runs the same tests. Preview
endpoint and rendered page must pass before production release.

No wallet connection, signature, fund movement, signup, staking or lending
change. The dated evidence and former-mint archive remain unchanged.
