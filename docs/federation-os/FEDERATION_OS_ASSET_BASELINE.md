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
| File | References found | Resolution | Reason |
|---|---|---|---|
| dexscreener_logo.png | none in any runtime HTML/JS/manifest/XML | REMOVED — 2026-09-03 hygiene reconciliation | No in-repo consumer; current token links do not use this asset |
| og-image.png | none in markup | PRESERVE — do not re-reference | Old share-link previews may still resolve it |
| og-image-v2.png | none in markup | PRESERVE — do not re-reference | Old share-link previews may still resolve it |
| app-sw.js (root) | not registered anywhere | REMOVED — canonical worker is `/app/sw.js`; active cache rotated to `v18.0-2026-09-03` | Eliminates the stale duplicate while shipping the cache bump through the registered path |
| app-manifest.json (root) | no page links it | REMOVED — canonical manifest is `/app/manifest.json` | Eliminates the divergent, unreachable duplicate |

No other unreferenced media found.
