# Wallet address preview acceptance — PR #158

Status: source tests only; no hosted or real-wallet acceptance recorded. Trading stays disabled. This is separate from Alliance member access and the dashboard release gates.

## Protected-preview prerequisite

Deploy only the reviewed PR head to an access-protected preview after owner approval. Preserve existing site protection. Do not merge or deploy production for this test. The production hostname must not be used as proof that the draft exists there.

## Owner steps — browser only, no funds required

1. Open the protected `/swap` page in a desktop browser with your usual installed Solana wallet. Quote checking must work without Federation sign-in or a wallet connection. Trading must be disabled.
2. Under Optional wallet address preview, explicitly choose your installed wallet and choose Connect to display address. Confirm the hostname in your wallet. A connection permission prompt is expected; a signature, transaction, seed phrase or key request is a failed test. Reject anything unexpected.
3. Confirm the displayed address matches the wallet account you chose. Do not send the address or a wallet screenshot to chat; report match or mismatch only.
4. Check a quote manually. No wallet approval or signature should appear. Trading must remain disabled.
5. Change the wallet account. The displayed address and any quote must clear. Use Disconnect wallet before a fresh explicit connection.
6. Choose Disconnect wallet. The address must clear. If the wallet cannot confirm disconnect, the page must describe uncertainty instead of claiming success. Remove the preview from trusted apps in wallet settings if you want to revoke saved permission.
7. Reject a connection prompt. There must be no displayed address or trade. The preview currently requires prompt closure and reload after an uncertain connection; this is intentional.
8. Switch tabs or reload while a prompt is open. A late approval must not restore an address automatically. Close the wallet prompt and revoke permission before testing a fresh session.
9. In a browser without a compatible wallet, the page must explain that none was found while manual quotes remain usable. Do not install an extension solely for this test. Mobile wallet handoff is not implemented.

Record only browser/device, preview commit, step results and nonsecret error text. No real trades, signatures, emails, recovery trials or Alliance access changes are part of this acceptance.

## Outstanding after this check

Transaction decoding and validation, signing integration, mobile flow, transaction-cost review, and separately authorized bounded owner trade acceptance remain future work. Passing address-preview acceptance is not permission to open trading.
