# Google account presentation and warning evidence — October 16, 2026

Scope: draft PR #99. Google Safe Browsing still reports one Deceptive pages
issue for the preview `/account` URL. Its cause is undetermined. No clearance,
production account release or real sign-in acceptance is recorded here.

## Owner-supplied Google inspection evidence

These observations precede the button-artwork change and refer to the preview
serving source `6f015446a1436019da8acab2b26dc3bac20605d8`.

- Security Issues lists one Deceptive pages issue with the preview account URL
  as a sample. No root cause is supplied in that report.
- Live smartphone inspection displays October 16 at 05:58:50, successful fetch,
  HTTP 200, intentional noindex, all resources loaded and no JavaScript console
  messages. Indexing and security classification are separate checks.
- The visible rendered section shows the expected account UI, Google available
  and Apple disabled. This is partial rendering evidence, not a complete audit.
- All six listed resources are expected and share the preview origin:
  `/api/federation-account/config`, `/assets/federation/fed-account.css`,
  `/assets/federation/fed-account.js`, `/assets/federation/fed-tokens.css`,
  `/journey/passport.js` and `/logo-circle.png`.

Four additional anonymous HTML fetches used desktop, mobile, a Google referrer
and an inspection-style User-Agent. Each returned HTTP 200 and the same HTML
SHA-256 `3f13624114081258b92dab16d596ae12a537519832e36c31b2bb07b2a97b5028`.
The only script URLs were the two expected local scripts. This finite check
found no differing markup in those contexts; it does not exclude every form of
cloaking or establish Google's reason for classification.

## Separate button presentation correction

The former text-only Google control lacked the standard Google branding required
by the [current button guidelines](https://developers.google.com/identity/branding-guidelines).
The correction uses Google's supplied light rectangular PNG unchanged, including
its own text, logo, colors and boundary. Its accessible name is `Sign in with
Google`; CSS preserves its aspect ratio and provides at least a 44-pixel target.
The other account controls retain comparable dimensions. No Google SDK, remote
font, extra script or external page-resource request is introduced.

Asset provenance:

- Official bundle: https://developers.google.com/static/identity/images/signin-assets.zip
- Entry: `Android + Web/PNG @3x/Light/Theme=Light, Show text=Yes, Shape=Square, Platform=Android+Web@3x.png`
- Local resource: `/assets/federation/google-signin-light.png`
- Dimensions: 540 × 120; 9,671 bytes.
- SHA-256: `8a053b4c34e0dcb58079b84e08414a8b2de78b6b8c2f54d61aed64a89ab7aa7b`
- Google owns its brand asset; it is used only for the Google sign-in action
  under the linked branding guidance.

Existing 41 page/tab/wait tests pass. A static check confirms the button has an
accessible image label, scripts remain unchanged and the page has no credential
inputs. The authentication script is byte-identical to the preceding reviewed
version. CI now also triggers for account HTML and stylesheet changes. No new
behavioral test is added for this presentation-only change. Browser visual QA,
provider consent-screen review and current Google clearance remain pending.

The button finding is a separate branding requirement. There is no evidence that
it caused or resolves the Deceptive pages classification. Keep sign-in acceptance
paused, preserve noindex and the existing provider settings, and do not move the
flow to another hostname to evade the warning. The October 13 incorrect-warning
report and formal Search Console review are different procedures; this packet
neither submits another report nor attests that all security issues were fixed.
