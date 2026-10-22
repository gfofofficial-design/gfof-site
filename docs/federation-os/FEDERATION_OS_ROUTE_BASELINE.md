# FEDERATION OS — ROUTE BASELINE (BUILD 00, verified 2026-08-13)

Static verification: every clean-URL rewrite maps to an existing file; every internal href resolves to a file or redirect rule. All routes VALID unless noted.

## GFOF (galacticfederation.co)
| Route | Mechanism | Target | Status |
|---|---|---|---|
| / | file | index.html | valid |
| /faq /research /record /adjudication-method /treasury /corrections /security /liquidation-spec /governance-spec /access-spec* /creator-fee-spec* /intel /classified | netlify.toml 200 rewrite (*served as .html; access-spec & creator-fee-spec have no explicit rewrite rule — clean URL works via Netlify pretty-URLs, .html canonical) | matching .html files | valid |
| /app, /app/* | 200 rewrite | app/index.html | valid |
| /api/price /api/chat | 200 rewrite | netlify/functions/{price,chat}.js | valid (runtime) |
| /gfof-corrections.html /gfof-index.html /app-index.html /dossier-corrections.html | 301 retired-file redirects | /corrections, /, /app, dossiertrack.co/corrections | valid (chained) |
| /* fallback | 404 status | 404.html | valid; real files still serve (no force) |
| Published artifacts | files | whitepaper.pdf, corrections-feed.xml, sitemap.xml, robots.txt, llms.txt, humans.txt, record/fr-001.txt(.ots), /.well-known/security.txt (NEW in BUILD 00) | valid |

## Dossier (dossiertrack.co)
| Route | Mechanism | Target | Status |
|---|---|---|---|
| / | file | index.html | valid |
| /forecasts /methodology /corrections | _redirects 200 | matching .html | valid |
| /record | _redirects 200 | forecasts.html | valid (alias) |
| /status.html /forecast-spec.html | direct files (no clean-URL rule; page canonicals use .html) | files | valid |
| forecasts.json, corrections-archive/** | published data URLs | files | valid |
| No custom 404 | — | Netlify default | noted, not a defect |

Canonical note: Dossier pages declare .html canonicals; corrected sitemap (BUILD 00) matches them exactly.
