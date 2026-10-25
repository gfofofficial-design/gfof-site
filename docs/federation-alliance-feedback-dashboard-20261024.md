# Alliance feedback dashboard candidate

Source-only, October24,2026. The normal page and account controller remain
closed. Nothing here enables a host, database login, route, signup, reporting
operation or public member service. A reviewed host must explicitly opt into
`feedbackEnabled` together with the existing member/community capability and
use the feedback-aware application/checkpoint from the separate storage work.

The member task is to post a useful idea, choose support on/off, remove one's
own idea, or privately report an idea/author/received invitation or task. The
new client sends cookie-bound same-origin requests only after an explicit
action. It carries no actor selector, token, browser persistence or polling.
The server remains responsible for authorization, ownership and current sessions.

Native labelled inputs/selects, fieldsets, ordinary buttons and a polite status
region provide the interface. Draft fields accept text before the first read;
posting stays disabled until an explicit load confirms the member profile. The
form explains this prerequisite and keeps drafts in the tab. An in-flight request
or uncertain action still locks the form until it ends or is reconciled.
Reading ideas keeps the posting draft. A selected
idea must be read before taking an action. Support receipts do not invent a new
aggregate count; a fresh explicit read is needed. Own removal requires a checkbox
and explains active records versus retained backups. Matching draft text and the
old detail view clear before dispatching removal.

Reports require an explicit checkbox and describe their limits: a recorded flag
does not establish removal, dispute resolution or completed human review. The
ideas panel can report an idea or its author. The separately enabled private
collaboration panel offers a recipient-bound challenge report. There is no peer
report listing, copied private conversation text or automatic email. Operator
handling and retention acceptance remain separate release requirements.

An interrupted mutation pauses new actions. Only the clearly labelled
check-or-finish action resubmits the exact saved intention, including its stable
ID and desired support state; a read alone cannot clear uncertainty. A known
refusal during that check does not erase the original uncertainty. Cancellation
and late replies cannot release another account's content. Sign-out, account
replacement and profile removal dispose both feedback surfaces and clear drafts.
Profile-removal confirmation explicitly includes ideas, support and related
private reports without implying account deletion or physical backup erasure.

Automated checks cover exact receipts, streamed bounds, malformed/cacheable
responses, unknown outcomes/reconciliation, ownership controls, reporting
confirmation, cancellation, lifecycle clearing and closed-by-default behavior.
They do not prove keyboard/screen-reader/reflow/touch behavior. Rendered-browser and
assistive/device acceptance remain pending. A fictional standalone local preview
was prepared separately for owner review; it is not a hosted feature or real account.

Remaining: rendered keyboard/focus/status and narrow-screen checks, screen reader
and physical-device acceptance, full protected hosted journeys, current serving
and complete managed recovery, report operations/retention and explicit release
with rollback. Keep safe optional images and text participation in scope.
