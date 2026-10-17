# Google account release acceptance — proposed operator checklist

Prepared October 13; updated October 17, 2026. This is a review checklist, not release authorization or a completed acceptance record. The public read-only Command Deck and the draft account release have separate scopes. Keep account registration closed until every applicable gate has evidence and the owner approves the exact release.

## Gate 0 — Google warning and exact candidate

Current connected-Chrome observation, October 17, 2026: Search Console Security Issues for the exact property `https://deploy-preview-99--gfof.netlify.app/` shows **1 issue detected**, **Deceptive pages** and the sample `https://deploy-preview-99--gfof.netlify.app/account`. No completed review outcome or review-in-progress confirmation is visible. The Request review dialog shows an unchecked **All issues were fixed** box, an empty disabled explanation and disabled Submit request. It was cancelled without changing the checkbox, entering text or submitting. The cause has not been established; expected page rendering and passing CI do not prove that the warning was incorrect or removed. This supersedes the earlier unavailable-browser observation as a current status read, not as clearance.

Keep browser/phone sign-in, callback replay and authenticated acceptance **NOT RUN** while this gate remains unresolved. Do not bypass a browser warning or move the same flow to another hostname to evade it. Review current Safe Browsing/Search Console evidence for the exact destination before authorizing browser acceptance; URL indexing status is a different check.

The candidate is the **current PR #99 head and its matching ready preview**, read immediately before acceptance. Do not use an old SHA from a dated note as the test target. The earlier synchronized heads and their CI results are historical evidence. The latest October 17 synchronization combines account head `5e7220a4910312cf780773f1ee2a16ca38dd0c2f` with released production `556f56ccc669abc28ff97bba449e2ba88799d90e` (production deploy `6ad389d8c12a590598b5b371`). It carries fourteen released path changes: Alliance Mission Console, local Crew Plans and Project Prep artwork, the stations-first section order, homepage Alliance links and GF host seals. Twelve paths use exact released Git blobs. Two clean three-way merges retain the preview's existing Google verification tag and account routing, limits, private/no-store headers and account CSP while adding the released homepage links and Alliance-only blob image support. This checklist is the only additional edit. The account page, scripts, styles, Google artwork, handler, bounded provider reader, wallet handler and database/schema sources retain their exact prior blobs. Historical HTML/flow inventories remain dated; the Alliance page and homepage have changed since that inventory. This remains a pinned released baseline; compare later production changes before account acceptance. Exact-head CI/deploy and passive delivery evidence are recorded on PR #99. No real sign-in or phone acceptance was run.

### Owner status readback

Open [Search Console Security Issues](https://search.google.com/search-console/security-issues) and select the exact property `https://deploy-preview-99--gfof.netlify.app/`. A report for the production domain, an indexing result or the Google OAuth Verification Center is a different observation.

| Observation to record | Next step |
| --- | --- |
| Current report shows no security issues | Record the property and time; check the account page anonymously in normal Chrome and the intended phone browser before entering sign-in. Continue only if neither presents a security interstitial. |
| Review is in progress | Record that status and wait for the existing review's final decision. Do not duplicate it. |
| Deceptive pages still appears | Record the expanded sample and any review status/outcome. The latest capture has the /account sample but no visible review outcome or first-detected date. Inspect the current Request Review dialog without submitting or making an all-issues-fixed attestation; button visibility alone does not establish whether another report is pending. |
| No current report or ambiguous property | Keep Gate 0 pending and all real sign-in checks NOT RUN. |

The October 13 incorrect-warning report and the formal Search Console security review are separate. Current evidence does not establish the warning's cause or support an all-issues-fixed attestation. Follow [Google's current report guidance](https://support.google.com/webmasters/answer/9044101?hl=en); record evidence rather than assuming that source parity, noindex or branding changes establish clearance.

## Gate 1 — existing-owner Google acceptance

After Gate 0 is resolved, use the existing provider configuration unchanged for the separately authorized owner test. Keep new-user registration closed and Apple disabled. This checklist authorizes no credential creation, export, replacement or rotation, and no provider-setting change. If a configuration change is necessary, prepare its exact scope and recovery procedure for a separate decision.

Never place credentials, tokens, user identifiers or browser cookies in this repository. Google returns to the identity project's /auth/v1/callback; the application callback is a different endpoint. Verify the existing intended destinations before testing.

| Check | Pass condition | Evidence to record |
| --- | --- | --- |
| Exact candidate | Current PR #99 head and ready preview identified immediately before testing | Commit, deploy ID, timestamp |
| Existing owner sign-in | Real Google round trip returns the same intended account; no new account created | Pass/fail only publicly |
| Reload | Server session remains verified after reload | Browser/device and outcome |
| Cancel | Cancelling provider entry creates no new session | Outcome; no callback code |
| Callback replay | A consumed callback cannot establish another session | Outcome; redact URL parameters |
| Logout | Identity disappears, local cookies clear, remote revocation outcome is reported accurately | Outcome |
| Expired access | Refresh/logout behavior matches the handler contract after real expiry | Outcome and elapsed time |
| Second tab | Logout reaches the other tab; stale responses do not restore identity | Browser and outcome |
| Mobile | Owner repeats sign-in, reload and logout on the intended phone browser | Device/browser and outcome |
| Registration closure | New-user registration remains closed throughout this owner test | Reviewed configuration evidence privately |

Use existing browser acceptance procedures; do not fabricate successful-code replay or expiry results from anonymous guard checks. Previously passing tests must retain their dates and scope.

## Gate 2 — public account operating readiness

The proposed [account operations plan](federation-account-data-operations.md), [readiness record](federation-account-readiness.md) and [security release gates](federation-security-release-gates.md) are draft account contracts in PR #99, not adopted production procedures. Record unresolved items rather than treating earlier technical drills as completed customer support.

| Required decision or proof | Acceptance condition |
| --- | --- |
| Managed signup rule and deadline | Current hosted allow/deny and failure evidence reviewed; unresolved timeout behavior has an explicit operating decision |
| Deletion requester verification | Disposable verified-request rehearsal completed; wrong sender and duplicate cases handled without revealing account existence |
| Deletion ledger custody | Restricted ledger location, responsible operator and retention decided; exact identifiers never stored in public Git |
| Recovery reconciliation | Isolated restore reconciles later deletions before service exposure; deleted disposable account stays absent and old sessions cannot resume |
| Backup and recovery coverage | Cadence, accessible encrypted custody, recovery target and repeatable restore procedure established |
| Monitoring and cost | Named operator, review cadence, escalation route and concrete usage thresholds established |
| Google audience/brand | Intended audience and provider publication requirements reviewed for the actual client |
| Privacy/support notice | Actual data use, deletion channel and retention match the operating procedure |

## Gate 3 — separately approved production acceptance

Only after the preceding gates pass, review the exact production commit, environment scope, canonical origin, provider settings and the approved recovery procedure. A preview pass does not authorize changing production environment values or opening signup.

The application origin must be https://galacticfederation.co. The intended application redirect pattern is https://galacticfederation.co/api/federation-account/callback?state=*; the only wildcard is generated state. Register the separate provider callback at the reviewed identity project.

Verify production sign-in, cancellation, replay refusal, server session, Secure/HttpOnly host-only cookies, refresh and logout on the actual production deployment. Review the Google-only new-account acceptance matrix separately before any registration opening. Keep public wallet reads, local mission progress and proposed staking clearly distinct from account identity or financial eligibility.

Update navigation on Federation and companion sites only after the account destination works publicly. Check both normal and mobile paths; never point users at a preview as the permanent account service.

## Stop and recovery rules

- Failed existing-owner login: stop acceptance, keep unreleased signup closed, and record a sanitized outcome. Investigate before proposing an exact recovery action. This checklist does not authorize provider changes, owner-account resets or user deletion.
- Failed production account acceptance: stop acceptance, preserve the working read-only Command Deck and follow the exact recovery scope approved for that release. Generic checklist wording is not authorization to change production settings.
- Failed recovery reconciliation: keep the restored service isolated with signup and outbound email closed.
- Missing or ambiguous evidence: use NOT RUN or NO CURRENT EVIDENCE as appropriate; do not call an unperformed test a failure. Mark the gate pending. A hidden Email button, payment for a plan or an anonymous HTTP guard pass is not acceptance of public registration.

## Evidence record template

For each gate, record date/time, exact source commit, deployment, browser/device, expected result, actual result, pass/fail and remaining limitation. Public records contain sanitized outcomes only; private credentials, identity references and deletion correspondence remain in restricted custody.
