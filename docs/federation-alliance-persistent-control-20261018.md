# Alliance persistent control candidate

Source only, October 18, 2026. The SQL is **unapplied**. No hosted project, login,
credential, signing key, backup, route or public feature is enabled. The journal
pilot stays locked. This builds the durable-policy side of the
[startup consumer](federation-alliance-startup-gate-20261018.md); independent
protected minimums, actual key custody and managed recovery remain release gates.

## Separate data and access

The candidate requires a third dedicated database/restore domain, distinct from
both member data and the deletion journal. Installation refuses either existing
data schema. One private forced-RLS singleton holds exact member/journal scope,
epoch, monotonically increasing revision, state, change ID, freeze/time, checkpoint
digest and minimum deletion sequence/hash. No profile text, account email, token,
private key or raw transaction is stored. Digests/IDs still reveal linkable metadata.

Three nonprivileged roles start NOLOGIN/password-free: owner, reader and operator.
Only the owner policy can touch the table. Reader has one fixed read function;
operator has that read plus explicit bootstrap and transition functions, without
direct table access. Helpers and table/schema access are revoked from public,
anon, authenticated and service_role. Functions use a private schema and empty
search path. No Auth/JWT/user_metadata authorization or browser key is introduced.

The runtime reader pins three different project references, the exact control
hostname, certificate/hostname validation, TLS1.2 minimum and channel binding. Each
bounded read uses a read-only transaction and verifies login identity, zero role
memberships, privileges, durable server settings and dedicated schema. Table or
column grants and schema CREATE refuse. No provider bootstrap-membership exception
is adopted for these new roles; any managed-provider requirement needs review.
Policy data is returned only after strict content/digest/scope checks and COMMIT.
There are at most two active reads, no waiting queue/retry and a 1.5-second bound.

## Deliberate, serialized transitions

Fresh installation is unconfigured and closed. Reading cannot initialize missing
authority or recover it to genesis. Explicit operator bootstrap pins scope once,
at revision1/closed/genesis. Subsequent transitions lock the singleton and compare
both expected revision and complete content digest. Exactly one contender can
commit; a stale contender receives conflict without overwriting newer policy.

Allowed transitions are closed→review, review→serve, and review/serve→closed.
Review requires a new freeze identity, canonical nonfuture time, checkpoint digest
and a deletion floor that cannot regress/fork. Advancing the floor requires the
entire bounded canonical deletion chain (at most256 records/256KiB), recomputed in
SQL with exact scope/order/hash links, unique event IDs and the prior floor prefix.
Same-floor review may supply no chain. Release and closure must preserve the exact
freeze/checkpoint/floor binding; closure does not require an available data source.
There is no direct closed→serve, automatic reopen, reset/refund or unbounded log.
The singleton holds only current policy, not a complete operator audit history.
Revision exhaustion refuses and requires operator intervention; capacity/retention
and emergency operations need production review.

Mutation functions require synchronous_commit/fsync/full_page_writes on. The public
runtime adapter has no mutation method. A future operator runner must treat a lost
commit response as unknown and reconcile by separate read; never blindly repeat
bootstrap/transition. If a later transition already replaced that change ID, the
current row cannot prove the earlier request's outcome. No automatic mutation
retry or background reconciliation service is implemented.

## Fresh signing after persistence

The disabled authority factory receives a pinned public verification key, an
independently supplied minimum revision/content digest/deletion floor, fixed
read-only store and injected signing capability. A fresh exact boot/challenge
request is copied, the committed policy read, a domain-separated decision signed
and its signature locally verified, then the policy read again. Any change drops
the response. Unknown signing, timeouts, stale/forked policy or cancellation faults
that authority instance closed; one request runs at a time without a queue.
The overall bound is three seconds (at most two store reads and one signer call).
No private-key lookup, environment transport, operator mutation or persistent-pin
writer is added. The signer has no database edit capability through this adapter.

The startup gate still requires two fresh reviews around actual paired recovery,
then a distinct newer serve decision for every permission check. Trusted wiring
must retain the same logical scope/epoch/minimum for the live deletion reader,
current Auth/session/RLS, database switches, quotas and before/after checks.
These are point-in-time checks, not a globally atomic freeze/revocation barrier.

This row persists the **reviewed startup floor**, not every later deletion. Floor
advancement currently occurs only during closed→review; no live deletion-write
bridge updates this independent store before acknowledging a new removal. The
existing deletion witness still remembers later observations only in memory.
Durably anchoring each newly acknowledged removal, and checking that latest
independent anchor during recovery, remains required before real member data.
Do not claim this increment alone prevents resurrection of all later removals.

## What persistence proves, and what it does not

Committed state survives ordinary application and database restart. A fresh signer
can refuse an older/forked store when it receives a genuinely independent newer
minimum. Its in-memory observations alone do not survive process loss. This code
does **not** supply independently protected minimum storage, signing-key custody,
rotation, recovery quorum or an external append-only witness. Never load the only
trusted minimum from the same restored database or member archive.

A privileged administrator can restore/edit all control state. A new signature
over that state cannot expose forgotten history if every trusted minimum was lost
or restored with it. A third project under one administrator is not independent
administrative custody. A valid chain proves continuity, not source completeness,
actual quiescence or that a checkpoint represents acceptable schema/Auth/Storage.
Those remain separate trusted operator and recovery checks. No unerasable-history,
full recovery, physical-erasure, production availability or automatic-backup claim.

## Verification and accessible operation

Synthetic tests cover strict canonical hashes, grants/identity/domain/TLS checks,
read-only committed output, lost replies, deadlines, signature validation and
rollback refusal against a pinned newer minimum. The native fixture runs three
actual disposable TLS/SCRAM PostgreSQL servers, composes persisted policy with
actual member/journal inventories and the startup gate, races two operators,
commits closure during signing, tests full-chain/fork refusal and read-only
reconciliation, restarts the control database and reads it from a fresh Node
process. Fixture keys remain ephemeral/in-memory and all data/roles/servers/scratch
are removed. These are synthetic local/CI tests, not a managed deployment or real
key-custody proof. No source schema is applied to a real project.

No UI changes. Future operators need plain-text unconfigured/closed/review/
prepared/released/conflict/unknown states, keyboard and assistive-compatible native
controls, paste-friendly private custody steps, and deliberate confirmations
without countdown pressure or automatic destructive recovery. Missing authority
must not look like empty member data or successful recovery. Browser, mobile,
assistive-technology and WCAG acceptance remain separate.

Before activation: protected independent minimum and signing custody/rotation,
reviewed provider/access/cost and full restore procedure, authenticated physical
freeze and fleet lifecycle, real encrypted independent-copy/schema/Auth/Storage
recovery, account removal/retention/privacy, HTTP budgets/browser recovery and
managed-host/Google-warning/assistive/publication acceptance.

References: [PostgreSQL row locks](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS)
and [safe security-definer functions](https://www.postgresql.org/docs/17/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY).
