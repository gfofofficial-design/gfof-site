# FEDERATION OS — BUILD 00 REPORT
Date: 2026-08-13 · Branch: federation-os-v2 · Scope: safety & baseline only

## BUILD 00 STATUS
**Partially Complete** — all code-level tasks done; three tasks blocked by environment, not by the repos: (1) real GitHub branch must be created by owner (zips carry no .git history — local git reconstruction used), (2) screenshots unavailable (no browser in audit environment — none invented), (3) Lighthouse unavailable (manual baseline substituted per spec §10). One owner verification pending: production check of /.well-known/security.txt before committing the new file.

## BRANCH
Local reconstruction: baseline commit b8e2530 (untouched uploads) → branch `federation-os-v2` with BUILD 00 changes. Owner action: create `federation-os-v2` branch in each GitHub repo via web UI and apply the files listed below to that branch only. Do not merge. Do not deploy.

## FILES CREATED
- gfof-site/.well-known/security.txt (exact transcription of the block published on security.html — no invented values)
- gfof-site/docs/federation-os/FEDERATION_OS_BUILD_00_REPORT.md
- gfof-site/docs/federation-os/FEDERATION_OS_PROTECTED_FILES.md
- gfof-site/docs/federation-os/FEDERATION_OS_ROUTE_BASELINE.md
- gfof-site/docs/federation-os/FEDERATION_OS_ASSET_BASELINE.md

## FILES MODIFIED
- dossier-site/sitemap.xml — domain corrected to dossiertrack.co (see HYGIENE FIXES)
- gfof-site/index.html — one string, line 3075: holders fallback 'LIVE' → '—' (sanctioned by spec §13; zero layout consequence)

## FILES DELETED
None.

## PROTECTED FILES
Confirmed and SHA-256-baselined in FEDERATION_OS_PROTECTED_FILES.md: GFOF record/** (txt+ots), corrections-feed.xml, whitepaper.pdf, all 4 logo/Voss image assets, corrections.html anchors #c001–#c046; Dossier forecasts.json (+schema), corrections-archive/** (3 txt + 3 ots), corrections anchors, published data URLs. All hashes verified unchanged after BUILD 00 edits.

## ROUTES VERIFIED
All GFOF and Dossier routes valid (16 GFOF pages, function rewrites, retired-file 301 chains, 404 fallback; 6 Dossier pages + /record alias + data URLs). Zero broken, zero renamed. Full table: FEDERATION_OS_ROUTE_BASELINE.md.

## LOGO ASSET BASELINE
- Favicon (all GFOF pages): logo.png
- In-page: logo.png (multiple sections, index) — nav currently uses a CSS hexagon, not the image
- Circular mark: logo-circle.png (index.html only)
- Voss: voss-avatar.png (index chat/community), voss-full.jpg (index §admiral)
- Dossier: zero logo assets present (correct for BUILD 00; logo added only in the later approved shell build)
- All four assets hash-locked; no redraw/recolor/regeneration performed or permitted

## HYGIENE FIXES
1. **Dossier sitemap** — FIXED. Before: 13 galacticfederation.co URLs (copied from GFOF). After: 6 dossiertrack.co URLs matching each page's declared canonical exactly (/, forecasts.html, methodology.html, status.html, corrections.html, forecast-spec.html). lastmod/changefreq/priority omitted rather than fabricated. robots.txt already pointed at the correct sitemap URL — untouched. XML validated.
2. **security.txt** — CREATED from the exact values security.html publishes (Contact: x.com/WelksCrypto + t.me/GFOF_SOL; Expires 2027-04-20; Canonical, Policy, Acknowledgments URLs). PENDING OWNER CHECK: open galacticfederation.co/.well-known/security.txt in a browser first — if production already serves one, do not commit this file.
3. **Factual fallback** — FIXED per §13. index.html:3075 wrote literal 'LIVE' into the holders value slot on total API failure. Now '—'. Reported explicitly per spec.

## ORPHAN ASSET REPORT
See FEDERATION_OS_ASSET_BASELINE.md. Summary: dexscreener_logo.png = true orphan (retain — possible external hotlinks); og-image.png/-v2.png = superseded, preserve for social caches; root app-sw.js/app-manifest.json = orphaned duplicates, see next section. Nothing deleted.

## SERVICE WORKER / MANIFEST REPORT
- Registered SW: /app/sw.js (app/index.html line 829), cache v17.27-2026-07-22
- Linked manifest: /app/manifest.json
- Root app-sw.js: referenced by NOTHING; cache v18.0 — NEWER than the registered file. Evidence a cache bump was authored at the wrong path and never shipped.
- Root app-manifest.json: referenced by nothing; content diverged from app/manifest.json (description/categories)
- Deleting root copies would break no route or in-repo reference (HIGH confidence), but per §7 they remain untouched pending owner confirmation of the v18.0 intent. BUILD 01 recommendation: port the intended v18 bump into app/sw.js properly, then remove the root duplicates.

## DATA SOURCE BASELINE
| Source | Consumers | Poll | Fallback | Misleading-UI risk |
|---|---|---|---|---|
| DexScreener pair→token chain | GFOF index (direct), price.js | 30s | skeletons/dashes persist | Low |
| /api/price (Netlify fn, 20s cache) | app/index.html | on load + interval | zero-shape JSON | Low |
| Solscan holders→meta chain | GFOF index, app | 60s | was 'LIVE' text — now '—' (fixed) | Was Medium, now Low; residual: hardcoded '41+' default (see RISKS) |
| Helius RPC (key inline treasury.html, domain-locked per its comment) | treasury.html | 60s | 'see Streamflow' — never wrong numbers | None (exemplary) |
| /api/chat → Anthropic (claude-haiku-4-5, ANTHROPIC_API_KEY, 8s timeout, 1 retry, coded failures) | index + app chat | on demand | single offline message | None; NOTE: SYSTEM_PROMPT is a second copy of site truth |
| Railway /api/status | Dossier index (60s), status.html (10s) | polls | explicit unreachable state; never asserts LIVE | None (exemplary) |
| forecasts.json | forecasts.html | on load, no-store | honest load-failure message | None |

## ACCESSIBILITY BASELINE
Manual (tooling unavailable): no skip links anywhere; prefers-reduced-motion honored only on both homepages; GFOF doc pages have no mobile nav (only "back to site"); DexScreener iframe lacks title; 39 inline onclick handlers on index (CSP-hostile); 9–11px mono at 2px tracking below comfortable readability; --muted #8896BC borderline at small sizes; images otherwise well-handled (alt text, dimensions, lazy, fallbacks). Nothing changed — baseline only.

## PERFORMANCE BASELINE
Manual (Lighthouse unavailable): index.html 232KB single-request HTML (~44KB gz est.), zero render-blocking JS; render-blocking Google Fonts on every page with per-page weight-set drift defeating cross-page cache; canvas starfield + multi-layer fixed gradients + backdrop-filter on index (partially reduced-motion gated); browser-side 30s/60s polling per visitor on index vs cached /api/price in app (unconsolidated duplication); logo.png (140KB) reused as favicon everywhere and as both PWA icon sizes; dossier-og.png (328KB) doubles as Dossier favicon. Numbers to be captured with real Lighthouse in BUILD 01 before/after gates.

## SCREENSHOTS
UNAVAILABLE — no browser/headless Chrome exists in this audit environment and its restricted network cannot install one. Not invented per spec §9. Owner options before BUILD 01 visual work: capture at 1440×1200 and 390×844 via browser devtools on the live site, or I supply a small Puppeteer script to run locally.

## RISKS FOUND
1. stat-holders default is hardcoded '41+' — on total API failure a stale number persists (the fixed fallback only fires when the slot is empty/'...'). Factual-accuracy risk; needs a decision in BUILD 01 (skeleton default → '—').
2. Registered SW carries older cache version than an unregistered orphan — stale-cache risk for existing PWA installs whenever BUILD 01+ ships; must bump app/sw.js correctly.
3. chat.js SYSTEM_PROMPT duplicates site truth (self-documented failure shape in corrections #026) — every fact-affecting FEDERATION OS change needs a paired prompt pass.
4. Helius RPC key is public in treasury.html source — acceptable only while domain-locked (as its comment states); re-verify the lock in Helius dashboard before any FCC/treasury build.
5. docs/federation-os/ is publicly fetchable under Netlify root publishing (unlinked, no secrets). If undesirable, exclude via netlify.toml in BUILD 01 or keep docs out of the deployed repo.
6. GFOF's three CSS token generations / JetBrains Mono question — carried forward to the BUILD 01 token decision; no change made.

## RECOMMENDATIONS FOR BUILD 01
Technical only: (1) resolve SW version intent, bump app/sw.js, then remove root duplicates; (2) decide stat-holders default treatment; (3) capture real Lighthouse + screenshot baselines before any visual diff; (4) token decision: bless or retire JetBrains Mono before fed-tokens.css exists; (5) consolidate index's direct DexScreener polling onto /api/price when the shell lands; (6) add iframe title + skip links as part of shell markup (shell build, not before); (7) pair any public naming change with a chat.js prompt pass.

## TEST RESULTS
- XML validation of corrected sitemap: PASS (xmllint)
- Static route integrity, both sites: PASS (all rewrites → existing files; all internal hrefs resolve; function paths exist)
- Protected-file hash re-verification after edits: PASS (all baselines unchanged)
- LIVE→'—' change: verified single-occurrence, single-string, no markup/CSS touched
- security.txt: field-complete per RFC 9116 (Contact + Expires present); values byte-matched to security.html's published block
- Not testable here: Netlify redirect runtime behavior, function execution, deployed security.txt presence, rendering

## READY FOR REVIEW
**YES** — with the three owner actions above (create real GitHub branches; verify production security.txt before committing it; screenshots via local browser). No BUILD 01 work started. No fed-tokens.css, no shell, no command-preview.html, no visual change of any kind.
