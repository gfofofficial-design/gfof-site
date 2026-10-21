# Account preview production synchronization — October 16, 2026

PR #99 was based on production commit `7cd97e7106a69fa6c91105c3f4ffd20ee75389d9`. Production subsequently advanced by seven commits to `16aac1aebe01b715aa77e8361674395dfda8cf9e`, including the approved public Federation Alliance pilot.

This preview-only merge brings those production changes into the account review branch without discarding its account work. The overlapping files are `command-deck.html` and `netlify.toml`; both merge cleanly using their exact common ancestor. The deck receives the already released Alliance navigation and entry section. The account configuration remains intact, with only the approved static Alliance route and headers appended. All other incoming production files use their existing Git blobs.

The Google account handler, bounded provider reader, account page, account script/styles and official Google artwork are not modified by this synchronization. There is no provider configuration, credential action, registration opening, public account release or change to account capabilities. External partner stations remain empty; the owner is handling prospective partner outreach separately.

## Validation and limits

- All six overlapping-file merge inputs match their expected Git blob hashes.
- Both three-way merges completed without conflict.
- Python's TOML parser confirms all pre-existing account configuration values and ordered route/header entries are preserved; only the approved Alliance route/header entries are added.
- All 14 existing Alliance tests pass in the merged static fixture, with no failures, cancellations or skips.
- The full resulting tree is checked against the previous account tree and production additions before the branch is advanced. Hosted checks and passive static preview results are recorded on PR #99 for the exact resulting head.
- The staging folder is partial source; it must never be uploaded as a deploy. The existing Git integration builds the review preview.

The latest owner-provided Search Console evidence still reports a Deceptive pages issue. No new Google verdict was obtained here, and the cause remains undetermined. This synchronization does not establish clearance. Real sign-in/cookie/phone acceptance remains paused, and PR #99 stays draft. Operating recovery, deletion, abuse and registration requirements also remain release gates. No live Auth, wallet, price or RPC service call is needed for this work.
