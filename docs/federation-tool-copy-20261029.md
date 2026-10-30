# Shared public tool copy

The dashboard and Alliance use one reviewed source for tool names, destinations,
availability labels and account-access wording:
`scripts/_shared/federation-tools.mjs`.

These records describe published product scope. They do not establish provider
health, data freshness, account admission, wallet control or permission to trade.
Changing a label cannot enable a service. The existing server, Auth and swap
controls remain authoritative.

The dashboard's existing first-view panel now offers wallet quantities, Alliance,
Galactic Swap and Dossier. A separate mission link remains below the choices.
The wallet action is a local anchor so it does not reload an existing dashboard
session. The Alliance's native tools disclosure uses the same names, destinations
and status labels; its sign-in shortcut states the existing-account limit.

The generated regions are checked-in HTML. They work without an extra script,
network request or client-side catalog. Ordinary links remain usable with
JavaScript disabled. Existing financial reads still require their own scripts.

To deliberately update the copy:

1. Reconcile the intended scope with the exact approved release and evidence.
2. Edit the catalog. Its review date describes copy review, never a fresh chain
   read or blanket refresh of historical evidence.
3. Run `node scripts/sync-federation-tools.mjs --write`.
4. Review the HTML diff and run the focused catalog test and `--check` mode.

The existing Alliance CI workflow checks the catalog and all marked regions.
The swap description derives its token symbols from the explicitly declared
quote pairs at authoring time. Updating that registry triggers the same checks;
it does not add a browser request or imply that every route is available. The
current list describes SOL, GFOF and native USDC on Solana; trading remains closed.
Drift fails the check. Missing, duplicated or reversed markers refuse before the
tool rewrites either source page. Refreshing marked regions preserves surrounding
content; it does not rewrite account forms or member controls.

This change preserves closed public signup, protected member acceptance gates,
deferred Google sign-in and quote-only Galactic Swap. It adds no dependency,
credential lookup, cloud permission, hosted trial or deployment.
