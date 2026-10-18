# Alliance DynamoDB authority-store candidate

Default-off source candidate for the validated account checkpoint authority.
No AWS account is connected; no table, IAM role, Lambda, key, public route or
purchase is created. This is an investigated backend, not provider adoption.

## Backing protocol and access boundary

Only trusted authority code receives the store/client/credential provider.
Application callers receive the authority's read/advance service. The store does
not replace semantic successor validation and must never be exposed as raw CAS.

Configuration pins account, US east/west region, prefixed table name, unique
table ID, exact root key and separate custody identifier. An explicit credential
provider is required; there is no default environment/profile lookup. The normal
client fixes the regional HTTPS endpoint, TLS1.2/certificate checks, two sockets,
connect/request deadlines and one SDK attempt. `openClient` is a trusted fixture
hook, never an endpoint override accepted from a public request.

DescribeTable/DescribeTimeToLive must match ARN/ID/name, ACTIVE/on-demand/single
HASH key, deletion protection, no indexes/replicas/stream, and disabled TTL.
These are sampled control-plane observations, not an administrator/restore/ABA
fence; DescribeTable metadata may be eventually consistent. Strong GetItem then
checks exact item shape, custody, generation/digest and canonical scope/key/bytes.
Missing/corrupt/foreign records refuse without initialization.

PutItem is conditional on the existing key, custody, expected generation/digest
**and complete previously read bytes**. It cannot initialize an absent item.
Conditional conflict is independently read back without retry; other failures
after dispatch are sanitized unknown outcomes. Post-write resource drift withholds
a committed receipt. The authority separately reads committed canonical bytes
before releasing evidence. A late remote commit may still happen after timeout.

One ordinary authority advance uses12 API requests: three per authority read and
six for backing CAS. A racing conditional failure adds one item read. This is a
per-operation bound, **not a global spending cap**. Fresh cost/ingress limits are
needed before hosting. Closing aborts current work and destroys owned sockets.

Runtime IAM should allow only DescribeTable/DescribeTimeToLive on one exact table
and GetItem/PutItem constrained to its one root key. Metadata/data statements need
separate conditions and verified `dynamodb:LeadingKeys` enforcement. No create,
delete, update-table, TTL, scan, stream, restore or provisioning access. IAM does
not enforce our semantic transition validation or a specific condition string;
the authority service code/execution role remains trusted. The app needs only
invocation access to one reviewed service identity/version, no table access.

Authenticated invocation and short-lived caller credentials from the actual app
host, old-credential/version refusal and global request limits are **unimplemented**.
Do not use administrator credentials as a shortcut. Initial root setup is a
separate reviewed action after fresh ledger/ack state verification; runtime never
resets authority from ordinary backups. No deployment/initialization tool exists.

## Verification and limits

Exact official SDK client3.1152.0 is lockfile-pinned; local audit reports zero
vulnerabilities. Fifteen unit tests cover disabled operation, exact binding and
table policies, SDK bounds, strong reads, absent/corrupt items, byte-bound CAS,
conflicts/lost replies, post-write drift, deadlines and authority composition.

The native Python runner verifies SHA-256-pinned official DynamoDB Local3.3.2 and
Corretto17 artifacts, then runs Node/Java in a Linux network namespace with only
loopback, dummy SDK credentials and a minimal environment. No Java installation
or account credential lookup. It kills its owned child process group on failure
and removes the exact temporary extraction/database directory.

Thirteen native PASS checkpoints cover actual local strong reads/conditional
writes, competing service/SDK clients, missing-item refusal, pending/resolution
with one synthetic business dispatch, emulator disk restart, a simulated lost
reply after a real local write, TTL/deletion-protection drift and exact cleanup.
These do not prove AWS IAM, TLS, provider durability, power-loss recovery or
independently current custody.

Local3.3.2 has a `ddblocal` ARN and **no TableId**. The fixture alone projects those
two metadata fields into its synthetic binding; all other responses are real
emulator data. Production verification has no missing-ID fallback. Projected-ID
mismatch is synthetic evidence, never a hosted resource-identity test. A changed
emulator download fails its source-pinned hash and requires reviewed updating.

Primary references: [local emulator/checksums](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.DownloadingAndRunning.html),
[Corretto downloads](https://docs.aws.amazon.com/corretto/latest/corretto-17-ug/downloads-list.html),
[GetItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_GetItem.html),
[PutItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_PutItem.html),
[DescribeTable](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DescribeTable.html).

## Before release

Hosted identity/IAM, authenticated invocation, restore exclusion/current custody,
old-producer/session/in-flight barriers, coordinated Auth/Storage recovery,
signing-key provenance/rotation and fresh metered costs remain open. Provider and
account administrators remain trusted. Never automatically accept a recreated
or restored root by name or lower a floor to make a restore work.

Canonical records carry linkable subject hashes/operation IDs, not anonymous
data. Define provider/log/backup retention and access before real members; keep
identities, profile text, images and signing secrets out. No UI changed. Future
unknown states need persistent plain text, keyboard/screen-reader access and
support outside sign-in, without timed secret entry/hash transcription. No
completed erasure, WCAG, operating-backup, RPO/RTO or public-readiness claim.
