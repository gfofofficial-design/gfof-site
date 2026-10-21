# Alliance request intake and challenge publication

The user approved routing explicit project requests to gfofofficial@gmail.com.
The worksheet still prepares a local draft first. Only the separate Send request
to GFOF form submits the prepared proposal, reply email, consent and honeypot to
Netlify Forms. Artwork is excluded. No SMTP/API secret enters browser code.

Form name: alliance-project-request. Required notification: email to the owner
GFOF inbox on verified submissions for this form only. Subject includes Netlify's
submission ID. Form detection must be enabled; a successful source build alone
is not registration, inbox delivery or admission acceptance. Native browser POST
uses same-origin form-action; connect-src remains none. Member profile meta CSP
still prohibits form actions and no member write is enabled.

Netlify records are the initial private intake queue. Treat every claim and
reply address as unverified. Read the Spam queue when a legitimate submission is
missing; do not disable filtering or automatically approve submissions. The
confirmation page is not an inbox delivery receipt. No public status lookup or
self-service challenge publishing is implemented by this change.

## Operator workflow

1. Received: open the Netlify record and preserve its private submission ID in
   the correspondence. Do not publish the reply email or intake record.
2. Reviewing: confirm official project identity and authorized representatives
   through independently established channels. Reply to the supplied email only
   as request follow-up; a self-described community is not authority.
3. Rules agreed: retain the proposed deliverable, eligibility, deadlines/time
   zone, entry limits, permitted tools/rights, rubric, reviewer conflicts,
   moderation, ties, corrections and dispute rules. Record any separately
   approved/funded prize terms; no prize is assumed.
4. Both teams accepted: retain explicit acceptance by each authorized project
   representative. A request, notification, email delivery or website visit is
   not acceptance.
5. Published: prepare a public challenge page/card with a stable public ID,
   approved project identities, final rules and dates. Review the exact source
   change and deployment before publication. Public copy must accurately reflect
   whether enrollment/submission services are actually ready.
6. Active and judging: use an authenticated durable submission/review service.
   The current local sandbox cannot supply live participant records or scores.
7. Results/closed: publish reviewed scores and explanations, disclosed recusals,
   corrections and permitted recognition. Preserve the private operating record
   separately from public results and handle withdrawal/deletion requests across
   both intake and email copies.

These are operating stages, not custom statuses already present in Netlify's
Forms UI. Until a private admin tracker exists, use the intake record plus the
owner's request correspondence. The member dashboard does not yet expose these
stages. A future portal needs server-enforced representative roles, immutable
accepted rules/version, audit events, transition permissions, conflict handling,
moderation, notifications and public/private data separation. It must not let
anyone turn a submitted proposal directly into a public match.

## Activation acceptance

Verify form registration/fields and form-specific notification settings on the
preview. Submit one clearly labelled synthetic owner test, confirm a captured
record and matching inbox notification, and test reply-email/privacy boundaries.
A successful POST alone is insufficient to claim email delivery. No main merge
or production deployment follows from adding this source.
