# Watchtower owner/operator readiness — October 14, 2026

The October 13 dev-session draft added closed intake and one-candidate worker routes, role-bound pg/TLS connections, a reviewed source fingerprint, locked credential-role preparation and a 100-distinct-candidate pilot ceiling. The draft is not a continuous-monitoring or public-release claim. The production state referenced here belongs to that dated check; see the October 16 synchronization note below for the later released site.

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

## Approved initial-trial retention — October 14, 2026

The owner approved this policy on October 14, 2026 at 10:26:18 UTC. For the initial finite trial, retain candidate receipts and their projected RPC corroboration for seven days after the recorded activation window ends, solely for verification and failure investigation. Do not automatically delete, archive or reset anything as part of this policy. After that period, present an exact owner-reviewed cleanup set; unresolved or leased candidates must be investigated before any deletion. Keep the trial's sanitized acceptance record and preserve the daily/monthly allowance counters through their periods. Future continuous-monitoring retention requires its own design. This approval establishes the retention period; it does not authorize deletion or alter existing data.

## Work-computer credential placement

The reviewed source expects private settings scoped to Functions and the exact review branch. The currently exposed Netlify connector can select a branch context but cannot name the exact branch for a value; it also cannot change an existing variable's secret flag/scopes through upsert. Do not compensate by placing credentials in production, all contexts, or every branch deployment. Use the owner's signed-in Netlify UI, or the already prepared private dev workflow, to inspect the key metadata and select the exact branch `review/watchtower-event-boundary-20261013` before installing any value. No unrelated environment variables need to be exported.

Keep `WATCHTOWER_PILOT_ENABLED` closed during setup. Database passwords, intake/worker headers and the reviewed provider key belong in secret-marked server storage, never this document, screenshots or chat. Do not replace existing values without checking their purpose and custody. The public tenant/pooler configuration and the private activation record remain bound to the reviewed target. The activation record's absolute start/end window is selected when an operator is ready to observe the test, not hours beforehand. Installing settings alone does not activate roles, update old deployments, prove TLS or stop upstream billing.

## Prepared trial shutdown action

The owner/operator SQL `sql/watchtower-relock.sql` atomically sets only the two dedicated Watchtower credential roles to NOLOGIN, then reports their locked state and visible server-session count. It contains no password, reset, role membership, broad privilege change, candidate deletion or allowance reset. It is a prepared action for closing the authorized trial; it has not been executed against hosted storage by this source update.

Pause and verify the exact upstream trial webhook first. Keep the pilot setting closed and respect the old deployment's absolute expiry. Run relock through the reviewed operator channel, then inspect any remaining visible sessions; NOLOGIN alone does not cancel established database or pooler sessions. Session termination, if needed, requires a reviewed exact target and must not affect member/Auth sessions. A zero server-session count is not proof that every pooler client has disconnected or that provider billing has stopped. Verify exact deployment cleanup and provider state independently.

The disposable PostgreSQL fixture runs the relock action after its synthetic enabled-credential checks, verifies both credentials become locked with no visible sessions, and verifies a repeated relock remains safe. No hosted credentials or real provider calls are used. Keep the seven-day evidence retention and period-bound allowance counters intact during shutdown.

The work-computer owner reports installing the closed pilot toggle, selected project/pooler settings and a secret-marked provider key on the review branch. These setup reports do not establish runtime secret placement or hosted TLS acceptance. The existence and assignment of the two dedicated database passwords remains unconfirmed; inspect the private dev setup before creating or replacing them.

## October 16 released-site synchronization

The draft now includes released production `92f532e3fd788dc76a48afdcbff713560caf3341`: Alliance, the prelaunch Community League and the expanded manual Operations Assistant. Twenty-seven incoming production paths were compared with exact shared ancestor `7cd97e7106a69fa6c91105c3f4ffd20ee75389d9`. The sole overlapping edit was the automation workflow; its merged form retains the Watchtower driver installation, source-fingerprint check and existing tests while adding the released tool-page trigger/test. All other incoming paths use their exact production Git blobs.

No Watchtower runtime, pinned source input, dependency lock, four-address manifest, SQL, role boundary or activation contract changes in this synchronization. The reviewed fingerprint is retained without regeneration. The manifest remains disabled, notifications off, additional provider spend zero and upgrades disallowed. Netlify routing takes the exact released production version; it does not introduce Watchtower activation settings.

This is preparation within draft PR #112, with no production merge requested. It does not establish current hosted credentials, roles, TLS, provider headroom, upstream webhook state or trial acceptance. No hosted schema/role change, provider/RPC call, secret installation, notification or schedule is performed. Owner-reported private setup from October 14 remains dated evidence; missing database-password assignment must be resolved through the existing private dev workflow before any controlled trial, without guessing or replacing credentials.

The seven-day initial-trial retention decision still applies; no cleanup or allowance-counter reset is performed. The next dev-computer steps remain private credential-role pairing and TLS/denial checks, then a separately reviewed source-bound trial window and shutdown. Real account acceptance and public registration remain separately gated; League enrollment is still closed.

Validation for the synchronized revision is recorded on PR #112 after its exact-head CI and disabled-preview checks complete. Passing offline/isolated checks and HTTP refusal are not proof of an enabled monitoring run or coverage of on-chain events.
