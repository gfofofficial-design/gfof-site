# Disabled private-report review candidate

This source adds the owner's explicit private-review workflow. It is not mounted,
installed or serving. The host must supply an authenticated server client and
dispose the panel on sign-out; no owner flag in a browser can authorize review.

The existing member executor gets four fixed private entry points: a bounded
metadata queue, one selected read, a review update and recovery inventory. A
separate default-off control binds exactly one verified Auth actor. Each read or
review requires that actor's current database session. No new role is created;
raw reports/review tables and the maintenance function are denied to the executor,
anonymous users, authenticated users and the service role.

The queue omits reporter identity and separate target-owner fields. A selected
read can return bounded idea/profile text. Private challenge text stays excluded;
existing participant access remains necessary. Remote text becomes text nodes.

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

Before hosted use: finish the authenticated HTTP/service binding using the new
gate, complete canonical eleven-component capture and reconstruction, run required
CI/provider checks and dependency audit, review the exact owner binding, prove
ongoing cleanup and backup deletion behavior, and obtain installation/activation
decisions. The candidate grants no authority for any of those operations.

The fictional local panel has an owner-reported keyboard/focus/200% zoom check.
Actual assistive-technology, physical mobile, network and authenticated hosted
journeys remain gates. No WCAG conformance or response-time promise is made.
