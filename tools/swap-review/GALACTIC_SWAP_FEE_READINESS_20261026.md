## November 2 clarification — managed Plugin is the selected execution path

This draft's helper is historical, offline `/order` metadata preparation. The
current selected execution path is Jupiter Plugin; the helper is not imported by
that Plugin and is not its signing gate. Do not rebuild the custom transaction
decoder or change the helper's fixed false results to activate Plugin fees.
The retained implementation instructions below apply to the older custom path,
not as new prerequisites for the managed integration.

Source review: production-source checkpoint
`9b3acc6cee2c8877f9b6f8efa4faa1e82837b163` and isolated PR181 candidate
`e6b1d89c8e0a8bad6c164e6dd43312769fa14c3c` both retain a provider module without
`referralAccount` or `referralFee` in Plugin formProps. This establishes no
Federation fee configuration in those source files. It does not prove that no
referral accounts or separately retained Dev fee candidate exist. PR181 remains
a preview harness that must not merge into production; source state is not proof
of the currently deployed preview.

### Smallest next managed-fee increment

First reconcile the exact existing Dev fee candidate and its nonsecret receipt.
Do not duplicate setup or ask the owner to choose the receiving wallet again.
Before adding any fee settings, retain the reviewed public referral-account
address, actual program/project and recipient binding, relevant fee mint and
referral-token-account identities, and the exact candidate artifact/configuration.
A receiving wallet alone is not a referral account. No private key belongs in
this source or a web page.

Jupiter Plugin documents `formProps.referralAccount` and `referralFee`.
Its FAQ requires referral and fee-token accounts. The current `/order`
documentation shows 50 basis points as 0.50%, describes Jupiter's 20% integrator
share and warns that a missing fee-token account may fall back to a swap without
the integrator fee. Those API documents do not independently establish what a
particular Plugin request charged, what the wallet displayed, or what arrived.

For the exact managed candidate, verify:
1. The configured account, fee basis/rate and fee mint match reviewed bindings.
   Do not silently substitute a recipient, auto-create token accounts or raise a
   rate to accommodate an unexpected provider charge.
2. Displayed user costs and minimum output remain understandable. Total
   `feeBps` can include additional charges; it is not automatically equivalent
   to the Federation's referral rate.
3. The known review warning is resolved for the exact configuration before any
   separately approved owner-run funded check. Domain classification, token
   verification and fee/transaction acceptance are different evidence.
4. A bounded receipt demonstrates the actual fee transfer, recipient, asset,
   amount, provider share and any claim/access requirements. A callback, matching
   metadata or projected 40-bps equivalent is not reconciled revenue.
5. The accepted source/origin and production isolation/disable plan are reviewed
   before release. Existing account sessions and signing material must not be
   passed into the provider interface by accident.

New token support requires the relevant fee-mint/account and route evidence.
Do not treat a token catalog entry, Alliance membership or a different chain
adapter as permission to create accounts, charge fees or execute transactions.
This note creates no setup, signing, spending, testing or activation authority.

Primary references rechecked November 2, 2026:
- https://developers.jup.ag/docs/tool-kits/plugin/customization
- https://developers.jup.ag/docs/tool-kits/plugin/faq
- https://developers.jup.ag/docs/swap/order-and-execute

### Retained October 26 custom-path preparation — historical scope

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
