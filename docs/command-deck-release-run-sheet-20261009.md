# Read-only Command Deck release run sheet — October 9, 2026

Status: **HOLD — review candidate, not production release approval.**

Candidate: [PR #104](https://github.com/gfofofficial-design/gfof-site/pull/104).
Reviewed application revision: `8bb6714c7d5c582f19182cece4e2b7c3e4758d84`.
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
| Physical device | Owner reported ordinary input/table/term use on the larger PR #99 preview | Check this exact PR #104 preview on a physical phone: input, table scrolling, filters, chart labels, Clear and mission navigation |
| Administration | Repository, identity and hosting MFA confirmations recorded | Domain/DNS administrator MFA, recovery custody and least-access review |
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
publishing or a tested recovery. The deployment record reports an API source,
so do not assume that a Git push alone will publish a corrective release.

A data-provider outage can leave wallet or lock reads unavailable while the
homepage remains Up. Keep the explicit unavailable display, distinguish provider
failure from a deployment regression, and do not advertise a successful dashboard
check based only on the homepage monitor.

