# Federation account data operations — draft

This plan applies to the closed, owner-only Google pilot in PR #99. It is a
release checklist, not a public privacy policy or an authorization to open
registration. Apple, wallet access, staking and lending remain off.

## What the pilot currently holds

| Location | Observed or implemented data | Limit |
| --- | --- | --- |
| Isolated Supabase Auth project | One owner user with Email and Google identities as of the October 7, 2026 read-only check. Google sign-in can share email, name and profile picture. | No application tables were found in the `public` schema; this does not inventory provider logs or backups. |
| Federation browser | Secure HttpOnly access and refresh cookies (at most one hour and 24 hours respectively); a ten-minute sign-in flow cookie. | Signing out clears this browser and asks the provider to revoke its session; already-issued access tokens can remain valid until expiry. |
| Journey browser storage | Local choices and mission progress. | Not attached to the Auth user or synchronized across devices. |
| Netlify and Google | Request/identity-provider operational records under their own services. | Their actual log and backup retention must be confirmed before a public notice promises a deletion deadline. |

The Federation account page displays the email returned from Supabase. No
wallet address, token balance, entitlement, financial position, or account
profile is stored by this application. Do not imply that this inventory covers
all data held by vendors.

## Manual account-deletion procedure to prove before public registration

1. Accept a request at the Federation support address shown on the account
   page. Treat the sender address as a clue, not identity proof. Confirm
   control of the account through a fresh provider sign-in or a separately
   documented verification step; do not delete from an unverified email.
2. Record only a case identifier, request date, verification method and
   outcome in restricted internal operations. Avoid placing identity data in
   Git or a public corrections record. Check for any linked application data or
   Storage objects before deletion; the pilot currently has no application
   tables but that can change.
3. Revoke active sessions where the provider allows it, delete the exact Auth
   user through the provider's administrative workflow, and verify the user and
   linked identities are absent. A deleted Auth user can leave an already-issued
   access token valid until its expiry. Test that the Federation `/session` and
   `/refresh` routes reject the deleted user's browser after deletion, then
   clear its browser cookies.
4. Tell the requester what was deleted and any verified limits from vendor
   backups or logs. Do not promise immediate removal from backups without
   confirming provider policy.

Run the entire procedure first with a disposable account created for this
purpose. Preserve the owner's only pilot user. If any step cannot be verified,
keep public registration closed and state the failure precisely.

## Recovery and release gates

- Supabase Free can pause during low activity and does not supply the same
  downloadable dashboard backups as paid plans. Design a restricted,
  encrypted logical backup and restore test before depending on accounts for
  public access. A local Git checkout is not an identity-data backup.
- Confirm which vendor records are kept, where the data notice links, who
  handles deletion requests, and what realistic response time can be offered.
- Supabase's Email provider remains enabled in the pilot even though the site
  presents only Google. With signup disabled this does not open public
  registration. Before turning signup on, verify and close any direct Email
  signup route or review it as a separately supported option. Changing it may
  remove the owner's password fallback, so preserve recovery first.
- The October 7 security advisor reported leaked-password protection disabled.
  Resolve or explicitly scope that warning before any password registration.
- Keep Google production credentials separate from the preview OAuth client;
  register only required callbacks and basic identity scopes. Apple can remain
  off for a Google-only launch. Review real cancellation, replay, provider
  outage, multi-tab refresh, cost and a production rollback before publishing.

References: [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data),
[sessions](https://supabase.com/docs/guides/auth/sessions),
[sign-out](https://supabase.com/docs/guides/auth/signout),
[backups](https://supabase.com/docs/guides/platform/backups), and
[production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).
