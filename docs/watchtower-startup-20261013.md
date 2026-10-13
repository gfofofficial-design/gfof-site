# Pilot startup composition — no live delivery

The private server factory assembles the already-tested header intake, receipt sink, production-scoped allowance, fixed Helius transport, candidate verifier and single-candidate worker around the approved four-address manifest. It defaults disabled. A key or SQL callback alone cannot assemble an enabled pilot.

Operator startup declarations require zero additional provider spending, checked credit headroom, disabled automatic purchases, reviewed upstream pause controls, approved/ready storage migration, approved actual limits and reviewed mainnet transport. These are recorded private operator prerequisites, not authenticated billing/storage evidence. Never read them from an HTTP request, client form or public-user claims. They do not independently prove provider spending controls or a successful migration. Real evidence must be obtained and reviewed before declaring them true.

The approved proposed limits can be used only after the operator records limitsApproved. The runtime adds no route, environment lookup, key creation, database provisioning, schedule, provider account mutation or notification. Tests use synthetic keys, local Response fixtures and mock storage only. The integrated fixture connects received candidates to reservation-before-read and evidence/completion; the separate PostgreSQL fixture proves storage concurrency/recovery.

Actual delivery still requires an owner-selected live database with reviewed grants/TLS/retention and migration, secure server-side configuration, an authenticated ingress URL, a bounded worker trigger, an upstream webhook/stream setup within confirmed account capacity, pause/recovery/backfill procedures and separately reviewed live acceptance. The provider account's Usage page holds autoscaling controls according to current Helius documentation. Free plan/available credits do not alone prove account-specific billing settings. Do not upload API keys or full provider account responses into the public repository.

No email/Telegram destination was selected. Observation means saved candidate corroboration, not a public financial verdict or automatic message. Keep financial/control/lock-change interpretation gated on independently reviewed historical/program-specific evidence.

Source: [Helius additional credits and Usage controls](https://www.helius.dev/docs/billing/additional-credits), reviewed October 13, 2026.

## Supabase storage preparation

The selected platform is Supabase. Storage uses watchtower_private, separate from public member tables. Both internal tables have enabled and forced RLS with no policies, and schema/table/function privileges are revoked from PUBLIC and the platform anon, authenticated and service_role roles. Functions remain SECURITY INVOKER. Existing auth configuration and public tables are not altered. The isolated fixture creates analogous platform roles and verifies denied table/function access in addition to concurrency/recovery tests.

This preparation grants no runtime access. A separately reviewed least-privilege server connection and necessary RLS policies must be configured before startup can truthfully declare storageReady. Never use the database administrator credential as the routine intake/worker identity. Do not expose the private schema in the Data API or add it to a public realtime publication. Project identifiers, credentials and account usage evidence are not published in this review.

The existing generic review migration is amended in place because it was not previously applied. Deployment must apply this exact reviewed migration once to an empty private schema, record the migration in Supabase history, and verify catalog privileges and security advisors. No production data or provider events are needed to validate private access controls.

## Restricted runtime identities

The runtime-access SQL template creates separate NOLOGIN/NOBYPASSRLS intake and worker roles, without any login credential or membership. Intake can insert approved-scope receipt identity columns and reconcile duplicates; its row-lock permission is limited to the signature column, whose changes an invoker trigger forbids. Intake cannot change verification state, claim work, spend allowance or delete records. Worker can claim/update verification columns and production-scoped allowance, but cannot enqueue candidates, alter receipt identity or delete records. No SECURITY DEFINER function is introduced. Platform member/service roles remain denied.

The runtime factory requires distinct intakeQuery and workerQuery callbacks. Deployers must bind each callback to the corresponding database role and verify current_user plus actual denied operations before activating the endpoint. Distinct JavaScript functions alone do not prove separate database identities. Password-bearing login creation, pooler/TLS configuration, memberships and server-secret installation remain separate deployment steps. The role template is applied through recorded migration tooling; it is not a generated Supabase CLI migration file. Its database acceptance checks include role capabilities, approved-scope receipt success, duplicate reconciliation, immutable identity, worker claims and denied cross-role access.
