# Alliance encrypted byte-package candidate

Source only, October 18, 2026. This implements the bounded synthetic encryption
exercise from the [complete recovery plan](federation-alliance-complete-recovery-plan-20261018.md).
It is not a production backup/exporter, SQL restore tool, independent custody
service or full recovery proof. No real identity, member data, credential,
provider request, hosted setting, route or public feature is used or enabled.

## Package contract

The unmounted `createAllianceRecoveryPackage` is disabled by default. Enabled
construction requires exact three-domain scope/epoch, independently supplied
public trust-record SHA-256 and minimum generation, one native age recipient and
an explicit encryption or decryption capability. Export-only and recovery-only
processes can omit the opposite capability. There is no key/environment/file/
network/database lookup or automatic SQL execution in the module.

Eight fixed, ordered logical components are required: member data, journal data,
control data, schema/security, Auth, Storage, signing recovery and deployment.
Each has a nonempty byte count, SHA-256 and canonical base64 content inside the
encrypted payload. The public trust record is inside that payload too, with its
digest checked against the separately supplied pin. Exact package ID, UTC capture
time, source commit, freeze ID, checkpoint digest and recipient bind the manifest.
Unknown/duplicate/reordered/missing components or fields, malformed encodings,
changed bytes, wrong scope/pins/generation/recipient or mixed package identity
refuse. Canonical JSON rejects duplicate keys, reordered fields and trailing data.

Finite exercise limits are 1 MiB per component, 4 MiB aggregate component bytes,
6 MiB plaintext representation and 8 MiB ciphertext. These are not production
capacity/retention policies. Oversized content refuses; no truncated or partial
package is accepted. One operation runs at a time without a queue, with at most
15 seconds per operation. Cancellation/close/deadline failures discard results
and fault that instance closed; no automatic retry occurs. Late byte buffers are
cleared when they arrive. A failed attempt requires a new explicit instance.

`seal` passes the canonical plaintext only to the injected age encryptor and
returns `sealed`, `access: closed`, ciphertext and a minimal outer descriptor:
format, package ID, ciphertext size/hash. The descriptor contains no components,
project references, private identity or plaintext manifest. Sealed means the
trusted encryptor returned bounded age-format bytes, not that recovery was tested.
The export process does not need a private decryption key.

`open` requires a descriptor obtained from protected, reviewed provenance, checks
the ciphertext before calling its decryptor, then verifies every inner binding and
component hash. It returns `verified_bytes`, `access: closed`, metadata and copied
component buffers. It executes nothing, enables nothing, and has no database or
serving capability. The caller owns returned plaintext and must protect/clear it.

An age recipient is public: anyone knowing it can encrypt content. A descriptor
stored only alongside an attacker-replaceable ciphertext is not source authority.
Neither a checksum nor successful decryption proves who exported the data, its
recency, safe SQL, correct capture boundary or the truth/completeness of a component.
Do not derive expected trust from that same archive. Capture time/source commit
and declared component names are validated metadata, not independent observations.
The real exporter, protected catalog and semantic restore checks remain necessary.

## Real encryption exercise

The unit suite uses an explicitly labeled mock carrier to test this byte protocol;
that carrier is not encryption. A separate, guarded native fixture uses official
age1.3.2 and real X25519 age encryption on Windows and Linux. It generates two
synthetic identities only in memory, verifies the tools/version, and pipes private
identity input into age. It never writes a private identity or plaintext component
file, passes no secret as a command argument, and prints only fixed status lines.

The fixture verifies wrong-key refusal, authenticated refusal of changed/truncated
ciphertext even with a deliberately changed outer checksum, and refusal of an
invalid inner component hash inside otherwise valid age encryption. It copies the
ciphertext to a second directory, checks its hash, removes the primary file and
clears the original identity buffer. A fresh Node process receives the separately
retained synthetic identity privately through stdin, decrypts only the second copy
and reports exact component hashes with access still closed. Mixed descriptors
refuse before decryption; a missing copy cannot pass. Exact scratch/tool/ciphertext
cleanup is checked.

The identity's retained copy is in fixture process memory, and both directories
are on the same computer. This is process-restart/separate-copy evidence, **not
off-device storage, independently saved Bitwarden key recovery or provider/admin
independence**. Components contain explicit synthetic markers, not actual database
dumps, managed Auth/Storage records or signing keys. Existing actual database
archive/restore tests are separate; they are not yet joined to this encryption path.

Application byte buffers are cleared on completion/failure where possible.
JavaScript strings, garbage collection, OS/process memory, swap and a trusted
provider's internal copies prevent a secure-erasure guarantee. Cancellation can
discard a late result but cannot undo external side effects from an uncooperative
capability. The fixture's child processes are bounded and support cancellation;
production providers must be reviewed separately and receive no write authority
unnecessarily. Caller-owned pools/providers are not shut down by module close.

## Test-tool provenance

Existing Windows test binaries are matched against fixed known hashes. CI fetches
only the official versioned archive for its platform, at most 40 MiB within 30
seconds, verifies the pinned archive SHA-256 before extraction/execution, and
extracts only age and age-keygen. Temporary tools are removed afterward. No plugin,
installer, account or persistent global tool installation is used.

| Official release asset | SHA-256 |
| --- | --- |
| age-v1.3.2-windows-amd64.zip | `f48d8f8f9ebe903ab5027ed067652f2cc1db94bc206976430133b905dcd8e8c7` |
| age-v1.3.2-linux-amd64.tar.gz | `cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10` |

Hashes checked against the publisher's release-asset metadata October18, 2026;
they are an integrity pin to those published artifacts, not an independent audit
or reproducible-build proof. See the [official age1.3.2 release](https://github.com/FiloSottile/age/releases/tag/v1.3.2)
and [age public-recipient usage](https://github.com/FiloSottile/age#usage).

## Next acceptance

Connect the guarded actual member9/journal3/control2 archives and reviewed security
exports to the package; verify their semantic recovery after decrypting a separate
copy. Add real managed Auth/session/deletion and Storage-byte checks, protected
current minima/provenance, independent decryption/signing custody and fleet fencing.
The real key, off-device destination, access, costs, retention/cadence and hosted
test targets need their exact reviewed decisions. No running backup is claimed.

No user interface changed. Future owner steps should name one precise vault item
and purpose, allow password-manager paste, use familiar keyboard/screen-reader
controls and provide clear status without repeated transcription, countdown
pressure, color-only meaning or automatic destructive repair. Native source tests
establish no browser/mobile/assistive-technology or WCAG acceptance.
