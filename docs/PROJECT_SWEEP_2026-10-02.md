# Federation project sweep — 2026-10-02

## Scope and evidence

Review of source inventories and selected current source across Command/GFOF,
Dossier and FCC; public homepage retrieval; open pull-request inventory; offline
HTML/link/asset, JSON-LD, JavaScript syntax and calculator execution checks.
This is a bounded engineering/content sweep, not a security certification,
full browser accessibility audit, contract audit or end-to-end release test.

Pinned main source:
- GFOF: b298e4eee603de9846bb899d15d2b735a8229447.
- Dossier: 540ca1ffea4c6925e27203b23a527417e0fdf2ef.
- FCC: 3f464436ddff7111340313c23509bdf6f05b9166.

Inspected 36 GFOF HTML pages, 10 Dossier HTML pages, GFOF Voss fact sheet,
routing/security configuration, and 24 FCC source/script modules. Inventories
were complete (Git trees reported truncated=false). These counts describe
inspected files, not every repository file. Local review copies were fetched
from GitHub; no assumption is made that older scratch checkouts are current.
Homepage web retrieval confirmed the public Command staking section and its
Dossier Measurement Review wording. Dossier's public/source homepage and verdict
describe Program 01 as retired. Public retrieval of /staking returned a tool
access error; it is not evidence of a production outage. Calculator validation
below used current source, not a new live browser check.

## Fixes staged in this draft

1. Add Staking preparation to the mobile More menu. Desktop nav, homepage section
   and footer already link to it; the desktop nav is hidden below 1024px.
2. Reconcile Program 01 status in Command network labels/body, build progress,
   roadmap, FAQ visible text and JSON-LD, and Voss's fact sheet/example.
   Link the existing measured verdict; keep the separate public Lens beta.
   No alert availability is added.
3. Remove the build/roadmap instruction to publish a measurement outcome that
   Dossier already published on 2026-09-29.
4. Tell JavaScript-disabled staking visitors that displayed figures are only the
   starting 100,000 GFOF example and input changes will not recalculate.
5. Mark invalid calculator amounts with aria-invalid and clear it on recovery.

This draft does not rewrite historical correction entries, legal policy,
treasury purposes, numerical staking targets, provider settings or public gates.

## Prioritized remaining work

| Priority | Finding | Next action / boundary |
| --- | --- | --- |
| Release blocker | Original canary completed 24 in-window runs, including 17 consecutive gap reports. No cursor or sale/purchase/email proof was established. | Keep alerts closed. Resolve isolated flag-off verification, preserve evidence and obtain final budget only through safe test metadata access. PR48 is not deployed. |
| Release blocker | New observation intervals are a proposal, not implemented behavior. Existing controller gap is permanent and blocks a fresh watch. | Review separate interval implementation, migration, state isolation and disposable concurrency tests before a new trial. Do not delete the old gap. |
| Release blocker | Staking is a public preparation concept; pools, exact provider formula, cumulative entry liability, reserve funding, fees, counsel review and withdrawal proof remain open. | Continue private readiness PRs71/75. No pool creation, deposits or funding transaction follows from this sweep. |
| High | Live security.html and FAQ still describe paid bounties and deadlines; llms.txt and Voss also advertise bounty wording. Review-only PR25 stages withdrawal. | Complete the existing counsel/publication review; avoid a conflicting second policy patch or claiming withdrawal is already live. Preserve prior commitments and any obligations. |
| High | GFOF llms.txt calls the project name the legal/operational entity; owner supplied Welks 8 LLC DBA Galactic Federation Of Finance. | Reconcile legal display after verifying exact issuer/operator scope; do not publish an EIN as routine metadata. No legal clearance is inferred. |
| High | Dossier CSP form-action none blocks native form submission if homepage JavaScript does not run. Homepage currently intercepts submission through script. | Review allowing same-origin forms or providing a functional non-form fallback. Verify behavior in a browser before a routing/security change. |
| Medium | access-spec.html uses present tense “Program 01 ... is in Measurement Review”; index.html also retains it but /index.html redirects to /. | Reconcile current specification notice without overwriting historical evidence. Treat index.html as redirected legacy source, not the served homepage. Coordinate with PR25. |
| Medium | llms.txt describes FCC as unannounced/design phase and liquidation spec v0.2 while homepage links describe a public Epoch2 experiment and newer spec. | Update machine-readable discovery against current source/version records, preserving historical dates. Do not invent operating capital services. |
| Medium | FCC forbidden-word source walker includes astro/jsx/tsx/html/md but excludes the actual mjs components. deploy-build runs lint before creating current dist. | Add reviewed mjs literal/render coverage or lint newly generated output, with fixtures proving an introduced forbidden claim fails. Existing copy JSON is scanned; do not call the whole build unvalidated. |
| Medium | Journey first-contact.png is about 2.94 MB and is used by the homepage. | Prepare an optimized responsive derivative, preserve exact approved art, and compare mobile visual quality. Inventory sizes are not measured transfer/performance results. |
| Medium | Voss upstream timer is cleared after fetch resolves, before response.json reads the body. | Add an offline stalled-body regression case before proposing an end-to-end deadline adjustment. This is source-level timeout exposure, not an observed outage. |
| Medium | Draft receipt fixes PR37–43, archive PR45 and gap PR48 have different branches/baselines and evidence. | Prepare a consolidation/dependency review on a separate branch; run the combined offline suite before any merge proposal. Do not assume independent passing suites prove the combined release. |
| Follow-up | Owner reported delayed inbound mail to alerts@dossiertrack.co. | Verify receiving mailbox/MX configuration separately. Outbound Resend acceptance does not prove inbound delivery or owner-inbox acceptance. No DNS/mail configuration was changed here. |

## Checks performed

- Parsed inspected HTML to inventory identifiers, links and images: no duplicate
  static IDs and no img elements missing alt attributes in the inspected GFOF and
  Dossier pages. This does not prove meaningful alternatives or complete WCAG
  compliance.
- GFOF: 584 local href/src references resolve to source files after path/directory
  normalization. Dossier: 205 references were checked; /token-structure maps to
  token-structure-preview.html through _redirects, resolving its clean URL.
  Static route resolution is not a live HTTP status/fragment test.
- Six Journey skip-link targets are generated by their page scripts; absence
  from initial HTML is not itself a broken-link verdict. Browser keyboard
  behavior with and without JavaScript remains a separate check.
- All 24 inspected FCC mjs modules passed node --check. No FCC build or moving
  record fetch was executed.
- Changed Voss source passed module syntax checking.
- Changed-page JSON-LD parsed successfully.
- Actual calculator browser script executed with a minimal DOM harness:
  100,000 starting example; 25,000 comma-grouped amount; malformed 1,00 rejection;
  invalid-state recovery; and 0.000001 base unit passed. No wallet, RPC or provider
  request occurred. This is not real-browser layout or screen-reader validation.
- No new tests were added for these small reversible presentation changes.
  Runtime/contract acceptance suites were not represented as rerun.

## Release boundaries

This draft is unmerged. No production deploy, AWS action, Railway change,
hosted migration, provider/RPC call, email send, fund movement, staking pool,
automation or alert gate activation was performed. Existing PR25, PR15, PR45,
PR48 and staking readiness holds remain independent. Browser visual/mobile
verification of this patch and publication are still pending.

## Follow-up review — 2026-10-02

PR82 code source 79d1cfaa4c63c94bb5e0b2b0df403081c03ed388 remained draft,
unmerged and mergeable when inspected. The six Journey generated heading
targets were checked in their actual scripts/shared chapter runtime; this
supports the source explanation above without claiming keyboard/browser proof.

The five changed HTML pages passed duplicate static ID, trailing-whitespace
and applicable JSON-LD parsing checks. The mobile More drawer contains a plain
/staking link marked IN DESIGN, and the changed Voss module passes syntax
checking. These are source checks, not rendered accessibility acceptance.

A local-only preview was assembled with first-party CSS and shell scripts.
Real-browser layout checks could not execute: the installed Playwright package
had no Chromium binary, and a browser install attempt failed with an incomplete
archive (End of central directory record signature not found). No screenshot,
mobile overflow result, real-browser calculator result or screen-reader pass
is claimed. The prepared preview harness was not executed successfully and is
not part of the production patch. No live site/provider request was made by
that harness. Visual/mobile QA remains outstanding.
