# Federation Learn crypto evidence lessons

November 27, 2026

Add three public lessons to `/learn`. A newcomer should be able to use the lessons as checklists when reading a receipt, approving token permissions, or reviewing a project lock. Use the existing topic index, lesson layout, source links, and native question disclosures. Each practice question uses fictional data.

| Lesson | Practice outcome | Primary references |
| --- | --- | --- |
| Solana transaction receipts | Identify the failed 10 USDC transfer, the unchanged recipient balance, and the 0.000005 SOL fee in a fictional finalized receipt. Separate the outcome from confirmation status. | [Solana transaction records](https://solana.com/docs/rpc/http/gettransaction) · [Solana fees](https://solana.com/docs/core/fees) |
| Delegated spending | Spot a request authorizing up to 100 tokens for a 10-token deposit. Identify the token account, delegate and allowance. Understand what a completed revocation changes. | [Solana approve delegate](https://solana.com/docs/tokens/basics/approve-delegate) · [Solana revoke delegate](https://solana.com/docs/tokens/basics/revoke-delegate) · [Phantom connection guidance](https://help.phantom.com/articles/29995498642195) |
| Token lock records | Verify the recorded asset, funded amount, release dates and permissions. In the fictional example, one 40,000-token lock leaves the status of the other 60,000 tokens unknown. | [Streamflow token lock FAQ](https://docs.streamflow.finance/en/articles/9670511-token-lock-faq) · [Streamflow vesting settings](https://docs.streamflow.finance/en/articles/9670413-create-a-vesting-contract) |

Acceptance requires a matched topic link, focusable article, named heading, readable exercise, and source links for each lesson. The lessons work with JavaScript disabled and use the existing public routes and site assets. The public build changes only `learn.html`.
