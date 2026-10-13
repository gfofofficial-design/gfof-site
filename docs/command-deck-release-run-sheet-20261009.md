# Read-only Command Deck — release and operating record

Current status: **LIVE — read-only Command Deck released October 12, 2026 (Central).**

Live dashboard: https://galacticfederation.co/command-deck

## Current release status — October 13, 2026

The release is recorded in [PR #104](https://github.com/gfofofficial-design/gfof-site/pull/104), approved at head `e135da24ae9d46b650a568757f96dbffe89e8f6f` and merged as `06ec768379e650eb79417c7756a98afb72d9080b` on October 12 Central. That PR records finite preview and production acceptance, not full hosted quota exhaustion or a complete accessibility audit.

[PR #106](https://github.com/gfofofficial-design/gfof-site/pull/106) subsequently merged the staking/intelligence paragraph fixes and legacy-app zoom/cache changes as `23b419903e9d9722608d261cc5cbc5d1bf411ad7`. This is the public main revision checked on October 13.

[Dossier PR #63](https://github.com/gfofofficial-design/dossier-site/pull/63) and [FCC PR #6](https://github.com/gfofofficial-design/fcc-site/pull/6) are merged. Fresh public-page reads confirmed three Command Deck links on the Federation homepage, three on Dossier and two on FCC, all targeting the canonical dashboard. A merge alone is not proof of publishing; these served-page observations supply the link evidence.

### October 13 public-page check

Both `/command-deck` and `/command-deck.html`, and the dashboard privacy page, returned HTTP 200. Each returned private/no-store caching, no-referrer, nosniff, frame denial and a CSP header. The production `/account` route returned 404. No wallet, pricing, lock RPC, OAuth or signature request was made by this check; page availability is separate from data-service health.

### Released scope and operating limits

The public dashboard provides manual public-address reads, exact returned quantities, available reference values, current GFOF lock evidence and First Contact missions. Clear removes page wallet results and visit history. Proposed staking comparisons and fictional ranking examples remain labeled. No account registration, wallet signing, deposit, claim or public lending is included in this release.

The released wallet path requires a separate shared reservation before RPC. Its configured counter allows 500 wallet reservations per UTC day, with at least one second between them. Each permitted lookup can attempt up to three RPC calls, with no application retries or refunded reservations: at most 1,500 attempted calls per day through that configured route. Preview and production share this allowance. It is not a cap on every provider account, other route or hosting cost.

Prices have their own shared reservation counter: 24 per rolling minute, 3,000 per UTC day and at least 2.5 seconds apart. Pricing can be unavailable while confirmed quantities remain visible. Missing configuration and service failure must retain the unavailable behavior. The per-visitor six-request/60-second rule is also exported by the modern function; its documented enforcement delay prevents treating it as an immediate hard ceiling.

### Remaining account and operating work

- [PR #99](https://github.com/gfofofficial-design/gfof-site/pull/99) remains draft and unmerged. Its integration with the released dashboard has automated evidence, but a new Google round trip and affected normal-path acceptance remain distinct checks. Public-account activation and provider/client replacement retain separate release decisions.
- The managed signup-hook timeout clarification and verified account deletion/recovery operations remain account gates. The read-only release does not close them.
- Verify wallet/pricing failure coverage, current response ownership and operating allowances. The released PR does not claim automated wallet/pricing monitoring, measured provider-credit parity or full hosted daily exhaustion.
- Real screen-reader acceptance, physical-device checks for newly changed flows and complete WCAG conformance remain distinct from semantic markup, source tests and browser emulation. Accessibility remains the first design priority recorded during the release work.
- Regenerate any corrective Git change against the actual release and current main, preserving later unrelated changes. An old fixture or hosting snapshot is not a rehearsed current recovery. Further production publication retains its exact-scope decision.

## Historical review evidence

The collapsed material below preserves the October 9–12 pre-release record. Its HOLD, draft and pending statements are dated historical evidence; they do not override the current live status above. Later operating claims require their own evidence.

<details>
<summary>October 9–12 pre-release review history</summary>

# Read-only Command Deck release run sheet — October 9, 2026

Status: **HOLD — review candidate, not production release approval.**

Candidate: [PR #104](https://github.com/gfofofficial-design/gfof-site/pull/104).
Original October 9 reviewed revision: `1545aa88d9cd7a1b7b1eac8074b21bc706bb45b6` (privacy page and dashboard links). Later acceptance is recorded below; use the current PR head for a release decision.
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

## October 9 treasury API monitor activation

At 12:35 PM Chicago the owner explicitly approved enabling the prepared treasury
API monitor. It was created and its first observed result was **Up**, with zero
incidents. It checks the public `/api/treasury-locks` endpoint every three minutes
for the current token mint string. Email notification is enabled for the existing
sole-owner response path. Confirmation and recovery periods are one minute,
request timeout is ten seconds, TLS verification is on, and redirects are off.
No credentials, new recipients, paid upgrade or intentional failure were used.

This provides endpoint and case-insensitive mint-string coverage. It does not
validate complete JSON, decode each lock, establish data freshness or verify
wallet and pricing APIs. Failure and recovery email delivery for this monitor
remain **NOT RUN**. The earlier drill remains paused. Production dashboard
acceptance and the remaining release requirements above are unchanged.

## October 12 price reservation preview connection

The existing Cloudflare price-reservation service has been connected through
Functions-only environment settings for this candidate's exact preview branch.
Its original credential and shared SQLite state were retained. No production
environment setting was added. This documentation update triggers a fresh
Git-based PR preview build to apply those settings; runtime acceptance is still
pending at this revision.

The configured service limits reservations for the wallet's Jupiter price step
to one per 2.5 seconds, 24 per rolling minute and 3,000 per UTC day across this
preview. A refused or failed reservation leaves reference pricing unavailable;
it does not substitute a price. A reservation is consumed even if the later
price request fails. These limits do not cap Solana balance reads, the separate
token price endpoint, hosting use or all project spending.

Before counting this connection as accepted, verify the new exact-head preview
and run the finite preview service checker. Preserve any unavailable-pricing
result and its timing; an environment-settings readback alone is insufficient.
Production configuration, release approval, account sign-in and monitoring
acceptance remain separate requirements.

## Production missing-configuration guard

The canonical production wallet route now requires a successful price
reservation before it can call Jupiter. Missing or incomplete budget settings,
a denied reservation or a service failure leaves pricing unavailable while
the confirmed balance response remains readable. The server chooses this rule
from its validated canonical origin; request data cannot disable it.

Synthetic handler checks cover all four refusal cases and a configured allowed
reservation. They do not configure production or replace its post-release
acceptance. The isolated preview's existing connection and behavior are retained.

## October 12 remaining launch review

The current main baseline is `802edf8c2e338be0987df91b59ba4e702bb70de8`.
An isolated Git-index reversal of candidate `378aea19a7afd6e6c4bb1a067411545d08e8dfb8`
matched the exact baseline tree across all 35 changed files and preserved one
synthetic unrelated later addition. It did not change a checkout, branch or
hosted site, test later changes in the same file or perform a hosted recovery.
Regenerate the corrective patch for the actual final candidate/merge before use.

Fresh metadata confirms one Netlify team Owner and one accepted Cloudflare
administrator with two-factor authentication enabled. This is stronger than
the earlier Cloudflare owner-only report, but it is not a complete token/key
inventory or a private recovery-login rehearsal. Existing provider variables
are secret, Functions-scoped site values; their current vendor allowance and
shared usage are not established by environment metadata.

The data-and-privacy page now identifies the shared Cloudflare reservation path,
its lack of viewed-wallet data, published provider policies and the existing
operator contact. It distinguishes page clearing from provider deletion and
does not invent one log-retention period. Jupiter's published interface policy
does not establish an API-specific retention period. Provider-request handling
and any applicable agreements remain operating review items.

The earlier incident, acknowledgment and automatic-recovery emails for the
October 9 drill were found together in the official Federation inbox on October
12. They match the incident timeline and sender, closing the previously unverified
receipt item. This is a past controlled drill, not proof of future response
availability, wallet/pricing monitoring or delivery during a provider outage.
The three homepage monitors and current-mint treasury monitor are active; the
drill remains paused. No new email, monitor or setting was created for this check.

The wallet visitor limit was previously attached to a redirect targeting a
Lambda-compatible function. Netlify's documentation requires function limits
in a function's exported configuration. The candidate now uses a modern custom
route with the original balance handler in a library, a 256-byte/two-second
inbound-body bound and the intended six-request/60-second IP-and-domain rule.
The old redirect rule is removed. Request origins, quantity precision, provider
deadlines, missing-price handling and the mandatory canonical price reservation
are retained. Local route-boundary and ignored-cancellation tests passed.
Hosted rule/route verification is pending at this source revision.

Netlify documents up to ten seconds of enforcement delay. The visitor rule is
neither an immediate six-request hard ceiling nor a shared RPC/day/spend cap.
See [Netlify rate limiting](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/).
The separate shared price-reservation limit covers only the Jupiter price step.

## Shared wallet-read limit draft — October 12 Central / October 13 UTC

The new draft adds a separate SQLite counter to the existing reservation service:
500 permitted wallet lookups per UTC day, spaced at least one second apart.
One permitted lookup can attempt three Solana RPC calls, with no application
retries or refunded reservations. This bounds this route at 1,500 attempted RPC
calls per UTC day when connected. The existing price counter, namespace, object
identity and credential are retained. The two counters contain only shared
counts and timing, without viewed addresses, balances or mint lists.

The canonical production wallet route requires this reservation before any RPC
call. Missing or incomplete configuration, invalid responses and service failure
return unavailable without balances; the daily and spacing refusals give their
own return guidance. The price reservation remains a separate step: unavailable
prices can still accompany confirmed balances from a permitted wallet read.
Unconnected previews retain their earlier behavior; they are not protected by
this daily cap until the exact preview configuration has been approved and tested.

Real SQLite fixtures cover simultaneous requests, object recreation, the full
daily ceiling, UTC reset, corrupt state and preservation of the existing price
row. Handler and page checks cover refusal before RPC, stale-data clearing and
separate daily/visitor messages. This is offline evidence. No new Worker version,
wallet budget variables, production configuration or release is authorized here.

The proposed preview setup reuses the existing reservation service and secret,
adds only Functions-scoped settings on this PR's exact branch, then performs
one finite hosted acceptance packet. A later production decision would share
these counters with that preview, so testing would consume the same allowance.
These limits do not cover another draft, the separate token-price endpoint,
treasury reads, hosting compute, all account usage or all project spending.
The Helius dashboard showed Free-plan usage of 53/1,000,000 credits during the
read-only launch review; that account observation does not establish the exact
production key or future competing use. Published method pricing is a separate
source, not a measured account debit for this candidate.

See [Helius credits](https://www.helius.dev/docs/billing/credits). Keep the live
site unchanged until hosted acceptance and an exact production decision.

## Accessibility-first continuation — October 12, 2026, Central

The owner adopted accessibility as the Federation's first design priority.
This candidate now gives the keyboard-focusable wallet table the same visible
focus treatment as other controls and marks its loading state with aria-busy.
Success, failure, cancellation, a replacement invalid input and a late cancelled
response must all leave accurate state without restoring old results or clearing
a newer request's loading indication. The live status message remains outside
the busy results region so progress and errors can still be announced.

Native labels, keyboard operation, the text/table equivalents, reduced-motion
styles and no-JavaScript guidance are retained. Focused DOM tests and a local
Chrome keyboard/invalid-input check support these changes; they do not establish
real screen-reader announcements, full WCAG conformance or a new physical-phone
check. Those checks are recorded separately from simulated or automated evidence.
No new source call, cloud permission, account or publication is included.

## Shared wallet-cap preview connection — October 12, 2026, Central

The owner approved the prepared preview-only connection. The existing reservation
Worker was updated once with the reviewed wallet counter, preserving its secret
binding, namespace, class and named object. Functions-only wallet-budget settings
were added once for this exact PR branch, with no production/shared-team value.
Readback confirmed the intended metadata and unchanged published site.

This documentation commit rebuilds the Git-based preview to apply those settings.
The three-request service-spacing proof and two-request wallet/price plus treasury
acceptance packet are still unrun at this revision. No runtime daily-cap acceptance,
hosted exhaustion, monetary spend cap or production protection follows from settings
alone. Keep the PR draft until the finite packet and final production review pass.

</details>
