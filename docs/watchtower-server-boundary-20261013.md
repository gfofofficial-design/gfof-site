# Watchtower HTTP boundary — closed draft

The two server routes are implemented for a future finite, private observation test. Both return `503 WATCHTOWER_DISABLED` by default. This change installs no secrets, activates no database login, creates no Helius webhook, configures no schedule and sends no alerts. The public site has not been released with this change.

## Request flow

`POST /api/watchtower/intake` accepts a bounded enhanced-webhook batch with its own Authorization header. After deployment, time-window and configuration checks, it projects only watched signature/slot/account candidates into the intake capability. A success response requires the durable write to acknowledge before the deadline. Raw webhook bodies are not stored.

`POST /api/watchtower/process-one` requires a different Authorization header and an empty body. It claims at most one stored candidate through the worker capability, reserves each of two fixed finalized RPC reads before attempting it, and saves only projected corroboration. The caller cannot choose a candidate, supply SQL, change accounts or change limits. It makes no sale, ownership, lock-effect or safety finding. There is no automatic trigger or background retry.

Each request gets separate role-bound database queries. TLS, transaction-local roles, identities, allowed statements and database privileges remain checked by the connection component. Pools close afterward, including failures. Database completion can be uncertain after a timeout; investigate the durable row/counter before authorizing another attempt.

## Closed by default, with an absolute deadline

Only the exact string `true` in the server setting `WATCHTOWER_PILOT_ENABLED` permits further setup. A closed handler reads no credentials and constructs no pools. Enabled requests must also pass all of these gates before storage access:

- A correct route, POST method, no query string and the route's own header credential.
- A private `WATCHTOWER_ACTIVATION` record identifying one Netlify site and the exact reviewed Watchtower source fingerprint.
- Netlify's trusted context identifying a non-published `branch-deploy` with a valid deploy ID. Production and Deploy Previews are refused.
- Explicit absolute UTC start/end times, at most ten minutes apart, with the current time inside that interval. Restarts and later requests cannot extend it.
- All recorded operator prerequisites, including hosted credential proof, review of other connectable databases and upstream webhook costs.

The fingerprint covers 21 text source/contract/dependency files, normalized to LF checkout line endings. `node scripts/check-watchtower-server.mjs` checks the committed digest; regeneration is a review step, not runtime behavior. It identifies this component's source version, not the whole deploy, an external signature or correctness of provider data. CI checks it independently of the activation setting. The runtime uses trusted context for the actual deployment; build-only environment variables such as COMMIT_REF are not assumed to exist in Functions.

Expiry or request cancellation propagates through the intake, worker, verifier, database adapter and source transport. The intake deadline is at most 750 milliseconds; the single worker deadline is at most ten seconds. Each query and source read also checks that the window is still open. Late results cannot start the next source read, acknowledge a receipt or save corroboration after cancellation. A previously committed write or reservation cannot be undone by cancellation.

Changing an environment setting does not change older Netlify deploys. The short absolute expiry protects those deploys; emergency shutdown still requires upstream pause, locking credentials and exact deployment cleanup. Expiry does not revoke an external secret or lock a database role on its own.

## Private deployment settings — no values in this document

Use approved Netlify server-side secret storage, with Functions scope and the selected branch context where supported. Do not place values in Git, public pages, `netlify.toml`, logs or request URLs.

| Setting | Purpose |
| --- | --- |
| WATCHTOWER_PILOT_ENABLED | Closed unless explicitly `true` |
| WATCHTOWER_ACTIVATION | Schema 1 record: siteId, sourceSha256, startsAtUtc, endsAtUtc, startup |
| WATCHTOWER_INTAKE_AUTHORIZATION | `Bearer ` plus 43–128 URL-safe characters, dedicated to the webhook |
| WATCHTOWER_WORKER_AUTHORIZATION | Different credential of the same form, for one manual worker request |
| WATCHTOWER_SUPABASE_PROJECT_REF | Exact approved tenant reference |
| WATCHTOWER_SUPABASE_POOLER_HOST | Exact reviewed shared transaction-pooler hostname |
| WATCHTOWER_INTAKE_DATABASE_PASSWORD | Unique private intake login password |
| WATCHTOWER_WORKER_DATABASE_PASSWORD | Different private worker login password |
| WATCHTOWER_HELIUS_API_KEY | Reviewed private standard-mainnet RPC key |

The public Supabase CA is bundled as a source module with its reviewed SHA-256. It is not a password and is not read from a runtime filesystem or environment variable. The actual private project and role credentials are supplied separately. A valid pooler certificate alone does not identify the tenant.

The `startup` record requires `additionalProviderSpendUsd: 0` and true values for creditHeadroomChecked, automaticPurchasesDisabled, providerPauseReviewed, storageMigrationApproved, storageReady, limitsApproved, mainnetTransportReviewed, credentialProofReviewed, otherDatabaseScopeReviewed and providerWebhookCostsReviewed. These are operator declarations, not authenticated evidence. Each needs a dated review before it can truthfully be set. This code creates no spending authorization.

The existing atomic counter limits verification RPC reservations to the reviewed 2,000/day and 60,000/month values. It does not cap webhook-provider charges, Netlify compute, database storage, other API consumers or all hosting costs. Database and role limits are not a hosting-spend guarantee. Retention, recovery, upstream pause and account-specific credit/billing evidence still need review before a hosted test.

## Checks and limits

Offline cases cover default-off imports, wrong/swapped headers, malformed worker requests, wrong site/source/context, missing prerequisites, expired/future/overlong windows, complete projected intake/worker composition, sanitized errors, pool closure and expiry during a source read. The isolated PostgreSQL fixture runs the complete HTTP composition through the actual pinned driver and restricted identities over fixture TLS, with two synthetic source responses. It cannot contact a hosted project or provider.

These checks do not prove a deployed enabled route, provider delivery, hosted deadline behavior or continuous monitoring. No alert destination or public notification behavior is configured.

No user-facing interaction was added. API responses use short stable text codes, do not depend on color and expose no credential/error details. Future operator controls should name each credential separately, support password-manager paste, keep status readable and make expiry explicit. Backend tests do not establish WCAG conformance.

Primary references checked October 13, 2026: [Netlify Functions context and routes](https://docs.netlify.com/build/functions/api/), [environment scope and deployment snapshots](https://docs.netlify.com/build/functions/environment-variables/), [Supabase Postgres connections](https://supabase.com/docs/guides/database/connecting-to-postgres).
