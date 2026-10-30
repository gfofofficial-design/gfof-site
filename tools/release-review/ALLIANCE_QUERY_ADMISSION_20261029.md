# Alliance request-query admission hardening

October 29, 2026. Prerelease source review on top of integration PR171, base `eea33969fcc363d17101780210c434b977a99084`. The protected member routes remain unmounted/default-closed. No production, account, database or cloud setting is changed.

## Reproduced issue

After a synthetic application was prepared, `/api/alliance-members/me?ignored=1` reached the signed serving-authority check before the inner profile API rejected its query. The regression observed authority decisions and signing-key reads rise from2to3. No profile operation was needed to reproduce it. The same issue was reproduced for `/community/challenges?limit=0` in the full owner-review application.

The inner HTTP boundaries already rejected the malformed queries before their Auth/service calls. The gap was the earlier URL classifier used by the composed application before its authority exchange. This is unnecessary admission/signing work, not evidence of a live production disclosure or authorization bypass.

## Change

- Profile-directory parsing is shared between the outer member classifier and the inner profile API. Self/profile-removal/status routes reject query parameters at entry.
- Collaboration, feedback and report-review modules each reuse their existing domain-specific query policy in both their route classifier and inner cookie boundary.
- Unknown keys, duplicate keys, invalid/missing IDs, out-of-range pagination and query strings on mutation URLs are rejected before the application's serving-authority exchange.
- Valid profile pagination remains1–20; other list pagination remains1–5. Valid read, write and deletion paths, current-session checks, privacy headers, limits and uncertainty handling remain intact.

Malformed URLs now receive404 from these composed entry points rather than consuming authority work and later returning400. Malformed request bodies still use their existing validation. This change does not attempt to pre-read request bodies before authority admission or replace ingress/rate limits.

## Evidence

The new full-application regressions assert unchanged authority/signing counters and zero Auth/profile work for malformed requests, then verify that valid directory/collaboration/feedback/owner-review queries still succeed. The shared route test covers native and encoded duplicate query keys. Existing direct-HTTP expected statuses were updated only for URL failures now rejected at entry.

170focused local cases passed, none skipped: profile API, member HTTP/application, community/feedback/review HTTP, finite host, preview-bundle ownership and static-publication suites. All five modified runtime modules pass syntax checks. Static publication remains641files and still excludes operator tools/server implementation. Browser sources, netlify/Supabase/worker/config sources, deployment policy and feature flags are unchanged from PR171. No dependencies were added.

The optional local finite-entry package test could not load the repository's pinned AWS SDK because this isolated checkout has no installed package dependencies. Its existing CI job installs the pinned dependencies with lifecycle scripts disabled and runs the package suite. Read exact-head CI results before acceptance; the missing local SDK is not a passing check. No software was installed on Michael's company-managed computer.

## Dev implications

This changes five runtime source files, so it supersedes PR171's runtime-byte-invariance claim for this later candidate only. Rebuild/review the member package from the selected exact source before a hosted journey; retain its new hashes and existing numeric version/resource bindings. It does not change the private corrected Control capture source, established keys/trust, database roles, recovery minima or backup decisions. Do not reset or repeat those operations to apply this patch.

Current hosted capture/offsite, operating backup/recovery, protected journeys, device/assistive checks and full-release approval remain open. Passed independent retained fictional52-table restore and original B2 roundtrip stay passed. Signup/private serving, Google deferral and Swap trading/fees remain closed. This draft grants no merge, deployment, credential, cloud-run, signing, spending or message authority.
