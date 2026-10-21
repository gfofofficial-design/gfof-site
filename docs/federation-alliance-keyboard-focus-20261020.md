# Alliance preview keyboard focus — October 20, 2026

## Observed problem

On the existing PR #124 Deploy Preview, Chrome keyboard activation of **Accept invitation** while **Awaiting acceptance** was selected removed the invitation card and left `document.activeElement` on `BODY`. The action's status message appeared, but its requested card no longer existed. Keyboard activation of **Show Nova · example** after hiding that sole member also removed the last Show control and left focus on `BODY`.

The existing fixture retained detached IDs in its registry. It could therefore focus a removed card and miss the actual browser failure.

## Change

The existing action helper accepts an explicit fallback focus ID. Accept, decline and cancel invitation, plus contribution acknowledgement/rejection, retain focus on the rebuilt challenge card when it remains visible; otherwise they focus the existing **Show challenges** filter. Showing a hidden member focuses the restored member card, with the existing member search as fallback when the search excludes that member.

The fixture unregisters removed descendants and clears its active element when removed. When a new card reuses an old ID, removing the old card does not erase the new registration.

## Verification

- 29 Community Hub tests pass under Node 24.19.0.
- All 109 combined Alliance, Community League, Launchpad and Community Hub tests pass, with no failures or skips.
- Five additional tests cover accepting/declining a filtered invitation, cancelling a filtered invitation, final/intermediate acknowledgement, restoring a member with/without a matching search, and preserving card focus when its status remains included. Four fail against the preceding module with the corrected fixture; the stable-card preservation case already passes there.
- The initial Chrome reproductions above use synthetic, tab-only profile content and opt-in fictional crew. No hosted membership, invitation, vote or report is created. Updated-preview browser acceptance is recorded separately in the PR after deployment.

Only the Community Hub module, its tests and this note change. Core model semantics, HTML/CSS, routes, dependencies, account and database configuration remain as before. The first three Alliance sections stay in their approved order. This is a keyboard continuity repair; it does not establish screen-reader/WCAG conformance, physical-phone acceptance or public membership readiness.

