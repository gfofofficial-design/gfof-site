# Galactic Swap growth boundaries

Source candidate, October30. Only Solana mainnet/Jupiter quote checking is registered. No new chain, token, bridge, provider origin, wallet permission, trading or fee collection is activated.

The browser catalog separates chain adapters, asset identity and directed provider routes. Chain adapters validate address/reference rules; provider adapters build requests for explicitly declared chains. Current Solana amounts retain the u64 maximum. Shared integer-only decimal conversion supports0–36decimal places with a caller-supplied atomic maximum; future chains must specify their own limits, not inherit Solana assumptions. Tokens are identified by chain plus canonical native/contract/mint reference rather than ticker. Reused symbols can label different identities; duplicate canonical identities and registry IDs refuse.

Research, quote and trade metadata are distinct. A token entry alone adds no pair. Explicit route entries must name a registered provider and compatible chain. Neither trade flags nor matching catalog metadata expose any execution method; executionEnabled remains false. Chains/provider modules are registered locally from reviewed source, never fetched from a token feed, wallet, URL or runtime import address. Caller mutation cannot replace a captured provider registration or asset binding.

## Add a token on an implemented chain

Follow TOKEN_LISTING_20261029.md to verify official identity, precision, token program/extensions, logo consent and proposed routes. Add the reviewed token and only the directed quote pairs actually supported. The native selectors are generated from the registry; there is no second JavaScript option list to maintain. Static HTML retains the initial three-token fallback but does not enable unregistered requests. Update the static fallback/copy where appropriate for publication, tests and source evidence. Existing public SOL/GFOF/USDC behavior is retained.

## Add a chain or provider

Implement the chain-specific address and amount rules and register the adapter under an explicit stable versioned ID. Build a provider adapter whose supported chain IDs match. Test routing, identity collisions, precision/overflow, errors, stale results and privacy before enabling quote capability. Do not send an EVM contract to a Solana endpoint or infer that equal tickers on two chains are interchangeable. Supply chain-specific explorer/research links and UI labels before exposing that chain: the current visible page still deliberately says Solana and uses Solana links.

For execution, independently implement each chain's instruction/calldata review, recipient/fee binding, wallet/network matching, simulation, expiry, signature integrity, submission and uncertainty/confirmation behavior. The present offline v0/SPL checker is Solana-specific; it is not a reusable EVM/Bitcoin validator. Chain adapters do not make those security controls optional. Provider changes cannot bypass them.

Cross-chain routes deliberately refuse in this catalog version. Future bridge adapters need separate source/destination identities, custody/trust and fee disclosure, multi-step status, timeout/refund/recovery and acceptance. No generic bridge forwarding or arbitrary remote router is supplied as a shortcut. This is an extension boundary, not a claim all chains are supported.

Current user choice: grow reviewed token support as Alliance projects join; preserve no-wallet public quote browsing and independent research. No requirement to decide every future chain today. Decide provider costs, enabled chains, supported token extensions and bounded wallet tests only when a concrete adapter is ready for review.
