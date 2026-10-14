# Watchtower owner/operator readiness — October 14, 2026

The October 13 dev-session draft added closed intake and one-candidate worker routes, role-bound pg/TLS connections, a reviewed source fingerprint, locked credential-role preparation and a 100-distinct-candidate pilot ceiling. The draft is not a continuous-monitoring or public-release claim. The main site is still on its prior released commit.

The current-head CI for that dev-session revision passed offline and isolated PostgreSQL acceptance. The recorded dev-session evidence also describes private-schema export/restore and disabled branch-route checks; those records are separate from the fresh catalog check below and do not prove an enabled hosted provider delivery or recovery of future receipt data.

## Fresh read-only check

`sql/watchtower-readiness.sql` is an authorized operator SELECT for the already-prepared private schema. It returns aggregate candidate-state counts and checks for four locked restricted roles, exact credential-capability memberships, forced RLS, platform-role denial, installed identity/bound triggers, separate intake/worker privileges, no definer functions and no realtime publication. It returns no credentials, provider payload, candidate identity or member data. Do not expose this query as a public RPC or public status route.

The October 14 hosted check returned `storage_prepared_credentials_locked`, every listed check true, zero candidate/allowance rows and `activationProven: false`. This means prepared storage with locked credentials. Empty storage does not prove zero on-chain activity or complete coverage. Catalog trigger presence does not prove exact function source; compare independently with the reviewed bound before activation. The query does not accept the real pooler/TLS credentials, deployment, provider delivery, billing, retention or recovery gates.

The isolated PostgreSQL fixture runs this report before its synthetic login activation and verifies the expected closed state. It then changes one disposable credential role to LOGIN and verifies the report changes to `review_required`, before relocking it. That change occurs only in the disposable CI service, not the hosted project.

## Remaining finite-pilot steps

1. Review recovery coverage and select the pilot receipt-retention period. The current tables are empty; no cleanup is performed here. Preserve RPC allowance counters through their billing periods, and do not reset counters as receipt cleanup.
2. Place unique database passwords and separate intake/worker headers through private server-secret handling. Verify the real pooler certificate, project, both session identities, restricted role switching and denied operations. No administrator fallback.
3. Review the exact branch deployment, source fingerprint, site and UTC start/end window of at most ten minutes. Record only prerequisites actually evidenced; an operator declaration is not proof.
4. Review dated provider headroom, billing and webhook creation/delivery charges, plus upstream pause and propagation behavior. Four accounts remain the approved scope. The 100-row ceiling and expiry do not stop upstream charges or establish zero hosting cost.
5. Perform a separately reviewed enabled test with a defined upstream webhook and one manual worker invocation. Interpret saved results only as candidate corroboration, not a transfer, lock-effect or safety verdict. Timeout acknowledgment can be uncertain; inspect durable state before retrying.
6. Pause and verify the exact upstream webhook, relock the two credential roles, close/remove private activation settings and clean up exact trial deployments as authorized. Do not assume changing environment settings changes old deploys. Re-run the read-only report and retain dated acceptance evidence.

No schedule, public signup, notification, provider call, secret installation, login activation, deletion or production merge is added by this readiness update. Existing account/member configuration remains separate. Project identifiers and private account evidence are not exported in this document.
