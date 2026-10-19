# Explicit session-pooler control connection candidate

Source-only and default-off, October19,2026. This adds no deployed setting,
credential, login, grant, bootstrap, root, route, account or billable add-on.

The control adapter originally accepts only a direct project database hostname.
Supabase documents direct connections as IPv6 unless the separate IPv4 add-on is
enabled. Its shared session pooler is an included IPv4 alternative. A development
computer's failed direct DNS lookup does not establish that the hostname is
globally absent or that every deployment host lacks IPv6. Do not buy an add-on or
silently change transports in response to that failure.

## Explicit configuration and unchanged checks

The new `connectionProfile: 'supabase-session'` is permitted only together with
the existing explicit `deploymentProfile: 'supabase-managed'`. Direct remains the
default, including its original raw database username and exact project hostname.
No automatic discovery, fallback, retry or live-learned host allowlist is added.

This candidate allows only the separately observed Ohio session host
`aws-0-us-east-2.pooler.supabase.com`, port5432/database postgres. Configuration still
contains only host/password/PEM CA. The client derives its username from its fixed
reader/anchor-writer role and the already validated control project ref:
`alliance_control_reader.<control-ref>` or
`alliance_control_anchor_writer.<control-ref>`. Arbitrary hosts, regions, ports,
URIs, users, operators and prequalified usernames are refused. Different pooler
hosts require a separately reviewed source change, not a guessed region string.

TLS still requires the supplied CA, exact selected-host servername, certificate
validation and TLS1.2 or newer. The adapter retains PostgreSQL SSL negotiation,
channel-binding preference, original connection/query/pool limits, fixed SQL,
three distinct project refs, no direct table access, exact backend actor/login,
managed grant/environment checks and post-COMMIT fresh checks. An actor reported
as a pooler-qualified username or administrator refuses before application SQL.
Post-COMMIT write drift remains unknown and destroys the connection; no retry or
direct-host fallback is allowed. Strict deployment mode is unchanged.

A pooler terminates the client TLS connection. The certificate authenticates the
shared pooler; project routing additionally trusts that service and the qualified
username/unique credential. The adapter's pg_stat_ssl query describes its backend
database session, not the same front-end TLS channel. Both the real backend role
mapping and backend TLS predicate must pass an actual approved authenticated test.
Enabling channel-binding preference is not proof that SCRAM-PLUS was negotiated.

## Evidence and limits

Eleven new tests cover exact connection construction, dangerous route/user/scope
refusals, explicit managed/default-off requirements, original budgets/TLS,
wrong backend identity, unknown writes/no fallback, and unchanged direct behavior.
They are configuration/protocol simulations, not a real Supavisor acceptance test.
Existing native direct managed tests remain relevant to their own route only.

A separate credential-free PostgreSQL SSLRequest/TLS1.3 handshake to the observed
session host validated against a retained, pinned public Supabase CA. It sent no
startup/authentication packet or SQL, so it proves reachable authenticated TLS to
that endpoint only. An earlier bundled-public-root probe failed TLS; there was
no insecure bypass. Neither this observation nor source tests prove database
authentication, project routing, session affinity, backend TLS, prepared-statement
behavior, latency at service deadlines, revocation or recovery on the pooler.

The locked managed roles retain provider-default database CONNECT/TEMP rights
and template-database CONNECT rights. Their NOLOGIN/password-free state remains
unchanged. A local default-off adapter and fixed database config do not erase
those credential capabilities. Inspect/decide actual cross-database rights before
a restricted login; do not revoke provider defaults or accept them silently.
The old synthetic schema-archive helper deliberately requires zero memberships
and is not a managed backup tool; do not relax it or claim recovery acceptance
because this connection profile exists.

No user interface changes or assistive-technology claim. An eventual operator
flow should offer a clear explicit connection choice, durable actionable errors,
password-manager support and no repeated secret or fingerprint transcription.
Public readers must not have to understand database transport options.

Primary source: [Supabase connection modes and IP versions](https://supabase.com/docs/guides/database/connecting-to-postgres).
Next: separately approved finite authenticated access/role-routing and cleanup
checks, followed by managed recovery, independent authority/custody/fleet and
public-release gates. No new purchase or password entry is required by this
completed source preparation.
