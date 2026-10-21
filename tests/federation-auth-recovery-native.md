# Disposable account recovery rehearsal

This test runs real self-hosted Auth v2.197.0 and PostgreSQL 17.11 in disposable
CI services. It exercises an older recovery point that contains a synthetic
account subsequently deleted from the source. It does not use either existing
owner project, Google, a hosted Supabase key, a real deletion request or a saved
Auth archive. The current managed timeout discrepancy remains separate.

The runner requires explicit `disposable_recovery_fixture` confirmation and a
local Docker container ID. Before mutation, it checks the exact Postgres image,
version, source database, absent target database, empty Auth schema and absent
fixture roles. It creates only the named synthetic target and its Auth schema.
The child Auth services use only a new internal Docker network, publish no
ports and have no external mail relay or Google configuration. Registration
remains disabled and direct signup rejection is checked on both services.

The sequence requires these observed results:

1. Two synthetic accounts have different exact IDs. The account chosen for
   deletion can obtain a fresh password session, an Auth user read and a
   Federation handler session before deletion.
2. A data-only `pg_dump` of `auth.users` and `auth.identities` is held in memory;
   it is never printed, saved, uploaded or represented as an encrypted backup.
   Sessions and refresh-token rows are excluded. Its hash is only an integrity
   binding for this synthetic planning input.
3. Source session revocation and exact-user administrative deletion leave the
   other synthetic account present. Fresh password login, old Auth user read,
   old refresh and the actual Federation session/refresh handlers must reject
   the deleted account. The application's fetch adapter calls the real owned
   Auth service; it supplies no mocked Auth response.
4. With the target Auth service stopped and its tables independently empty,
   one transaction restores only the two selected tables. Counts must be two
   users/two identities and zero sessions/refresh rows. An exact admin read
   positively confirms that the older recovery point contains the deleted ID.
5. A normalized synthetic external ledger and fresh target inventory must
   produce exactly that deleted user's candidate and linked identity. The
   fixture-only operator deletes that already-asserted candidate. This is not
   a production deletion executor or authority from the planner's output.
6. The retained account and identity stay present; a second inventory/complete
   cutoff produces no removal. The deleted account's fresh/old Auth and
   Federation session/refresh paths are rejected on the target. The retained
   exact ID still works with fresh login and Federation session in both databases.

The services deliberately share a fixture-only JWT secret, so rejection cannot
be explained solely by switching the target signing key. This does not prove
that arbitrary consumers of an already-issued JWT revoke it; they can still
accept its signature until expiry. The Federation handler validates the current
Auth user. A real recovery must separately review target signing keys, provider
configuration and recent-authentication requirements.

Generated passwords, JWT secrets, tokens and synthetic dump data stay in memory
and disposable container configuration. Docker errors suppress raw diagnostics
because restore errors can contain row contents. `finally` removes only owned
Auth containers, disconnects the supplied Postgres fixture and removes the new
network. GitHub disposes its Postgres service/runner. No fixture artifact is
exported. A startup or test failure must not be reported as a pass.

Run only in the dedicated fixture job:

```sh
FEDERATION_RECOVERY_TEST_CONFIRM=disposable_recovery_fixture \
FEDERATION_RECOVERY_TEST_POSTGRES=<matching-disposable-container-id> \
node tests/federation-auth-recovery-native.mjs
```

This is technical synthetic coverage. Real requester verification, explicit
deletion consent, an independently complete and protected ledger, encrypted
archive/off-site custody, vendor retention and a specifically approved hosted
rehearsal remain requirements. No public registration or recovery activation
follows from CI success. See the [metadata planner](../docs/federation-auth-reconciliation-20261011.md)
and [data operations procedure](../docs/federation-account-data-operations.md).

Current primary references: Supabase [user management](https://supabase.com/docs/guides/auth/managing-user-data),
[admin deletion](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)
and [Auth migration](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects).
