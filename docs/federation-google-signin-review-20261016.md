# Google account presentation and warning evidence — October 16, 2026

Scope: draft PR #99. The latest owner-supplied Search Console evidence reports
one Deceptive pages issue for the preview `/account` URL. No newer Google
verdict has been observed. Its cause is undetermined. No clearance, production
account release or real sign-in acceptance is recorded here.

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
paused, preserve noindex and the existing authentication behavior, and do not move the
flow to another hostname to evade the warning. The October 13 incorrect-warning
report and formal Search Console review are different procedures; this packet
neither submits another report nor attests that all security issues were fixed.

## Owner Google Auth Platform configuration check

Owner-supplied console screenshots on October 16, approximately 11:37–12:00 UTC
(06:37–07:00 America/Chicago), establish the following limited observations.
No screenshot, tester email, client secret or credential export is included in
this public record.

The owner entered and saved these Branding values. The console displayed
`Branding changes saved!`:

- Application home page: https://galacticfederation.co/
- Privacy policy: https://galacticfederation.co/account-privacy.html
- Terms: https://galacticfederation.co/account-terms.html
- Added authorized domain: `galacticfederation.co`.
- The three existing provider-domain entries were retained.

Finite anonymous GETs to the three public links returned HTTP 200. The home
page links to both account notices; the notices describe the private account
preview and Google/Supabase identity data. Successful delivery does not establish
Google brand approval or Safe Browsing clearance. Domain ownership verification
for a future brand submission has not been independently confirmed here.

The Audience page displays `Testing`, user type `External`, and one listed test
user. No tester was added and no publishing action was taken. Those console
observations alone do not independently establish the application's complete
registration restrictions.

The existing pilot web client's sole displayed authorized redirect URI matches
the previously recorded pilot project and ends in `/auth/v1/callback`, as
specified by [Supabase's Google setup guide](https://supabase.com/docs/guides/auth/social-login/auth-google).
It was not edited. The AI-powered-agent option was unchecked. Two additional
test/drill client entries were visible in the client list; they were not audited,
modified or deleted during this check.

Data Access lists only the three non-sensitive identity scopes: `openid`,
`https://www.googleapis.com/auth/userinfo.email` and
`https://www.googleapis.com/auth/userinfo.profile`. Both sensitive and restricted
scope tables are empty. This records the console declarations; no live consent
request was executed to establish its effective scopes.

The Verification Center says verification is not required because the app has a
Testing publishing status. This is an exemption for the current testing state,
not a verified-brand decision or approval for public account release. The
[Google brand verification guide](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)
describes the separate published-app and domain requirements.

This check changed only the owner-saved public branding links and domain
metadata. There was no callback or scope change, new tester, OAuth publication,
credential action, registration opening, deployment or sign-in acceptance.
The Safe Browsing issue remains unresolved; these configuration observations do
not identify its cause or establish that it has been corrected. Keep PR #99
draft and real sign-in acceptance paused pending current security clearance and
the remaining release gates.

## Passive delivered-file integrity check — 12:54 UTC

A finite, anonymous, read-only check at 12:54:44 UTC (07:54 America/Chicago)
compared ten delivered preview resources with the Git tree at
`83b36d5230b8e77919874cb1e0f11830ada4bad8`. All ten requests returned HTTP 200. Only public
static pages and assets were requested; no sign-in, callback, Auth API, wallet,
price or RPC request was made. Retrieved markup was inspected as data, not
executed in a browser.

The seven scripts, stylesheets and images were byte-identical to their reviewed
Git blobs. The identifiers below are Git blob SHA-1 values used for exact source
comparison, not a claim of independently authenticated provenance:

| Resource | Matching Git blob |
| --- | --- |
| `assets/federation/fed-account-notices.css` | `5c0e7a793b00d18589eb6bf8e329311b183968d4` |
| `assets/federation/fed-account.css` | `a03bdc5b0d31a2e51332ab1cbb939ad008bdbd49` |
| `assets/federation/fed-account.js` | `bd7812aebbbad4b8bdb053245fc26a636f1cbde7` |
| `assets/federation/fed-tokens.css` | `0238ed0b218473a25772f7c35f285fd39dd9d653` |
| `assets/federation/google-signin-light.png` | `3e827a4920539d616b57e275b30c39ff04a3d588` |
| `journey/passport.js` | `ff95209ae6d8aa0ba2cb840de1d2369320baeab9` |
| `logo-circle.png` | `bf8d496fe1e115caf32368b5750dd0b1c4117483` |

The HTML was not byte-identical. The complete observed difference for all three
pages was hyperlink delivery rewriting: an `href="...html"` becomes
`href='...'` with the `.html` extension removed. After applying only that exact
rewrite to the source, each complete delivered document matched. The changed
links were:

- `account.html`: account privacy and Command Deck links.
- `account-privacy.html`: the account terms link.
- `account-terms.html`: two account privacy links.

There was no additional markup difference in these responses. All three pages
contained zero input elements and served `private, no-store`, `no-referrer`,
`X-Frame-Options: DENY`, `X-Robots-Tag: noindex` and the expected account CSP.
The policy restricts scripts, styles, images and connections to the same origin;
it disallows inline script attributes, frames, objects, form actions and workers.
The account page's script elements remain the two expected local scripts.
The shared passport source adds no network request on the account path; its
conditional mission-help import applies only to enumerated mission paths.

The current production deploy identifier remained `6ad1390b9a22b5139b50293f`.
The PR's Netlify deploy-preview commit status was successful. Neither observation
establishes a current Google verdict. No new runtime defect or unexpected asset
was found in this bounded review, and no runtime change was made. This is not a
full audit, a finding about every possible browsing context, confirmation of
provider consent behavior, or evidence that the Deceptive pages issue is fixed.

The next authoritative security-status check remains the owner's Search Console
Security Issues report for the flagged preview property. A green no-issues state
or Google's review outcome must be observed directly; successful fetches,
noindex, branding metadata and passing source checks are not substitutes.

## Release handoff refresh after Community League publication

The owner requested continued work on warning clearance and later real sign-in
and phone acceptance while registration stays closed. The connected-browser
attempt ended before any tab became available; no Google page or fresh verdict
was observed. The October 16 owner evidence remains the latest recorded report,
not a newly verified current classification. No warning was bypassed and no
Google report/review or all-issues-fixed attestation was submitted.

Released production advanced to `d9853cfef0a2d6445027c9132eee2c37ad26c61c`
with the approved prelaunch Community League. The account branch is synchronized
with those production changes for the next acceptance candidate. The sole
overlapping production file is Command Deck; the three-way merge preserves the
account branch's private-pilot copy and the released League. All other incoming
production files use their exact existing Git blobs. Account handler, bounded
reader, page/script/style, Google artwork and account configuration remain
unchanged.

The operator acceptance checklist now records October 16's latest observation,
requires the current PR head and matching ready deployment, and distinguishes
no-issues, review-in-progress, continued deceptive-page and missing-evidence
outcomes. Normal anonymous Chrome/phone warning checks follow current report
clearance before real OAuth acceptance. Request Review button visibility,
indexing, Testing status and passing CI remain insufficient clearance evidence.
Exact-head source, CI and passive preview results are recorded on PR #99.

Real Google sign-in/cancellation/replay, cookies/expiry, multitab and physical
phone acceptance remain NOT RUN for this candidate. Public signup, managed
hooks, provider callbacks/scopes and credentials are not changed here. The
League still has no real enrollment or score collector. The next required
owner evidence is a current status readback from the exact flagged Search
Console property and, if still listed, its expanded issue/review details.
