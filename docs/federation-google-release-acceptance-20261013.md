# Google account release acceptance — proposed operator checklist

Prepared October 13, 2026. This is a review checklist, not release authorization or a completed acceptance record. The public read-only Command Deck and the draft account release have separate scopes. Keep account registration closed until every applicable gate has evidence and the owner approves the exact release.

## Gate 1 — existing-owner Google acceptance

Before any credential change, retain the currently working provider configuration privately and identify the exact rollback pair. Never place credentials, tokens, user identifiers or browser cookies in this repository.

A separately approved operator may connect the dedicated production Google client to the reviewed identity project. Keep new-user registration closed, Apple disabled and the application callback limited to the reviewed preview during this step. Google returns to the identity project's /auth/v1/callback; the application callback is a different endpoint.

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

The existing [account operations plan](federation-account-data-operations.md), [readiness record](federation-account-readiness.md) and [security release gates](federation-security-release-gates.md) remain the detailed contracts. Record unresolved items rather than treating earlier technical drills as completed customer support.

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

- Failed existing-owner login: keep signup closed and restore only the specifically reviewed working provider configuration. Do not reset the owner account or delete users.
- Failed production account acceptance: close new signup first and disable the production account entry using the reviewed rollback; preserve the working read-only Command Deck.
- Failed recovery reconciliation: keep the restored service isolated with signup and outbound email closed.
- Missing or ambiguous evidence: mark the gate pending. A hidden Email button, payment for a plan or an anonymous HTTP guard pass is not acceptance of public registration.

## Evidence record template

For each gate, record date/time, exact source commit, deployment, browser/device, expected result, actual result, pass/fail and remaining limitation. Public records contain sanitized outcomes only; private credentials, identity references and deletion correspondence remain in restricted custody.
