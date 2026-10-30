# Closed managed member candidate

This is the fixed installation/profile candidate for the existing Federation
Account Pilot. An explicitly approved disabled installation is recorded separately;
the original "unapplied" preparation status does not describe every later deployment.
The installer creates no project, runtime password, enabled login, key, serving
transition, member record or mounted function. Publication and account signup
remain separate. This source is not authority to repeat an installation.

## Managed Auth boundary

The hosted postgres installer can read the necessary Auth columns but cannot grant
custom roles Auth-schema usage. Do not change the managed schema's owner or join a
platform role. Supabase documents a narrow private-schema SECURITY DEFINER as the
supported alternative:
[custom-role Auth permissions](https://supabase.com/kb/troubleshooting/permission-errors-when-granting-custom-roles-access-to-the-auth-schema).

`managedMemberInstallSql()` composes fourteen fixed candidates in one transaction.
Its private `alliance_auth_gate.require_current_session` is owned by the existing
postgres installer, has an empty search path and returns only void/refusal. It
checks the exact account/session relation, confirmation, anonymity, deletion, ban
and session expiry. Both ordinary and removal guards delegate to that predicate.
Only the locked member owner can execute it; executor/browser roles cannot call
it or read Auth tables. The provider's Auth ACLs remain unchanged.

The installer refuses existing target names, preserves existing Auth user/identity
counts and leaves all four member control flags false. Two locked, password-free
roles retain only the two provider-created administrator management edges. Temporary
SET and trigger-installation privileges are revoked before commit. Final verification
failure rolls the transaction back, including new roles and schemas.

## Protected text paths

Legacy authenticated Data API table/RPC grants are removed from the newly created
member objects. Directory reads use the restricted server's session-bound
`directory_session` with an ascending UUID cursor, one extra row for pagination,
limit 1–20, and only listed/non-held public fields. The HTTP composition applies
current serving and independent journal checks before releasing those records.
Unlisting and a tombstone against restored text are covered in the composed check.

`createAvatarLedger({deploymentProfile:'supabase-managed', ...})` explicitly selects
the fixed provider profile. The default strict profile is unchanged. Managed identity
checks run before dispatch and after COMMIT: exact bootstrap edges, nonprivileged
roles, fixed private verifier body/owner/search path, denied Auth access and denied
legacy browser/table/column/RPC access. Drift withholds the result; a dispatched
mutation remains unknown. No live permission baseline is learned or relaxed.
These checks cannot defeat a trusted administrator who changes and restores state
between observations, or supply independent protection against provider compromise.

## Independent inspection and evidence

`managedMemberClosedInspectionSql()` validates the managed boundary, briefly grants
the existing installer SET access, checks the complete empty inventory and four
closed flags, then rolls the entire inspection back. An error also rolls back;
a fresh catalogue query must verify no SET edge survives. It adds no enduring
inspection function or privilege. Hosted application/inspection requires its own
reviewed owner decision. Do not apply source opportunistically after a failure.

Actual disposable PostgreSQL 18.6 rehearsals cover complete install rollback,
closed-row inspection and failed-inspection rollback, private verifier denials,
TLS create/edit/conflict/unlist/removal preparation, directory paging/visibility,
table/column/RPC and role drift, revoked/expired/ineligible sessions, and cleanup.
The fixture has synthetic data, an in-memory test password and a temporary TLS
certificate. It is not a managed provider or real sign-in acceptance. The separate
exact-head PostgreSQL 17.11 CI result is recorded internally after completion.

Existing accessible controls and error/uncertainty states are reused; no new
gesture, countdown or secret transcription task is introduced. This server work
does not establish screen-reader/device acceptance or WCAG conformance. Real
runtime custody/connections, journal extensions, authority/recovery/privacy,
durable community features, mail/Google and publication remain release work.

## Existing administrator and temporary grants

An administrator that already inherits `pg_read_all_data` has implicit schema
USAGE even without an ACL grant. This is standard
[PostgreSQL predefined-role behavior](https://www.postgresql.org/docs/17/predefined-roles.html).
Absence of effective administrator USAGE is therefore an incorrect proxy for
removing the installer's temporary schema grant.

The revised closed installer/inspector requires the expected private schema owner,
no direct PUBLIC/postgres schema grant, no administrator CREATE right, no direct
PUBLIC/postgres callback EXECUTE grant, and no surviving owner SET edge. Effective
administrator USAGE is accepted only when the existing `pg_read_all_data` path
explains it. No membership in that built-in role is granted by the installer.
All fifteen application-boundary predicates and runtime checks remain unchanged.

Native fixtures reproduce the exact original installer hash's final refusal using
the inherited read-all role. The revised installer passes under that same model;
deliberately retained schema/callback grants still cause rollback. Granting read-all
to either new application role is also refused. This distinguishes cleanup of our
temporary ACLs from the existing administrator's broader authority. The design does
not isolate member data from the trusted administrator or provider; their existing
ability to read/manage data must remain explicit in deployment review.

## Unapplied rollback-only diagnostic

`managedMemberDiagnosticSql()` is an offline proposal for isolating a managed
compatibility refusal. It reuses the exact installation prefix with every login
and mode closed. The final block reports fifteen fixed boundary predicates, four
cleanup/count booleans, the proposed roles' creator edges and the verifier's
owner/type/search-path metadata plus a SHA-256 of its fixed SQL body. It never reports
account rows, tokens, passwords or credential hashes. An unconditional exception
aborts the entire transaction even when every predicate passes; there is no success
or COMMIT path. It is not an alternate installer or authority to retry a failed
hosted installation.

Native fixtures now model the provider's observed public table/function default
grants. They verify that the diagnostic always removes its new objects, that an
injected API grant isolates the corresponding false predicate, and that normal
installation/session/visibility checks still pass. This does not identify a real
provider refusal's cause or authorize changing its grants. Hosted use requires a
separate bounded decision and independent absent-object readback after the expected
diagnostic refusal; missing details or rollback uncertainty stop the attempt.
