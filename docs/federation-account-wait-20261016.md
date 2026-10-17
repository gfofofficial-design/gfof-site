# Account browser wait recovery — October 16, 2026

Scope: draft account PR #99. This is source and offline test evidence, not a
production account release, provider test or Google warning clearance.

The earlier page used a 12-second deadline for every account request. The
unchanged server bounds each provider read at eight seconds; refresh can require
two sequential reads and logout can require three. The browser could therefore
stop waiting before a slow, valid server operation finished. A transport or body
reader that ignored abort could also hold the page and its session lock open.

## Changed contract

| Page request | Browser wait for fetch and JSON body together |
| --- | ---: |
| Configuration, session and OAuth start | 12 seconds |
| Refresh | 20 seconds |
| Logout | 30 seconds |

Each request races its complete fetch/body read against explicit deadline
rejection, passes an AbortSignal and removes its timer/listener on settlement.
A response received after abort is not read. There is no added retry. Existing
generation checks, sign-out notices, URL validation and same-origin session
exclusion remain in place. The separate 20-second browser-lock acquisition wait
is unchanged; it is not a deadline for work that already holds the lock.

Browser abort does not prove that server processing stopped, that a provider
refresh/revocation was cancelled, or that late Set-Cookie behavior is impossible.
The synthetic tests establish page state and operation ordering only. Actual
browser cookie rotation, multi-tab behavior and provider outcomes remain release
acceptance requirements. A timed-out logout does not claim successful sign-out.

## Verification

The actual browser script passes 41 focused page/tab/wait tests, including 16
new deterministic cases. Tests cover stalled headers/body even when abort is
ignored, all five operation deadlines, late result suppression, refresh completion
after the former cutoff, a 23-second logout, manual retry, error text and cleanup.
Three selected regressions fail against the preceding script: stalled-config
recovery and the slow refresh/logout paths. JavaScript syntax check passes.

No provider request, real Google login, account deletion, database operation,
credential action, provider-setting change or signup opening was used for this
change. The provider/session backend and its cookie rules are unchanged.

Google acceptance remains pending. The latest recorded owner warning observation
is October 14; the October 16 browser connection was unavailable and supplied no
new verdict. Keep the account PR draft and follow the
[release acceptance gates](https://github.com/gfofofficial-design/gfof-site/blob/ca7ee973274c90651a2a175d869fa7ab298b4728/docs/federation-google-release-acceptance-20261013.md)
before any real sign-in testing or production account release.

Later October 16 owner-supplied Search Console evidence still showed one
Deceptive pages issue. Google fetched the page successfully, loaded the six
expected local resources and reported no JavaScript console messages. The
[dated presentation and warning packet](federation-google-signin-review-20261016.md)
records the subsequent source review and separate Google button correction.
The cause remains undetermined and sign-in acceptance remains paused.
