# Federation account foundation — review build

Requested by the owner on October 6, 2026 for a shared Federation account,
including eventual staking and lending participation. This implementation is
closed by default. It does not open those financial products or connect wallets.

## Implemented

- Account dashboard with Google/Apple provider buttons enabled only by server configuration.
- Server-side OAuth authorization-code flow with PKCE, a random browser-bound state and ten-minute flow cookie.
- Verified provider user lookup before issuing HttpOnly, Secure, SameSite=Lax, host-only session cookies. Tokens never returned to browser JavaScript or stored in localStorage.
- Exact configured-origin validation on every POST; no return URL accepted from the client. Duplicate auth cookies fail closed.
- Session inspection, bounded cookie lifetime, refresh rotation and browser logout; upstream errors are generic and responses cannot be cached.
- Public browsing remains available. Dashboard links to missions and current staking/lending status.

## Configuration still needed

Use a dedicated Supabase project for Federation consumer identity. No project
is created or billed by this change. Google and Apple are supported by the
candidate provider, but neither is configured or end-to-end verified here.

Server environment only:

| Name | Purpose |
| --- | --- |
| FEDERATION_ACCOUNT_ENABLED | Leave unset/false until acceptance is complete |
| FEDERATION_ACCOUNT_ORIGIN | Exact HTTPS origin; production https://galacticfederation.co |
| FEDERATION_AUTH_URL | Dedicated HTTPS project origin ending in .supabase.co |
| FEDERATION_AUTH_PUBLISHABLE_KEY | Publishable key only; service/secret keys rejected |
| FEDERATION_AUTH_GOOGLE_ENABLED | true only after Google OAuth configuration and testing |
| FEDERATION_AUTH_APPLE_ENABLED | true only after Apple configuration and testing |

Configure exact provider redirect/allowed callback rules for
`https://galacticfederation.co/api/federation-account/callback` with its generated
state query. Do not use broad production redirect wildcards. Prove successful
Google and Apple flows, cancellation, expired callbacks and replay rejection
on a configured isolated preview before production. Apple requires its own
developer setup, Services ID, verified web domain, signing-key/client-secret
maintenance; never paste those credentials into GitHub or chat. A native app
configuration does not establish web sign-in support.

Configure provider rate limits and abuse controls, minimal scopes, user support,
privacy/retention/deletion policy, backup/recovery and cost ceilings before
registration opens. No email sign-in is implemented in this first build; it
needs separately configured delivery and abuse controls.

## Boundaries and follow-up

This is a central account on GalacticFederation.co. Cookies do not provide SSO
to the separate dossiertrack.co domain. No Dossier deployment, database grant,
saved-report activation or infrastructure change is included. A later reviewed
cross-domain authorization flow is required before describing shared sign-in
as operational across products.

Mission progress remains browser-local. There is no cloud progress, profile
database, wallet linking, token ownership check, entitlement, staking position,
credit decision, deposit, withdrawal or custody in this implementation. Do not
present signed-in status as financial eligibility. Wallet association requires
a separate replay-resistant proof with explicit user consent; transactions
must stay in an independently verified provider flow.

The refresh cookie has a 24-hour browser lifetime, access cookie at most one
hour, and each session lookup checks the provider. Logout reports whether
remote revocation was confirmed; clearing local cookies does not prove remote
revocation. Provider token/session behavior and multi-tab refresh contention
require integration testing. Sensitive transactions require a separately
designed recent-authentication/step-up policy. This code is not an audit or
proof of readiness for a lending service.

## Validation

`node --test tests/federation-account.test.mjs` uses synthetic fetch responses
only. It tests default closure, configuration constraints, CSRF rejection,
provider selection, PKCE/state binding, expiry, user verification, safe session
output, refresh, cookie ambiguity, upstream failures and local logout.
It does not exercise real providers or production cookies.

Primary implementation references:
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/social-login/auth-apple
