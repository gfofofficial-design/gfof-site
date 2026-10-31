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

## Unmounted Node application request bridge

`createPersistentAllianceNodeHttp` adapts real Node HTTP requests to the existing
persistent host's Web Request interface. It opens no socket and performs no
startup, credential lookup or permission transition. It defaults off. Trusted
composition supplies the fixed site origin and a copied/frozen instance, release
and process identity; client headers cannot choose those values. The installed
closed HTTPS shell is unchanged and does not import this bridge.

Only existing member/profile/community/feedback/owner-review route predicates
can dispatch. Management paths are refused. Exact backend Host, duplicate
security-header rejection, bounded JSON body/response and fixed private/no-store
response headers apply. Existing same-origin and cookie/Auth checks remain in
the application. No forwarded deployment/host identity, CORS grant, auth refresh,
Set-Cookie, redirect or raw exception is forwarded to the browser. A future Node
HTTPS entry must additionally set a32KiB parser header limit (to admit the
existing bounded account cookies), bounded connections and header/socket limits;
the bridge's own total header check cannot override Node's earlier parser limit.

The outer request budget is at most20seconds, inside Netlify's documented
[26second proxy timeout](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/).
Disconnect/deadline aborts reach the existing host. A dispatched mutation that
cannot be confirmed retains the existing unknown-outcome contract and retires
that process generation. Slow uploads stopped before dispatch retire no unused
application. Late work retains occupancy and cannot return success or reopen
the generation. Callers still need the host's actual local drain and independent
provider closure; closing this adapter proves neither remote SQL closure nor a
safe maintenance/reopen transition.

Eight focused tests use an actual loopback Node HTTP server and fictional
application responses: cookie/context binding, JSON transfer, refused routes/
headers/oversized requests, slow body, timed-out write/late-result refusal,
oversized response and client disconnect. This proves the request bridge, not
hosted Netlify cookie forwarding or signed member acceptance.

## Uninstalled member HTTPS composition

`createPersistentAllianceHttpsServer` explicitly composes the bounded Node bridge
with a TLS listener. It defaults off and neither prepares a generation nor loads
application credentials. Trusted composition provides the existing application
host and installation identity. The32KiB parser admits the existing bounded
account cookies; body, response and20second operation limits remain in the bridge.
Connections, header/socket timeouts and requests per connection are bounded.
Member routes retain their cookie/origin contracts; management paths cannot
dispatch through this listener. Health says only `transport_ready`, which makes
no claim about account readiness, SERVE authority or provider drain.

An explicit server-side reader supplies TLS material at listen/reload. A failed
reload preserves the current context. Shutdown stops socket admission/connections
before awaiting host closure; occupied sockets and failed private readers cannot
reopen or return raw errors. Five actual verified-TLS tests cover cookie/JSON and
trusted identity transfer, closed host/management refusal, renewal, reader failure
and occupied-target shutdown. They use fictional data and disposable test keys;
they do not certify real Auth, sign-in, private service startup or hosted proxies.

The installed closed HTTPS shell and active Netlify configuration are unchanged.
This is source-only. Authenticated management/private delivery and coordinated
maintenance/startup remain required before installation or member opening. No
new browser control or authentication interaction is introduced, preserving the
accepted keyboard/phone/zoom behavior; hosted accessibility acceptance is pending.

## Local maintenance control boundary

`createPersistentAllianceLocalControl` is an uninstalled, default-off Unix-socket
administrative interface. The existing service account/root authenticate through
OS file permissions: a real, current-user-owned0700 directory and0600 socket,
without a symlinked parent or occupied target. There is no TCP listener, browser
endpoint, token or ambient credential lookup. This protects against other local
users, not the service account itself or a compromised administrator. Production
composition uses `/run/alliance-member-control/control.sock` in a systemd-owned
runtime directory; enabling it requires a separately reviewed service setup.

Bounded JSON commands must match the exact immutable release/process identity.
Prepare invokes the existing signed startup under REVIEW and never changes
provider permissions or SERVE. It is one-attempt per process. Close can interrupt
preparation and discard its late result; drain observes the existing host's real
local jobs. Neither close nor drain claims provider/fleet closure. Independent
database closure and the durable maintenance hold are still required before
capture; a fresh signed REVIEW/startup followed by newer SERVE is still required
to reopen. No command on this socket opens a role or creates another generation.

Five Linux tests use actual Unix-socket permissions and requests, covering the
closed preparation result, fixed identity, foreign requests, priority closure,
late readiness disposal, occupied targets and refusal to label remote providers
closed. Linux CI uses the target Node24 version; local Linux verification used
Node22.22.1. Windows executes the default-off case and skips Unix-only cases.

`createPersistentAllianceProcess` composes the existing host, local control and
TLS transport. It defaults off and never prepares automatically. The explicit
closed-bootstrap mode accepts no application-opening callback and cannot be
promoted through local control. Preparation remains unavailable in that mode.
Only separately enabled generation mode can call the supplied application factory
after a matching local prepare command. That mode still uses the existing signed
startup and newer SERVE requirements; composition itself grants no permissions.
Shutdown closes local control, TLS and the application, without certifying remote
provider closure. Three Linux process tests use real TLS/Unix-socket requests for
default-off, unpromotable closed bootstrap and explicit preparation/closure. The
application fixture is fictional; real Auth/SQL/startup acceptance remains pending.

`alliance-member-fixed-proxy.candidate.toml` is an unconsumed configuration
candidate. It names one fixed HTTPS backend and only `/api/alliance-members/*`;
it excludes management paths and goes before the catch-all404 if later approved.
The active `netlify.toml`, public site and installed server remain unchanged.
This keeps the browser's existing site origin and account-cookie boundary, with
no cross-site sign-in or new browser interaction. Current keyboard/phone/zoom
acceptance is preserved; protected hosted member and assistive-technology checks
remain outstanding. No accessibility-conformance claim follows from these tests.
