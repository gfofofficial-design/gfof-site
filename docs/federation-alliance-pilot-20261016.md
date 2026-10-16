# Federation Alliance — first community station interface

Review-only implementation based on production `ca7ee973274c90651a2a175d869fa7ab298b4728`.
This is a static, read-only program interface, not an account release or a live
financial service. No external partnership is announced by this build.

## Included

- `/alliance` introduces the proposed community program and a working GFOF host
  station using the already published current mint from Treasury.
- A station directory, native selector, search and empty-result recovery select
  only source-reviewed entries. Unknown URL station values fall back to the host.
- Links open the existing public wallet viewer, Dossier with the selected mint,
  a fictional mission and the station's published evidence. The Alliance does not
  fetch balances, prices, chain data or reports itself.
- The Command Deck has a navigation anchor and a program entry linking here.
- Cyan/gold orbital artwork uses CSS and the existing Federation seal. The network
  drawing is illustrative; the host and partner counts describe published entries.
- Shared progress, leaderboards and Watchtower coverage remain labelled as future
  work. Local mission progress does not become verified community participation.

## Prospects and agreement

Owner-selected prospects remain in the owner's conversation. They are not in
the public registry, interface, metadata or this note. Do not infer a project or
contract address from a ticker alone, and do not publish its branding or announce
a relationship before agreement. No outreach or other external message is sent
by this implementation.

The public partner array is empty. All assets and JavaScript are downloadable:
never add a prospect, private agreement, personal contact or secret to a hidden
entry. Publication checks reduce accidental display; they do not hide source.

Before adding a station, retain the agreement privately and confirm:

1. Which project and authorized representative are agreeing; exact chain/mint,
   official website and independent official-channel confirmation.
2. Permission for the name, logo, links and description, and approval of the final
   station page and relationship wording.
3. The agreed service scope, responsibilities, any fees, disclosure wording and
   process for correction, pause or removal.
4. Public evidence links, source dates and coverage limits. A partner's own
   disclosure must not silently become a Federation-verified on-chain finding.
5. Owner publication approval recorded under an opaque `ALLIANCE-...` reference.
   Only the non-sensitive reference and date belong in the public registry.

Add the approved entry through a reviewed code change. The registry requires
confirmed consent and identity, publication approval, a calendar date, bounded
plain-text fields, a 32-byte base58 address and HTTPS links. Duplicate slugs,
missing approval fields or invalid entries stay out of the displayed directory.
These fields are operator attestations, not independent proof of consent or mint
ownership. The current UI has no partner administrator or self-service intake.

## Boundaries

No credentials, account tables, provider configuration, data budgets, schedules,
wallet permissions, signing, trading, staking, lending, monitoring or rewards
are introduced. The selector stores no preference and calls no API. Selecting a
station shares only its public slug in the URL and establishes no membership or
wallet ownership. Navigating to another service is separate and subject to its
published data handling. External links have opener/referrer protections.

The Alliance has a same-origin script/style/image policy and `connect-src 'none'`,
no frames, forms or workers, and remains noindex during this pilot build. The
static fallback exposes the host links if JavaScript is unavailable. This is not
an alternate sign-in location and does not resolve the flagged account preview.

Future project service fees need an agreed scope and must be disclosed. Dossier
analysis remains independent. Listing is not a safety rating, investment advice,
ownership stake, reward promise or permission to administer Federation services.

## Validation and release

Run `node --test tests/federation-alliance.test.mjs` for approval filtering,
duplicate/invalid identities, link boundaries, query handling, search recovery,
selection updates and absence of network/storage work during initialization.
Run the existing deck fixtures for the additive dashboard entry. Header/redirect
and relevant wallet workflows must pass on the review head. Inspect static
markup, references and the ready preview without invoking data services.

This workspace is a partial source staging folder. Never upload it as a whole
site. Use the reviewed Git tree and the existing Netlify repository integration.
Production merge and any actual partner announcement are separate owner decisions.

Local validation: all 14 Alliance checks and 37 existing deck fixtures pass
(51 total, zero failures or skips). The UI fixture binds to IDs in the actual
HTML and rejects duplicate IDs. The static check confirms unique IDs, valid
fragment targets, no inline handlers/styles, a valid TOML route/header block and
no prospect names in the new public interface, registry or note. Internal links
resolve against the production tree or this patch. Browser visual/phone review
remains an owner check because the connected browser runtime is unavailable.
