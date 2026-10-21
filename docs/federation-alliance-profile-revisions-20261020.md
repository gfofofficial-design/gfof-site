# Self-service profile edits: revision protocol candidate

Status: unapplied, default-off database protocol, verified only in a disposable
PostgreSQL/TLS fixture. This is not the member API, a migration for an existing
member store, a hosted installation, or release approval.

## Problem and intended member behavior

The existing candidate leaves both confirmed and uncertain saves under an
owner-only review fence. That preserves uncertainty but blocks every second
ordinary edit. Do not grant the owner review function to the runtime or infer
delivery from a later profile read. Its closed review procedure remains intact.

The alternative uses optimistic concurrency: a member edits a particular
revision, and the database accepts that edit only if it is still current. An
operation UUID identifies that one submitted edit. Revision numbers are for
profile text/listing changes; they are distinct from avatar/removal versions.

| Situation | Database result | Required future member behavior |
| --- | --- | --- |
| Create with revision 0 | Profile and receipt commit together as revision 1 | Show Saved only after the guarded API confirms success. |
| Edit current revision | One new revision | Keep ordinary Save, Edit and Unlist controls; no operator review. |
| Exact most recent operation requested again | Same saved result and timestamp, marked replayed | This is result recovery, not proof that the original HTTP response arrived. No automatic resubmission. |
| Older revision or changed reuse of the latest operation ID | Conflict, no profile change | Keep the member's draft and offer an explicit current-profile comparison. Never silently overwrite or merge. |
| Cancellation, lost acknowledgement or unavailable status | Unknown to the caller | Preserve the draft and operation identity. Do not say failed, saved or rolled back; offer an explicit status/read step. |
| Old owner-review hold, changed stored state or revoked session | Refused | Keep the existing reconciliation/security boundary. No forced-clear button. |

A later read need not prove an earlier request stopped: any late save still
carries its original expected revision. It cannot overwrite a newer committed
revision. The member must explicitly review the current state before submitting
another intention. A safe UI must not turn background polling or page reload into
automatic consent to retry.

## Implemented database boundary

`sql/alliance-profile-revision-candidate.sql` extends only an empty disabled
creation store. It defaults `profile_revision_enabled` to false. When selected
in the synthetic fixture, old revisionless saves refuse. Existing held legacy
writes are not converted, even if an owner has cleared their pending marker.

The private definer function keeps the existing live account/session checks,
creation/removal control lock, immutable owner binding and creation-event check.
It locks the profile's preparation row, checks the expected revision, and commits
profile fields, operation ID, input/result hashes and the last exact result in
one transaction. Remote admission must occur before this call, outside the SQL
transaction. The database does not independently verify a remote admission.

The executor receives only the new narrow function, retaining its existing
session/preparation abilities. Public, anonymous, authenticated and service roles
receive no new access. No direct table access, owner-review permission, password,
login, route, automatic job or provider integration is added. Last-result storage
is bounded to one receipt per profile; older operations are rejected using their
stale revision rather than retained as an unbounded profile-content history.

The last saved result is checked against current stored fields and their exact
digest before replay or another edit. An out-of-protocol moderation/change is a
reconciliation case, not permission to replace the expected receipt silently.
Removal/session checks still run before an exact replay.

## Remaining integration before adoption

1. Extend the restricted driver and creation coordinator with exact revision
   request/result contracts. Keep independent journal admission and serving
   checks, including suppression after a concurrent recorded removal.
2. Provide a guarded atomic own-profile + revision read. Do not obtain a profile
   and revision in unrelated reads and describe them as one coherent version.
   Bind operation recovery to the verified current account/session; no profile
   IDs, operator receipts or arbitrary SQL from the browser.
3. Wire explicit Save/conflict/unknown/status behavior into the member client and
   page. Keep drafts on conflict, use text and accessible status announcements,
   preserve keyboard focus and avoid timing-dependent interactions. No extra
   password, CAPTCHA or owner approval for ordinary editing. The existing
   unmounted API/client intentionally still use the older fence.
4. Extend paired recovery inventories, archive schema and startup verification
   to cover the new control flag and receipt columns. Verify that a restored
   older revision cannot pass current checkpoint checks. No existing installer
   includes this candidate and no existing profile hold is cleared by it.
5. Compose the native member journey: verified session → create → second edit →
   unlist → independent journal-first removal, including late/conflicting saves
   and refresh after an unknown result. Avatar and removal versions stay separate.

This continues the full member release; it does not cut images, invitations,
contributions, ideas, blocking/reporting or portal records from its scope.

## Observed acceptance and limits

`profile-revision.native.mjs` runs through the guarded native runner, with an
optional `--profile-revision-only` selector that retains its target identity/TLS
and disposable confirmation gates. The regular PostgreSQL 17.11 CI job includes
it after the existing native sequence. Local acceptance uses PostgreSQL 18.6;
that is separate evidence, not a claim that local testing used 17.11.

Actual restricted TLS connections exercised create/edit/unlist, exact replay,
changed reuse, stale and concurrent editors, rollback, a discarded committed
reply, legacy fencing, forgery/direct-access denials, state changes, revoked
sessions and removed-profile replay. The admission event and Auth table are
synthetic here; no real Google login, remote journal admission, browser workflow,
managed provider behavior, full restore or accessibility conformance is proved.

## Documentation checked

- PostgreSQL 17 [transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html)
  and [explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html)
  inform the revision comparison/row-lock transaction. This is our protocol,
  not a PostgreSQL promise about HTTP delivery.
- Supabase [RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
  supports retaining explicit ownership/grants. The
  [changelog](https://supabase.com/changelog) was checked October 20; the October
  12 HTTP TLS cipher announcement does not change this SQL protocol or establish
  project-health clearance.
