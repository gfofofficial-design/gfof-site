# Closed managed member candidate

This is an unapplied installation/profile for the existing Federation Account
Pilot. It creates no project, runtime password, login, key, serving transition,
member record or mounted function. Publication and account signup remain separate.

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
