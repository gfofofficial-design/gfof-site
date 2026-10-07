# Federation security release gates

Owner agreed to these release requirements on 2026-10-07. Scope: the new Command Deck, account registration, and future staking/lending integrations. This is an evidence checklist for review, not a security certification or a completed audit. Existing public informational pages are not declared audited by this record.

**Current disposition: HOLD for public account registration and financial activation.** PR99 remains draft. The wallet preview reads public addresses only; it establishes neither ownership nor financial eligibility. Documentation approval does not authorize an account-setting change, paid service, pool creation or transaction.

## Evidence required before release

| Gate | Required evidence | Current status |
| --- | --- | --- |
| S1 — Website and integration review | Review the exact release commit, script/dependency sources, security headers, request boundaries and sensitive-data handling. Record findings, fixes and focused regression results. Obtain an independent competent security review of the account/wallet integration before a financial launch; do not imply an audit from unit tests. Unresolved critical/high findings block release. | Partial: implemented controls and focused tests recorded below; independent review and final integration checks pending. |
| S2 — Administrator access | Verify MFA for repository, hosting, identity and domain/DNS administrators; least necessary access, secure recovery and credential handling. Record dated confirmation without publishing recovery codes, keys, device identifiers or private account details. | Pending verification; do not assume MFA from a successful login. |
| S3 — Actual wallet behavior | On the exact preview origin, test explicit address permission, rejection, pending-request cancellation, account change, disconnect and mobile behavior. Independently compare populated token quantities and verify stale/error displays clear. Read-only mode must not request message or transaction signatures. | Partial: five mock-provider cases passed; real Phantom/device/populated-holder checks pending. |
| S4 — Account and registration | Test real cancellation, successful-code replay rejection, expired state, provider outage, multi-tab refresh, logout/revocation and production-specific cookies/origin. Before Google-only signup, prove new Google creation succeeds and direct Email/password/OTP creation is denied in an isolated signup-enabled test; preserve existing owner access. | Partial: private Google round trip, selected failure cases and 29 focused tests; selective signup and remaining provider cases pending. |
| S5 — Data access and privacy | For each new data feature, document access rules and prove cross-user reads/writes are denied, including table grants, RLS, privileged code and storage where applicable. Complete retention and verified-request deletion procedures. A gate may be marked not applicable only with evidence that the release has no such data path. | Private pilot observed with no application public tables; future cloud records and wallet association not implemented. Privacy/deletion procedures incomplete. |
| S6 — Recovery | Retain a dated recovery point, export/tool provenance and integrity checks; restore in isolation, verify required Auth users/identities and login, exclude inappropriate session restoration and reconcile deletions since backup. Choose a sustainable backup/availability plan and demonstrate recovery without relying only on a dump file. | Partial: isolated restore-pilot Google login tested; provenance and complete session/deletion reconciliation pending. |
| S7 — Monitoring and response | Verify actionable alerts for provider/API failures, suspicious account activity and resource usage; avoid logging tokens, auth codes or request bodies. Record who responds, how new invitations are disabled, provider contact, evidence retention, public correction and recovery steps. Rehearse an outage and suspicious-activity response; approve operating limits and availability plan. | Pending operational evidence. Rate limits and public RPC are not a hard spending cap or uptime guarantee. |
| S8 — Financial provider and authority | Match the exact product/program/version, upgrade/admin powers and audit scope; resolve material findings and test the actual permitted position through exit/claim. Verify current mint, full reward obligations, custody, destinations, fees and approvals under the existing staking runbook. Lending needs its own product-specific review, including liquidation/oracle/authorization risks if applicable. | Provider unselected; no pool or lending service open. No contracts, funding or transactions approved by this record. |

## Existing evidence and its limits

- Dashboard/wallet/price/calculator/Phantom: 27 focused tests passed together. Tests include exact token arithmetic, request rejection, failure handling, stale-response cancellation and mock-provider behavior.
- Account: 29 focused handler/page tests previously passed. The private pilot completed owner Google sign-in, reload and logout. A disposable-user deletion was checked against its Federation session and old refresh token; this is not proof of revoking every issued token at every endpoint.
- Hosted dashboard: public mint-address balance/pricing success, unavailable-service behavior and two actual visit-only SOL observations checked. That mint address is not a populated holder-wallet validation.
- Strict request/origin constraints, secure account cookies, restrictive dashboard script policy, bounded reads and application-memory-only history are implemented. Their presence does not settle administrative access, recovery, production availability or provider-contract security.
- Phone visuals and final keyboard skip-link activation remain device checks. These usability checks do not replace the security gates above.

Details: [dashboard evidence](federation-command-deck-preview.md), [account readiness](federation-account-readiness.md), [data operations](federation-account-data-operations.md), [staking activation runbook](staking-activation-runbook.md).

## Release decision procedure

For each applicable gate, record the evidence date, exact commit/environment or provider version, method, result, reviewer and remaining findings. Keep sensitive evidence private and publish only a safe summary. Do not mark an untested condition passed. Recheck affected gates after changes to authentication, wallet permissions, data access, deployment configuration or provider versions.

This checklist is a review requirement; it is not automatically enforced by CI. A green deployment or test suite does not grant release approval. Keep the PR draft and public registration/financial actions disabled until the applicable packet is complete and the exact production release is separately approved. Later wallet ownership linking or financial authorization needs separate consent, replay-resistant proof and a reviewed recent-authentication policy.

Do not advertise “top notch,” audited, guaranteed safe or production-ready security without evidence appropriate to that claim.

Primary configuration guidance: https://supabase.com/docs/guides/deployment/going-into-prod ; https://supabase.com/docs/guides/security/product-security ; https://docs.phantom.com/solana/establishing-a-connection .
