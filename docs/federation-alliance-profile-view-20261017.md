# Alliance text and directory deletion barrier

October 17, 2026. Disabled/unmounted source. No new hosted change, credential,
endpoint, startup permission or public release is included.

## Concrete behavior

A restored member database can contain a profile that was removed later. Text
must therefore pass the independent deletion journal as well as existing Auth/RLS
checks; image-only checking is insufficient. The signed reader now offers an
exact profile-only deny check, without a fabricated image ID. An image-removal
intent does not hide unrelated profile text. Absence remains **not listed**, never
authorization or proof of physical erasure.

The unmounted profile handler requires both the journal reader and startup/restore
serving policy before it contacts Auth. After its existing cookie/account checks,
the text guard checks that permit and a complete freshly challenged signed chain,
executes the existing store operation once, copies the bounded public DTO, then
checks a second fresh chain and the final permit before returning text. Denials
from either review are retained. Both self reads and save responses pass this
barrier; the older deletion route stays closed.

A denied own profile produces unavailable/withheld, not a false missing-profile
response or a prompt to recreate it. A save already dispatched before a denial or
failed final check returns an unknown mutation outcome without its profile text.
There is no retry, rollback claim, automatic refresh or journal bypass.

## Directory continuation

Only permitted rows survive. A continuing page uses its **last surviving row** as
the next cursor, never the ID of a removed row. The shared client/server contract
therefore permits a short nonempty page with that exact visible cursor. Ordering,
bounds, uniqueness and cursor equality remain validated.

If every row in a continuing source page is denied, this finite candidate refuses
the response rather than claiming the directory ended, leaking a removed ID,
looping or automatically refilling. A final source page can correctly become an
empty visible final page. Handling long runs of denied rows without this refusal
needs a separately reviewed opaque-cursor or bounded repair design; no new signing
key, retention policy or unbounded scan is introduced here.

## Bounds and trust

One active operation per guard instance; no queue. At most one source operation,
two journal reviews and three serving-policy checks. The guard has an eight-second
deadline and cancellation checks. Existing inbound-body and Auth reads have their
own two/eight-second limits before the guard. Late noncooperative responses cannot
start follow-up work through a stopped guard. Cancellation/timeout faults that
instance rather than silently reopening after an uncertain save; host lifecycle
and production concurrency/availability still require acceptance.

Source callbacks and journal/serving dependencies are trusted server composition,
not browser-supplied policies. Auth IDs, cookies and tokens are not sent to the
independent journal. Only the existing validated profile/directory DTO leaves the
handler. Journal failure yields no partial text. No claim of global linearizable
revocation is made: deletion can occur after the final observation. Existing
Auth/RLS remains responsible for ownership/listing visibility, and fresh live-session
validation across the complete HTTP lifecycle is still a release gate.

This does not prevent every profile mutation: new-object deletion-capacity
admission, authenticated account-removal cascades and administrator writes remain
separate work. Nor does an injected startup permit implement a persisted floor or
an actual startup/restore interlock. Real key custody, encrypted recovery,
retention/replay/privacy, provider acceptance and public release remain gated.

## Accessibility and acceptance

Keep unavailable distinct from empty, preserve a clear user-controlled recovery
path, and never announce an uncertain save as confirmed. The existing client keeps
further writes paused after uncertainty. Short pages preserve ordinary Continue
controls; no transcription, timed task, automatic polling or hidden refill is
required. Consumers must discard stale displayed details on unavailability rather
than treating old results as current. The tab-only preview is unchanged; no actual
screen-reader, physical-device or WCAG conformance claim follows from source tests.

Tests compose the real Ed25519 reader with restored DTOs, changing denial history,
the cookie/Auth handler, existing store and browser-client module. They check
profile/image distinction, before/after denial, cursor privacy, empty-page limits,
unknown saves, malformed data, copying, cancellation, expiry/freeze, late responses
and no automatic retry. Auth/provider/serving dependencies remain synthetic;
hosted end-to-end acceptance is not established by these tests.
