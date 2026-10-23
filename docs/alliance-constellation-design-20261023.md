# Alliance constellation design

Approved direction: a project-centered community map, with a project logo at each cluster center and an optional member-selected image inside each member bubble. Participation is the default view. Holdings are an optional, separate view and never grant membership, rank, rewards or voting power.

## Included preview

`/alliance-constellation-preview.html` is a browser-only design demonstration. GFOF is the host concept; the other three crews, all people, contributions, token amounts and activity are fictional. The preview has no account integration, wallet connector, balance provider, membership writes or persistent storage. It is linked from the draft member page, not the production homepage or dashboard.

The original owner-private design is available separately. This source copy prepares integration into the existing Alliance experience; merging it into the member candidate does not open the member service.

Supported interactions:

- Filter by team, search members, select a profile, zoom and browse a keyboard-accessible member list.
- Compare equal-sized community bubbles with bounded sizes for one selected token's shared sample units. Different tokens are not compared as equivalent value. Range disclosures use a common band rather than encode a hidden exact amount through size.
- Add, move or hide the sample “You” profile. Appearing on the map and sharing a token amount require separate choices, both initially off.
- Choose a PNG, JPEG or WebP image up to 2 MB. The browser validates the file signature, decodes the image, makes a centered circular display from a normalized 256px square and uses a local blob URL. The image is not uploaded. Initials are the fallback. Reload clears the sample profile and chosen image.
- Hide shared holdings without removing the member's place in the community. Reset returns to the equal-size sample view.

The preview retains the existing Alliance policy: scripts and styles come from the site, image sources are self or browser blobs, and outbound connections are disabled. It does not add external image URLs or a new CSP permission.

## What live integration needs

The current profile contract has `name`, `community`, `bio`, `role` and `listed`. `community` is free text, not a project membership or an owner-verified project identity. Directory listing is not consent to this map or to wallet disclosure. Do not infer any of those permissions from the existing fields.

Before real people appear, the service needs an explicit project registry, reviewed project-owner logo updates, confirmed team affiliations, independent map visibility consent, and member image authorization. Membership in multiple teams should refer to one member identity rather than create separate accounts. A primary team is optional; no transaction relationship should be implied by a connection line.

Map access must follow the intended audience of the member service. Being signed in must not make private map records public. An authorized projection should include only the display fields needed for the selected view, never email, session identifiers, storage credentials, raw wallet signatures or undisclosed balances.

For optional wallet-backed holdings, a separate reviewed flow must verify wallet control with a narrowly scoped, expiring signed message and no transaction or spending request. Wallet control is not proof of every asset a person owns. Members choose the tokens, exact amounts or ranges, and whether a public address is shown. Explain that a linked public address may reveal other public activity. No wallet address should be disclosed by default.

Each displayed holding needs a token identity, explicit sharing permission, source/verification state and observation time. Stale, failed, revoked or uncertain observations must not appear as current verified balances. Ranges must be projected before data reaches the browser; hiding the displayed number while sending its exact value would not preserve privacy. Live holdings data must not be fetched for people who have not opted in.

Project membership revocation, unlisting, map withdrawal, moderation holds, image removal, profile removal and account deletion must suppress the applicable map fields promptly. Clear selected profiles, cached projections, browser blobs and image access when access is lost. Do not treat a UI-only hide as server-side revocation or promise physical erasure from retained backups or public blockchains.

Member images require authenticated ownership, bounded formats and sizes, server-side decoding/normalization, metadata stripping, moderation/reporting, and controlled image delivery. The local demo file picker does not implement that service. Project logos require project-owner approval; an ordinary member cannot replace a whole team's logo.

## Release boundary

Keep real membership, wallet verification and hosted image operations disconnected until their service contracts, access controls and recovery behavior have been implemented and accepted. Test consent withdrawal, cross-team access, unlisting, image replacement/removal, stale balances, logout and recovery suppression before opening a real member map. This preview is not evidence of those capabilities.
