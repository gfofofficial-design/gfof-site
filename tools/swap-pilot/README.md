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


## Accepted pilot progress — October 30

The isolated preview is deployed at
https://deploy-preview-181--gfof.netlify.app/ . Netlify deploy
`6ae4919fea488c57e38ff6e8` serves commit
`0dcd854ea16050b0e34df00e638762bee272eb64` from preview-only PR181.
The later PR181 commit `32ab906a5b7e39be53d375383a7ee908ff9a09f7`
changes CI scope only and was marked to skip Netlify; it does not change the
served pilot. The temporary PR181 root configuration must not be merged.

Verified via connected Netlify/browser review: deploy-preview context, no
functions or edge functions, six-file static build, team-protection gate and
private badge, then Jupiter panel with GFOF locked and wallet disconnected.
The dedicated managed-pilot, static-output and stations CI checks passed.
The legacy public quote-site workflow is explicitly skipped only for this
isolated harness branch; that configuration is not serving the quote-only site.
Production remained deploy `6ae3397d7ecdd326770140d6`, source
`4238bee2c9e64bf91bf2b59f365230659f1c0e28` at the verification point.

Owner accepted the layout and reported the requested connection/disconnect check
worked. This is owner-reported acceptance on one tested device; the wallet name
and a separate desktop/mobile matrix were not recorded. No financial transaction
was requested or observed. Do not repeat this passed connection check as if it
were still entirely untested; confirm additional devices only where needed.

Owner's screenshot identified the two JupShield warnings as Not verified and Low
organic activity. Keep them visible. Verification is a separate identity/listing
process, not proof of safety or a prerequisite imposed by this implementation.
Jupiter's FAQ says unverified tokens can trade when integrated pools have
sufficient liquidity: https://verified.jup.ag/faq . GFOF's description was missing
in its verification record; website, X and Telegram matched the public site.
No verification approval or removal of either warning has been established.

The next financial acceptance is one owner-executed trade only after an explicit
spending limit (including fees) is selected. No such limit or transaction is yet
authorized. Until that acceptance, do not claim quote-to-settlement success or
open public trading. Referral fees remain unconfigured. A production hosting
and isolation decision, exact release configuration and release approval remain.
The custom decoder work is parked unless a specific managed-flow defect makes
it necessary; avoid expanding it instead of completing the user journey.
