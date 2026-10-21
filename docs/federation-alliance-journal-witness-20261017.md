# Alliance journal witness source candidate

October 17, 2026. Draft only; disabled, unmounted and unapplied. No real signing
key, independent journal project, cloud access or public feature was created.

## Purpose and data flow

`createJournalWitness` connects the direct-PG journal store to the existing
fresh-challenge Ed25519 reader. A caller supplies only a 32-byte lowercase-hex
challenge. The producer reads the actual store tip, verifies the complete ordered
hash chain and its configured/previously observed minimum, constructs the scoped
witness itself, calls an injected signing capability, verifies the signature
against the pinned public key, and rereads the tip before returning private bytes.
There is no API for a caller to choose a tip, timestamp, epoch or signing key.

The producer makes at most three store calls and one signer call in 3.5 seconds.
It admits one request with no queue or retry. Any failure after work starts latches
that instance closed, including cancellation, changed tip or unknown late signer
completion. Reconciliation and construction of a new instance are explicit
integration responsibilities. Invalid/pre-cancelled requests do no work. Closing
the producer cancels its attempt; it does not close externally owned dependencies.

## Guarantees and limits

The complete chain is bounded to 256 records/256 KiB. The witness is under 2 KiB
and contains no profile/image intent records. Paused or full journals remain
readable. A producer remembers observed history in memory and refuses rollback,
same-height fork, a higher tip that does not extend its floor, malformed history,
wrong signatures and tip movement during signing. The signer receives copied
canonical bytes; its returned signature must verify against the original bytes.

The last read detects movement during this operation; it cannot prove that no
append happens after that read. This is not a globally latest or linearizable
serving decision. In-memory high-water is lost at process restart. An independently
persisted authenticated startup floor outside the member backup, protected real
signer custody and project/epoch binding are still required. No KMS/provider,
network transport, signer rate control, cloud cost or key rotation was selected.

A witness is evidence for the reader's deny-only review. Neither a signature nor
`not_listed` grants image access or proves physical erasure. Deletion intent must
be committed before member deletion, and startup/restore/serving interlocks must
be connected before activation. Direct candidate deletion paths still need that
routing. No retention, replay horizon, purge or backup-deletion policy is adopted.

## Verification and accessible recovery

Unit checks use ephemeral Ed25519 keys held only in test memory. The disposable
TLS fixture connects the real SQL store through this producer and the reader,
then simulates a control-tip rollback. That simulation is not a full restore,
power-loss, independent-host or provider-durability test. Hosted acceptance still
requires a separate reviewed permission/cost/backup decision.

No interface is changed. The eventual page must expose a clear text unavailable
state and a user-controlled retry after reconciliation, retain keyboard focus,
announce completion/errors to assistive technology without a countdown task,
and never fall back to a stale image when verification fails. Real screen-reader,
mobile and full member-journey checks remain release gates.

The signature mechanism uses Node's documented Ed25519 key/sign/verify interfaces:
[Node crypto](https://nodejs.org/api/crypto.html). An injected capability is an
interface boundary, not proof that a future key service is secure or available.
