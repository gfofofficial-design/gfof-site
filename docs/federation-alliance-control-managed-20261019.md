# Explicit managed-provider control profile

Source candidate, October19,2026. No hosted install, project, privilege, login,
key, root, route, deployment configuration or signup is enabled. The existing
strict profile remains the default and its transaction order is unchanged.

The control reader previously required zero memberships. A managed PostgreSQL
creator retains bootstrap-granted ADMIN-only memberships even after its temporary
installer SET grant is removed. Buying another ordinary project does not resolve
that mismatch. This explicit `supabase-managed` profile models one fixed provider
baseline; it never learns permissions from a target or silently selects a profile.

## Offline installer and fixed runtime checks

`managedControlInstallSql()` prepares one UNAPPLIED transaction using the unchanged
control-policy and live-anchor semantic SQL. It requires an empty dedicated target,
the nonsuperuser postgres creator, PG17/18 and the fixed Auth/Storage relations.
It adds an installer-only owner SET grant, performs schema operations as the owner,
installs both extensions, removes exactly its own grant and checks the final
managed environment with all four roles locked. Any refusal rolls back the entire
installation. It sets no password and performs no bootstrap or serve transition.

The explicit profile requires exactly the four control roles and exactly four
creator edges, each from bootstrap `supabase_admin` to `postgres` with ADMIN=true,
INHERIT=false and SET=false. It verifies bootstrap OID10/superuser, Auth/Storage
ownership, nonprivileged NOINHERIT role attributes and a NOLOGIN owner. Those
administrator powers remain trusted; this does not resist provider/admin compromise.

All four roles must lack Auth/Storage schema, relation, column and sequence rights.
No schema USAGE also prevents access to functions within those private namespaces;
the profile does not claim every raw function EXECUTE ACL is false. Public
application relations/functions and mixed Alliance domains refuse. A fixed matrix
checks the reader/operator/anchor-writer's private schema, direct table/column
denials and exact policy/anchor/bootstrap/transition entrypoint permissions.
Calling the old startup-only transition directly is forbidden. Catalogue OID
lookups avoid granting the installer extra private-schema access just to verify
the final state. Missing objects refuse rather than being accepted through NULL.

The managed check runs inside the transaction before the application function,
then in a fresh autocommit snapshot after COMMIT before returning evidence. Read
drift withholds the result; a dispatched write followed by drift is **unknown**,
not a failed-and-safe-to-repeat write. The connection is destroyed, with no retry.
Persistent grant changes are caught; an administrator changing and restoring state
between samples is not excluded. The original deadline, pool limits, TLS/hostname
certificate validation and channel binding remain required.

## Verification and limits

Unit checks cover explicit profile/default closure, unchanged strict order,
pre-dispatch/post-commit refusal for reads and writes, generic unknown results and
unchanged SQL function bodies. The actual disposable native test uses the managed
nonsuperuser shape, protected TLS sessions, both reader and anchor writer, final
installer rollback, direct Auth/Storage/table/SET ROLE denials, fourteen catalogue
drifts with exact repairs and a real committed write whose postflight fails.
Independent readback proves that one committed effect despite withheld evidence.
Synthetic logins and the exact isolated cluster are removed afterward.

This is a partial provider model, not hosted acceptance. It does not fully audit
every system schema, extension, default ACL, function body or managed API. PUBLIC
CONNECT/TEMPORARY and cross-database rights require separate real-target inventory
and an explicit policy before any restricted hosted login. It does not establish
DDL/fleet/restore exclusion, independent authority, current receipt custody,
recovery, privacy/erasure, production scale or safe public joining. The managed
profile is not mounted in a live entrypoint and no new project is purchased here.

No interface changes. Unavailable/unknown/closed outcomes remain distinct plain
states for future accessible integration; operator errors must not require users
to race a countdown or transcribe fingerprints. No assistive-technology or WCAG
conformance claim follows from database tests.

Next: exact hosted-domain/cost/role decisions, independent control/journal key
custody and first-checkpoint/receipt review, finite deployment/IAM/ingress trials,
coordinated recovery, Google, real assistive checks and publication acceptance.
The local caller key is separate from the control verification key.

Primary references: [PostgreSQL role creation](https://www.postgresql.org/docs/17/sql-createrole.html),
[membership options](https://www.postgresql.org/docs/17/sql-grant.html) and
[Supabase managed roles](https://supabase.com/docs/guides/database/postgres/roles).
