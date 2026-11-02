# Alliance subscriptions — implementation handoff
Updated November 2, 2026. Design preparation only; billing and access enforcement OFF.

## Owner decisions
Operator: Welks 8 LLC. Owner handles legal review.
Products release independently after their own acceptance.
90-day owner-invited project beta; no beta start date recorded.
After beta: individual member USD 8.88/month; project USD 29.99/month.
Both paid plans include all released subscription tools, linked to authenticated dashboard identity. No tool-by-tool tiers approved. Unreleased tools are not entitlements.
100,000 GFOF TOTAL must be maintained by each project, not each member.
Project holdings remain in project-controlled wallets; no deposit/staking requirement.
Receipts or wallet connection must establish current holdings and authorized control.
Below-threshold project: contact team and offer restoration; no deadline or automatic penalty approved.
Token admission requires full project/tokenomics and route/liquidity/security review; payment and membership never bypass it.
Further chain scope follows beta results.
Current public read-only tools remain as currently released; no public-tool paywall is authorized by this preparation.

## Integration boundary
Use the existing Federation account ID as the member principal. Associate project subscription with a stable project ID and authorized project administrators, not an email string or wallet address.
Billing identity is distinct from wallet identity. Wallet connection cannot establish account sign-in or project authority.
Use existing hosted member admission and maintenance controls. Active billing is necessary for paid access after activation, never sufficient to bypass closed service, account/role checks or safety gates.
Use server-verified provider subscription state. Never grant access from return URLs, query parameters, local storage, client plan labels, screenshots or receipts supplied by the browser.
No new billing provider selected or credentials created. Source only, no hosted integration.

## Minimal records (logical fields; reconcile actual schema on Dev)
Plan: code member/project, currency USD, monthly amount in minor units 888/2999, version, enabled=false.
Subscription: internal ID, subject type and ID, provider customer/subscription references, plan version, verified state, paid-through timestamp, cancellation-at-period-end flag, last applied provider-event identity.
Project verification: project ID, designated wallet(s) subject to final aggregation decision, proof method, verification time/chain/slot, qualifying raw token quantity, control evidence, reviewer, next review and contact status.
Do not put card data, seed phrases, private keys, raw identity documents or full webhook payloads into ordinary logs.
Operator override/complimentary access is not approved; do not add an automatic bypass.

## Recommended billing lifecycle — review before activation
States: inactive, checkout_pending, active, cancel_scheduled, payment_issue, ended.
1. Signed-in user chooses plan; server checks correct account/project authority and creates hosted checkout with fixed server-side plan/price.
2. Checkout return says payment is being verified. Only authenticated, signature-verified provider events or reconciled provider reads can grant a bounded paid-through entitlement.
3. Apply each event idempotently. Resolve out-of-order/conflicting events by current verified provider state; no client-controlled timestamp or old event can extend access.
4. Verify subscription on each protected request using bounded server-side state. Uncertain, expired or disabled subscription does not enable paid tools; public navigation/help remain reachable.
5. Recommended cancellation: authorized account/project administrator can stop renewal; access continues through verified paid-through time. Show end date and retain confirmation. Do not treat cancellation as a request to delete data.
6. Failed renewal: show payment issue and a provider-managed billing link. Any access grace period needs owner approval; do not invent one.
7. Refund/dispute reversals: reconcile current provider state; keep audit history. Refund policy remains to be defined; do not promise refunds or silently issue one.
8. Account/project ownership changes must not silently transfer billing authority. Project member-seat coverage is unresolved; no unlimited seats or double-billing assumptions.
9. Maintenance closure overrides paid entitlement and must remain explained. Do not sell a service that remains operationally closed.
10. Revenue display separates test receipts, gross fees/revenue, provider costs, refunds, claimable referral amounts and actual treasury receipts. Never infer treasury income from trade volume or provider success callbacks.

## Dashboard flow (no new live controls yet)
Signed out -> existing account sign-in -> correct member/project context.
Subscription panel: plan, exact monthly price, included released tools, current state, renewal/end date, billing/cancellation help.
Available tools: all released tools allowed by identity/role and current operating state. A project plan does not grant owner/reviewer authority.
Unavailable tool: specific reason (not released, service maintenance, no subscription, permission missing), next step/help, no dead-end button.
Project panel: separate subscription, project holdings, identity review and token listing statuses. Failure of one must not mislabel the others.
Cancel screen: plain-language effective date and confirmation; support route for failure. Exact provider implementation awaits selection.

## Minimum acceptance before billing activation
- Successful payment grants only correct subject and plan; return URL alone grants nothing.
- Forged signature, replay and stale events cannot grant/extend access.
- Cross-account/project access and unauthorized billing management refused.
- Price/plan cannot be changed by client; monthly amounts exactly 888 and 2999 USD cents.
- Cancellation and verified expiry update tool access as documented; payment uncertainty fails closed for paid tools.
- Project token threshold is never checked for individual plan.
- Valid payment never bypasses project/token review or member maintenance closure.
- Real hosted sign-in, logout, ordinary-member and project-admin journeys accepted; appropriate mobile/keyboard check.
- Public tools and signed-out help retain published behavior.
Use a provider sandbox first; any real payment needs a specific bounded owner decision. No automatic test charge.

## Still needing owner decision later
Project seats: number included and whether a project seat also needs an individual subscription.
Beta clock: common cohort start/end versus per-project; do not start it from a page visit.
Billing provider, payment methods, sales tax handling, renewal authorization, refund policy, failed-payment grace and cancellation terms.
Holdings: single designated project wallet versus aggregate project-controlled wallets; cadence and proof acceptance; response deadline.
These do not require another general architecture. Complete existing hosted member acceptance and recover tested Swap source first.

## Retained release evidence
PR187 frontend head 1ea6f6d; runtime PR185 head1512cc8 and PR186 head3af4c87 remain unmerged candidates, not installed-source assertions.
Operating backups/hourly alerts/cleanup restored per Nov2 Dev handoff. Next normal Nov3 1am CST backup not yet verified.
Independent/same-PC restore results accepted; do not repeat.
Separate Swap tx 45TFDBRyNydSbgaFCZL6QEofhnMzji6gJwBwtwo9uKPRzHSLF8c1PjMWuWF9xJoY4Qjf5PaWwViB89SeeSqY1s6s finalized; 658917.268117 GFOF received, 0.0005 wrapped SOL gross referral credit. Claim/payout not established.
Fee candidate origin fee-review--galactic-swap-review-20261101.netlify.app; exact tested source still needs Dev reconciliation. No further trade needed.
Earlier Blockaid approval names PR181 origin only. Separate fee-origin warning unresolved. Owner has response draft; sending not verified.
