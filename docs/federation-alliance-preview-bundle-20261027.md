# Owned connections for the finite member preview

`createManagedAlliancePreviewBundle` supplies the `application` and `close`
contract required by the existing finite preview host. It constructs the complete
profile, collaboration, ideas, private-report and owner-review application from
the existing restricted database and signing adapters. It defaults off and adds
no Function, route, secret loader, database installation or serving transition.

The reviewed host passes explicit configuration, three purpose-bound encrypted
database connections, a caller-key reader and an owned media factory. The factory
derives the Auth URL from the member project, uses the same three-project scope
for the anchor and authority transport, and shares the pinned verification keys
between the application and its signed transport. Production identities/origins
refuse; existing Netlify checks still require the actual trusted handler context.
The [Netlify Functions API](https://docs.netlify.com/build/functions/api/)
documents the handler's separate Request and Context arguments.

The member connection supplies four separate restricted pools for the profile,
collaboration, feedback and review stores. The independent journal executor and
Control anchor writer supply two more pools. All use the existing managed-role,
TLS and identity checks; roles, SQL grants and transaction limits are unchanged.
The AWS authority continues to use its own separate reader credentials. This
bundle does not create, find, install or enable any of those credentials.

Enabled construction requires an explicit `readCallerSecret` callback, so it
cannot fall back to an ambient signing secret. No key is read and no Auth,
authority or SQL request is made merely to assemble the bundle. The existing
adapters perform their checks when an explicitly prepared application later runs.
`openPool`, `transport` and `fetcher` retain their existing explicit test/runtime
injection interfaces; a deployment must supply reviewed real implementations.

`openMedia({signal})` transfers ownership of a `{processor, storage, close}`
bundle. Its close operation must retire every media handle it created. Existing
text-member routes do not admit image uploads. This increment does not implement
or enable an image service; the native text journey's media objects refuse images.

Construction failure or cancellation closes all already-owned components. A late
media result is retired without constructing the application. Closing either the
returned application or the bundle first retires the application, then starts
shutdown of all dependencies; repeated closes share the same completion. Driver
errors never escape the fixed bundle error. Shutdown completion is a local
lifecycle result, not independent proof that a provider ended remote sessions.

Use this factory only inside the existing finite host's explicit
`openApplication({signal})` operation. The finite host supplies the reviewed
preview identity, immutable UTC window, admission budget and expiry handling.
The bundle itself does not establish a fleet-wide limit or expire database/cloud
permissions. Preparation remains an explicit closed operation; a separate current
serving decision is still required before member Auth/data work.

Focused tests cover disabled construction, exact purpose binding, the real
adapter graph while closed, partial failure, application rejection and late
cancellation. The existing three-database managed/TLS journey now uses this
factory for its complete member-to-owner path. Its Auth and AWS responses and
keys remain fictional; actual hosted account/provider acceptance is separate.

No browser controls or markup change. Existing keyboard, focus, status and
private-response behavior remain in the application; this server increment does
not establish a new mobile, assistive-technology or WCAG acceptance result.

Before a hosted trial, review the exact source/deploy identity, retained trust
minimum, caller custody, credential versions, TLS roots, reviewer binding,
serving transition, request/cost bounds, ingress and independent cleanup. No
release, permission expansion or owner-secret step follows from this source.
