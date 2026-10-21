# Dev computer: protected keys and first checkpoint preparation

This is a review procedure for a new, closed installation. It does not authorize
key generation, secret installation, root writes, IAM changes or activation.
Keep existing hosted functions stopped and public registration closed.

## Start from the actual dev checkout

Open the existing GFOF repository. First run only these read-only commands:

```text
git status --short
git branch --show-current
git rev-parse HEAD
node --version
```

Compare the result with the exact reviewed head in the private handoff and
PR #124. Node24 is required. Preserve any uncommitted dev work; review differences
and use an isolated checkout where needed instead of resetting the existing one.
The newer Netlify/checkpoint-preparation source and the older closed AWS packages
have different source bindings. The handoff records both; do not treat either
as a currently enabled account service.

The work-computer CloudShell paths under `/tmp` are temporary. If absent later,
rebuild the exact pinned source and dependencies using the recorded official
Node checksum and the reviewed package builder. Do not regenerate keys or reset
tables to compensate for a missing build directory.

## Protected key setup comes before generation

1. Establish the actual dev user's protected storage and independent encrypted
   backup/recovery path outside the repository and website publish directory.
   Verify permissions and recovery access first. The public setup record stores
   only fingerprints, public descriptors and receipt digests. Do not put a
   private key, database password, token or plaintext backup in chat, source,
   shell arguments/history, screenshots or build logs.
2. Use distinct keys for the preview gateway caller and the control/journal
   authorities. The new Netlify adapter accepts a canonical48-byte Ed25519 PKCS8
   DER caller key encoded as base64; its public descriptor uses SPKI DER,
   SHA-256 fingerprint and finite canonical UTC validity. There is no generated
   default key or automatic rotation. Key backup/generation and any secret
   installation still require the exact reviewed procedure.
3. Netlify storage must be marked secret, Functions-only, and limited to the
   exact reviewed branch/context. Verify actual metadata without revealing the
   value. A deploy-preview value shared with every preview is not a substitute
   for branch isolation. Other functions on an allowed deployment may still
   read a Functions-scoped value. Keep production/dev/all-context values absent.
4. Pin only public Netlify site/deploy/context metadata in an independently
   reviewed server manifest. Verify the actual deployed runtime against it.
   Retiring old deployments and key acceptance remains necessary; a new value
   does not rewrite old Netlify deployments or instantly revoke a copied key.

## First account root: separate from restart and recovery

`account-root-preparation.mjs` provides an offline first-install preparer,
exact-artifact reviewer and supplied-readback reviewer. It has no SDK, cloud,
filesystem, credential, key generation, dispatcher or apply command. It is not
imported by either runtime entry point or included in the closed Lambda ZIPs.

The preparer requires all seven explicit inputs:

| Input | Independent evidence needed |
| --- | --- |
| `resource` | Actual account/Region, authority table name and TableId, exact root key and separate custody ID |
| `scope` | Three actual distinct member/journal/control project references and reviewed account epoch |
| `verificationKey` | The independently reviewed control public key |
| `receipt` | Independently retained generation-one digest, supplied before review |
| `bytes` | Already prepared canonical generation-one checkpoint bytes |
| `tableDescription` | Actual current DescribeTable output for the dedicated authority table |
| `ttlDescription` | Actual current DescribeTimeToLive output with TTL disabled |

It does not manufacture an empty checkpoint. The supplied record must have no
pending work, no history/acknowledgement and no prior generation. The empty
history claim must come from independent installation evidence: table ItemCount
is approximate and is deliberately ignored. Existing history, pending work,
generation2+, wrong digest/scope/key and noncanonical bytes are rejected.

The prepared request binds the exact table ARN and root key, with only these
write semantics:

```text
ConditionExpression: attribute_not_exists(#root)
ExpressionAttributeNames: { "#root": "rootKey" }
ReturnValues: NONE
ReturnValuesOnConditionCheckFailure: NONE
```

It also prepares an exact-key strongly consistent GetItem request. Binary
checkpoint bytes are represented as canonical base64 in the JSON-shaped plan;
the SDK fixture explicitly converts that field back to bytes. No live request
is sent by preparing or reviewing the plan.

The artifact reviewer rejects changing/removing the condition, target, item,
read consistency or return settings and rejects additional operations. The
operator must independently retain the reviewed plan digest and checkpoint
receipt outside restored data before any separately approved first write.

After a separately approved successful write, obtain fresh table/TTL metadata
and a strong exact-key read. The readback reviewer compares the full supplied
item, including byte encoding, generation, digest and custody. Its result says
only `matchesSuppliedReadback` with `access: closed`; it is not an authorization,
commit attestation, currentness oracle or automatic update of a serving floor.

The condition prevents replacing an item at that key. It does not establish
global table emptiness or prevent delete/recreate, choosing another root key,
administrative rollback, stale operator evidence or an actor bypassing this
source. TableId is a reviewed metadata binding, not an atomic PutItem condition.
Actual permissions, admin/fleet/restore exclusion and fresh identity checks
before/after any write remain separate controls.

On a duplicate-condition failure, lost reply, timeout or uncertain dispatch,
stop. Do not retry the write, reset the record, initialize a different key or
infer success from a later convenient read. Reconcile against independently
retained evidence through a separately reviewed procedure. A missing root on
restart is a recovery incident; this first-install tool is not its recovery path.

## What follows a completed custody review

1. Review actual managed-domain schema/role separation and the independent
   current checkpoint. No project reference or initial root comes from examples.
2. Assemble exact public installation manifests, enabled code artifacts and
   immutable numeric Lambda versions. A mutable `$LATEST` closed package cannot
   satisfy the runtime's numeric-version checks.
3. Review exact IAM identities/boundaries, API integration and resource policy,
   key scope, logging/retention, rate controls and finite trial inventory before
   any privilege/ingress/concurrency change.
4. Follow the bounded trial proposal, then close ingress, return concurrency0,
   retire old acceptance and preserve consumed nonces. Do not delete custody
   records or remove table protection as routine teardown.
5. Complete Google clearance, actual sign-in/phone, member privacy/abuse/recovery
   and assistive checks before opening public joining.

## Verification limits

Unit tests check missing/changed bindings, generation/history/pending refusal,
canonical bytes, protected table metadata, exact guard/target review, readback
and input-copy isolation. The existing confirmed DynamoDB Local fixture also
exercises the prepared condition against the real isolated local data API:
both duplicate and different generation-one overwrites fail, and an exact
strong readback remains unchanged. The fixture's ARN/TableId/name projections
are explicitly test-only. They prove neither hosted AWS identity/IAM nor real
project emptiness, protected key custody or production recovery.

Primary AWS references reviewed October19:
[PutItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_PutItem.html),
[conditional writes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html),
and [strong exact-item reads](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithItems.html).
