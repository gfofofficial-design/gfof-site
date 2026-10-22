# Operations assistant foundation

Run `node scripts/federation-operations-brief.mjs` for one finite check of the three canonical public homepages and their dashboard links. The report uses reviewed rules, not an AI model. It produces evidence-linked investigation tasks rather than making repairs. P1 availability findings come before P2 navigation or size-limit findings. Provider error text and page bodies are not included.

Only fixed canonical targets are accepted. Inconsistent, duplicate, future-dated or unsupported evidence is refused. Evidence older than fifteen minutes produces a stale-check status and requires a fresh run. Supplied check data is not cryptographically authenticated. A successful page check does not clear Safe Browsing or prove account, API, financial or security readiness.

No schedule, model credential, messaging, deployment or account access is added. Tests use synthetic checks only. A manually authorized run may contact the three public homepage URLs, with the existing checker’s byte/time limits and no credentials. The assistant does not call price, RPC, auth or model services.

## Release evidence comparison

`node scripts/check-release-evidence.mjs < reviewed-public-evidence.json` accepts at most 32 KiB of public metadata on standard input and makes no network calls. The JSON has schema=1, checkedAt (canonical UTC ISO), expected (exactly Command and Dossier site/siteId/commit records) and deploys (up to two site/siteId/deployId/commit/state/context/branch/publishedAt records). Each commit is a full lowercase SHA; each deploy ID is 24 lowercase hexadecimal characters. Use null for unavailable commit or publication time. Dates cannot be in the future.

Expected commits must be taken from independently reviewed owner release approvals, never copied from the observed deploy to manufacture a match. Read only the currently published deploy through the existing Netlify connector and normalize the allowlisted fields. Do not export a whole provider response, environment variables or credentials. The comparison checks ready production/main publication and exact commit equality. It refuses wrong site bindings, duplicates and malformed evidence. Missing, stale, preview, unpublished and unexpected-commit evidence stays explicit. It cannot establish release ordering or whether a change was authorized; a mismatch requires review, never automatic deployment. FCC release metadata is not covered.

The core does not authenticate either supplied approvals or deploy snapshots. Connector provenance and an independently recorded approval remain operator responsibilities. Metadata equality does not prove served-file parity, security or sign-in. A new approved release requires a new expected-commit record; there is deliberately no self-updating baseline in code.

Next stages: authenticated deployment evidence; durable incident deduplication; owner-approved cadence and notification destination; then optional AI-drafted explanations bound to the evidence. AI must not turn a timeout into an invented root cause, or homepage availability into a security verdict. Watchtower follows this operating foundation with separately reviewed live-source authentication, finality, deduplication and coverage controls.

## Combined manual report

Run `node scripts/federation-operations-report.mjs < reviewed-public-evidence.json` to validate bounded UTF-8 release evidence before making one fixed public-page pass, then print one dated report. Supply the same independently reviewed expected revisions and fresh deployment snapshot accepted by the release-evidence CLI. The runner captures the input so callers cannot replace the approval baseline while the page check is running. Freshness is evaluated again at completion.

The combined investigation list places availability tasks before release/navigation review. Missing or stale evidence remains a review task. `checked_scope_ok` now also requires eight public tool destinations to return their expected HTML page title, in addition to the three homepages/links and Command/Dossier publication metadata. It does not approve Safe Browsing, sign-in, monitoring or financial features. The checkers make ordinary public GET requests only. There are no provider RPCs, credentials, cloud mutations, repairs, scheduled calls or messages. Exit status is 0 for checked scope, 1 for review-needed and 2 for invalid/unavailable evidence. Raw input extras and diagnostic errors are not printed.

Synthetic composition/CLI tests cover invalid preflight before either checker, combined task priority, tool-page failures, post-check freshness, malformed/oversized input, omitted raw fields and immutable release expectations. Runtime behavior remains manual; this is not a live autonomous operations agent.

## Public tool-page delivery

`node scripts/check-federation-tools.mjs` makes one bounded check of each destination below. The combined report includes the same results under `toolPages`; the existing homepage-only brief command remains available.

| Page | Fixed destination |
| --- | --- |
| Command Deck | https://galacticfederation.co/command-deck |
| Alliance / Community League | https://galacticfederation.co/alliance |
| First Contact Journey | https://galacticfederation.co/journey/ |
| Staking preparation | https://galacticfederation.co/staking |
| What we're building / lending status | https://galacticfederation.co/building |
| Treasury / public records | https://galacticfederation.co/treasury |
| Dossier Structure Lens | https://dossiertrack.co/token-structure |
| GFOF published project evidence | https://dossiertrack.co/projects/gfof |

Coverage expanded October 17 to include the published GFOF evidence entry point. Its expected title identifies the October 8 record; a matching title does not refresh that evidence or verify lock facts. Update the reviewed expected title when that record is deliberately replaced. Earlier seven-page captures do not satisfy the expanded target set; run a new finite check rather than filling a missing result.

Every page needs HTTP 200, an HTML response, valid UTF-8 within 1 MiB and the reviewed title. This catches missing routes, non-HTML responses and many generic error/homepage responses that otherwise return 200. Title comparison tolerates ordinary whitespace and a small explicit set of entity spellings. A title is only a page-identity marker; it does not validate complete source integrity or prevent a different document from copying the title.

The eight destinations are fixed in source. No command-line URL override, account page, preview domain, query string or API endpoint is accepted. Reads omit credentials, refuse redirects and do not execute scripts or request linked resources. Two bounded tool probes are scheduled at a time; each request and body has a ten-second default deadline (fifteen-second maximum for injected/test options) and no automatic retry. Unused or unfinished response bodies are canceled without waiting indefinitely for cancellation. A transport that ignores abort may outlive its probe, so this is not a guarantee of physical cancellation or two underlying network requests at all times. There are at most eight tool fetch attempts in one pass, and late completion cannot change the returned result.

The evidence validator refuses unknown/duplicate bindings, inconsistent flags, future dates and unsupported reasons. Evidence older than fifteen minutes becomes stale rather than a current delivery verdict. Only fixed URLs and allowlisted diagnostic fields enter output. Availability/identity findings are P1 investigation tasks; oversize responses are P2 review tasks. These labels do not establish an incident's cause.

The report runs homepages and tool checks concurrently, making eleven fixed public HTML requests in one manual pass. A successful result does not test page rendering, JavaScript, accessibility, wallet balances, prices, Google sign-in or transaction behavior. Staking remains preparation, lending remains in development and League enrollment remains closed. Google's private-preview warning and the existing account-release gates remain separate.
