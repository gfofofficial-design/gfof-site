# Member profile form — closed draft and explicit comparison

Status: default-closed page and explicitly mounted form adapter. No production
route, account connection, hosted activation, signup or removal request is enabled.

`alliance-profile.html` presents the real form markup. Its entry module calls the
adapter with no activation flag or client factory. Fields/buttons are disabled,
and CSP forbids connections and native form submission. URL parameters, page
attributes and browser storage cannot opt it into account access. Without
JavaScript the same closed state and explanation remain visible.

A separately reviewed host can mount `mountMemberProfileForm(document,
{enabled:true,createClient})`. The factory supplies a fresh revision client and
receives the form's status callback. It must not reuse another account's client.
The adapter never performs authentication, selects an actor or starts an initial
read. Host composition must review the page's connection policy as well as the
existing account/session, serving, journal, recovery and publication gates.

## Interaction decisions

| Member action or outcome | Form behavior | Access consideration |
| --- | --- | --- |
| Read current profile | Explicit request, with text busy state and Cancel | No startup polling or unexpected account request. |
| Read into an untouched draft | Fill the returned values; keep a separate recorded-profile panel | Familiar labeled form, no identity/receipt fields to transcribe. |
| Read with a draft, or type while a clean read is pending | Keep every draft field and require comparison | Slow connections do not silently overwrite text or select a new save baseline. |
| Conflict or unknown save | Pause Save; show an explicit current read and comparison | No automatic retry, merge or claim that an interrupted save failed. |
| Keep my draft and continue | Select the displayed version; submit nothing; focus Save | A distinct keyboard action precedes a new save intention. |
| Invalid field | Keep its help text, add its error association, focus the input | Text plus `aria-invalid`/`aria-describedby`, not color alone. |
| Type while saving | Keep newly typed text after the earlier saved result returns | Editing remains possible during a slow request; busy actions are guarded. |
| Cancel | Abort local wait, retain uncertainty if a write started, focus Read | Cancellation does not claim server rollback. Late responses cannot replace text. |
| Dispose/unmount | Stop handlers/client; clear draft and recorded-profile content | No previous account's profile is left in the form for a later mount. |

The transport's new explicit `compare()` method always stages a comparison read.
It cannot clear an uncertain outcome; acceptance remains a separate action. If a
draft first appears while an ordinary clean read is already pending, the form
adds its own explicit comparison gate for that successful read, before allowing
Save. It submits no extra request and never auto-confirms an unknown save.

## Accessibility and constrained use

Use native inputs/select/checkbox/buttons, a semantic fieldset and legend,
descriptive labels, one polite atomic status region and a separate recorded
profile definition list. The comparison panel is not a live region that would
read an entire bio unexpectedly. A keyboard-operable jump link moves to the
recorded-profile region when comparison is available. Only explicit validation,
continue or cancel actions move focus; asynchronous reads/saves preserve it.

Desktop uses separate draft/recorded columns. At narrow widths they stack; the
jump link reduces repeated navigation. Controls target at least44CSS pixels,
field text is16px, content wraps and textareas resize vertically. Focus indicators,
reduced-motion and forced-colors styles are supplied. Actual screen-reader,
physical-phone, high-zoom and forced-colors acceptance remain; code and Chrome
checks do not establish WCAG conformance.

No local/session storage or cross-reload draft persistence is added. The page
warns that closing/reloading can lose unsaved text. Source data is rendered with
textContent, never HTML interpolation. Directory listing remains unchecked by
default; role/community labels confer no authority. Images and the browser's
journal-first removal operation/confirmation are still separate integration work.
The removal section says it is unavailable and its button is disabled.

## Observed acceptance

Targeted form/legacy-client/revision suites pass43cases, including late typing
during a read, stale/unknown comparison, field errors, slow saves, cancellation,
late-response suppression and account-content clearing on disposal.

Actual Chrome on the local fictional fixture exercised first save, conflict,
separate current-vs-draft values, no-submission continue, lost reply/readback,
keyboard error focus/help association, and late typing during a delayed read.
At360px, document content width345px fit without horizontal page scrolling.
The comparison jump focused its named region and Continue focused Save. The
normal page stayed closed with all controls disabled. The temporary viewport
override was reset. These were synthetic local data, not real Google/Auth,
database isolation, hosted serving or physical-assistive-device acceptance.

The fixture's first load had a syntax error in its private test-only script;
that observation is not acceptance. After repair and a cache-ignoring reload,
the final controller's delayed-read guard was verified in actual Chrome. Mouse
automation missed one long-page fixture action; keyboard activation visibly
queued and exercised it. A full-page screenshot attempt timed out; accepted
normal screenshots and DOM observations are retained in internal evidence.

No new runtime dependencies, credentials, cloud permissions or monitoring were
introduced. Existing revision SQL/server/recovery acceptance remains prior
evidence and is not relabeled as a new local database run.
