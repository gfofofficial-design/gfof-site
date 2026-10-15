# Google account release acceptance — proposed operator checklist

Prepared October 13; updated October 15, 2026. This is a review checklist, not release authorization or a completed acceptance record. The public read-only Command Deck and the draft account release have separate scopes. Keep account registration closed until every applicable gate has evidence and the owner approves the exact release.

## Gate 0 — Google warning and exact candidate

Latest recorded owner observation, October 14: Google listed the account preview `/account` for deceptive pages. No later clearance evidence is recorded in this checklist. The cause has not been established; expected page rendering and passing CI do not prove that the warning was incorrect or removed.

Keep browser/phone sign-in, callback replay and authenticated acceptance **NOT RUN** while this gate remains unresolved. Do not bypass a browser warning or move the same flow to another hostname to evade it. Review current Safe Browsing/Search Console evidence for the exact destination before authorizing browser acceptance; URL indexing status is a different check.

The October 15 source candidate is PR #99 head `d72606053c282f23cd133bdcdad05e3093619bd1`, synchronized with released main `7cd97e7106a69fa6c91105c3f4ffd20ee75389d9`. Automated and isolated-fixture checks passed at that head; real Google and physical-phone acceptance have not been established. Re-read the current head and deploy before later acceptance.

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

The proposed [account operations plan](https://github.com/gfofofficial-design/gfof-site/blob/d72606053c282f23cd133bdcdad05e3093619bd1/docs/federation-account-data-operations.md), [readiness record](https://github.com/gfofofficial-design/gfof-site/blob/d72606053c282f23cd133bdcdad05e3093619bd1/docs/federation-account-readiness.md) and [security release gates](https://github.com/gfofofficial-design/gfof-site/blob/d72606053c282f23cd133bdcdad05e3093619bd1/docs/federation-security-release-gates.md) are draft account contracts in PR #99, not adopted production procedures. Record unresolved items rather than treating earlier technical drills as completed customer support.

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

Only after the preceding gates pass, review the exact production commit, environment scope, canonical origin, provider settings and rollback. A preview pass does not authorize changing production environment values or opening signup.

The application origin must be https://galacticfederation.co. The intended application redirect pattern is https://galacticfederation.co/api/federation-account/callback?state=*; the only wildcard is generated state. Register the separate provider callback at the reviewed identity project.

Verify production sign-in, cancellation, replay refusal, server session, Secure/HttpOnly host-only cookies, refresh and logout on the actual production deployment. Review the Google-only new-account acceptance matrix separately before any registration opening. Keep public wallet reads, local mission progress and proposed staking clearly distinct from account identity or financial eligibility.

Update navigation on Federation and companion sites only after the account destination works publicly. Check both normal and mobile paths; never point users at a preview as the permanent account service.

## Stop and rollback rules

- Failed existing-owner login: stop acceptance, keep unreleased signup closed, and record a sanitized outcome. Investigate before proposing an exact recovery action. This checklist does not authorize provider changes, owner-account resets or user deletion.
- Failed production account acceptance: stop acceptance, preserve the working read-only Command Deck and follow the exact recovery scope approved for that release. Generic checklist wording is not authorization to change production settings.
- Failed recovery reconciliation: keep the restored service isolated with signup and outbound email closed.
- Missing or ambiguous evidence: use NOT RUN or NO CURRENT EVIDENCE as appropriate; do not call an unperformed test a failure. Mark the gate pending. A hidden Email button, payment for a plan or an anonymous HTTP guard pass is not acceptance of public registration.

## Evidence record template

For each gate, record date/time, exact source commit, deployment, browser/device, expected result, actual result, pass/fail and remaining limitation. Public records contain sanitized outcomes only; private credentials, identity references and deletion correspondence remain in restricted custody.
