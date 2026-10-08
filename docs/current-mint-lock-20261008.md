# Current-mint GFOF lock — October 8, 2026

The owner supplied the Streamflow contract URL. A read-only finalized Solana
`getMultipleAccounts` request retrieved its metadata, escrow and current mint
together at slot **454546355**. The account bytes were decoded against the
official Streamflow SDK layout, not the page title or a token symbol.

## Verified observation

- Metadata: `AiRhuw9iFyXiZYv2hqanBK12dckebF4vNMoAzj9Nj9nY`.
- Program owner: `strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m`.
- Metadata version: 4; account length: 1104 bytes.
- Mint: `Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV`.
- Sender and recipient: `DqtrauD2dDNB2v38cG9xVsDYxjwT1hwVV6aGRLwsPcd6`.
- Escrow: `F1iUer7wVsdv7uQ4if77Jy1ZAfTVDjSy4Pd7ZiXsVfS1`.
- Scheduled principal: `30000000000000` base units at six decimals:
  **30,000,000 GFOF**.
- Mint supply: `1000000000000000` base units: **1,000,000,000 GFOF**.
  Scheduled principal is **3%** of that observed minted supply.
- Escrow balance: `30150000000000` base units: **30,150,000 GFOF**.
  The 150,000 excess is not counted as scheduled principal.
- Created: October 8, 2026, 07:30:45 America/Chicago.
- Start, cliff and end: October 1, 2027, 00:00:00 America/Chicago
  (`1822366800`, 05:00 UTC).
- Full cliff amount equals the scheduled deposit; withdrawn amount is zero;
  canceled timestamp is zero.
- Sender/recipient cancellation and transfer, top-up, pause and rate-update flags
  are all false. The contract name is empty.
- Mint and freeze authorities are null in the observed mint account.

The recipient is also the address previously disclosed as W-006. That match does
not establish the purpose of this new allocation. Do not label it development,
marketing, staking funding or replacement distribution without a current owner
designation and any applicable recorded approvals.

## Publication behavior and limits

The treasury review adds a dated new-mint card above the historical records,
links the three-account RPC snapshot and shows the full-cliff date and permissions.
It counts 30M, not the full 30.15M escrow balance. The existing four former-mint
live reads and their total remain historical and are not combined with the new
mint. OpenGraph/social descriptions reflect this distinction.

This snapshot proves observed account data, not present-day continuous status,
beneficial ownership, a provider audit, immutable program code or verified upgrade
authority. This is not a staking pool or an authorized reward allocation.
No transaction was submitted, no wallet connected and no funds or authority moved.
The supplied UI link could not be retrieved by web search; verification used
direct Solana RPC and the official SDK source instead.

## Sources and review checks

- [User-supplied contract](https://app.streamflow.finance/contract/solana/mainnet/AiRhuw9iFyXiZYv2hqanBK12dckebF4vNMoAzj9Nj9nY).
- RPC: `https://api.mainnet-beta.solana.com`, method `getMultipleAccounts`,
  `encoding: jsonParsed`, `commitment: finalized`; response in
  [source snapshot](../record/current-mint-lock-20261008.json).
- [Official stream layout](https://github.com/streamflow-finance/js-sdk/blob/master/packages/stream/solana/layout.ts).
- [Official unlock calculation](https://github.com/streamflow-finance/js-sdk/blob/master/packages/stream/solana/contractUtils.ts).

Confirm the stored bytes, mint/escrow relationship, exact integer principal and
supply, schedule and flags against the SDK. Check that the card says snapshot,
the legacy total is unchanged, verification links and fragment IDs resolve, and
inline scripts are byte-identical to main. Re-read the contract before a future
production release if its present status is being claimed. This review does not
merge or deploy production.
