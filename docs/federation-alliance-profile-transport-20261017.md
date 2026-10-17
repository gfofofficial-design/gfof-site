# Alliance account-to-profile transport candidate

October 17, 2026. Builds on the approved self-service profile foundation in PR124.
**Prepared source, not a running member service.** Neither the API factory nor the
browser client is mounted, enabled, imported by Alliance HTML or connected to real
Auth/Data API settings. The interactive Hub remains an explicitly tab-only preview.

## First usable slice

The intended member flow is sign in, read/create/edit one's profile, choose whether
to list it, read a bounded member-directory page, or explicitly remove one's own
profile. No ordinary member approval by Michael is introduced. This slice has no
avatar upload, invitation, suggestion, vote, report, email or financial action.

`lib/alliance-profile-api.mjs` exports a factory with no environment reads or route.
It defaults closed and requires trusted server configuration for one exact
Federation origin, a fixed HTTPS Supabase project origin and a publishable key.
It does not accept a service-role key or browser-supplied bearer authorization.
Future composition must retain the existing account flow's reviewed deployment
and provider configuration rather than inventing a second login system.

## Identity and data flow

1. The future page client sends a same-origin cookie request. It never reads a
   cookie/token, selects a trusted actor or stores a credential.
2. The API reads only the existing `__Host-gf-access` cookie. Missing, malformed,
   duplicate or oversized values refuse access. A refresh cookie alone is not
   authorization, and this factory does not refresh, start OAuth or set cookies.
3. A bounded `/auth/v1/user` read verifies the token against Supabase Auth. Require
   a confirmed non-anonymous account; never authorize by decoding user-editable
   claims, profile names, affiliations or browser actor IDs.
4. The unchanged ownership model receives the same verified token through the
   existing profile store. Supabase verifies its bearer context again and enforces
   grants/RLS. Self-profile RPCs take editable fields only, never a user ID.
5. Return a small profile/directory data shape. Account IDs, email, tokens,
   moderation writes and raw upstream errors are not returned. `private, no-store`,
   cookie variation, no-referrer and no CORS permission remain explicit.

Cross-origin/cross-site requests, direct function paths, unsupported methods,
unexpected query keys and invalid bodies refuse before Auth. Mutations require
the exact Origin. GETs never mutate. Inbound JSON is capped at4096 bytes/2 seconds;
Auth and the Data API each have an8-second/64KiB bound with no retry. Provider
cancellation is requested, but cannot prove a dispatched mutation rolled back.

## Accessible waits, cancellation and uncertain results

`assets/federation/fed-alliance-member-client.mjs` is a disabled, unmounted client
factory. It offers load/save/remove/directory/cancel/dispose with plain status
messages for a future semantic form and polite status region. Construction/import
does no network work. The server/client share one data contract; private and
listed profiles are distinct and publication values must agree.

Only one operation can be pending per client instance. Response bytes and the
19-second wait are bounded even if a fetch or body ignores abort. Cancellation,
disposal and a newer operation cannot restore late profile data. A cancelled or
unacknowledged write has an **unknown** outcome; further writes stay paused in
that instance. A later read can display current data but does not prove the older
mutation stopped or silently unlock retry. No automatic refresh/retry or local
credential persistence is added. Durable operation reconciliation across page
reloads and devices is still a release requirement, not implemented by this
in-memory pause.

This preserves accessible control over interrupted/slow work without a countdown
or forced transcription. The eventual page must provide native labelled fields,
keyboard operation, paste support, explicit removal confirmation, concise busy/
error announcements and a useful non-JavaScript explanation. No new UI is mounted
here, so screen-reader, phone, zoom, focus and WCAG-conformance claims are not made.

## Validation boundary and remaining work

Offline transport tests cover real Request/Response objects with synthetic Auth/
Data API responses, strict route/origin/cookie gates, invalid identity, self-only
payloads, streamed limits, cancellation, lost acknowledgements and the composed
browser-to-API-to-store path. This is not live GoTrue authentication, hosted RLS,
Netlify routing or physical-device acceptance. The existing native SQL fixture
remains separate and its synthetic claims do not authenticate a person.

Before mounting: resolve the exact Google warning; compose with the accepted
account candidate and real verified-session expiry/deletion behavior; specify
durable write reconciliation, server quotas and abuse limits; run two-account
hosted allow/deny tests and real accessible browser/phone checks; review privacy,
retention, support, costs, backup/recovery and publication. Image processing,
challenge/suggestion storage and notifications remain separate incomplete lanes.
No hosted schema, grants, credentials, signup settings or public site is changed.

## Sources reviewed

- [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser)
- [Server-side Auth advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

The requested lightweight changelog markdown index returned an unsupported-content
fetch error. Current topic guidance was read; this is not a full changelog or
dependency-security audit. No Supabase SDK or CLI dependency was added.
