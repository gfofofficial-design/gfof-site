# Self-service profile edits: revision protocol candidate

Status: unapplied, default-off database/server/client-transport candidate,
verified in disposable PostgreSQL/TLS fixtures. The factories explicitly opt
into revision mode; their defaults retain the legacy fence. No form or route is
mounted, no hosted installer includes it, and this is not release approval or a
migration for an existing member store.

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

The result contains profile text, so a deletion trigger clears that copy and
its last-operation fields in the same transaction as profile removal. It retains
only the sequence/digests and existing removal evidence, without clearing any
legacy hold. Rolling back deletion also rolls back receipt clearing. Existing
backup retention/privacy rules still apply to earlier archives; this is not a
claim that all prior copies disappear on deletion.

## Integrated service behavior

The restricted driver now has fixed parameterized revision-save and coherent-read
methods. `createAllianceCreation`, `createAllianceProfileApi` and
`createMemberProfileClient` accept the explicit `profileRevisions: true` option;
non-boolean values refuse. Defaults remain unchanged. Revision requests contain
only an operation ID, expected revision and validated editable profile fields.
The server still derives actor/session from the accepted account cookie and
checks the current SQL session before loading and before returning a response.

The coherent SQL read holds the common control lock while obtaining the profile
and receipt revision. It creates no row, clears no hold and resumes no write.
The API preserves serving and independent signed-journal checks around reads
and mutation responses. It returns a known conflict as 409, with no profile
payload, and withholds content if removal or session revocation intervenes.

The browser transport requires an explicit initial read. Save generates one
operation ID for one request; it never retries or changes the draft input.
Conflict or an unknown response pauses further saves. An explicit `load()` then
announces `comparison_ready`; it does not unlock saving. Only
`acceptCurrent(theDisplayedRevision)` selects that read as the next baseline,
without submitting anything. A later Save is a new intention with a new operation
ID and the selected expected revision. If another change intervenes, it conflicts
again. This accepts the displayed current version; it does not prove delivery or
the outcome of the earlier HTTP response.

`unconfirmedSave()` retains only a copied operation/revision reference in this
client's memory after uncertainty, never a credential or operator receipt. It
performs no lookup and clears after explicit current-version acceptance/disposal.
Reloading/disposal is not durable draft or operation storage. A page must preserve
the draft visibly and must not call acceptance automatically.

## Remaining integration before adoption

1. Mount the opt-in service and form only through a separately reviewed host
   composition and release decision. Keep account admission, serving authority,
   current-session, independent journal, privacy and publication gates. No
   existing held store may be converted by toggling the new flag.
2. Wire the transport's explicit Save/conflict/comparison states into the page.
   Keep drafts on conflict, provide text and accessible status announcements,
   preserve keyboard focus and avoid timing-dependent interactions. No extra
   password, CAPTCHA or owner approval for ordinary editing. Physical-device and
   screen-reader acceptance remain; a callback test is not assistive acceptance.
3. Finish the browser's own-removal operation-ID/version route and confirmation.
   The native journey composes the real journal-first removal coordinator, but
   this transport's `remove()` and the old DELETE route remain unavailable.
4. Review actual hosted schema/privileges, current authority/custody, coordinated
   freeze/restore/startup and operating acceptance. The existing format-2 paired
   inventory hashes all columns, and data-only archives copy the new columns:
   native verification now covers these rather than inventing a new format.
   Synthetic signed control is not independent hosted recovery authority.

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
sessions and removed-profile replay. The added composed journey uses the actual
browser-transport/API/coordinator code, two separate PostgreSQL servers, real
restricted journal admission and signed journal read guards. It exercises
conflict/current-version acceptance, a lost response without automatic retry,
and journal-first own removal with replay-text clearing. Auth HTTP and serving
control remain synthetic; this is not an actual Google or physical-browser test.

Actual paired data-only dumps/restores preserve the revision control flag,
operation/result columns and cleared removal receipt. Same-count revision
regression, changed operation/result content and changed flag fail the checkpoint;
a fresh modeled signed startup quarantines regressed data. Restoring the exact
archives re-establishes the closed checkpoint without changing the independent
journal. This establishes disposable schema/data coverage, not managed-provider
behavior, independent production custody or a live recovery guarantee.

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
