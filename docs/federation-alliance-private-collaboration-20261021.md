# Alliance private collaboration candidate

This default-off server candidate saves a private invitation and its contributions beyond a browser tab. The sender and recipient share one published brief, the recipient chooses whether to accept, and only the other participant can acknowledge a contribution. These acknowledgements are peer feedback, not independently verified evidence, official project representation, League points or a public competition result.

The existing page and tab-only preview are unchanged. No HTTP route, Auth adapter or production startup permission mounts this candidate. The profile-only serving gate cannot enable it.

## Member journey and access

1. A signed-in member chooses a listed, visible member and one of the existing eight formats. A cross-community invitation also requires two different, nonempty self-described community names; it confers no authority over either project.
2. The recipient accepts or declines the fixed brief; the sender can cancel an unanswered invitation. Acceptance starts the chosen 3, 7, 14 or 30-day window. Reads identify expired work, and SQL refuses contributions after the window. No background worker or countdown is required.
3. Either participant contributes a short explanation while the collaboration is active. Only the other participant may acknowledge or decline it. Reaching the agreed goal completes this private record.
4. Explicit hide/show is reversible and idempotent. A hide prevents interaction in both directions without notifying the other person. Unlisting stops new incoming invitations while preserving existing conversations and the member's choice to invite someone else.

Commands carry a unique operation ID and expected revision. Exact replay returns the same revision; a changed request is refused. If another change has advanced the record, the caller receives a conflict instead of overwriting it. An uncertain write is withheld and closes that service instance; it must be reconciled explicitly, never resubmitted automatically.

## Architecture and privacy

`verified Auth context → community-aware serving permission → current SQL-session/profile binding → independent signed deletion review → restricted community store → second deletion/session/permission review → private DTO`.

The source consists of a shared strict DTO contract, an unmounted service, a parameterized PostgreSQL adapter and five private tables. Fixed source-generated function fingerprints, role identity, TLS, table and column ACLs, forced RLS and cascade keys are checked around each transaction. Runtime calls use the existing restricted member executor, never an administrator. The existing provider administrator remains trusted and can manage/read the database; these controls do not isolate data from that administrator.

Only the two participants receive the invitation or contribution text. Operation receipts retain IDs, hashes and revision numbers rather than cached text. Removing either profile cascades the collaboration, its contributions, receipts and hide pairs. This also removes the other participant's access to that conversation. Independent deletion evidence suppresses records restored from an older backup. Profile removal is distinct from deleting the sign-in account and does not immediately erase backups.

Finite candidate limits are 128 invitations, 512 contributions, 1,024 accepted mutations and 256 active hide pairs across the candidate deployment. Each participant can submit at most the goal plus three contributions per collaboration. Counters are not refunded when rows are removed. These are bounded pilot design limits, not adopted public policy, abuse controls or a hosting-wide cost cap. Operating limits and a usable response when capacity is exhausted require review before release.

## Disabled installation

`managedCommunityExtensionSql()` builds an atomic, unapplied extension for the existing empty, closed managed member foundation. It adds the private `alliance_community` schema, five tables, nine fixed functions, five executor entry points and one persistent owner `REFERENCES(id)` grant on `public.alliance_profiles`. No new role, password, login, signup, sending identity or service mode is created or enabled.

The existing administrator receives a temporary owner SET grant only during installation. Final verification rejects privilege drift, unexpected data or changed Auth counts and removes that temporary grant before commit. Failure rolls back new objects and grants. `managedCommunityClosedInspectionSql()` independently checks the closed inventory and rolls back its temporary access even on success. Neither builder connects to a database. Hosted application requires its own reviewed owner decision and baseline/backup evidence.

## Recovery and activation gate

The existing format-2 member checkpoint does **not** inventory these five tables. `alliance_community.recovery_inventory()` supplies a separate complete, closed count/hash inventory with no row contents. It is not an encrypted archive, restore proof or accepted startup checkpoint.

Before serving, extend the coordinated recovery package, restore comparison and signed startup/serving authority to bind both member and community inventories. The service explicitly requires `authorizeCommunity`; the existing profile-only `authorize` is insufficient. An injected fictional permission in a disposable test does not satisfy that production requirement. Browser/account transport, consent/error/reconciliation controls, operating/abuse limits and a combined real-hosted journey also remain integration work. No activation decision is requested by this source candidate.

## Accessibility decisions

Reuse familiar buttons, labelled text fields and the existing brief choices. Acceptance, contribution and acknowledgement must be separate actions with a readable outcome; do not encode their meaning only in color, a score or an icon. Keep brief text and status available to assistive technology, announce concise updates without moving focus, and preserve a user's draft after conflicts or interrupted requests. Offer explicit refresh/comparison instead of automatic retries. Hide and unlist need clear, distinct explanations.

Pagination is bounded to five records per request, text is short, and the service performs no automatic polling, media upload or wallet action. These choices reduce bandwidth and interaction load. The server deadline bounds stalled work rather than requiring a person to respond within seconds. Before mounting, verify keyboard, screen-reader, zoom/reflow, touch and interrupted-connection behavior on the actual combined dashboard. Database and unit tests establish no WCAG conformance or device acceptance.

## Verification scope

The disposable managed-role PostgreSQL/TLS journey exercises the real store and service with fictional accounts and synthetic signed deletion evidence. It covers atomic install/refusal and inspection cleanup, recipient consent, concurrent revision conflict across two connections, contribution/peer review, private pagination, unlisting/hiding, accepted-window expiry, revoked SQL sessions, fresh-connection persistence, permission drift refusal, signed deletion withholding, complete inventory and profile cascade. Unit tests cover malformed/forged commands and DTOs, closed defaults, authority withdrawal and late cancellation. The existing native CI path includes this journey on PostgreSQL 17.11; actual current-head results must be checked separately.

No hosted object, login, data, mode, cloud permission, mail delivery or public page is changed by these tests. Full release still requires successful mandatory dependency security checks and the existing runtime, custody, account/mail, recovery/privacy, operating, assistive-device and publication gates.
