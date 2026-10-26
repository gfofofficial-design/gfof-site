# Galactic Swap — approved fee direction, collection still closed

Owner instruction on 2026-10-26: continue with the recommended 0.50% fee design.
This approves source preparation, not a particular wallet, on-chain account creation,
a signature, funds movement or live transaction execution. No fee has been enabled.

## Economics and current provider constraints

Use 50 basis points as the proposed integrator fee. Jupiter documents a 20% share
of integrator fees on its `/order` path and no separate base platform fee when
referral fees are active. Expected Federation share before operating costs/tax is
therefore equivalent to 40 basis points of the relevant fee basis. This is not a
promise of net profit or a dollar price. Pool fees, network fees, rent, and any
additional provider charges must be reviewed and disclosed separately.

Source checked 2026-10-26:
https://developers.jup.ag/docs/swap/order-and-execute
The documented referral range is 50–255 bps. Jupiter selects the fee mint. Missing
referral token accounts can lead to swaps without the intended integrator fee.
Top-level feeBps can include additional charges. Do not assume every route will
match a 50-bps total or silently accept a larger rate.

## Prepared source

`tools/swap-review/fee-review.mjs` is an offline metadata review helper, excluded
from static output and not imported by the live page. It requires explicit public
owner/referral/fee-token-account bindings, copies them, checks the fixed SOL/GFOF
pair, the returned referral account, fee mint and exact 50-bps rate, and refuses
mismatches. Every result keeps tradeAllowed and collectionConfirmed false.

Address syntax validation is not proof of ownership, account type, mint authority,
referral initialization or entitlement to fees. Matching quote metadata is not
transaction validation or evidence of a fee transfer. Do not use this helper as
a signing gate by itself or change its fixed false states to activate a service.

## Next owner input and Dev work

1. Owner has selected the public receiving wallet; its exact address is retained
   in the private continuity receipt. Verify control on Dev before account setup.
   Do not request another wallet selection or any private key in chat.
2. Reconcile any existing Jupiter referral account before creating one. Verify
   the referral program, account owner and partner/recipient, and corresponding
   fee-token accounts on-chain. Review exact fees/rent before an owner-signed
   initialization or claim. Keep receiving-wallet signing keys off the website.
3. Pin the reviewed public account addresses. Verify the fee mint actually
   returned for both directions. Stop for review if an expected fee account is
   missing; never auto-create it or add a substitute recipient.
4. Build and review transaction decoding, instruction/program/account binding,
   spend/output limits, fee destination/amount caps, blockhash lifetime, lookup
   tables and simulation. Test malicious extra transfers/authority changes,
   stale quotes, late prompts, rejection, pending transactions and uncertain
   outcomes. Do not automatically resubmit a transaction after uncertainty.
5. Show an accurate final fee/cost/output review before each user signature.
   Check signed message bytes match the reviewed transaction. Independently
   verify confirmation and actual fee receipts in separately approved small
   owner buy/sell tests. Test the claims/withdrawal process separately.
6. Finish mobile wallet flow, dependency/security review, operating limits,
   incident shutdown and commercial terms/disclosures before a trading release.

The public quote preview remains unchanged and charges no Federation fee.
Existing successful phone quote display does not prove any item in steps 2–6.
