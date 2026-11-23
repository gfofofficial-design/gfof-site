# Member presence addition

This approved member-card and crew-challenge preview now builds on Dashboard #203 at `474c0a60d3e40c706d2d1e8d638f63ff50e30379`, including current public main. Its source is for review; the preview remains outside the public website build.

## Existing pieces reused

| Existing work | Connection in this addition |
| --- | --- |
| Member profile model | Imports the existing Community Hub sandbox and its five-field validation |
| Member workspace and optional profile image | Links to the existing workspace and #203 image panel |
| Challenge templates | Uses the existing Rewrite the mission template and links to the Wrong Moon activity |
| Invitations and contributions | Calls the existing invitation, acceptance, contribution and acknowledgement methods |
| Community League | Links to the existing League while demonstrating separate proposed individual XP |
| Dossier and learning | Voss suggestions use current templates and link to the existing tools |
| GFOF access | Shows the proposed advanced milestone and the outstanding threshold decision |

The preview has fictional profiles, page-memory state, example review events and a weekly contribution board. Selecting a member changes the fictional identity being demonstrated. The XP review controls exercise the proposed score rules. They establish no actual reviewer permission. Peer acknowledgement retains its existing behavior and grants no XP automatically.

Voss uses static suggestions from the current challenge templates. Live Grok, Telegram and wallet eligibility are future integration work. The holder amount and actual benefit still need selection. The current preview does not establish a public member service or persistent score.

## Review and verify

From the repository root, run the focused checks with Node 24.

```text
node --test tools/community-presence/*.test.mjs tests/federation-alliance-community.test.mjs tests/federation-community-league.test.mjs tests/static-publish.test.mjs
```

The November 23 local run passed all 130 checks. Seven core checks cover profile reuse, duplicate example evidence, category caps, unlisting, challenge consent, peer acknowledgement, immutable returned data and reset. An additional page regression verifies that switching or resetting examples clears contribution errors, profile-error descriptions and drafts without moving focus away from the member selector. It failed before the fix and passes afterward. The suites overlap with prior Federation checks.

The November 23 Chrome review passed ten interaction cases covering contribution/profile validation on member switching, keyboard focus at a category limit, refusal of an extra review, listing and unlisting, peer acknowledgement without automatic XP, the current Federation Learn link, reset and nonparticipant controls. Desktop viewport and content widths both measured 1348 pixels, with no horizontal overflow or observed application-console errors. This is not a physical iPhone or VoiceOver acceptance run.

The follow-up visual pass gives this private preview an orbital Federation crest, stronger heading hierarchy, a cyan primary activity link, distinct member/challenge borders and a grouped example selector. It reuses the existing local crest and static CSS without new fonts, providers, scripts or animation. Fictional member and page-memory limits remain next to the hero. The new activity links use native fragments and the decorative orbital artwork is hidden from assistive technology. Existing focus outlines and the forced-colors fallback remain available.

The design review confirmed all three local images loaded, a 1348-pixel document matched its viewport, the member-card link focused its heading, a keyboard-activated fictional learning review changed Aster from 45 to 55 XP, and reset restored the example selector focus and 0 XP. No local application warning or error was observed. Narrow-width and physical iPhone/VoiceOver checks remain pending. This isolated design review does not replace the requested private Work-browser acceptance of the public guest journey.

The final build matched all 671 public files from the current #203 foundation by SHA-256. This folder stays under `tools/`, outside the existing static publish allowlist. The static-publication workflow runs the private preview checks and explicitly verifies that `tools/` is absent from the emitted site. The member workspace, profile-image, League and Wrong Moon links remain available; Voss guidance and the footer also lead to the current Federation Learn page.

For a private local review, serve the repository and open `/tools/community-presence/index.html`. On the managed Work environment, stage the existing public build plus this folder into an isolated preview directory and use the supported preview service. Browser links to other Federation pages require those existing public files to be present.

## Integration sequence

1. Complete independent Alliance acceptance and the existing #187, #202 and #203 hosted checks in order.
2. Keep the saved profile and image API as the account-backed identity. Read it through an explicit adapter into the member card instead of creating another account or competing profile table.
3. Add an authoritative XP service with reviewer authorization, versioned scoring rules, category limits and atomic event deduplication. Browser events and current device-only Passport progress cannot establish a verified score.
4. Make public listing, score visibility and cross-account isolation part of hosted acceptance. Preserve an individual’s ability to view their own progress when unlisted.
5. Connect the existing challenge record to independently reviewed contribution events. Keep the League’s published methodology intact until a separately reviewed season defines its metrics.
6. Add the bounded Voss knowledge service and Telegram entry after identity and scoring are reliable. Scope provider keys and private conversation context by user.
7. Decide the GFOF threshold and operating budget for a real benefit, then review wallet-control proof and eligibility refresh. Existing research approval does not select those missing values.

## Source review

Use the current review branch `review/member-presence-current-20261123` for this source, stacked after Dashboard #203. The November 20 Dev packet’s `member-presence/candidate.bundle` at `05831701b97d23fb664a8ab20f04ef2c4cf1ea0f` is historical recovery evidence. Its integration, sign-out and save-review prerequisites were verified and restored before the six preview files were reconciled onto the current Dashboard. The live member service, authoritative scoring and holder eligibility remain outside this review-only source change.

The first hosted social pilot can follow that sequence using one crew challenge and fictional acceptance data before eligible members are enrolled. The preview’s weekly cap and milestone examples remain product parameters to validate in that pilot.
