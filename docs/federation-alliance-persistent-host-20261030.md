# Explicit persistent member-host candidate

This source increment prepares one long-lived member process. It adds no
listener, proxy, environment value, credential, installed server or activation.
All factories default off. The existing Netlify factories keep their deployment
identity and ten-minute preview limit.

The separate persistent factories bind a pinned Ohio Lightsail instance ARN,
release SHA-256, fresh per-process UUID and preview/production purpose. The Node
host must construct the trusted `{server: identity}` context itself; client
headers, JSON and forwarded Netlify fields cannot supply it. These checks verify
trusted composition, not hardware identity or protection against a compromised
administrator. A production origin is accepted only by the explicit persistent
factory and production identity.

`createPersistentAllianceHost` reuses the same bounded operation, cancellation,
late-result disposal and local-drain engine. Its reviewed generation window can
span at most26 hours, allowing a daily maintenance boundary; the finite Netlify
factory still caps its window at10 minutes. Wall-clock and monotonic budgets
both apply. Expiry closes admission; it cannot renew itself or construct a new
generation. Drain does not certify remote sessions or fleet closure.

`createPersistentAllianceReportReviewApplication` composes the same complete
profile, collaboration, feedback and owner-review services. Its signed startup
protocol is unchanged: closed inventory under REVIEW, then a separately newer
SERVE decision before member work. Current Auth/session validation, removal
history/anchor, rollback floors and private HTTP contracts remain in force.

`createManagedAlliancePersistentBundle` owns the same six purpose-bound pools
and explicit caller/media dependencies. Text-member routes still refuse images.
It does not obtain credentials or enable roles. Its persistent signing runtime
requires an explicit private reader for one fixed caller-key name, with no
ambient environment fallback. The shared signing provider retains exact Ed25519
public-key matching, validity margins, fresh runtime checks, per-exchange scope,
late callback refusal, failure latching and a maximum30-day caller descriptor.
An operating deployment must provide renewal alerts and an owner-approved key
replacement process; this change adds neither automatic key creation nor renewal.

Focused tests use the actual application, clients, signed startup/witness code
and ephemeral in-memory crypto, with fictional SQL/Auth/transport. The persistent
member-to-owner flow passes; changed process identity refuses before private
work. Separate tests check wrong instance/release, explicit key reader, retired
callbacks and a bounded daily generation. Existing Netlify cases remain enabled.
No hosted, real-sign-in, assistive-device or complete availability claim follows.

Remaining implementation before member opening: reviewed Node HTTP/TLS adapter
and same-origin proxy; authenticated management interface separated from member
routes; real host-origin/release validation; private credential delivery; durable
maintenance fencing and independent drain; closed backup followed by a separately
fresh REVIEW checkpoint/startup and SERVE transition; then protected hosted member
and owner acceptance. A closed backup checkpoint cannot simply reuse its freeze
ID for REVIEW. Do not weaken that transition rule or reuse an old prepared process.

Public Alliance/dashboard remains separate. No UI control, cookie policy, report
retention, accessibility claim, public release or trading authority changes here.

## Closed HTTPS transport increment

`createClosedAllianceHttpsServer` is a separate default-off transport shell. It
does not import or dispatch the member application. Only GET/HEAD `/healthz` at
the exact proposed backend hostname can report `{state: 'closed', memberServing:
false}`; member, management and other paths stay unavailable. It ignores forwarded
host headers, refuses request bodies, bounds headers/connections/timeouts, emits
no request/access log and uses TLS1.2 or newer. Importing/constructing it opens no
socket and reads no key. An explicit reader supplies certificate material only
when listening/reloading. A failed reload retains the previous TLS context;
close removes all connections and prevents reopening the same object.

Five focused cases use a disposable, locally generated certificate and an actual
TLS client that verifies that certificate and hostname. They cover the closed
health response, member/control refusal, host/body refusal, occupied-target
refusal, reload/failure and shutdown. No public CA request or hosted deployment
was made. Proposed DNS/TLS setup, certificate renewal and monitoring need their
own reviewed installation; this source adds no Netlify route or environment value.
