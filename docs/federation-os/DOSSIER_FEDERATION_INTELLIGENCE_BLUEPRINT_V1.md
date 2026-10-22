# DOSSIER FEDERATION INTELLIGENCE — BLUEPRINT v1
Specification only · No Dossier production code · 2026-08-13 · For ChatGPT + owner review

## 1. REPOSITORY AUDIT

**Stack:** static HTML, zero build, 6 pages + data, Netlify with 4-line `_redirects`, no SW/PWA, no functions. One external service: Railway status API (`api-server-production-4a25.up.railway.app/api/status`), polled by index (60s) and status.html (10s), with honest-failure rendering and `?demo` mode.

**Routes:** `/` · `/forecasts` (+`/record` alias) · `/methodology` · `/status` · `/corrections` · `/forecast-spec(.html)` · data URLs `forecasts.json`, `corrections-archive/**`. Page canonicals use `.html` forms; BUILD 00's corrected sitemap matches them.

**Index sections (anchors):** problem (`#problem`: "SUB-$100K = RUG ROULETTE" / "$10M+ = ALREADY OVER" / "LONE WALLETS LIE") · method (`#method`: Surveil→Enrich→Detect Convergence→Alert) · focus · tiers (`#tiers`: Recruit FREE / Operative·Beta FREE 6MO / Operative / Handler — prices $19–$99 shown) · roadmap (`#roadmap`: Phase 01 "BUILT, NOW STOPPED / BUILT, NOW IDLE / NO ALERTS SENT", waitlist withdrawn 2026-08-10 per #023; Phase 02 "WAITLIST WITHDRAWN · SEE #023"; Phase 03 "NOT COMMITTED") · faq · federation (`#federation`: "intelligence arm of $GFOF", #006 revenue commitment 25%→50% at $5K MRR) · waitlist block (withdrawn).

**Hero (current truth, load-bearing):** "Currently halted while we work out whether that convergence means what we said it meant — and publishing the measurements either way," with the original pitch struck through and the 28.5% closed-position finding stated twice.

**Accountability surfaces:** corrections.html (23 numeric-id anchored entries) + OTS-anchored snapshot archive (3 txt+ots pairs) + append-only, hashed forecasts.json rendered client-side by forecasts.html with a verification footer. Specs: methodology.html (cohort, four on-chain stages, Signals/Handler rules, limitations) and forecast-spec.html (qualified-holder growth metric, floor F, broadening threshold, pre-registered confound, Brier vs two baselines).

**Identity/meta:** @Dossier_HQ (10 refs), t.me/GFOF_SOL (2), links into GFOF (corrections, liquidation-spec, security, home). OG images double as favicon (328KB). Fonts: Orbitron/Rajdhani/Inter/Share Tech Mono — already the FEDERATION OS set. Two token generations (index #080b11/.12 glow vs others #0a0e14/.15). Per-page duplicated shells; corrections/forecasts pages use a different nav than the marketing pages.

**Hardcoded claims/numbers found:** tier prices, $73K bond references, 28.5%, 8→38 cohort, phase labels, #006 percentages, $5K MRR threshold — all *published record*, not fabrications, but each is a maintenance liability in static HTML.

**Orphans/obsolete:** the waitlist section (withdrawn per #023) still renders; dossier-og.png doubles as favicon; no custom 404; no security headers (`netlify.toml` absent).

## 2. CLASSIFICATION (KEEP / RESTYLE / REPOSITION / RETIRE / NEEDS DECISION — nothing deleted in audit)

| Element | Class | Rationale |
|---|---|---|
| forecasts.json + client renderer + hashes | **KEEP** | Core accountability infrastructure; schema frozen (protected) |
| corrections.html entries/anchors + OTS archive | **KEEP** | Protected record; restyle chrome only, never entries |
| methodology.html, forecast-spec.html content | **KEEP** (restyle chrome) | The intellectual spine of Intelligence |
| status.html honest-telemetry pattern + ?demo | **KEEP** | Already exemplary truth-first engineering |
| Railway status API contract | **KEEP** | Only live dependency; reuse for MEASUREMENT REVIEW state |
| Hero halted disclosure + struck pitch + 28.5% | **KEEP · REPOSITION** | Becomes the flagship "Measurement Review" program record, not an apologetic hero footnote |
| Roadmap "where it stopped" section | **KEEP · RESTYLE** | Perfect evidence-chain / record-card material |
| Federation section + #006 commitment | **KEEP · RESTYLE** | Becomes the shell-level parent identity + an Archive-style commitment card |
| Method (Surveil→Enrich→Detect→Alert) | **REPOSITION** | Reframe as *the Convergence Program's* pipeline (one program), past/idle-tense accurate |
| Tier grid + prices | **NEEDS DECISION** | Waitlist withdrawn, no paid launch; showing a price sheet for a halted product invites the exact overclaim the record retracted. Recommend: retire the grid, keep a single factual "access model" statement + pointer to #023 |
| Waitlist block | **RETIRE** | Withdrawn on the record (#023); rendering it contradicts the record |
| "RUG ROULETTE / ALREADY OVER" problem framing | **NEEDS DECISION** | High-energy pitch voice vs. measured Intelligence posture; recommend retire or rewrite in evidence language |
| @Dossier_HQ, GFOF cross-links | **KEEP** | Real destinations |
| Marketing-page radar/decode effects | **RESTYLE** | Fold into FEDERATION OS motion rules (reduced-motion, one-shot) |
| Dual token generations, duplicated shells | **RETIRE** (via fed-tokens adoption) | Same consolidation as Command |
| OG-as-favicon | **RESTYLE** | Proper small icon; OG untouched |
| Missing netlify.toml/404/security headers | **NEEDS DECISION** (hygiene build) | Port GFOF's header discipline |

## 3. CURRENT-STATE PRODUCT MAP
Dossier today = (a) a halted convergence-detection product (pipeline stopped, engine idle, zero alerts delivered, waitlist withdrawn), (b) a **live and healthy accountability system** (forecast record, corrections, OTS archive, honest status), and (c) two rigorous public specifications. The product is paused; the *record* is the working product. The blueprint's core move: build the identity on (b)+(c), with convergence as Program 01 inside it — exactly the "broader than convergence" mandate.

## 4. PROPOSED INFORMATION ARCHITECTURE
**Dossier = FEDERATION INTELLIGENCE (GF-I01): programs, records, method.**
- **BRIEFING** (`/` — route-preserving): who Intelligence is, current posture (Measurement Review), programs index, Federation identity, records access.
- **PROGRAMS**: 01 CONVERGENCE (status: Measurement Review — method, the struck pitch, the 28.5% finding, what's being measured, the stopped pipeline as an honest systems record). Architecture leaves room for future programs without a rebuild — the section is a list of one today, and says so plainly.
- **RECORDS** (existing routes unchanged): Forecast Record (`/forecasts`, `/record` alias), Corrections (`/corrections`), snapshot archive.
- **METHOD** (`/methodology`, `/forecast-spec` unchanged): the standing intellectual assets.
- **TELEMETRY** (`/status` unchanged).
No route renames, no redirects needed; the redesign re-chromes and re-narrates existing URLs and adds zero required new ones (an optional `/programs` anchor lives on `/`).

## 5. VISUAL-LANGUAGE EXTENSION FROM FEDERATION OS
Same tokens file, Dossier context: deep navy environment (`--fed-space` family), **intelligence cyan** as the working accent, **signal green strictly for verified/resolved states** (resolved forecasts, kept commitments, confirmed reads), **gold only where the parent Federation speaks** (shell identity, the Federation section, #006 commitment card, GF coordinates). New Dossier-context vocabulary built from existing BUILD 02 components: evidence paths (fed-chain), signal traces (the fed-signal shell — rendered idle/preview until real data exists), research records (fed-record-card for forecasts/corrections/roadmap phases), source chains, timelines (forecast issued→resolves-by as restrained horizontal records), dossier cards, verification states (existing status semantics). Confidence/evidence structures appear **only** where forecasts.json actually supplies them (probability, Brier baselines per the spec). Forbidden list adopted verbatim: no trading-terminal cosplay, no fake feeds, no decorative charts, no glass stacks, no HUD.
**Character delta vs Command:** denser information rhythm, tighter panels, more mono metadata, less cinematic space — Headquarters is spacious and ceremonial; Intelligence is quiet, precise, and slightly darker (`--surface-system`-dominant backgrounds), with the one gold thread marking whose intelligence service this is.

## 6. NAVIGATION / SHELL STRATEGY
Shared from FEDERATION OS: the Command Bar (exact GF logo + GALACTIC FEDERATION + FEDERATION OS), system nav with **DOSSIER active** (aria-current), status trigger, drawer engine, footer, bottom mobile nav, config structure. Dossier-specific: a **second-level Intelligence rail** under the shell (BRIEFING · PROGRAMS · RECORDS · METHOD · TELEMETRY) in Dossier cyan — this is the mechanism that prevents duplicate navigation: the Federation shell switches *systems*, the Intelligence rail moves *within* Dossier. Command↔Dossier movement: shell nav both directions (Dossier's shell "COMMAND" → galacticfederation.co; Command's "DOSSIER" → dossiertrack.co), division identifier (DOSSIER / FEDERATION INTELLIGENCE / NODE // GF-I01) confirming arrival. The Dossier logo question — Dossier currently has no mark beyond wordmark+glyph — **NEEDS DECISION**: continue wordmark-only under the GF shell (recommended; identity flows from the parent) vs. commissioning a Dossier mark (out of scope for AI generation under asset rules).

## 7. HOMEPAGE (BRIEFING) CONCEPT
Shell → division identifier → **posture line**: `DOSSIER // MEASUREMENT REVIEW` with the explicit sentence that detection is currently halted while the convergence thesis is measured, styled as a first-class system state (impaired semantics), never a buried disclaimer → mission statement (intelligence & research system of the Federation; evidence before access) → PROGRAMS panel (Program 01 Convergence card: state, what stopped, what's being measured, link to method + the measurement) → RECORDS strip (live counts *computed client-side from forecasts.json/DOM*, never hardcoded — open forecasts, resolved, corrections entries) → METHOD cards (methodology + forecast-spec) → FEDERATION section (gold: parent identity, #006 commitment as an Archive-style card with its corrections link) → footer. Telemetry pill keeps the existing Railway read with its honest-unknown fallback. **Removed relative to today (pending owner sign-off):** waitlist block, tier price grid, rug-roulette framing.

## 8. INTELLIGENCE WORKSPACE CONCEPT (forward architecture, not built now)
When detection resumes (or a successor program ships), `/` gains a CONVERGENCE FEED zone rendering real signals through the fed-signal component from real API data or rendering an explicit idle state — the component contract already forbids fabricated population. Zones per the original Bible: Feed / Signal Detail / Evidence / Methodology / Forecast Record / Corrections / Status — all but Feed and Signal Detail already exist as pages; the workspace is a recomposition, not new construction. This is why the blueprint survives Dossier evolving beyond convergence: the workspace frame is program-agnostic.

## 9. MEASUREMENT REVIEW TREATMENT
Parent level everywhere (shell status, Command network, Dossier posture line): `MEASUREMENT REVIEW` (impaired semantics). Detail level (Program 01 card + method page intro): the full verbatim-faithful disclosure — halted, why, the struck pitch preserved struck-through, the 28.5% finding, measurements published either way. The redesign treats this as **Dossier's strongest brand asset**: an intelligence shop that measured its own thesis and published the miss. No visual element may imply live detection: no pulsing "scanning" states, radar sweep retired or explicitly labeled as program illustration, no live-feed cosplay.

## 10. MOBILE STRATEGY
FEDERATION OS bottom nav (Dossier active) + the Intelligence rail as a horizontally scrollable second bar under the shell (same pattern as fed-rail, 44px+ targets). Records and program cards single-column; forecast entries stack with their metadata rows intact; the evidence chain uses its existing vertical mobile form; no hover-dependent information anywhere (inherited rule). Tables in forecasts render as stacked definition-style cards below 640px.

## 11. ACCESSIBILITY STRATEGY
Inherit wholesale: WCAG 2.2 AA target, canonical focus ring, 44px targets, aria-current in both navigation levels, dialog-spec drawers, reduced-motion (all Dossier ambient effects one-shot or static), 12px metadata floor (several current Dossier labels sit at 10–10.5px — restyle brings them up), label+color for every state, skip link added with the new shell, semantic `<ol>`/`<article>` for records.

## 12. SHARED vs DOSSIER-SPECIFIC COMPONENTS
Shared (from /assets/federation/, served per-domain as exact copies until a CDN decision): fed-tokens, fed-base, fed-components, fed-shell (+js). Dossier-specific (new, one file each): `fed-dossier.css` — Intelligence rail, briefing composition, program card, forecast-entry chrome, posture banner; `fed-dossier.js` — forecasts.json renderer port into the new chrome (logic preserved), status pill (existing logic), rail behavior. **Cross-domain asset note:** the GF logo file must be added to the Dossier repo as an exact byte copy (hash-verified) — first time the sacred asset crosses repos; recorded as a protected-file addition.

## 13. MIGRATION RISKS
(1) forecasts.json renderer rewrite risks the verification footer/hash display — port, don't rewrite; diff rendered output. (2) Corrections page restyle must not touch entry markup/anchors (numeric ids) — chrome-only rule, hash the content region. (3) Railway API is a single point of live truth — every consumer keeps the honest-unknown fallback. (4) Removing tier grid/waitlist changes public claims — must be its own reviewed change referencing #023, possibly with its own corrections entry (owner's call, flagged). (5) `.html` canonicals vs clean URLs — keep as-is; changing canonicals is out of scope. (6) Two repos drift — shared files need a stated sync rule (copy-on-build-approval). (7) The GFOF chat.js fact sheet describes Dossier — any repositioning language shipped publicly triggers the standing prompt-pass rule.

## 14. PROTECTED ASSETS/FILES (Dossier)
forecasts.json (URL+schema+bytes-append-only) · corrections-archive/** (byte-exact, OTS) · corrections.html entry anchors + content · published data URLs · Railway API contract · @Dossier_HQ identity · methodology/forecast-spec substantive content (chrome may change; claims may not) · the halted/28.5% disclosure language (may move, may not soften) · all existing routes. Plus, upon migration: the copied GF logo (hash-locked).

## 15. PROPOSED PHASED BUILD SEQUENCE (each gated, mirroring the Command process)
**D0 — Hygiene & baseline:** netlify.toml (headers + 404), favicon decision, protected-hash baseline for Dossier, shared-file copies (tokens/base/components/shell + logo, hash-verified), no visual change.
**D1 — Briefing preview:** isolated `briefing-preview.html` (noindex, unlinked): shell + Intelligence rail + posture + programs + records strip + Federation section. Owner decisions required first: tier grid retirement, problem-section voice, Dossier mark question.
**D2 — Records re-chrome:** forecasts + corrections in the new chrome; renderer ported; anchors/entries byte-preserved; verification footer diffed.
**D3 — Method & telemetry re-chrome:** methodology, forecast-spec, status.
**D4 — Production migration:** route-preserving cutover, sitemap/OG refresh, GFOF chat.js prompt pass, corrections entry if public claims changed, Command network link verified both directions.
**D5 (future, unscheduled):** workspace/feed — only when real detection data exists.

— End of Blueprint v1. Awaiting ChatGPT + owner review. No Dossier code written; GFOF/Command untouched; FCC not begun.
