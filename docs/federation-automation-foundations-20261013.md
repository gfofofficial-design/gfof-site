# Automation review lab and offline foundations

The review page is /automation-lab.html, with no production navigation link. It displays explicitly fictional Watchtower and bot-permission records and reviewed hints for all 11 existing Passport mission IDs. It runs no model, RPC, notification, account or financial operation.

Implemented:
- Mission coach: three curated hint depths per existing mission. No scoring, badge writes, identity collection or progress sync.
- Watchtower replay: at most 100 normalized events, allowlisted kinds, bounded fields, signature/event-index deduplication, conflict refusal, finalized-only output and slot ordering. Confirmed duplicates can advance to finalized once. Raw provider adapters, authenticated ingestion, persistent deduplication and subscriptions are not implemented.
- Agent-record comparison: at most 20 declared permissions and 100 reported attempts, exact action/resource comparison, explicit unverified outcomes and unknown log coverage. It does not enforce a capability or certify authenticity; no FCC production record changes.
- Voss briefing and public-page checker are in the same review build.
- Dossier PR #64 contains the separate local Lens guide and six-capability integration sequence.

These foundations use reviewed templates, not generative AI. Model integration, provider adapters, record signatures, consent-based notifications and recurring monitoring remain later gates. Inputs are untrusted; source verification belongs outside these pure functions. Lab events are fabricated examples, not receipts to link to an explorer.

Synthetic tests cover finality upgrades, conflicting duplicates, ordering, metadata exclusion, exact resource scope, unsupported actions and all mission hints. Browser/mobile visual acceptance remains pending. The lab uses Federation tokens, same-origin modules, native controls, text nodes, a skip link, visible focus and a mobile layout. This is not full accessibility certification.
