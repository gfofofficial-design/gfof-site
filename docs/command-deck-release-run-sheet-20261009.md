# Read-only Command Deck release run sheet — October 9, 2026

Status: **HOLD — review candidate, not production release approval.**

Candidate: [PR #104](https://github.com/gfofofficial-design/gfof-site/pull/104).
Latest reviewed application revision: `9b751c47b910a1c0e894cf69eaac2987d0f65afb`.
The earlier 112-test application baseline was `8bb6714c7d5c582f19182cece4e2b7c3e4758d84`.
Production baseline at review: `50be6258473374b46887da9605f177cc98d3c757`.
A later documentation commit does not establish application changes or new production acceptance.

## First release scope

The prominent homepage link opens Command Deck. Visitors can manually read a
public Solana address, inspect exact returned quantities and available reference
values, filter assets, and view up to twelve SOL observations during that visit.
Three current GFOF Streamflow locks have separate public evidence. First Contact
missions use optional local Explorer Passport storage.

No account handler, signup migration, wallet permission prompt, ownership proof,
staking deposit, lending deposit, claim or transaction is included. Reference
values can omit unpriced assets. Proposed staking terms are illustrations, and
leaderboard aliases and scores are fictional. Public-address access does not
establish ownership or financial eligibility.

Preview: https://deploy-preview-104--gfof.netlify.app/command-deck

## Evidence and remaining acceptance

| Item | Evidence available | Still required for this scope |
| --- | --- | --- |
| Application boundaries | 112 applicable local tests; wallet, lock and service-check CI passed at the application revision; preview deployed | Confirm the final release diff preserves this scope and all required checks pass on its exact head |
| Hosted data reads | Finite preview wallet and lock checks passed; independent binary quantity comparison through the same RPC provider; origin rejection and clearing checked | Production-origin acceptance after separately approved release; no inference of independent provider agreement |
| Physical device | Owner reviewed the PR #104 preview on a physical phone and confirmed wallet input, table scrolling, filters, Clear and mission navigation seemed to work on October 9 | Reported acceptance passed for those ordinary flows; this is owner-reported evidence, not an instrumented device test or account/wallet-permission acceptance |
| Administration | Repository, identity and hosting MFA confirmations recorded; owner reported Cloudflare two-factor authentication enabled and recovery codes saved on October 9 | Review administrator/member roles and recovery access for the relevant services; Cloudflare confirmation is owner reported, not an observed provider setting or recovery rehearsal |
| Monitoring | Three-minute homepage monitors active on the Free plan; ordinary email receipt confirmed; isolated failure dispatch, authorized UI acknowledgment and automatic resolution observed | Specific drill failure receipt and separate recovery-email dispatch/receipt; provider/API response coverage and operating limits |
| Recovery | Hosting reports the current production deploy ready at the baseline commit; exact-head wallet, lock and service-check CI passed at `fe6a6dec9b4f87174ddb34ee58f0e4d76cf4b205` | Prepare and review a Git revert/redeploy recovery path; verify responder access and publishing method without publishing private details |
| Data handling | Wallet history is page memory only; optional mission storage remains device-local; provider logging disclosed | Review applicable privacy/retention disclosures for this scope; account/cloud-data gates cannot be claimed complete |

The DNS/TLS shell attempt from the restricted work environment could not resolve
the target hosts. It is **inconclusive**, not evidence of a website outage.
Homepage availability is not proof that wallet or lock APIs work.

## Before a production decision

1. Verify the latest PR head, base, changed files and deployment preview. Record
   any application change since the reviewed revision and recheck affected evidence.
2. Complete the remaining scope-specific acceptance above. Use PASS, FAIL or
   NOT RUN; do not substitute emulation for physical-device acceptance.
3. Identify the known-good production commit and prepare the Git revert that
   would remove the approved release without undoing unrelated later changes.
   Review the resulting diff, test affected routes and verify the production
   publishing method. No recovery deployment or production rehearsal follows
   from this run sheet.
4. Record the responder, provider contact path, observation limits and escalation
   procedure. Missing current data must remain unavailable rather than replaced
   with sample balances or totals.
5. Request a production decision naming the exact commit and this read-only
   scope. Keep the PR draft and unmerged until that decision.

Public account registration and financial activation retain their own gates in
PR #99 and are not waived by a smaller dashboard release.

## After an explicitly approved release

Verify the production homepage link and both dashboard routes, expected security
headers and same-origin resources. Run one finite production service check using
the existing checker, then verify a fixed public-address lookup and lock read.
Do not initiate OAuth, request a wallet signature or submit a financial action.

Check address editing and Clear remove balances, reference values and visit
history. Confirm unpriced holdings remain identified, fictional ranking labels
remain visible, and missions have their intended local-storage consent flow.

Record the exact deployed commit, time, checks and result. A failed check is a
release incident, not permission to silently change account or provider settings.

## Failure and recovery

If the new page exposes unintended account/financial functionality, leaks
private data, breaks request boundaries, or repeatedly fails its required reads,
stop the release and prepare a reviewed Git revert and new deployment. Do not
republish an older hosting snapshot. A build that fails before publication does
not replace the existing live deploy, so it needs diagnosis and a corrected
build rather than a rollback. A bad published release needs a corrective commit,
affected checks and the agreed production authority before publishing.
Confirm the corrected homepage and affected routes, then preserve safe evidence
for review. Do not publish credentials, private logs, account identifiers or
provider-console links.

On October 9 the hosting connector reported the current production deployment
ready on main at the baseline commit above. This read confirms deployment
metadata only; it does not prove runtime health, recovery permissions, automatic
publishing or a tested recovery. A later authenticated dashboard review verified the linked GitHub repository,
active builds, production branch main and auto publishing enabled. Successful
main deploys publish automatically. The earlier API-source observation did not
by itself establish that configuration.

A data-provider outage can leave wallet or lock reads unavailable while the
homepage remains Up. Keep the explicit unavailable display, distinguish provider
failure from a deployment regression, and do not advertise a successful dashboard
check based only on the homepage monitor.


## October 9 acceptance update

At 10:14 AM Chicago, after reviewing the PR #104 dashboard on a phone, the owner
confirmed that the requested wallet input, table scrolling, filters, Clear and
mission navigation seemed to work. Record these ordinary flows as **PASS —
owner reported**. No device identifiers, private wallet address or screenshots
are required in this public record. This report does not prove every chart label,
error case, sign-in flow, wallet permission or financial action.

All three PR workflows and the Netlify preview status passed at
`9b751c47b910a1c0e894cf69eaac2987d0f65afb`. The fallback change passed 32 existing
focused dashboard tests. At 9:49 AM Chicago, one finite hosted preview check
returned healthy wallet/pricing and treasury-lock results. A separate HTML read
confirmed the no-script notice and mission fallback, HTTP 200, no-referrer,
nosniff, frame denial and a CSP header. It did not execute a JavaScript-disabled
browser or establish production acceptance.

Five synthetic storage checks of the unchanged passport code passed: disabled
completion does not persist progress; explicit opt-in saves only valid session
markers; removal disables future persistence while preserving disclosed tab
badges; blocked storage does not claim success; malformed or unknown badge
records are not trusted. The dashboard reads saved passport state without
writing it. Passport removal does not delete avatars, current-tab badges,
on-chain data or provider operational logs. Provider retention/deletion and
administrative recovery remain separate requirements.

The phone report closes the named ordinary-flow acceptance item. It does not
close the remaining administration, monitoring, recovery or data-handling items
in the table. No production release follows from this update.

## October 9 Cloudflare owner confirmation

At 11:28 AM Chicago the owner confirmed that Cloudflare two-factor
authentication was set up. At 11:29 AM the owner confirmed that its recovery
codes were saved. Record these two items as **PASS — owner reported**. No codes,
credential values or storage locations are published or requested.

This confirmation covers the reported Cloudflare login and its saved codes. It
does not demonstrate a recovery login, establish protections for every other
administrator, prove separate registrar protection, or complete the least-access
review. Review the actual authorized members and roles before closing that item.
The remaining monitoring, service recovery and data-handling requirements are
unchanged. PR #104 remains draft; this evidence does not authorize publication.

## October 9 administrator access and publishing review

The owner reported no other Cloudflare members at 11:40 AM Chicago. This is
owner-reported membership evidence, not an API-token inventory or pending-invite
review. Authenticated Netlify pages subsequently showed one team Owner, zero
reviewers, no Git contributors and no pending member requests. The detailed roster
is the evidence used; an earlier project-summary count differed. Private member
identities and console URLs are omitted from this public record.

The project is linked to the intended GitHub repository, with active builds,
main as the production branch and automatic publishing on. Thus merging a
release or corrective change into main can cause a production deploy; retain
exact-scope approval before either action. No permissions, build settings or
publishing controls were changed during this read-only review.

An isolated changed-file fixture of candidate
`80c834553e49d24cc1a48a48454d73e4a1e852e1` reversed all 27 changed files: six
existing files returned to the baseline and 21 additions were removed. Source
blob comparison identified one trailing-newline mismatch in staging; the exact
source was restored before repeating the successful reversal. This supports
preparing a corrective Git change for that candidate. It is not a full-site
build, a production recovery rehearsal or proof the reversal applies cleanly
after unrelated later edits. Recreate and review the corrective diff against the
actual release/merge and current main before use.

All three CI workflows passed at that candidate. Cloudflare token/invitation
review, other-service access and recovery custody, monitoring response coverage
and applicable data-handling requirements are still separate checks. No release
approval follows from these results.

## October 9 deployment-failure notification and privacy verification

The owner explicitly approved adding the GFOF project's Netlify Deploy failed
email notification. It was saved and observed in the notification list on
October 9. The rule covers project deploy failures, including previews. It is
not a provider/API availability alert, a recovery notification, a delivery test,
or proof of an incident response. No failed build or production outage was
intentionally generated. Recipient identity and private console evidence are
omitted from this public record.

The read-only data-and-privacy page is linked from both the wallet disclosure
and the dashboard footer. Browser navigation and a corrected HTTP inspection
verified both entry points and the page. The first HTTP checker incorrectly
required double-quoted .html links; Netlify's clean-URL rewriting used single
quotes and extensionless paths. Inspection confirmed the links were present,
so this was a checker error rather than differing dashboard content. The
corrected check returned HTTP 200 and verified no-referrer, frame denial,
nosniff and no-store on the dashboard and privacy page. The host injects its
preview script; the privacy page's application source contains no script and
its meta policy disallows script execution. Do not claim that the delivered
preview HTML contains no script tags.

All three CI workflows and Netlify preview status passed at the privacy change
`1545aa88d9cd7a1b7b1eac8074b21bc706bb45b6`. This does not close provider log
retention/deletion handling, response rehearsals, recovery-message receipt,
resource operating limits or production-specific acceptance. Those items remain
open for the exact scoped release decision.
