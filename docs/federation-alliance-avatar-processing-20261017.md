# Alliance optional profile-image processing candidate

October 17, 2026. **Disabled, unmounted source only.** No upload route, bucket,
database change, member image or cloud credential is created by this work. The
existing Alliance page still uses its tab-only interaction preview.

## Member task and accessible behavior

A member should be able to add an optional profile image without making a photo
or precise cropping gesture a condition of joining. Text name, bio and project
information remain sufficient. Preserve the full image's aspect ratio, orient it
correctly and do not enlarge a small image. The future form must use a native
labelled file input, keyboard/touch operation, clear size/type instructions and a
polite status region. Failure or cancellation must preserve typed profile text,
offer continuing without an image and never restore a late image result.

This candidate processes bytes only; it mounts no UI. Physical phone, screen
reader, focus/reflow and slow-connection acceptance remain future checks. No WCAG
conformance claim follows from processor tests. When an avatar accompanies the
same member's visible name, use empty alternative text to avoid duplicate spoken
content; never make the avatar the only member identification.

## Architecture, data flow and privacy

The isolated package in `lib/alliance-avatar-runtime` pins Sharp 0.35.5 and its
resolved dependency integrity hashes. It is not installed by the root site build
or imported by a deployed function. Installation uses `--ignore-scripts` and
prebuilt platform packages; Windows and Linux native-codec tests run separately.

Future route composition must authenticate a live eligible account, authorize
only its own profile and **durably reserve processing/storage allowance before
starting a decoder**. The caller supplies a bounded byte buffer and exact MIME
type, never a filename, filesystem path or URL. A separate fixed child process
decodes and re-encodes in memory. Its environment is empty, inherited Node
preloads/inspectors are excluded, standard streams are ignored, and neither
source bytes nor parser errors are written to logs/files. Only the validated
fresh PNG may eventually enter private storage; discard the original.

The child separation is **not an operating-system security sandbox**. It runs
with the invoking user's permissions. Its 64 MiB V8 heap setting does not bound
native decoder memory. A future hosting decision must check process support,
native package bundling, memory/CPU limits and OS/container isolation. Passing
local/CI checks does not establish availability or isolation on Netlify.

## Limits and failure behavior

| Decision | Candidate behavior |
| --- | --- |
| Accepted source | Static PNG, JPEG or WebP; exact type/signature plus full native decode |
| Input | At most 2 MiB; maximum 4096 pixels on either side / 16,777,216 pixels |
| PNG structure | Bounded chunks, CRC checks, exact end, animation chunks refused |
| WebP structure | Exact RIFF length, bounded chunks; animation flags/chunks refused |
| Output | Fresh PNG, fits inside 256×256 without cropping/upscaling; at most 300 KiB |
| Metadata | Apply EXIF orientation first, then strip EXIF, ICC, XMP and IPTC; parent rejects descriptive/metadata chunks |
| Processing | One child per processor instance; no waiting queue; busy requests refuse |
| Deadline | Parent kills after 8 seconds; native encode timeout 4 seconds; caller may cancel |
| Child lifetime | No success until actual process exit; timeout/cancel keeps its slot busy until exit |
| Error | Fixed short status; no decoder diagnostics or input contents returned |

The caller must bound the upload stream **before allocating this input buffer**.
The 8-second deadline begins after bounded structural validation and child spawn;
it is a processing deadline, not an entire HTTP-request deadline. Aborting after
a future storage dispatch cannot prove rollback; operation reconciliation is
separate. Re-encoding is not a malware/safety verdict or content moderation.

The one-instance slot is not a distributed quota. Concurrent server instances,
direct storage/API access, account churn, abandoned uploads and repeated failures
still require durable per-account/global limits and retention/deletion controls.
No such hosted quota or storage policy is enabled by this package.

## Verification and next smallest slice

Tests use generated synthetic pixels only: actual PNG/JPEG/WebP decoding,
orientation/metadata stripping, transparency and aspect ratio, corrupt/oversized/
animated inputs, derivative shape/metadata refusal, cancellation, deadline,
worker crash, secret-free errors and slot lifetime. Separate native CI jobs cover
Windows and Ubuntu with Node 24. A package advisory check is dated evidence,
not a guarantee that the decoder is vulnerability-free.

Next prepare a private-storage ownership and quota contract with an explicit
replacement/delete state machine. Originals must never be public; random
owner-bound object keys, short authorized reads, quota reservation, failed-upload
cleanup and account deletion (including derivatives/backups) need review and
tests before any bucket/route activation. Real account/Google warning clearance
and the existing public-site release process remain independent gates.

## Primary references checked October 17

- [Sharp constructor and input limits](https://sharp.pixelplumbing.com/api-constructor/)
- [Sharp output and default metadata removal](https://sharp.pixelplumbing.com/api-output/)
- [Sharp security guidance](https://sharp.pixelplumbing.com/security/)
- [Sharp changelog](https://sharp.pixelplumbing.com/changelog/)

These are technology references, not permission to upload member data or adopt a
new hosted service.
