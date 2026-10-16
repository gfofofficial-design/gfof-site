# Federation Community League — build and engagement research

October 16, 2026. This is a review build, not an active recruitment campaign.
The owner is handling contact with prospective projects. No external project is
added, contacted or represented as an agreed partner by this change.

## Recommended first competition

Use **members joined** as the main community ranking, with separate views for
**activated recruits** and **returning recruits after seven days**. Keep these
three measures visible rather than blending them into an unexplained XP score.
The purpose is to introduce people to working Federation tools and give their
community a reason to return. Growth outcomes need measurement; the mechanisms
below are design references, not evidence of a guaranteed result for GFOF.

The first season should run for 30 days, with dates and final rules published
before enrollment. Dates are not announced in this build. The implementation
supports one-to-31-day reporting windows; this is a validation bound, not a
launched schedule. Start with recognition and a reviewed community spotlight.
No prize, token allocation, payment or financial benefit is announced here.

## What comparable systems do

| Reference | Observed mechanism | Federation application |
| --- | --- | --- |
| [Zealy sprints](https://zealy.io/docs/leaderboard/create-sprint) | Time-limited leaderboards with selected quests and explicit start/end dates. | A defined season, clear eligible activities and a fresh opportunity for new communities. |
| [Galxe Rewards Hub](https://help.galxe.com/en/articles/10373007-introducing-galxe-rewards-hub) | Referral credit follows a referred user's quest completions; XP supports progression. | Separate a new join from a recruit who actually completes onboarding. |
| [Layer3](https://layer3.xyz/) | Curated onchain activations, CUBE completion records, social competition and ranking active users. | Guided discovery of existing tools, followed by an independently checked completion event. |
| [Ronin's Guild example](https://blog.roninchain.com/p/welcome-to-ronin-guildxyz) | A documented 2024 community model with points and Bronze-to-Mystic tiers based on qualifying attributes; the article records later snapshots. | Recognizable community identity and achievement badges. This historical example is not a current user-count or growth claim. |
| [Superteam Earn](https://superteam.fun/earn/) | Project opportunities and bounties across content, design and development. | Recognize reviewed tutorials, useful research and accepted fixes as distinct contribution categories. |
| [Jupiter Rewards Hub overview](https://academy.jup.ag/lessons/jupiter-rewards-hub) | One dashboard for discovering partner campaigns and viewing campaign progress/rewards. | Keep approved partner communities and available activities together in Alliance. No integration or reward claim is implied. |

One important current limitation comes from [Galxe's task documentation](https://help.galxe.com/en/articles/9728885-create-quest-tasks-settings): default X checks may capture intent/page visits rather than completed actions; authentic verification uses credits and has availability requirements. Survey submissions are automatically accepted unless subsequently reviewed. The same documentation says **Starboard was sunset on August 3, 2026** and new Starboards cannot be created. A proposal based on a new Starboard would therefore be outdated.

These findings favor a native, transparent count model first. Social-platform
connections, external verification vendors and any associated fees need a
separate decision. This build adds no vendor subscription, API dependency,
wallet requirement or recurring job. It does not establish zero hosting cost
at arbitrary traffic volumes.

## Engagement competitions, in priority order

1. **Recruitment Cup:** new eligible Federation accounts attributed to an
   explicitly chosen community. The largest count wins this category.
2. **First Mission:** recruits who complete a server-verified onboarding task.
   Do not count the current browser-local Passport as evidence.
3. **Return Crew:** activated recruits with a verified action at least seven
   full days after enrollment, before season end. This is a seven-plus-day
   return count, not the standard exact-day D7 retention statistic. Late
   cohorts have less time to mature and should not be compared as equal-age
   retention rates.
4. **Intel Challenge:** a source-linked Lens explanation or correction, judged
   on accuracy, evidence and usefulness. Token positivity is not a criterion.
5. **Builder and Creator Spotlight:** accepted fixes, accessible guides,
   translations and original educational work. Use a published rubric,
   duplicate checks and human review; no paid bounty is funded by this build.
6. **Joint missions:** communities collaborate toward a shared education goal
   alongside their competitive standings. Existing members can participate;
   any future all-member mission score must be separate from new-recruit totals.
7. **Small-crew momentum:** a separate future recognition category using a
   fixed opening roster and a minimum mature cohort. Consider at least 20
   eligible accounts before displaying a rate; do not divide by a zero or tiny
   baseline. The initial board publishes counts, not growth percentages.

Recommended launch rhythm: one understandable onboarding task, one useful
weekly activity and a reviewed results recap. A recap may be drafted from
approved aggregates, but this build does not send or schedule messages.
Avoid scoring clicks, follower totals, repeated posts, wallet balances or trade
volume. Those measures do not establish participation in Federation services.

## Counting contract and implementation

The public Alliance page gets a League section before the station explorer,
with three ranking views, relative-score meters, shared-place ties, dated-data
labels, counting rules and a public copy-link action. The Command Deck replaces
its fictional individual aliases/scores with a link to this League. The privacy
notice describes the new prelaunch state. Existing wallet and mission code is
not modified.

The shipped data is **prelaunch**, with no dates, no aggregate measurements and
only the approved GFOF host station. Unknown measurements display a dash rather
than a measured zero. Example mode is opt-in, uses four fictional crews outside
the project registry and labels the mode, caption, totals, rows and meters.
Returning to launch status restores only the actual approved roster. A copied
link contains no account, wallet, referral or example-state data, and sharing
does not count a join.

`netlify/lib/community-league.cjs` is a pure aggregation helper with no route,
storage, network, file access or automatic publication. It accepts only a
trusted server-owned eligibility ledger, confirmed enrollment events and verified
onboarding/return events. It does **not** authenticate callers, verify missions
or consent, discover duplicate humans, or turn supplied booleans into proof.
It is not connected to real accounts or called by a hosted endpoint here.

Given those trusted inputs, the helper:

- Excludes ineligible accounts and accounts created before the season.
- Counts an account once for its first eligible community choice in the season,
  independent of input order. Later choices do not transfer credit.
- Holds simultaneous conflicting first choices out of all community totals.
- Collapses identical duplicate records and refuses conflicting reuse of IDs.
- Treats season start as inclusive and end as exclusive; ignores events after
  the reporting cutoff. Enrollment cannot precede account creation.
- Counts activation once after enrollment and return once after activation and
  at least seven days after enrollment, within the season/capture cutoff.
- Emits aggregate counts only, with no account or event identifiers. Inputs
  and roster sizes are bounded; validation errors disclose no private values.

The browser read model checks the exact aggregate schema, approved roster,
nonnegative bounded integer totals, cohort subset relationships, season/capture
times and known methodology version. It refuses unknown, duplicate or missing
station rows and unexpected fields. These structural checks are not a source
audit. Equal positive scores share a place; zero and unknown are unranked.
Snapshots older than 48 hours are visibly marked as dated, not current.

## Requirements before real enrollment

1. Resolve the Google security warning and complete account, browser/phone and
   operating acceptance. This change does not open public registration.
2. Freeze the approved season roster and publish dates, eligibility, correction
   and removal rules. Partner names require mutual agreement and approval.
3. Implement a private authenticated enrollment store with an atomic unique
   account/season constraint, explicit consent and same-origin protections.
   A public URL slug must not directly authorize enrollment or a score write.
4. Generate eligibility and mission/return events server-side. Reject client
   score submissions, local badges, screenshots and link clicks as evidence.
5. Add rate limits, test-account exclusion, abuse review, appropriate retention,
   deletion handling and an owner correction process. A verified account is not
   proof of one human. Do not publish personal identifiers or unreviewed flags.
6. Validate a controlled cohort and reconcile private events against aggregate
   output before approving publication. Use dated snapshots and append clear
   corrections when evidence changes; do not silently rewrite final results.

Suggested first experiment: a 30-day recognition-only season after readiness,
with at least two consenting external communities. Compare recruited accounts,
activation share and seven-plus-day returns only within mature cohorts, plus
review workload and exclusions. These are proposed evaluation measures; no
analytics collector or schedule is activated here.

## Verification

Deterministic tests cover the read model, explicit example isolation, ranking
ties, invalid data, clipboard failure/late completion, no-network/no-storage
rendering and trusted-ledger cohort/deduplication/time-boundary rules. Existing
Alliance tests remain included. The Alliance workflow runs these checks for
frontend, backend helper, integration page and test changes. Hosted CI and
static preview evidence are recorded on the review PR for its exact head.

Connected-browser visual/phone QA remains unavailable. Static file delivery and
synthetic tests do not establish real account, event or anti-abuse acceptance.
The local folder is partial staging source; never deploy it directly. Publish
through the reviewed repository tree and existing Git integration.
