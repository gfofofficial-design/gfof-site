# Account local browser checks — October 17, 2026

The JavaScript-disabled account page kept saying “Checking account availability…”
without explaining that sign-in could not run. The HTML now starts with a neutral
public-browsing message and includes a native `noscript` explanation. Sign-in
buttons stay disabled until the existing account script checks configuration.
No authentication script, provider setting, route, cookie or signup rule changes.

Implementation commit: `b54a93aae7034e750badef0f45ce32f54c768b89`, following
preview source `04c27ee176a105bd153b07af04063d34bbfac47a`.

## Observed browser checks

Actual Chrome on Windows loaded the reviewed account HTML, scripts, styles and
images from a temporary server bound only to 127.0.0.1. A conspicuous synthetic
fixture banner and browser-capability label were added to that local HTML.
The account API was an in-memory stub with a fictional `.invalid` identity;
there were no provider, database, wallet or real-account operations. This is
browser-control evidence, not hosted authentication acceptance.

| Scenario | Observed result |
| --- | --- |
| Keyboard activation of sign-out | Identity cleared in both open tabs; both displayed Signed out. |
| Sign-out while another tab awaited a five-second session response | Native Web Locks serialized the session response before logout. Server peak concurrency was one; both tabs ended without identity or stale restoration. |
| Logout response could not confirm remote revocation | Both tabs cleared identity and explicitly reported the uncertainty; neither claimed confirmed remote revocation. |
| Configuration response delayed fourteen seconds | Existing twelve-second browser deadline showed Account status is unavailable and kept identity hidden. The later response did not display a signed-in identity. |
| JavaScript disabled before reload | Original indefinite loading text reproduced. Repaired HTML explains that sign-in needs JavaScript; public navigation remains keyboard reachable. |
| Narrow viewport | At a requested 320-pixel override, actual CSS layout width and content width were both 304 pixels. No horizontal page overflow was observed. The fallback and disabled controls wrapped within the page. |
| Restore JavaScript/default viewport | Synthetic signed-in behavior returned; the noscript explanation was absent from the accessible page. Temporary overrides were removed. |

All 41 existing account page/tab/wait tests pass after the HTML change, with zero
failures or skips. The application script is unchanged, so the preceding real
Web Locks/BroadcastChannel checks use its exact current bytes. The fixture's
read-only event trace records the delayed request/logout ordering; it does not
model real cookie writes, Supabase rotation, provider outages or server deadlines.

## Accessibility and release limits

The fallback uses ordinary HTML text and existing styling, without a new control,
timing requirement, remote dependency or credential prompt. Disabled scripting
no longer suggests that an account check is indefinitely progressing. Existing
status messages retain their polite live region and status role. Keyboard focus
was visible on a public navigation link in the narrow JavaScript-disabled view.

No screen reader, switch control, forced-colors mode, complete contrast audit or
physical-phone acceptance was performed here. These checks do not establish
WCAG conformance. Native controls and semantic text are retained for subsequent
assistive-technology testing.

Google's last observed Deceptive pages finding remains unresolved. The change is
an accessibility repair, not a demonstrated fix to that classification. Do not
bypass a browser warning, attest all issues fixed, open registration or describe
these synthetic checks as real Google/cookie/production acceptance. The other
account operating, recovery and release gates remain applicable.
