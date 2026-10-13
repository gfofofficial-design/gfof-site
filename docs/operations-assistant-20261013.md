# Operations assistant foundation

Run `node scripts/federation-operations-brief.mjs` for one finite check of the three canonical public homepages and their dashboard links. The report uses reviewed rules, not an AI model. It produces evidence-linked investigation tasks rather than making repairs. P1 availability findings come before P2 navigation or size-limit findings. Provider error text and page bodies are not included.

Only fixed canonical targets are accepted. Inconsistent, duplicate, future-dated or unsupported evidence is refused. Evidence older than fifteen minutes produces a stale-check status and requires a fresh run. Supplied check data is not cryptographically authenticated. A successful page check does not clear Safe Browsing or prove account, API, financial or security readiness.

No schedule, model credential, messaging, deployment or account access is added. Tests use synthetic checks only. A manually authorized run may contact the three public homepage URLs, with the existing checker’s byte/time limits and no credentials. The assistant does not call price, RPC, auth or model services.

## Release evidence comparison

`node scripts/check-release-evidence.mjs < reviewed-public-evidence.json` accepts at most 32 KiB of public metadata on standard input and makes no network calls. The JSON has schema=1, checkedAt (canonical UTC ISO), expected (exactly Command and Dossier site/siteId/commit records) and deploys (up to two site/siteId/deployId/commit/state/context/branch/publishedAt records). Each commit is a full lowercase SHA; each deploy ID is 24 lowercase hexadecimal characters. Use null for unavailable commit or publication time. Dates cannot be in the future.

Expected commits must be taken from independently reviewed owner release approvals, never copied from the observed deploy to manufacture a match. Read only the currently published deploy through the existing Netlify connector and normalize the allowlisted fields. Do not export a whole provider response, environment variables or credentials. The comparison checks ready production/main publication and exact commit equality. It refuses wrong site bindings, duplicates and malformed evidence. Missing, stale, preview, unpublished and unexpected-commit evidence stays explicit. It cannot establish release ordering or whether a change was authorized; a mismatch requires review, never automatic deployment. FCC release metadata is not covered.

The core does not authenticate either supplied approvals or deploy snapshots. Connector provenance and an independently recorded approval remain operator responsibilities. Metadata equality does not prove served-file parity, security or sign-in. A new approved release requires a new expected-commit record; there is deliberately no self-updating baseline in code.

Next stages: authenticated deployment evidence; durable incident deduplication; owner-approved cadence and notification destination; then optional AI-drafted explanations bound to the evidence. AI must not turn a timeout into an invented root cause, or homepage availability into a security verdict. Watchtower follows this operating foundation with separately reviewed live-source authentication, finality, deduplication and coverage controls.
