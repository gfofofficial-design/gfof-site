# Public availability check — review build

The configuration and script prepare the first monitoring phase in the
[supporting-tools roadmap](federation-supporting-tools-roadmap-20261008.md).
They are a manual check, not a configured alert service.

Run from the repository with Node.js 24:

```sh
node scripts/check-public-availability.mjs
```

The script reads only the three fixed public homepages. It requires HTTP 200,
HTML content and the expected title within the first 64 KiB. Each request has
a ten-second deadline covering response headers and body reads; redirects are
rejected. Results contain only the fixed site URL, status, generic reason,
duration and observation time. Exit 0 means all three passed; exit 1 means one
or more checks failed.

A successful result establishes homepage availability only. It does not prove
account sign-in, wallet balances, RPC availability, Lens lookup, record storage
or financial-service readiness. It makes no authenticated or chain requests.

For Better Stack configuration, use these three public URLs as the initial
targets and retain expected-content checks where supported. Review check
intervals, alert recipient, retention and cost before activation. Test both
failure and recovery notifications and record a responder rehearsal before
counting monitoring as operational.

The repository currently contains no recurring schedule, vendor credentials,
alert destination or configured delivery for this check.

Fixture verification:

```sh
node --test tests/public-availability.test.mjs
```

Tests cover expected pages, false-positive HTTP 200, wrong content type, missing
or oversized titles, generic failure output and stalled transports that ignore
abort. Ordinary availability errors do not expose fetched body contents.

## October 8 manual evidence

A live run at 2026-10-08 19:51:34 UTC (2:51 PM Chicago) passed all three fixed
homepage checks: Federation, Dossier and FCC returned HTTP 200 with the
expected title. This is one observation, not continuous uptime evidence.

Six fixture tests pass locally. A large response chunk with an expected title
inside the bounded prefix is accepted; content beyond that prefix is not
needed to verify the homepage. Alert delivery and recurring monitoring remain
unconfigured.
