# FEDERATION OS — DESIGN TOKENS (BUILD 01)

Canonical source: `/assets/federation/fed-tokens.css` (not attached to any production page in BUILD 01). This document mirrors the CSS; if they ever disagree, the CSS is wrong and must be fixed to match approved values, never the reverse.

## Color system
Core (approved, immutable without new approval): `--fed-space #020818` · `--fed-command #40C0FF` · `--fed-authority #F0C040` · `--fed-verified #3DFFA0` · `--fed-text #C8D8F0` · `--fed-text-display #EEF5FF` · `--fed-muted #8896BC`.
Derived: surfaces `#061022 / #081429 / #0B1A32`; borders at 200,216,240 alpha .10/.16/.28; soft/glow fields per accent; states `--fed-danger #E96767`, `--fed-warning #E8B85C`, `--fed-neutral #8796AA`.

**Semantics:** command = command/active-nav/technology/communication · authority = heritage/institutional authority/history/commitments · verified = verified/confirmed/operational · danger = failure/missed/offline/critical · warning = caution/pending · neutral = inactive/unknown. **Color is never the only carrier of a status** — always pair with a label and/or shape.

**Lighting semantics:** cyan = system activity/communication · green = verification/confirmed · gold = authority/historical significance · red = failure/critical. No glow for decoration alone.

**Contrast review (BUILD 01):** no canonical core color conflicts found on space surfaces at body sizes. Constraint: `--fed-muted` / `--fed-neutral` must not be used below `--text-xs` (12px) — the legacy 8–9px metadata readability problem is not to be recreated. No core values were altered.

## Typography
Roles (locked): display=Orbitron (Command headings/hero/ceremonial) · interface=Rajdhani (UI labels/nav/controls) · body=Inter (long-form reading, specs, records) · system=Share Tech Mono (technical metadata/telemetry). **JetBrains Mono is not canonical** — remains on legacy pages until progressive migration; do not remove in BUILD 01. Font delivery unchanged in BUILD 01 (§29).
Scale: text .75/.875/1/1.125/1.25rem · headings 1.5/2/2.75rem · display clamp(2.75–4.5rem) and clamp(4–7.375rem). Line heights: body 1.65 · heading 1.1 · display 0.95 · system 1.3. System metadata tracking .10em/.14em wide; production metadata floor ≈12px (11px only in rare decorative contexts).

## Spacing, layout, grid
8px rhythm, --space-1…10 (4px→128px). Content max 1280px; reading max 760px (≈65–75ch). Gutters 64/32/20px desktop/tablet/mobile. Nav height 72px desktop. Grid: 12/8/4 columns desktop/tablet/mobile (documented; column counts live in future shared CSS, not custom properties). Grid gap 24px.

## Geometry
Radii 4/8/12/16px; not a highly rounded interface. Pills only for statuses, compact filters, small metadata tags. `--fed-corner-cut: 12px` is the signature clipped-corner for select major panels — documented only in BUILD 01, never universal decoration.

## Motion
micro 140ms (hover/focus/buttons) · interface 250ms (tabs/drawers/panels) · structural 450ms (network relationships/module state) · cinematic 1000ms (**Federation Seal activation only** — never routine UI). Ease: cubic-bezier(.22,1,.36,1). Reduced-motion convention (future shared base layer maps `prefers-reduced-motion: reduce`): remove non-essential reveals, disable seal activation, disable network-line drawing, remove decorative motion, preserve functional transitions.

## Z-index
0/10/100/200/400/500/600/700 = base/content/sticky/nav/drawer/modal/command-palette/toast. No magic values.

## Surface hierarchy
Exactly four: SPACE (base universe) → SYSTEM (large structural section) → PANEL (information containment) → ACTIVE (selected/interactive). Aliased to the derived surface colors. No proliferation of variants.

## Status semantics
CSS defines **state types** only: operational (verified green) · provisional (warning/authority) · impaired (warning) · failed (danger) · unknown (neutral). Project status values (ONLINE, ACTIVE, LIVE, BETA, VERIFIED, PENDING, DESIGN PHASE, SPECIFICATION, RESEARCH, DEVELOPMENT, UNAVAILABLE, DEGRADED, OFFLINE, MISSED) live in content/data/config, never in CSS. Every status renders label + color, never color alone.

## Accessibility conventions (WCAG 2.2 AA target)
Focus ring: #40C0FF, 2px, 3px offset. Touch target ≥44px. Body text 16px. Reading measure 65–75ch. No color-only communication. Not globally enforced in BUILD 01; the shared base layer enforces later.

## Breakpoints
mobile ≤639 · tablet 640–1023 · desktop ≥1024 · wide ≥1440. Custom properties can't drive @media; explicit values go in future shared CSS. Reference tokens exist for JS use only.

## Federation coordinates
COMMAND GF-00 · DOSSIER GF-I01 · ARCHIVE GF-A01 · FCC GF-C01 · RESEARCH GF-R01 · COUNCIL GF-G01. **Fictional/internal UI identifiers only** — not blockchain addresses, physical coordinates, legal IDs, or network addresses. Not displayed on production pages yet.

## Inheritance
**Dossier** inherits space, text, typography structure, layout philosophy, motion, accessibility, shell behavior; accents prioritize command cyan, verification green, subdued graphite surfaces, restrained gold. One system, not a competing one. **FCC** inherits FEDERATION OS; emphasizes `--fed-authority`, restrained gold/bronze illumination, deep-space surfaces, white/readable data, minimal glow. FCC remains DESIGN PHASE; nothing implies operation.
