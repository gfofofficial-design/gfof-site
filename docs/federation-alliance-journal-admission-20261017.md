# Alliance journal capacity admission candidate

Source-only, October 17, 2026. This extension is **unapplied**. It does not enable
a database login, create a member or upload an image. The journal-side store is
implemented; profile preparation, profile creation and image reservation/upload
have **not** been routed through it. Existing creation paths therefore do not yet
have this end-to-end capacity safeguard. No public service or release is claimed.

## Purpose and data flow

Before future profile or image creation, the server must reserve the exact later
removal event in the independent journal. A temporary availability check would
race with other requests. This candidate instead commits one permanent admission
per deterministic removal identity, bound to the profile and optional image UUID.
The existing deletion hash-chain format is unchanged.

The proposed flow is: persist prospective subject IDs in a member preparation;
commit and confirm their independent journal admission; recheck current member,
session and removal policy; then permit the matching database/provider creation.
That orchestration and the closure of legacy bypass paths remain future work.
Admission alone is neither authentication nor permission to create an object.

The extension requires an empty, disabled, unconfigured, separate journal. It
adds a private forced-RLS admissions table and a default-off admission switch.
Existing restricted executors receive only fixed function entrypoints, with no
direct table access. The old append implementation becomes a private helper;
the new wrapper requires exact canonical admission before recording removal.
Hosted installation would require a separately reviewed transaction/installer
and permission verification, not execution of this candidate as an ad hoc script.

## Capacity and failure behavior

- Unique slots 1–256 bound all admitted subjects. Each admission reserves one
  possible later journal entry. Control-row locking serializes competing admissions
  and appends; concurrent requests cannot overbook the final slot.
- An image requires an admitted profile whose removal has not been recorded.
  At most four image identities may ever be admitted for that profile. The
  256-slot and four-image limits are finite test candidates, **not adopted
  production capacity, membership, replacement or retention policy**.
- Admissions never expire, refund, prune or transfer. Abandoned creations consume
  capacity too. Removal does not free slots or reopen a profile/image identity.
  Exhaustion stops new reservations; a production replenishment/epoch policy is
  unresolved and must not discard deletion history.
- Closing **new admission** still permits later removal of already admitted
  subjects. The existing journal master switch can still pause deletion appends;
  this is not a guarantee of availability during outage or administrator action.
- Canonical exact replay returns the existing state. A lost mutation or COMMIT
  reply remains unknown to its caller; the adapter does not retry automatically.
  A separate read-only `admission` lookup can identify the committed reservation.
  That lookup is recovery evidence, not fresh authorization to begin another write.
- Durable writes require synchronous commit, fsync and full-page writes. TLS,
  certificate/hostname validation, transaction deadlines, bounded concurrency and
  fixed parameterized statements remain required. A late response cannot commit
  or refund a timed-out request.

## Existing provider-management compatibility

The adapter accepts the already approved provider bootstrap management exception:
OID 10 named `supabase_admin` grants the connected journal role to the existing
`postgres` administrator with ADMIN true, INHERIT false and SET false. It still
refuses other memberships, wrong/missing named recipients or bootstrap, and
inherited or SET access. This source change grants no membership or cloud access.
It does not establish administrator/provider independence or disaster recovery.

## Privacy and accessibility

Admissions retain only UUID/event kind and a capacity slot, not profile text,
images, email or credentials. Those identifiers remain potentially linkable;
permanent metadata retention and deletion/backup policy require review before
real use. Do not call them anonymous or imply that user removal erases every copy.

There is no new interface in this increment. Future creation controls must give
clear text for capacity unavailable, paused and uncertain outcomes, preserve the
user's work where appropriate, and support keyboard, assistive technology and
password-manager/paste use without countdown pressure or automatic repeated
writes. Do not silently retry an uncertain upload. No browser, screen-reader or
WCAG conformance acceptance follows from these database tests.

## Verification and remaining release gates

Unit tests cover canonical binding, malformed/conflicting replies, closed/full
states, lost acknowledgements and late-response cancellation. Disposable actual
TLS/Postgres tests cover concurrent replay, final-slot competition, permanent
capacity, removed-parent refusal, full/closed-admission deletion, direct-access
denial, durability settings and exact provider-management compatibility. Fixtures
use synthetic identities and remove their database objects, roles and TLS files.
No hosted project, provider request or real credential is involved.

Before release: wire persisted prospective IDs and admissions into all creation
paths; verify two-domain crash/recovery behavior; persist the serving floor and
startup/restore interlock; complete account-removal integration and retention,
key custody and encrypted recovery policy; review HTTP/UI errors, real Auth,
hosted permissions, Google sign-in, mobile/assistive behavior and publication.

Postgres references: [explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html)
and [role membership](https://www.postgresql.org/docs/17/role-membership.html).
