# Disabled private-report review candidate

This source adds the owner's explicit private-review workflow. It is not mounted
or serving. The disabled foundation and service-aware snapshot update have been
independently verified in the Account Pilot with access still closed. The host must
supply the authenticated client and dispose the panel on sign-out. A browser owner
flag cannot authorize review.

The member/account page can now supply that lifecycle with the explicit
`reportReviewEnabled` capability, requiring its existing member/collaboration/
feedback capabilities. It mounts the cookie review client without reading any
reports until the user chooses Load. Sign-out, account replacement, profile
removal and disposal clear private context; a review-route sign-in refusal closes
the page, and late reads cannot populate a replacement account. The normal page
entry still supplies no enabled options and makes no requests. This capability
controls presentation only: the configured server reviewer and current SQL
session remain the actual authority. No reviewer identity comes from the browser.

The existing member executor gets four fixed private entry points: a bounded
metadata queue, one selected read, a review update and recovery inventory. A
separate default-off control binds exactly one verified Auth actor. Each read or
review requires that actor's current database session. No new role is created;
raw reports/review tables and the maintenance function are denied to the executor,
anonymous users, authenticated users and the service role.

The browser queue omits reporter identity and separate target-owner fields. The
private database envelope supplies two profile IDs only to the trusted server,
which checks both against fresh signed removal evidence before and after the
operation and strips them before responding. A selected read can return bounded
idea/profile text. Private challenge text stays excluded; existing participant
access remains necessary. Remote text becomes text nodes.

Reports expire 90 elapsed days after receipt until reviewed, then 30 elapsed days
after the first review. Repeated or changed outcomes never reset that timestamp.
Expired records are refused immediately, including review changes. Bounded closed
maintenance physically removes reports and cascades review metadata without
refunding lifetime abuse counters. Earlier profile/idea removal can delete them
sooner. Cleanup scheduling/operation is not implemented or activated here.

The UI explicitly loads one page, requires a selected fresh read and confirmation,
and separates review from moderation/account actions. An uncertain save remains
uncertain until a read-only reconciliation or explicit fresh-read reset. There is
no automatic mutation retry. Cancelled/late reads cannot restore private context;
disposal clears it even if client close fails. No polling, notifications, storage
of private drafts or external requests are created by the module itself.

Checkpoint format 5 covers the two additional private tables. Recovery-package
format 4 requires eleven named components including `report-review-data`; old
readers refuse it. Expired reports block startup preparation. Closed cleanup
changes inventories, so recovery needs a fresh checkpoint/authority decision after
cleanup; it cannot silently reuse old serving trust. Only the dedicated signed
review startup gate exposes `authorizeReportReview`.

SQL/TLS and native dump/readback fixtures cover permission denials, expiry,
preserved first-review times, bounded cleanup and re-expiry after restore. The
review archive test restores inside a closed rollback transaction in one disposable
database; it is not an independent-machine full encrypted recovery. Packaging tests
use a deliberately synthetic carrier; earlier actual age evidence remains separate.

## Authenticated service increment

`createAllianceReportReviewService` binds one explicitly configured reviewer to
the current database account session and the dedicated review-aware signed gate.
`createAllianceReportReviewApplication` combines the member/community/feedback
routes with the review routes under checkpoint5. Legacy applications do not route
review and cannot supply its permission. No default handler or mounted route is
added. Caller-owned database stores and signing adapters retain their ownership.

The cookie HTTP boundary accepts only same-origin requests, verifies the existing
access cookie against Auth, bounds input/output and returns private/no-store
responses. It rejects caller-supplied bearer/owner identity. Routes are explicit:
GET `/api/alliance-members/report-review/reports`, GET `.../report?id=...`, and
POST `.../review`. The browser client implements the panel's existing
`list/read/review/close` interface without token access or polling. A lost write
stays uncertain and is not resent; an explicit successful read of that same report
can clear the client's write hold. The server faults closed after an uncertain
database outcome; reconciliation may require a fresh verified server connection.

The explicit **Start a fresh queue read** action closes the old browser client
and creates a fresh one before clearing the local uncertainty note. It makes no
request and does not undo or resend the earlier review. Loading, reading a report
and confirming another save still require separate user actions. If the client
cannot be replaced, the panel closes and clears its private context; the member
must check sign-in again. This local reset cannot reopen a faulted server or
restore withdrawn serving authority.

The database change is one private `snapshot(uuid,boolean)` replacement. The two
tables, eight functions, owners, function OID/ACLs, execute permissions, retention
and existing roles remain unchanged. The source-only upgrade planner pins the
exact previous SQL, requires an empty/default-off/unbound closed pilot, removes
its one temporary owner grant before commit and supplies an independent old/new
boundary comparison. It has no connection or apply method. The new store refuses
the old envelope; an old host must be explicitly upgraded before this service can
be used. The preserved v1 fixture is an upgrade baseline, not an installer.

Before hosted use: run required CI/provider checks and dependency audit, review the exact reviewer/runtime
binding, finish provider/independent recovery, prove ongoing cleanup and backup
deletion behavior, and obtain activation decisions. This source grants no authority
for those operations. The local canonical reconstruction and hosted checkpoint
evidence remain dated to their accepted source versions.

The fictional local panel has an owner-reported keyboard/focus/200% zoom check.
Actual assistive-technology, physical mobile, network and authenticated hosted
journeys remain gates. No WCAG conformance or response-time promise is made.

## Complete local member-to-owner journey

The shared managed-application fixture now prepares checkpoint5 with all five
data domains, then exercises the real combined application and restricted SQL
stores over three disposable TLS databases. Two fictional members create their
profiles, consent to a collaboration, post an idea, support it and report it
privately. The configured owner uses the browser review client to load metadata,
read selected context and save a review. Private profile identifiers never reach
the review response, and recording a review does not remove the member's idea.

The same journey checks that an ordinary member cannot use owner review, deleting
the owner's real SQL session denies review despite an accepted Auth cookie, and
withdrawn signed serving authority closes profile/community/feedback/review
together. No additional UI layout, interaction pattern or manual acceptance is
introduced. Existing owner keyboard/focus/zoom evidence remains separate.

Auth HTTP, API/Lambda identity, DynamoDB, Secrets Manager and KMS responses remain
explicit synthetic adapters with ephemeral test keys. Actual PostgreSQL/session
and signed application interactions do not establish hosted-provider, independent
machine or assistive-technology acceptance. All disposable services and scratch
must be removed after the run. This fixture never contacts hosted services.
