# Community recovery and startup candidate

Private invitations and contributions add five tables that the existing profile-only checkpoint does not cover. This source introduces an explicit combined checkpoint and archive format rather than treating an old member backup as complete. Everything remains default off and unmounted; these functions cannot install a schema, capture a provider database, restore SQL or enable a service.

## Combined checkpoint and read-only comparison

`communityCheckpoint` accepts only format3: the exact member and journal scope, epoch, freeze ID, capture time, complete member9/journal3 inventories and the community5 inventory. Canonical field/table order and a separate hash domain bind every count and digest. Format2 checkpoints and missing/reordered community coverage are refused. A table's hash always describes its actual rows; no synthetic combined hash is substituted for a real table hash.

`createAllianceCommunityRecoveryReview` reads community inventory, invokes the existing full member/journal comparison and canonical deletion-prefix/floor check, then reads community inventory again. Changed snapshots or checkpoint mismatches keep access closed. Scope, freeze and known-floor failures are rejected before a lookup. The operator must still establish actual quiescence and independently authenticated provenance; matching reads do not prove a globally atomic snapshot or protect against the trusted administrator.

## Current serving permission

`createAllianceCommunityStartupGate` uses the combined digest in the existing challenge-bound signed startup protocol. It prepares only after signed review, the complete inventory comparison and a second matching fresh decision. Only a separate, higher-revision signed serve state can supply `authorizeCommunity`. Closure, cancellation, stale/replayed decisions, changed bindings or unavailable evidence retire that instance. Preparation is one-shot; reopening requires deliberate fresh construction, never an automatic retry.

This factory exposes `authorizeCommunity`, not the profile-only `authorize`. The old gate refuses format3 and cannot satisfy the community service's capability requirement. The reviewed combined application must explicitly share the appropriate permission with profile operations; the existing profile-only application is not silently upgraded or enabled by this change. Signing exchanges still require the actual trusted deployment scope and bounded signing-runtime invocation.

## Encrypted package format

`createAllianceCommunityRecoveryPackage` uses plaintext manifest format2 with nine ordered components: member-data, community-data, journal-data, control-data, schema-security, auth, storage, signing-recovery and deployment. Its complete canonical format3 checkpoint is inside the encrypted payload and must match the checkpoint digest, project scope, epoch, freeze ID and capture ordering. Missing community-data or an old eight-component package is refused. Legacy readers also refuse the new format; there is no fallback that drops the extra records.

Both formats reuse the existing bounded byte packaging, per-component/checksum validation, fixed recipient/trust/generation checks, cancellation and buffer cleanup. The external opaque descriptor remains format1 because it describes ciphertext identity/size/hash rather than the decrypted schema. Existing1MiB component/4MiB aggregate/6MiB plaintext/8MiB ciphertext limits are unchanged. No key, secret store, path, credential or provider is looked up by either factory. Successful decryption returns verified bytes with access closed; it executes nothing.

## Evidence and remaining work

Focused source checks include same-count changes in every community table, malformed/legacy scope and inventory, canonical ordering, concurrent snapshot change, late cancellation, signed review/serve/withdrawal, and missing or mixed archive components. The existing profile-only recovery/package tests remain unchanged and passing.

The disposable managed-role three-database TLS fixture checks the new gate against actual member9/community5/journal3 inventories and real acknowledged deletion history, with separate signed review, serve and closure. Community tables are empty in that composed startup fixture. A separate byte fixture uses actual age encryption/decryption for all nine synthetic components and proves legacy-reader refusal.

The community workflow fixture additionally captures actual nonempty member9/community5 data-only PostgreSQL archives, with exact TABLE DATA object lists and closed, stable row inventories. Real age encryption and a fresh byte-only process recover the exact archives from a separately copied, hash-checked ciphertext after removing the primary copy and clearing original export buffers. A different empty PostgreSQL cluster receives those fourteen tables through transactional restores. Changed archives, cross-component receipts, occupied targets and missing profile dependencies refuse; the missing-dependency attempt leaves no partial community rows. Fresh restricted TLS clients then check original hiding, invitation replay, contributions and acknowledgements, make a new contribution, and verify that separately retained synthetic signed deletion evidence still withholds an old record.

This is a disposable synthetic-data test, not a production exporter or complete coordinated recovery. Canonical schema/security is rebuilt from source, Auth dependencies are seeded, and the other seven package components, signing/control framing and service permission are explicit stand-ins. Local fixture superuser restore does not prove managed administrator restore permissions. The encrypted copy stays on the same host, its identity is ephemeral, and the original source remains available and quiescent. No off-device custody, key recovery, service recovery time, complete Auth/Storage/journal/control restoration or running backup service is established.

Before activation, capture complete SQL and dependent-object archives, recover them into isolated replacement domains, compare all restored inventories and independent deletion/current-authority evidence, and exercise the ordinary account/community journey. Bind the new gate into the actual authenticated dashboard transport and complete operating, privacy, abuse, runtime/key custody, assistive-device, dependency-security and publication acceptance. No completed hosted foundation or executor connection test needs repeating.

Accessibility: recovery and startup are operator/server paths with no new member prompt, time pressure, polling, media or wallet interaction. Keep the eventual member interface's explicit status, cancellation and draft/reconciliation controls. Server and encryption tests establish no keyboard, screen-reader, mobile or WCAG acceptance.
