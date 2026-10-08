# Current-mint GFOF locks — October 8, 2026

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

The treasury review adds three dated new-mint cards above the historical records,
links the joint RPC snapshot and shows each full-cliff date and permissions.
It counts scheduled principal (30M, 30M and 40M), excluding escrow excess. The existing four former-mint
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

## Second contract and joint re-read

A finalized five-account `getMultipleAccounts` read at slot **454549782**
checked both metadata accounts, both escrows and the mint together. Both
scheduled allocations remain 30,000,000 GFOF, with zero withdrawn amounts and
zero cancellation timestamps. Their combined scheduled principal is
**60,000,000 GFOF, 6% of the observed 1,000,000,000 minted supply**.
The first contract’s schedule and permissions above were reconfirmed.
The original three-account evidence is preserved; the public cards now link
[the joint source snapshot](../record/current-mint-locks-joint-20261008.json).
Response account order: first metadata, first escrow, second metadata, second
escrow, shared mint.

- [Second contract](https://app.streamflow.finance/contract/solana/mainnet/BW6ZUUT5NXxSGMKNAzoMYbqrXy5Dm1ev1ekEgYSXJWX8):
  `BW6ZUUT5NXxSGMKNAzoMYbqrXy5Dm1ev1ekEgYSXJWX8`.
- Program owner, metadata version and account length match the first contract.
- Mint: `Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV`.
- Sender and recipient: `8RZvY4oNGNY9fHKaZmr65BEumxfaM4ECXgVKJPQvZc7`.
- Escrow: `9NeQZao9SNt7FztKbNMCwCmEYZTYkWnidZmW4chuupQq`.
- Scheduled principal and full cliff: `30000000000000` base units.
- Escrow balance: `30150000000000` base units; only 30M counted.
- Created: October 8, 2026, 07:45:37 America/Chicago.
- Start, cliff and end: August 18, 2027, midnight America/Chicago
  (`1818565200`, 05:00 UTC).
- Cancellation/transfer for both parties, top-ups, pause and rate updates disabled.
- No current allocation purpose is assigned from a wallet address match.

The two cards are dated observations, not a new live-fetch feature. Their total
excludes escrow excess and the former mint’s historical contracts. Existing
scripts remain byte-identical to the first review commit. Exact mint, escrow,
principal, supply, schedule and permission assertions passed on the joint read.
Visual preview and production release remain pending.

## Third contract and latest joint re-read

A finalized seven-account read at slot **454550404** rechecked all three metadata
accounts, all three escrows and the shared mint together. The second-contract
60M total above describes the earlier two-contract snapshot. The latest total is
**100,000,000 GFOF scheduled, 10% of the observed one-billion minted supply**.
The public cards now link [the three-lock snapshot](../record/current-mint-locks-three-20261008.json).
Account order: lock 01 metadata, escrow; lock 02 metadata, escrow; lock 03 metadata,
escrow; mint. Earlier source snapshots remain available.

- [Third contract](https://app.streamflow.finance/contract/solana/mainnet/EPdpg7AYEzcwudN7TRdEkCGHQeHRrFhoK2yiYxDdGLnv):
  `EPdpg7AYEzcwudN7TRdEkCGHQeHRrFhoK2yiYxDdGLnv`.
- Same verified program owner, metadata version 4 and 1104-byte length.
- Same current mint; six decimals; mint and freeze authorities remain null.
- Sender and recipient: `5U3uduBNhNtwTofNNdsS8bet4GuQmGXYnQoJ5t6cfM6u`.
- Escrow: `DkzEr7nsuhL4Ser6AyZQ71u2mBdGj86mXmHDAzpS1Pop`.
- Scheduled principal and full cliff: `40000000000000` base units = **40M GFOF**.
- Escrow balance: `40200000000000` base units = 40.2M; only 40M counted.
- Created: October 8, 2026, 07:52:17 America/Chicago.
- Start, cliff and end: **October 18, 2028, midnight America/Chicago** (05:00 UTC).
- Withdrawn amount and cancellation timestamp zero. Both-party cancellation and
  transfer, top-up, pause and rate-update flags all disabled.
- No allocation purpose inferred. This lock is not evidence of staking funding.

All three remain full-cliff locks at the joint read. Former-mint totals remain
separate. Existing scripts are unchanged; visual preview remains pending.
