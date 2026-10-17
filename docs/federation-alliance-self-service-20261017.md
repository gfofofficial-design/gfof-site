# Alliance self-service members — product preview and integration contract

Owner direction, October 17, 2026: members should join independently, manage their own image/bio/community, challenge other members or projects beyond the Journey, and make suggestions. Do not make Michael approve every member or collect routine information through Telegram. Email is preferred for requests needing team attention; the portal should retain their record and status.

## What this change actually implements

An isolated Community Hub on `/alliance`, after the three explicitly ordered sections: Stations, Community League, Project Prep. The navigation links directly to it. The current production source baseline is `556f56ccc669abc28ff97bba449e2ba88799d90e`.

- Create and edit a preview profile: display name, optional self-described project/community, contribution role, bio and optional local image. An explicit listing choice is required. There is no owner-approval step.
- Local name/community search, hide/unhide and report interactions. A report cannot itself remove someone else's content.
- Six non-Journey challenge templates: sourced explainers, actionable product feedback, reviewed translations, evidence notes, discussion summaries and working demonstrations.
- Member invitations and cross-community proposals; the invited identity alone can accept/decline, and the sender can cancel an unanswered invitation. Contributions need the other participant's acknowledgement. A participant cannot approve their own proof. The first participant to reach the agreed preview goal is shown as the preview goal achiever.
- Suggestion categories, self-service posting/removal and one reversible support vote per other preview identity. No invented roadmap decision is assigned to an idea.
- Optional fictional crew, loaded only on request, to try both sides of an invitation and another member's vote. Their names and communities are visibly fictional; no real partner is asserted.
- Reset clears the tab's sandbox and revokes its selected image URL. The existing bounded PNG/JPEG/WebP inspector is reused: 2 MiB, 4096 per dimension, matching signature, bounded decode wait, cancellation and URL cleanup.
- Official project contact uses the existing published Federation email address. The mailto link opens the visitor's email app; it does not send anything itself or create a tracking record.

**This is not a working hosted member service.** All profile/challenge/idea/report state is in memory in the visitor's tab. It is lost on reload or closure. No account, stored upload, public profile, invitation, vote, report, deadline, email, ticket, notification, score or membership is created. No fetch, cookie, local/session storage, Supabase, price/RPC or model/provider call is made by these two new modules. The global preview notice, action labels, empty states and status messages retain that boundary.

The preview identity selector is roleplay, not authentication. The model's local ownership checks describe intended interactions; they are not a security boundary. Never accept its IDs, actor selector, flags, counters, proofs or votes as trusted production input. Do not automatically import preview state into live accounts.

## Intended live member flow

1. Sign in through the existing Federation account flow after its release gates pass.
2. Create an ordinary profile independently. Preview the image/bio, choose whether to list it, and publish after automated eligibility and content checks. No Telegram message or per-member owner approval.
3. Edit, unlist or remove the profile through the member account. Self-described affiliation remains separate from an official project representative designation or partner station.
4. Discover eligible members and send a bounded invitation. The recipient accepts, declines or blocks within the portal. Invites are not automatic enrollment; routine invites need no Michael approval.
5. Post suggestions and support another member's idea. Show a permanent reference and genuine team status on the portal. Votes indicate interest, not a release commitment.
6. Escalate reported abuse and official partnership applications to a small exception queue. Email notifications link to that queue; email is not the database or the only copy of a request.

Default to no direct messages, anonymous uploads, financial wagers, token purchases, paid prizes, wallet-size ranks or automatic social posting in the first member release. No League recruitment/activation points are awarded by these contribution counts. Account verification does not establish one unique human.

## Trust and data contract for the account integration

No migration, hosted schema, storage bucket, route, API handler, environment value, email service or managed signup hook is created or changed in this PR. The following is proposed implementation work, not an adopted data collection practice or tested authorization policy.

| Record | Ownership and publication rule |
| --- | --- |
| Private member binding | Verified account ID to random public profile ID; one profile per account. Account IDs, emails and provider details never appear in public directory responses. |
| Profile | Name, bio, contribution role, self-described affiliation, listing choice, processed avatar reference and publication state. Owner can edit/unlist/remove their row. Moderation flags and official representative roles are protected fields. |
| Avatar | Owned upload path, bounded file metadata and processing state. A member cannot supply another person's object path or an arbitrary remote image URL. |
| Invitation | Server-selected sender from the verified session, intended recipient, template/version, target, duration and terms snapshot. Only the recipient can accept/decline and only the sender can cancel an unanswered invitation. |
| Contribution | Participating account, challenge ID, bounded source/note and review status. Only the other participant may acknowledge; a single acknowledgement cannot count twice. |
| Suggestion/support | Author-owned suggestion; unique account/suggestion vote. Public responses expose an aggregate count, not voter IDs. Author removal and genuine team statuses are distinct permissions. |
| Block/report | Private, requester-owned block and deduplicated report records. Reports cannot grant takedown or moderator power to the reporter. |
| Review request/outbox | Permanent server reference, category, status, timestamps and a deduplicated email delivery record. Reports and team-only decisions are not exposed as public member data. |

Use the verified server session and database ownership rules for every operation. Do not authorize from a browser-supplied actor ID, editable profile affiliation, display name, `user_metadata`, local storage or this preview model. Retain PKCE/state, same-origin/CSRF checks and Secure HttpOnly cookies from the account build. Never send service/secret keys to a client.

Before a real schema is adopted: use explicit least-privilege grants and RLS for exposed tables; test read/insert/update/delete allow-and-deny cases across anonymous, owner, another member and moderator roles. Owner update rules must constrain both the existing and resulting ownership. Protected status/representative columns must not become writable through a general profile update. Use security-invoker views or a reviewed equivalent; a view must not expose private account bindings or bypass underlying ownership rules. Verify the actual project's Data API exposure settings rather than assuming defaults.

Official project-to-project challenges require both projects' designated representatives to opt in. A self-described affiliation never creates that designation. The team's initial partnership/representation confirmation is separate from ordinary community-member joining; routine member challenges do not require owner approval.

### Bounded uploads and automated checks

Proposed initial profile-image limit: 2 MiB and 4096 × 4096, PNG/JPEG/WebP only. Repeat type, signature, size and dimension checks on the server; browser checks are usability only. Store the original in an owned private staging area, process to a bounded derivative with metadata removed, and publish only the intended derivative after checks and listing consent. Do not treat a public bucket as a control on who can retrieve a known image URL. Restrict writes/replacements/deletion to the verified owner path. Reject SVG/HTML, remote URL imports, oversized decompression and unsupported animation. Set storage/processing quotas and cleanup for abandoned, replaced, unlisted and deleted images before activation.

### Abuse and time boundaries

Proposed starting limits for trial acceptance: one profile/account; five new invitations/day; three ideas/day; ten contributions/day; five reports/day; one active vote/account/idea. Review actual usage and costs before adopting them. Enforce quotas atomically on the server/database, including direct Data API and simultaneous requests, with separate route/IP controls. The preview's 12-profile, 12-challenge and 20-idea capacities are sandbox bounds, not production abuse controls.

Production challenge acceptance must snapshot the agreed rules and create server-time start/end timestamps atomically. Late contributions, duplicate evidence, deleted/blocked participants, simultaneous acknowledgements and expired/cancelled invitations need tested transition rules. This preview deliberately runs no deadline clock. Public results must identify peer acknowledgements accurately and must not claim independent verification.

Reports need deduplication, reason categories, review history and an appeal/recovery route. Reserve staff/project-role names and apply automated content/rate checks, but make no bot-proof or perfectly automated-moderation claim. Do not blanket hold every profile for Michael. Blocking should stop invitations and hide the relevant content without revealing who reported someone. Publish actual conduct and privacy rules before accepting public posts.

## Request tracking and email delivery

Keep routine member joins/edits and normal invitations self-service. Keep suggestions searchable on the portal. Give partnership applications and escalated reports durable server references and an in-portal status. An email may point Michael to a request requiring action; a configurable suggestion digest can summarize new ideas without emailing every join or vote. The owner has expressed the preferred routing, but no notification schedule or external delivery is activated here.

Email delivery should use a transactional outbox with idempotency keys, bounded retries and visible delivery state. A delivery failure must not lose the request or create duplicate records. Notifications should include a minimal category/reference and a canonical portal link; avoid raw private report bodies, account identifiers, credentials, untrusted HTML or attacker-supplied destination links. Recipients and sender must be verified before activation. The dashboard remains authoritative even if an email goes to spam. Never claim that a mailto click submitted a tracked request.

## Release dependencies and acceptance

- The account preview still has Google's deceptive-page issue recorded on October 17. Public registration stays closed. Do not move the account flow to a new preview hostname to evade that warning.
- Clear the exact account destination, then perform actual Google, session/expiry, multitab and intended-phone acceptance. Account-operation gates remain: managed signup behavior, deletion/recovery, backup custody, privacy/support, usage controls and Google audience/brand requirements.
- Implement and test the hosted member repository, ownership policies, image pipeline, server quotas, recipient-only transitions, opt-in publication and private report queue. This PR supplies an interaction preview and integration contract; it does not implement those hosted services.
- Test two real authorized disposable accounts: join without operator approval; edit only self; publish/unlist; replace/delete image; invite/accept/decline/cancel; block/report; deduplicate contributions/votes; restore after deletion without resurrecting removed data. Test cross-account denial through both application routes and directly permitted database APIs.
- Test requester confirmation, permanent references, queue statuses, notification deduplication and email failure recovery without using real members' information. Confirm data retention and account deletion cover community rows, stored files, derived thumbnails, backups and queued notifications.
- Stage a separately reviewed activation with the exact source, scope, operating budget and recovery procedure. Passing local preview tests is not public signup, hosted security, moderation or email-delivery acceptance.

## Current documentation sources

Supabase guidance reviewed October 17: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [File limits](https://supabase.com/docs/guides/storage/uploads/file-limits) and [Changelog](https://supabase.com/changelog). Relevant Data API exposure changes reinforce checking explicit grants and project settings. No SDK dependency or Supabase CLI was installed; no database migration was generated or applied.
