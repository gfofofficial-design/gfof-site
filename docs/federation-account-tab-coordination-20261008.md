# Account tab coordination — October 8, 2026

Scope: PR99's private account page. Public registration and financial activation
remain closed. This change does not modify the Auth handler, provider configuration,
signup hook, account database, credentials or production deployment.

## Problem and resulting behavior

Independent tabs could inspect the same expired access cookie and both rotate the
shared refresh cookie. The logout page also immediately reran session inspection;
a leftover-session response could restore its signed-in display. Other open tabs
did not receive logout status or recheck a stale display when revisited.

The revised page uses a same-origin exclusive Web Lock named
`gf-account-session` around configuration/session reads and account-page OAuth,
refresh and logout requests. A waiting tab reads configuration and shared cookies
after acquiring the lock, so a successful refresh by the first tab removes the
need for a second refresh. The lock is advisory browser coordination, not server
authorization or a distributed lock.

Logout immediately removes the displayed identity and invalidates pending UI
results. It does not automatically inspect or refresh again. A successful browser
logout broadcasts only `{type: 'signed-out', remoteRevoked: boolean}`; no token,
email, wallet address or sign-in proof is sent. A receiving tab hides identity,
discards pending results and requires an explicit sign-in action. Unknown messages
cannot establish identity. Remote revocation retains the handler's existing,
explicit confirmed/unconfirmed distinction.

Visible-tab and restored-page checks clear stale identity before asking the server
again. A generation guard rejects late identity, error and navigation results.
Sign-in options remain usable when a logout occurs during initial configuration.
No account identity, coordination data or new progress is stored locally.

## Bounded failures and compatibility

- Account requests have a 12-second browser deadline, covering response-body reads.
- Waiting lock requests have a 20-second acquisition deadline.
- Normal completion, failures and body-read cancellation release the lock.
- Without Web Locks, existing valid access can still be inspected. An expired
  session requires a new sign-in rather than an uncoordinated automatic refresh.
- Broadcast Channel is optional. Without it, a revisited tab rechecks with the
  server; immediate cross-tab display notification is unavailable.
- Browser abort is best effort. It does not prove that an already received
  server/provider request stopped, or that every remote token was revoked.

The coordinator covers this page's cooperating requests, not OAuth callback
navigation, direct API clients, other devices or unrelated browser partitions.
Existing HttpOnly cookies and provider-side checks remain the authorization path.
A channel hint cannot sign someone in or grant financial eligibility.

## Verification

Before implementation, seven of the first eight new synthetic page checks failed
against the previous page. They included two refresh requests for shared expired
cookies, post-logout session reinspection and stale displays across tabs. These
are application behavior regressions, not demonstrations of wallet theft.

After implementation, all **49 focused tests** passed together: 28 existing
handler tests, eight existing page tests and 13 new tab/timeout tests. The added
tests cover shared refresh exclusion, logout notifications, late identity and
OAuth results, unconfirmed revocation, missing-lock behavior, revisited pages,
provider failures, ignored channel messages, body-read cancellation, an expired
lock waiter and sign-in options during initial-config logout.

Commands:

```text
node --check assets/federation/fed-account.js
node --test tests/federation-account.test.mjs tests/federation-account-page.test.mjs tests/federation-account-tabs.test.mjs
```

The page tests use independent Node VM contexts with simulated DOM, fetch,
same-origin lock queues, status channels and selected fake timers. They do not
exercise real browser Web Locks, HTTP cookie application, Google, an actual Auth
service or physical devices. The existing disposable Auth/SQL CI jobs remain
separate evidence. S4 remains partial and PR99 stays draft.

## Required hosted/browser acceptance

On the exact private preview and intended browser versions:

1. Open two tabs with one owner session; expire only the browser access cookie
   using the existing acceptance procedure. Check that simultaneous revisits
   preserve sign-in and do not rotate stale refresh cookies concurrently.
2. Sign out in one tab while another is checking its session. Both must clear
   identity; a delayed response must not restore it. Separately verify remote
   session revocation, including the access-expired logout path.
3. Revisit a hidden tab and return through browser history. Confirm stale identity
   clears, available providers stay usable and unrelated browsing is unaffected.
4. Exercise provider unavailability and a slow response. Confirm generic feedback,
   recovery on an explicit retry and no stuck controls.
5. Check browsers with and without the coordination APIs. Complete real Google
   cancellation/successful-code replay, cookie/origin and mobile acceptance.

Do not mark those checks passed from this synthetic suite. Multi-tab races involving
a callback, a different client or another device still depend on provider behavior
and separate acceptance.

Primary references reviewed October 8, 2026:
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/guides/auth/server-side/advanced-guide
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API
- https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API
