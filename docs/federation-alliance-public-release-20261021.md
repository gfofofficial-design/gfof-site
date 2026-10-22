# Public Alliance Arena and project-request release

Base: c4ed598d3873f769f009977cfecc8c2db7634597. Source: approved integration preview, latest reviewed board head87768c82a3f9c1d5e7ea4d666c48dcfb83ccbb3d.

This release packages only the public Alliance Arena, local community sandbox, founder proposal/starter briefs, reviewed public match board, explicit Netlify request intake, related dashboard/privacy copy, and focused frontend checks. The public match registry is empty. Journey activities remain optional. The community sandbox stays in this tab and creates no real membership, invitations, scores or uploaded artwork.

The sole hosting configuration change is the existing Alliance header's form-action from none to self for the native request POST. Its connect-src remains none. Existing account/function routes, runtime credentials, database schemas/roles, AWS packages, protected member composition and execution boundaries are not copied from the integration branch. The production account email-only configuration is unchanged by this source.

Acceptance already observed on the combined preview:246 local tests, eleven workflows, registered request form and one clearly labelled owner request captured with matching GFOF inbox notification. The later empty-board increment passed253 local tests and eleven workflows; its hosted empty state was observed. These results are previous-source evidence: this isolated release requires its own exact-head CI and preview verification. No skipped job is runtime acceptance.

The form-specific notification for alliance-project-request is configured to gfofofficial@gmail.com. Records remain private in Netlify Forms; a proposal does not approve a partner or create a match. Public publishing remains a reviewed source/deploy change after actual team consent, rules and dates. There is no live entry/scoring service or private admin workflow in this release.

Main publishes automatically. Merging this PR would release these public pages and request intake to production. A decision must identify the exact checked head and this limited scope. After an approved merge, verify the production page/headers and perform a separately agreed finite intake check; prepare a reviewed corrective Git change if required. Do not infer full Alliance/member release or financial activation.
