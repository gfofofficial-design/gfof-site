# Alliance pinned authority configuration candidate

Source only, October 18, 2026. This extends the
[live removal anchor](federation-alliance-live-removal-anchor-20261018.md).
No real key, hosted configuration, login, schema, route or public feature changes.
The public-record consumer and replacement-review helper are implemented;
independent custody, real signing providers and full encrypted recovery are not.

## One explicit public configuration

`allianceTrustRecordBytes` produces a fixed-order UTF-8 JSON record ending with
one newline. `allianceTrustRecord` requires its exact SHA-256, exact three distinct
project references and epoch, and a minimum generation supplied independently by
the deployment operator. It accepts at most 4 KiB. Missing input, changed bytes,
duplicate JSON keys, different field order, hidden fields, BOMs, malformed UTF-8,
wrong scope or stale generation refuse; there is no database/genesis fallback.

The format-1 record contains only: scope; generation and predecessor digest;
reviewed control revision/digest/floor; latest copied removal sequence/hash; and
two different 32-byte hexadecimal Ed25519 public verification keys. The control
floor cannot exceed the removal minimum or disagree at the same sequence. There
are no private keys, passwords, tokens, member records, image bytes or provider
endpoints. The record is public-key configuration, not permission to publish
operational project identifiers. Treat its release context separately.

The SHA-256 is an integrity pin, **not a signature or proof of recency**. Its value
and minimum generation must come from protected custody outside the restored
databases/archive. Copying all three from the same old archive defeats this check.
A timestamp, filename, new signature or higher sequence alone cannot discover
forgotten history. This source does not install a protected store or update pins.

## Startup and witness use the same pins

`createPinnedAllianceAuthorities` is disabled by default and requires literal
`enabled: true`. It constructs the anchored control authority, paired-recovery
startup gate and anchored deletion witness with the record's keys and minimums.
The returned startup gate still requires one fresh review, actual paired inventory
checks, another matching review, and a separate higher-revision release. An old
serve policy never authorizes a new boot. The witness remains a fresh denial
check, not account authorization or permission to return an image.

Every independent anchor read verifies that the current canonical journal chain
contains the external removal minimum. This includes control decisions: a higher
sequence on a different chain cannot authorize startup. Checks run before and
after signing through the existing bounded factories. New process construction
does not clear the externally supplied floor. Missing/older/forked history,
uncertain reads, cancellations or failed signatures withhold results. Extra full
chain reads are bounded by the existing 256-record/256-KiB finite test limits;
their latency/cost and production capacity need hosted acceptance. No polling,
background update, retry, database write or policy transition is added.

Two injected signer handles each expose only `publicKey` and `signBytes`. Their
declared keys must match the record's distinct purposes. The underlying producers
verify each returned signature against the correct public key before using it.
Swapped or mislabeled signers cannot produce an accepted result. The module
receives no private-key bytes and performs no file, clipboard, environment or
provider lookup. A trusted signer implementation may still hold/export a key;
this interface does not establish hardware-backed or non-exportable custody.

Database transports remain explicitly injected trusted capabilities. Construct
them using the existing fixed TLS/hostname/role/grant/COMMIT adapters and the same
reviewed project scope. This consumer cannot prove an arbitrary injected object
represents the actual independent database. Existing session checks, live deny
checks and response withholding remain mandatory; startup approval is not cached
access permission. Closing the composition closes its three in-memory producers,
not their externally owned pools, the entire fleet or a cloud key.

## Explicit successor review

`reviewAllianceTrustSuccessor` accepts the exact old/new records and their digests,
requires generation +1 and the exact predecessor digest, preserves the scope,
rejects lower control revisions or a different digest at the same revision, and
verifies one full canonical chain extends every old/new floor. It refuses swapping
a former control key into the journal role or vice versa. Independent replacement
keys or unchanged keys with an advanced floor are allowed.

This is a pure review aid. It does not authorize the new digest, acquire records,
prove the control-policy transition history, test real key custody, install a key,
save a pin, revoke an old key or modify a running consumer. A reviewed new pin
must be installed through a separately authorized deployment; the new composition
requires matching replacement handles. Old processes/consumers may still trust
old keys until explicitly stopped/replaced. There is no overlap key list or
automatic acceptance of a record signed by the old key.

## Practical custody and recovery steps still required

1. Select and review two real signing implementations, one per purpose. Do not
   reuse a wallet key, Google OAuth secret or age backup-decryption key. Define who
   can use/export/revoke each key, its hosting cost and the recovery route. No new
   account, provider, privilege or spending is authorized by this source.
2. Establish protected custody for the expected public-record digest and minimum
   generation, plus an independent latest control/journal copy. Specify updates
   relative to removal acknowledgements and the outage/loss policy. This record
   protects only through its copied minimum, not later forgotten acknowledgements.
3. Verify actual signer possession privately, recover its encrypted copy on an
   isolated system, and match only public fingerprints. Keep secret generation,
   transfer and recovery out of AI-readable files, chat and tool output.
4. Review a complete encrypted recovery manifest for member9/journal3/control2
   tables, schema/roles/RLS, Auth, Storage bytes, keys and protected minimums.
   Restore into isolated domains, compare current protected pins, obtain a new
   review/release and test real denied/allowed account flows. Missing latest trust
   remains closed; do not reconstruct it from member data or reset to genesis.
5. For rotation, stop/fence the old serving fleet, review the successor and canonical
   prefix, install independently pinned new verification keys/handles, perform a
   new startup review and release, verify consumers, then retire old key access.
   Fleet fencing, hosted activation and destructive retirement need their exact
   decisions and evidence; none is performed here.

Operator setup should present one clearly named task at a time, support native
keyboard/screen-reader controls and password-manager paste, and keep private
confirmation separate from public fingerprints. Avoid countdown pressure,
transcription puzzles and repeated secret entry. No user interface changed here;
these source tests do not establish assistive-technology or WCAG acceptance.

## Verification and limits

Synthetic tests exercise exact configuration, separate keys, coherent rollback,
higher forked history, cancellations/late work, source mutation, explicit successor
review, no silent pin update, and actual cryptographic startup/witness protocols.
The three-domain disposable TLS fixture composes actual restricted adapters and
paired recovery, produces a signed journal witness, restarts the control database,
reviews a successor against actual history, requires new digest/keys, refuses
reusing a serve approval, and simulates coherent journal/anchor rollback beneath
the protected later minimum. Keys are ephemeral synthetic test keys in memory.

No real custody, power-loss/global administrator independence, physical erasure,
continuous latest-copy protection or full encrypted disaster-recovery proof is
claimed. Account removal, retention/privacy/capacity, fixed HTTP/Auth/browser/fleet
acceptance, Google warning clearance, assistive/mobile and publication remain
release gates. Real key creation/access and hosted rollout require concrete review.

The implementation uses existing Node JWK public-key import and Ed25519
`sign(null, ...)` / `verify(null, ...)` conventions; no new crypto dependency or
Node26-only context/raw-key feature is required. See
[Node crypto documentation](https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptoverifyalgorithm-data-key-signature-callback).
