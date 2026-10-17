# Private Watchtower server connection — disabled draft

This component prepares two server identities for the already-reviewed intake and worker capabilities. It adds no HTTP endpoint, schedule, environment-variable read, webhook setup or live startup. No hosted login or password is created by importing it.

## Separate credentials and transaction-local capabilities

The unrun `sql/watchtower-server-logins.sql` template creates `watchtower_intake_login` and `watchtower_worker_login` as **NOLOGIN** credential holders, each with a two-connection database limit. They cannot administer roles/databases, replicate, bypass RLS, or inherit table access by default. Each receives only its corresponding capability membership with ADMIN false, INHERIT false and SET true. Duplicate role names stop the transaction before it changes anything. Existing capability roles remain NOLOGIN. The template contains no password, login activation, public-schema grant, membership in a platform role or change to global PUBLIC privileges.

After a separately approved private password step and login activation, a credential can switch only to its assigned capability. `createWatchtowerDatabaseBindings` creates two small pools and returns distinct intake/worker queries. Every operation uses one checked-out connection, BEGIN, SET LOCAL ROLE, bounded statement/lock timeouts, and an actual current_user/session_user/database/membership/role-attribute check before business SQL, followed by COMMIT. No session-level role state is reused across transactions. The exact business statements and their parameter counts are allowed per capability; arbitrary SQL and named prepared queries are rejected. This complements database permissions; application checks do not replace them.

## Transport and secret custody

Use the selected project's shared Supavisor **transaction** pooler on port 6543. Private operator configuration supplies the exact project reference, pooler hostname, reviewed public CA bytes/hash and two different 24+ character passwords. It is not accepted from a browser, webhook or public JSON. Structured `pg` options avoid URI encoding mistakes or URL TLS parameters overriding validation. The driver is pinned to `pg` 8.23.1 in the committed lockfile. Certificate-chain validation, fixed expected hostname and TLS 1.2 or newer are required; the established socket is checked again before SQL. No `sslmode=require`, certificate bypass or administrator fallback is supported.

The database hostname and role suffix bind to the private selected project configuration. A valid public pooler certificate alone does not identify the tenant; the approved tenant reference and verified database-role configuration are also required. Wrong/unknown project, CA or role state stops setup. The provider pooler, selected project, real role grants and real certificate chain still require hosted acceptance.

Passwords belong in the owner's password manager and approved server-secret storage, never public files, Git, chat or process command lines. Do not save raw client errors; the adapter returns a fixed failure message. No administrator credential belongs in the routine server pools. Installing this draft does not install secrets. Existing account sign-in, member data and public Data API access stay separate.

## Deadlines and uncertain completion

Each database operation has a four-second total deadline, including connection acquisition, and at most a two-second driver connection attempt. Abort destroys that checked-out connection; a late acquired client is also destroyed without running SQL. Intake, verification allowance and worker cancellation signals reach this adapter. No automatic query retry occurs. A database error, cancellation or failed COMMIT acknowledgment can leave completion uncertain: inspect the durable receipt/counter before retrying. Candidate idempotency and lease-version checks remain essential. This is not an exactly-once-delivery claim.

Each process has at most one connection per role; the role's two-connection limit is a database backend limit, not a total Supavisor client or hosting spend cap. PUBLIC privileges still apply to every role. Review them, ownership, bidirectional memberships and all connectable-database access before enabling these credentials; never silently revoke shared Supabase defaults to fix this draft.

## Verification and activation boundary

Offline cases reject shared/short passwords, changed CA, wrong TLS/hostname, administrator or mismatched identities, extra memberships, cross-role statements, and late writes after cancellation. The isolated PostgreSQL job applies the password-free template, checks both directions of access, and uses fake passwords and a self-signed fixture certificate for the actual pinned driver. Its network driver is forced to loopback, with no hosted project or provider access. Fixture TLS/role success is not acceptance of the real Supabase pooler.

Before hosted setup, obtain the concrete access-change approval, verify current empty/private schema and recovery coverage, apply the recorded preparation once, assign unique private passwords, activate only the two reviewed logins, and verify the actual pooler/TLS/session identities and denied operations. Keep the runtime disabled and the credentials outside deployment until those checks pass. Then separately review server-secret placement, ingress/worker deployment, upstream credit/spending/pause evidence and a finite four-account pilot. No alert destination is selected.

No user interface was changed. Private password entry must support paste/password managers, hidden input and one clearly named credential at a time; return a short status instead of exposing diagnostics. Future public status views need dates, unknown versus zero, keyboard-readable controls and text equivalents. Automated backend tests do not establish accessibility conformance.

Primary references, checked October 13, 2026: [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [PostgreSQL role membership](https://www.postgresql.org/docs/17/role-membership.html), [SET ROLE](https://www.postgresql.org/docs/17/sql-set-role.html), [node-postgres TLS](https://node-postgres.com/features/ssl).
