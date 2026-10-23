# Gateway nonce storage candidate

October 19, 2026. Source-only continuation of the owner-approved authenticated
gateway direction. Default off; no mounted route, AWS call, table, IAM policy,
real credential, key, environment change or public registration is activated.

## Implemented capability

`createDynamoGatewayNonceStore` supplies the gateway's required `claim` capability
and explicit `close`. It requires one exact account/US Region/table name/TableId,
custody epoch and caller-key fingerprint. Only a dedicated `alliance-account-nonce-`
table is accepted, never the authority root table. An explicit temporary
credential provider is mandatory. The adapter has no environment/default-chain
lookup and accepts no long-lived AWS key or missing session token/expiry. Real
execution-role issuer and session compatibility still require acceptance.

Every claim validates one caller key, 128-bit lowercase-hex nonce, body digest and
integer expiry with 1–61 seconds remaining. The gateway derives that expiry from
the already verified signed timestamp; a browser never supplies it to this
capability. Inputs are copied before asynchronous work. The partition key is
`keyId#nonce`. The custody epoch is stored as metadata, **not** a fresh namespace:
changing only the configured epoch cannot permit a previously consumed request.

Before a write, the adapter samples the exact table ARN, TableId, name, active
status, on-demand mode, deletion protection, single string partition key, no
indexes/replicas/enabled streams, and TTL ENABLED on exactly `expiresAt`. No
disabled/transitional/wrong-attribute TTL is accepted. It makes one conditional
PutItem with `attribute_not_exists(nonceKey)`. It never overwrites a retained row
because its expiry passed or because the request digest changed.

A successful put is followed by a strongly consistent read of every exact field,
then another resource/TTL sample. Only that path returns literal `true`. An
authenticated conditional collision returns `false`, after metadata recheck,
without refreshing/replacing the existing record. SDK HTTP200 alone is not a
grant. Unexpected status, retries, changed/missing readback or post-write drift
cannot authorize the gateway.

The adapter uses regional certificate-validated HTTPS, bounded sockets and
connection/request/overall deadlines, with one SDK attempt. A lost or uncertain
write reply throws only sanitized `alliance_gateway_nonce_unavailable` with
`outcome=unknown`; it faults and closes that store instance. No write retry,
cleanup, reversal or automatic recovery follows. A fresh instance still needs
the same existing conditional record to deny replay. Pre-dispatch failures use
`not_started`; invalid input/pre-cancel/busy/closed cases perform no writes.

The runtime capability permits only DescribeTable, DescribeTimeToLive, PutItem
and strong GetItem. It does not create tables, enable TTL, change settings, scan,
delete, initialize roots or expose raw SDK/table operations to Netlify. A first
claim uses six DynamoDB requests; a duplicate uses five, without application
retry. These are protocol counts, not an operating cost/capacity acceptance.

## Evidence and what remains unproven

Twenty-one focused unit tests cover metadata/TTL/key/input denial, conditional
concurrency, fresh-instance replay, config-only epoch changes, strict readback,
lost replies, cancellation/busy/deadline, expiration during work, defensive
copies, provider-credential checks and actual SDK serialization/signing against
an in-memory request handler with synthetic credentials.

The existing isolated DynamoDB Local runner now also creates one separate
synthetic nonce table. Its native fixture exercises actual conditional writes,
competing independent SDK clients, emulator disk stop/restart, lost replies
after real commits, actual TTL/deletion-protection drift, projected instance
changes, and an Ed25519-signed gateway flow whose fresh-handler replay performs
no second synthetic authority read. The fixture deletes only its own table and
clients; the existing runner owns its Java process and disposable directory.
Native CI outcome is recorded in PR #124; syntax or unit success alone does not
establish that acceptance. Local namespace creation was unavailable, so the
network-isolated native exercise runs in disposable CI, without relaxing it.

DynamoDB Local lacks AWS TableId and uses a ddblocal ARN. The fixture explicitly
projects those two metadata fields only. This is **not** hosted AWS IAM/TLS,
resource-identity, TTL-deletion timing, execution-role provenance, power-loss,
administrator exclusion, cross-Region/fleet or key-custody proof. TTL cleanup
timing is not tested or used as an overwrite permission.

## Requirements before hosted use

- Provision and review the exact dedicated table, resource ID, schema, TTL,
  protection, region and custody record; runtime code cannot provision or repair
  it. Review the finite synthetic trial and cleanup before actual AWS actions.
- Scope gateway-role permissions to the four operations on that nonce table,
  plus Invoke on the one qualified authority version. No root-table access or
  table/TTL/delete/restore administration. Verify real allowed and denied calls.
  PutItem IAM permission alone cannot enforce this module's condition expression;
  the trusted AWS gateway runtime/artifact and code integrity remain part of the
  security boundary. It is not an immutable log against a compromised writer.
- Establish externally current table/key/custody configuration, clock discipline,
  key rotation/revocation and old-producer/in-flight exclusion. Table replacement,
  record deletion, restore/rollback or a major clock rollback can invalidate
  replay assumptions. Metadata is sampled, not an administrator/fleet fence.
  Changing an epoch does not revoke old signing keys or stop an old deployment.
- Do not reset or move nonce storage while still-valid requests can be replayed.
  Recovery must close ingress and exclude old keys/producers according to a
  reviewed key/replay-window procedure. No automatic genesis, missing-table
  fallback or new nonce namespace is supplied here.
- Keep payload/header/key logging disabled or explicitly redacted; the stored key
  fingerprint, nonce and request digest are linkable metadata. Establish actual
  retention/backup access and deletion practice. TTL is asynchronous cleanup,
  not proof that data is immediately erased at expiry.
- Measure global traffic, capacity, request amplification, cost, revocation and
  failure behavior before operation. API usage-plan quotas are not hard spending
  caps. Hosted failures, signing-key custody, authority-currentness/recovery,
  account/session/content/privacy/Google/phone and assistive release gates remain.

Primary references: [conditional PutItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_PutItem.html),
[strong GetItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_GetItem.html),
[TableDescription](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TableDescription.html),
[TTL description](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DescribeTimeToLive.html),
and [TTL behavior](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html).
No public security, authorization, completed-erasure, RPO/RTO or operating backup
claim follows from this candidate.
