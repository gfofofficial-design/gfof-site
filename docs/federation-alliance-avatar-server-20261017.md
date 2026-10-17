# Alliance image ledger server connection candidate

October 17, 2026. **Disabled, unmounted server source.** No hosted database
connection, credential, role change, route or member image upload is activated.

## Member task and accessibility

An uncertain connection must not make a member repeat an upload or incorrectly
report that an image was saved or deleted. The server must confirm a committed
record before dispatching further work and recover state after interruption.
Images remain optional and text profiles sufficient. Future native forms must
preserve text/current image and explain unknown outcomes with polite status text.
No UI, screen-reader, keyboard or phone acceptance is established by this adapter.

## Connection and transaction contract

The isolated private package `lib/alliance-avatar-server` pins node-postgres
8.23.1 and its lockfile. The main site has no new dependency/import/build step.
Disabled construction imports no driver, opens no pool and performs no query.
Enabled construction creates an empty lazy pool; only an explicit method connects.

Trusted server configuration supplies an exact direct `db.<project-ref>.supabase.co`
host, private password and certificate-only CA bundle. The adapter fixes database
postgres, port 5432 and role alliance_avatar_executor. There is no connection
string, URL parsing, password-store read, browser credential input or caller SSL
override. Certificate validation, hostname checking, TLS1.2 minimum and channel
binding are enabled. Important driver connection settings are explicit rather
than inherited from ambient PG connection defaults. Custom pools are a trusted
test/composition boundary and must never be chosen by request data.

Before every operation, one checked-out client starts a short transaction and
verifies database/session/effective role, TLS, login validity, no superuser/RLS
bypass/role-creation/database-creation/replication/inheritance, no role memberships,
no direct object-table SELECT and no public-schema CREATE. A mismatch destroys
the connection before calling a ledger function. Actual hosted identity, grants,
certificate provenance and credential containment still require separate review.

Each exposed method selects only a fixed private-schema function with typed
parameters: self-state, reserve, claim, commit, cancel, remove, operation receipt,
unpublished settlement, cleanup batch, deletion acknowledgement or expiry batch.
Caller values cannot choose SQL identifiers or statements. JSON values are copied
before yielding, byte-bounded and responses checked for known shapes/consistency.
PostgreSQL void's empty-string representation is normalized only for the two
fixed void-returning methods. A result is returned only after a confirmed COMMIT
on that same client. Network/image work cannot be injected into its transaction.

## Bounds and failure behavior

| Control | Candidate value |
| --- | --- |
| Connections and in-process calls | At most two; a third active call refuses |
| Driver connection/queue wait | 2.5 seconds |
| Per-statement / lock / idle transaction limits | 2 seconds / 750 ms / 3 seconds |
| Independent full method deadline | At most 4.5 seconds |
| Pool idle / lifetime | 1 second / 60 seconds |
| Cleanup/expiry batch | At most 20 |
| JSON argument / response | At most 4 KiB / 64 KiB |
| Shutdown wait | At most 1 second; aborts active calls and refuses new work |

Errors expose only a fixed message and `not_started`, `rejected` or `unknown`
outcome. No raw SQL/driver error, URL or credential is returned/logged. A confirmed
SQL denial before COMMIT is rejected. A lost mutation or COMMIT acknowledgement
is unknown, never a dispatch grant, success or an automatic retry. Late
non-cooperative acquisition/query results cannot start another statement or
COMMIT. Failed/uncertain clients are destroyed instead of returned to the pool;
session disconnect rolls back uncommitted work. Destruction does not prove that
an already dispatched COMMIT failed, so those outcomes still need reconciliation.

The pool's idle-error handler suppresses raw diagnostics; it is not an operational
alert system. Future hosting needs sanitized observability, recovery and service
coverage before activation. A default-closed module is not a running service.

## Verification and fixture privacy

Unit tests cover configuration, parameterization, identity checks, commit order,
JSON copying/result bounds, known rejection, uncertain query/COMMIT, cancellation,
non-cooperative deadlines, late results, bounded queues and shutdown.

A disposable PostgreSQL fixture uses the actual pg driver, certificate-validated
TLS and SCRAM login. It composes actual gateway result shapes with the ledger,
checks immutable claim/commit/deletion replay, fresh-pool recovery, ownership
refusal, real hostname mismatch and direct-table denial. Four provider responses
are in memory; no real Auth/Storage request occurs. The trusted test pool maps the
synthetic reviewed host configuration only to the guarded local fixture. It does
not prove production DNS/IPv6/hosting connectivity or the hosted account state.

Fixture-only TLS keys are generated in guarded temporary directories outside the
repository, never read into chat/files, and removed after testing. Synthetic SQL
roles/data are removed; local server/scratch closure is checked independently.
The fixture's temporary LOGIN/password changes are not hosted setup. Docker CI
uses one exact image/container bound to loopback; its service is discarded after
the test. Stubs are not a substitute for the real-driver checks.

## Remaining integration and release gates

The candidate executor role remains NOLOGIN in unapplied product SQL; no private
password is requested here. Any real hosted login/password/expiry/permission
setup requires a separate exact decision and acceptance. A certificate setting
or unit stub alone does not establish cloud least privilege.

Next implement bounded upload orchestration that waits for committed reservations,
processes once, requires a committed dispatch, preserves known provider evidence,
and reconciles uncertain database outcomes without repeating a write. Compose
the existing real account candidate and current viewer/listing/moderation/member
authorization before exposing any route. Durable cleanup claims, uncertain-write
recovery, metadata retention and account/backup deletion without resurrection
remain incomplete. Native host isolation, abuse/read limits, costs/privacy/support,
Google warning clearance, actual assistive/phone checks and publication review
remain gates. The local encrypted fixture is not a production recovery proof.

Primary guidance checked October17: [node-postgres transactions](https://node-postgres.com/features/transactions),
[TLS](https://node-postgres.com/features/ssl), [pool limits and release](https://node-postgres.com/apis/pool),
[PostgreSQL TLS statistics](https://www.postgresql.org/docs/17/monitoring-stats.html#PG-STAT-SSL-VIEW),
[Supabase changelog](https://supabase.com/changelog). npm registry reported pg8.23.1;
the isolated package audit reported no known vulnerabilities at preparation.
That audit is not a complete security guarantee.
