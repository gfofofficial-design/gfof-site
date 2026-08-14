# FEDERATION OS — PROTECTED FILES (BUILD 00)

These files/data are NEVER reformatted, pretty-printed, renamed, restructured, normalized, or rewritten by any build. Exclude from all formatters/prettifiers permanently. SHA-256 baselines recorded 2026-08-13 so accidental modification is detectable.

## GFOF (gfof-site)
| Item | Baseline SHA-256 |
|---|---|
| record/fr-001.txt (byte-exact, OTS-anchored) | 8a8764d0f1e7776e8815e352e99eed8f1f5c0d49345703e4a5c16fb07a55c56f |
| record/fr-001.txt.ots | 816ff4fd44341c841e8bcd47eec127f673835c3e564f862972894a89859bbac3 |
| corrections-feed.xml (RSS guids immutable) | 72a84e2365b53a5d52a3bc5ed98ac02f49f29cb4c9a328d168df72110850992e |
| whitepaper.pdf | c589811d2bba5dad3ccb1f65fd0803fe2d64bb5476ad699f959ce6ae6da42f9c |
| logo.png (sacred mark) | a3d1a031822da6350b057adf763d9b96809e486f0662b4fff6ab8a3620a0a87c |
| logo-circle.png (sacred circular mark) | fbd4bfc27b6da85ddd02baa6591ef63325c6372d6d5f80c022657ee84b2eeaea |
| voss-avatar.png | 34a7fce447d371413554800f3d1d9cf5629aeac81482e4f6dcd750f450aa1eb4 |
| voss-full.jpg | 6f7c937a1ad685d9a1785df9f446cba35c830dc323eee0fa2c453adeea7f1d80 |

Also protected (content rules, not byte-frozen):
- corrections.html — all 46 entry anchor IDs (32 c-series #c001… + 14 h-series #h001…) must survive any future redesign; entry markup semantics feed the live keep-rate computation
- All published canonical routes (see ROUTE_BASELINE) — no renames without approved redirects
- netlify/functions/chat.js SYSTEM_PROMPT — second copy of site truth; any fact-affecting site change requires a prompt pass

## Dossier (dossier-site)
| Item | Baseline SHA-256 |
|---|---|
| forecasts.json (append-only, per-entry content_hash; schema frozen) | 8d148689e49710cee5f74babcfaad752427ddcfdc3b86604e9a975eb99c1fce1 |
| corrections-archive/dossier-corrections-2026-08-01.txt | 357303855d04daf408f30761c922707a23aa2879465333250a9e39fa0d3763c1 |
| corrections-archive/dossier-corrections-2026-08-04.txt | 238d7416efc9056ef39dc9466d327222f8873b0d52c1b8fbcc5231cf56e94349 |
| corrections-archive/dossier-corrections-2026-08-10.txt | fd0400d91cd855283e5fd1c4f5794d4ed60a0ee24d03f08283610a256af2fdc3 |
| corrections-archive/*.ots (3 files) | 3f51e105… / 5dca8682… / 22be727d… |

Also protected:
- corrections.html entry anchor IDs (bare numeric scheme: id="001"…)
- forecasts.json URL and schema (fetched client-side by forecasts.html — a published data URL)
- Railway status API contract as consumed by index.html + status.html

## Append-only rule
record/** and corrections-archive/** are immutable append-only storage: existing files never change; new entries are new files.
