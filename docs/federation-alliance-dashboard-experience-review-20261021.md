# Alliance and Command Deck experience review — October 21, 2026

Reviewed production Alliance and Command Deck rendered page state, integration
source at ca23fb09609b3658d2372008892571d7810080be, the station registry, activity
planner, community sandbox, member/account composition, wallet and staking
components, and the two deeper mission scripts used by the new learning route.
This is a product/flow review, not a complete security audit or release acceptance.

## Main finding

The live Alliance starts with a station directory, an inactive League and a
project worksheet before explaining its purpose. That makes a first-time holder
work through administration before finding something enjoyable to do. The
candidate also includes a substantial local-only community preview; moving it
into production without persistent services would not deliver a real community.
The dashboard already has a useful first-visit chooser, but it underemphasizes
shared activities and still describes the superseded Google-first account pilot.

## Changes prepared in this review

- Welcome and actionable public paths now precede the station and League sections.
  There is one page h1, followed by explicit paths for an explorer, a crew host and
  an authorized project contact. Existing station, League, worksheet and hub IDs
  are retained for links and interaction code.
- The activity console moves near the top. A new Safety & judgment route uses
  Repair the Shuttle, Keys to the Gate and After the Crowd. Their briefs match
  the actual stories: spending trade-offs, permission scope and cash/stock costs.
  Ten activity briefs are now available, with the existing three-activity limit.
- Copied/downloaded crew plans include rotating reader/questioner/summarizer
  roles, discussion prompts, voluntary participation, consent and a closing
  takeaway. This is a hostable discussion plan, not multiplayer or event booking.
- A visible learning section links directly to those three public missions and
  explains what participants can practice instead of implying clicks prove skill.
- The local community preview adds Rewrite the mission and Teach it to the crew
  templates alongside the existing evidence, creative, feedback and build briefs.
  Eight templates are available. No real invitation, score or reward is created.
- The dashboard's existing three-way first-visit chooser now offers wallet reads,
  a crew session and a mission. Lock access remains in navigation and its panel.
  Its Alliance link leads to the starting paths. Account status now describes
  email-code access for existing approved accounts, closed public registration
  and deferred Google sign-in.

No account admission, CSP connection permission, hosted member write, financial
operation, staking term, wallet permission or scoring rule is changed.

## What projects should be able to bring their holders to

The useful offer is a recognizable project station plus a repeatable crew
session: one story/decision, one explanation or source check, and one contribution
another person can use. A short recap and a voluntary next session create a
reason to return. Token enthusiasm, spending and wallet size should not be the
participation currency. The public tools already support a first session; durable
shared participation is the missing service.

| Priority | Next product increment | Done when |
| --- | --- | --- |
| Release blocker | Persistent member profile and privacy lifecycle | Real authenticated create/read/edit/unlist/remove work across visits, with interruption/recovery acceptance. |
| Release blocker | Durable invitations and contributions | Only intended participants can act; acceptance, decline, withdrawal and acknowledgement have durable references and readable status. A peer acknowledgement is not independent verification. |
| Release blocker | Reports, blocking and support | Reports reach an operating queue with a reference; blocking applies to live routes; owner and exception roles have a workable response process. Preview reports do not reach staff. |
| High | Project welcome station | Each mutually approved station has official identity, its own shareable link and a small agreed starting route. Show relationship and scope without implying endorsement. |
| High | Weekly crew session kit | Publish a named activity, duration estimate, facilitator brief, optional recap format and next session. Do not present unscheduled plans as calendar events. |
| High | Ideas that receive an answer | Ideas retain a reference, author controls and actual team status: suggested, reviewed, planned, building or released. Explain declined/deferred outcomes and avoid treating votes as promises. |
| High | Education that demonstrates understanding | Use explain-back, changed assumptions and source/unknown distinctions. Keep local badges separate from assessed or server-verified activity. |
| Next | Cooperative recognition | Spotlight reviewed guides, translations, explanations and usable feedback, with consent and transparent criteria. Provide cooperative goals as well as rivalry. |
| Next | Fair community seasons | Review size effects, per-account counting, abuse handling, corrections and learning/retention metrics before starting scores. Raw recruitment alone is a weak measure of community value. |
| Later | Cross-community events and optional notifications | Explicit opt-in, actual event ownership/time zones and clear cancellation. AI guides or social mini-apps should follow a useful, tested core experience. |

## Flow and option findings still open

1. Keep the top-level story simple: play/learn, contribute, bring a project.
   Stations, League rules and preparation details should support that story.
   After persistent services launch, consider separate pages for the directory,
   challenge board and project onboarding rather than growing one long page.
2. The local sandbox still uses first acknowledged goal completion to identify a
   winner. A cooperative shared-goal mode is a separate product change, not
   provided by adding a discussion template. Resolve disputes and evidence
   standards before using this model for a live competition.
3. Mission pages generally return to First Contact, not the originating crew plan.
   A reviewed return-to-crew flow would reduce navigation loss; the current
   tab-only planner can be lost on reload. Do not silently persist personal drafts.
4. Account access and device Passport progress remain separate. Do not imply
   signing in syncs badges, establishes wallet ownership or joins a community.
5. Public project outreach in the review source uses email; production still
   displays Telegram. The review branch fixes that intake gap, but has not been
   merged or deployed. Neither channel creates a portal ticket today.
6. The dashboard and staking preparation page both currently show an 8% proposed
   six-month term. This review preserves the consistent source terms; it does not
   approve a reward program, funding or launch. Any economic change needs its own
   explicit decision and coordinated update.
7. Mobile and keyboard behavior must be tested on the final layout. Existing
   simulations, responsive rules and previous phone reports do not establish a
   new phone, screen-reader or full accessibility acceptance result.

## Verification and limits

The reviewed three HTML pages have no duplicate IDs. Source-path and available
cross-page fragment checks cover 113 links/assets across Alliance (54), dashboard
(47) and member profile (12), with no unresolved local target. This does not
prove every external service is healthy, validate every fragment in every other
page, or execute final Netlify routing.

The existing station, planner and sandbox suites passed 111 tests after updates
for the expanded content and intentional section order. Dashboard wallet/staking
suites passed 42 tests. Member/account lifecycle suites are run separately on the
same candidate. No synthetic test is counted as a live multiplayer, signup,
moderation, physical phone, custody or hosted runtime test.

Production page observations confirmed the ordering and stale account copy.
The local-browser extension was unavailable; public rendered inspection used the
cloud browser. New layout rendering/physical-device acceptance remains outstanding.
All changes remain in draft integration PR #125; no merge or deployment follows.
