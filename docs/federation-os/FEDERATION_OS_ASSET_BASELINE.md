# FEDERATION OS — ASSET BASELINE (BUILD 00)

## Logo assets (SACRED — see PROTECTED_FILES for hashes)
| File | Role | Referenced by |
|---|---|---|
| logo.png | Favicon + apple-touch-icon on ALL 16 GFOF pages; JSON-LD Organization logo; RSS channel image; PWA manifest icons (both 192 and 512 entries); in-page imagery | every GFOF page + app manifest + corrections-feed.xml |
| logo-circle.png | Circular mark | index.html only |
| voss-avatar.png | Voss chat/community avatar | index.html (static ×2 + JS-generated markup) |
| voss-full.jpg | Voss portrait, §admiral | index.html (lazy, dimensioned, graceful fallback) |

Dossier contains ZERO GF logo assets in BUILD 00 (per spec §4 — logo lands in a later approved shell build via exact file copy).
GFOF index nav currently renders a CSS gradient hexagon, not the logo image (future shell will change this by design).

## OG / social images
| File | Status |
|---|---|
| og-image-v3.jpg | ACTIVE — GFOF OG/Twitter image |
| og-image.png, og-image-v2.png | ORPHANED from markup; retained for old social-share caches. PRESERVE. |
| dossier-og.png | ACTIVE — Dossier index OG + site favicon/apple-touch (328KB — heavy for favicon role; BUILD 01+ candidate for a small icon, without touching OG use) |
| dossier-og-v2.png | ACTIVE — OG on all non-index Dossier pages |

## ORPHAN_ASSET_REPORT
| File | References found | Likely status | Safe-to-delete confidence | Reason |
|---|---|---|---|---|
| dexscreener_logo.png | none in any HTML/JS/manifest/XML in repo | orphan | HIGH (repo-scope) — but retain in BUILD 00 | Could be hotlinked externally (Telegram posts, X cards); no in-repo consumer |
| og-image.png | none in markup | orphan (superseded v1) | do NOT delete | Old share-link previews may still resolve it |
| og-image-v2.png | none in markup | orphan (superseded v2) | do NOT delete | Same |
| app-sw.js (root) | not registered anywhere (registration targets /app/sw.js) | stale/orphan — BUT carries NEWER cache version v18.0 than the registered v17.27 | do not delete yet | Evidence a version bump was authored but never shipped to the registered path; resolve intent in BUILD 01 |
| app-manifest.json (root) | no page links it (pages link /app/manifest.json) | stale/orphan (content diverged) | do not delete yet | Same divergence question |

No other unreferenced media found.
