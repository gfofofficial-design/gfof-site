# Alliance explicit managed account-store profile candidate

October 18, 2026. Source and disposable PostgreSQL evidence only. No hosted
installation, new project, role, password, key, signup, public route or purchase.

## Separate opt-in; strict remains unchanged

The history and acknowledgement factories accept `deploymentProfile` with values
`strict` (default) and `supabase-managed`. Unknown values refuse. The default SQL,
absence-of-Auth guard and zero-membership contract remain unchanged. Both paths
still default off and require three distinct project references, exact fixed host,
certificate validation, TLS/channel binding, narrow runtime identity and rights,
bounded pools/deadlines, verified COMMIT and pre/post installed-contract checks.

This addresses two concrete obstacles: ordinary managed projects contain an Auth
schema, and PostgreSQL's nonsuperuser role creator retains bootstrap-granted
ADMIN-only management edges. It does not infer that every Supabase project fits
the new profile or that a managed schema is an Alliance account service.

## Fixed managed contract

The explicit profile verifies a fixed additional catalogue object in the same
snapshot as the existing function/table/role contract, before dispatch and in a
fresh autocommit snapshot after COMMIT:

- Bootstrap role `supabase_admin` is OID10 and superuser. Both `auth` and `storage`
  schemas are owned by it. These are fixed source expectations, checked against
  read-only metadata of the existing journal project; no live allowlist is learned.
- All four account roles retain their nonprivileged, NOINHERIT attributes; the
  owner remains NOLOGIN. Exactly four membership edges exist in either direction:
  each account role to `postgres`, granted by `supabase_admin`, ADMIN true,
  INHERIT false and SET false. Missing/extra/reordered/foreign grantor, outgoing
  edges or changed flags refuse. Runtime cannot SET or inherit another role.
- Account roles have no Auth/Storage schema USAGE/CREATE or table, column or
  sequence privileges. Indexes are excluded from relation privilege checks;
  sequences use sequence-specific predicates. `public` contains no application
  tables/views/sequences or functions. Other Alliance domains remain forbidden.
- Canonical function bodies, signatures, ownership, execution settings and grants
  remain identical to the strict manifest. Existing table/RLS/trigger/private
  rights and schema ACL requirements remain. Provider shape excuses no drift.

The nine-row membership envelope detects excess edges without unbounded output;
the full catalogue envelope stays bounded to32KiB. Persistent mismatch before
dispatch refuses; mismatch after a committed write returns unknown and destroys
the client. It does not undo a commit or cause an automatic retry.

ADMIN is a powerful management privilege even with SET/INHERIT false: the provider
and existing administrator remain trusted and can regrant access or change the
database. This candidate does not establish protection from them or independent
custody. It adds no actual hosted exception without separate approval.

## Offline installer agreement

`managedAccountInstallSql('history'|'ack')` prepares SQL only. It never connects,
fetches credentials or executes. It is separate from runtime imports and does not
create migration history. The original three SQL candidates remain unchanged.

Output is one explicit BEGIN/COMMIT transaction for a separate nonsuperuser
`postgres` installer on PG17/18. It refuses a pre-existing account schema, missing
managed Auth/Storage tables, existing users/identities/objects/buckets, or other
Alliance domains/public objects. It creates four locked, password-free roles and
the original source functions/tables, with unconfigured disabled controls.

One temporary postgres-granted SET membership allows ownership changes and private
relation resolution. Common and domain installation work assume the owner before
accessing the private schema. Before COMMIT the installer removes exactly its own
grant, checks the four automatic provider edges and the managed baseline, and
verifies all roles remain locked/nonprivileged. Final failure rolls back roles,
objects and temporary access together. No password/login/mode is enabled.

Runtime does not read Auth records or provider signup settings. The installer
requires empty Auth/Storage data at that moment; runtime verifies denied rights,
not a continuously empty Auth service. Provider signup must remain closed and be
independently verified in a future approved dedicated-project trial. Local Auth
identities in these domains never authorize Alliance membership; the member
project remains a different pinned scope. Provider functions behind inaccessible
managed schemas are not treated as authorized account operations.

## Actual local tests and limits

The confirmed disposable driver renames its bootstrap role to `supabase_admin`
and creates a distinct nonsuperuser postgres. This exercises actual PG creator
grant behavior, not fictional membership data. Managed namespaces and empty
representative Auth/Storage tables, an identity sequence and index are synthetic;
this is not Supabase's complete platform/extension image.

Both domains test occupied-Auth refusal, transactional late-failure rollback,
four locked/password-free roles, temporary SET cleanup and runtime catalogue
verification over real TLS/SCRAM connections. Strict mode refuses the same shape.
Real append and separate acknowledgement commits pass. Changed role edges,
managed schema/table/column/sequence rights, public objects and schema ownership
refuse. Post-COMMIT grant drift returns unknown; independent readback verifies the
acknowledgement without retrying. Unit checks pin generated function-body hashes
and distinguish pre-dispatch refusal from post-COMMIT uncertainty.

Still unproved: full managed-host installation/lifecycle, platform default
privileges/extensions, cross-database rights, all table columns/defaults/generated
expressions/constraints/policies, privileged-DDL/ABA and fleet fences, current
outside receipt custody, signing keys, coordinated Auth/Storage recovery,
privacy/retention/capacity and HTTP/user-interface release acceptance. The minimal
catalogue check is not a complete audit of a hosted project.

## Next release work and accessibility

The shared [account-table layout guard](federation-alliance-account-layout-20261018.md)
now covers the specified private column/default/constraint/index/policy and default
ACL inventory in both profiles. This narrows the private-table gap; it does not
establish a complete provider baseline or hosted compatibility.

Finish exhaustive private-schema acceptance and a realistic managed-provider
baseline rehearsal before proposing a billable project or hosted access. Choose
and test the independent current-receipt backend, then database/old-fleet/restore
barriers and per-operation account/session/policy/content checks. Source results
do not open registration or authorize a public launch.

No interface changed. Future pending/unavailable states must remain plain text,
keyboard and screen-reader accessible without timed secret/fingerprint entry.
Keep owner-only setup minimal and password-manager compatible. No WCAG
conformance, completed erasure or end-user authorization is established here.

References: [PostgreSQL CREATE ROLE](https://www.postgresql.org/docs/17/sql-createrole.html),
[GRANT and grantors](https://www.postgresql.org/docs/17/sql-grant.html), and
[Supabase managed roles](https://supabase.com/docs/guides/database/postgres/roles).
