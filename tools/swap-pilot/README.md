# Galactic Swap — Jupiter-managed pilot

Owner approved October 30: use Jupiter's maintained interface, fix GFOF on one
side and permit Jupiter's broader selection on the other. This selection is not
Alliance membership or Federation endorsement. SOL is the initial other token.

## Implemented and checked

`index.html`, `page.mjs`, `provider.mjs` and `style.css` form a standalone pilot.
Copy only these four files to an isolated preview's static directory. The normal
site build excludes all `tools/` files, including this pilot; no production route,
CSP, auth setting, wallet integration or Federation fee is changed.

The panel loads the official `https://plugin.jup.ag/plugin-v1.js` only after a
button click. Jupiter owns token selection, wallet connection, order construction,
wallet signing prompts and submission. `autoConnect:false`; no wallet passthrough,
Federation account linkage, private key handling or referral settings. The existing
custom offline transaction-review tools are not in this managed execution path
and are no longer its launch prerequisite. They confer no authorization here.

Five focused tests cover configuration, result/error handling, initialization and
loader behavior with a stub provider, including asynchronous init failure. Seven existing packaging tests passed.
Browser check loaded the real provider panel with SOL input and locked GFOF output;
no wallet connection, entered amount, signature or trade. Jupiter displayed token
warnings for GFOF; their contents were not established during the layout check.
Do not hide or override provider risk warnings.

Result callbacks are provider reports, not independently verified settlement or
fee revenue. A syntactically usable transaction ID links to Solscan; uncertain
results direct the user to check wallet activity before retrying.

## Remaining acceptance before public release

1. Publish ONLY to a separately protected preview origin with no Federation
   account sessions or secrets. Review actual provider network requirements and
   headers there. This source change authorizes no deployment/access changes.
2. Owner checks a supported desktop and mobile wallet, including connection,
   cancellation/rejection and display of minimum output/fees. An actual funded
   signing/trade test requires a separately approved amount and owner execution.
3. Inspect GFOF's provider warnings and route availability. Retain accurate
   warnings and don't infer bond/liquidity status from the token appearing.
4. Referral account/token-account ownership/setup and the intended 50 bps remain
   a separate activation task. No Federation fee is configured in this pilot.
5. Exact release approval and public swap-page integration follow acceptance.

The official loader URL is mutable: this is the provider-maintained distribution,
not a locally audited or integrity-pinned bundle. Its script executes in the pilot
origin. Accepting that dependency is part of the managed integration choice;
production needs isolation/header review and a defined update/rollback process.
Do not load it into the signed-in Alliance dashboard while validating the pilot.

Primary references:
- https://developers.jup.ag/docs/tool-kits/plugin/index
- https://developers.jup.ag/docs/tool-kits/plugin/customization
- https://developers.jup.ag/docs/tool-kits/plugin/html-app-example
- https://developers.jup.ag/docs/tool-kits/plugin/faq
